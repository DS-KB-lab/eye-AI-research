#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

import fitz
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
LIB_DIR = ROOT / 'library'
PDF_DIR = LIB_DIR / 'pdfs'
TEXT_DIR = LIB_DIR / 'text'
FIG_DIR = LIB_DIR / 'figures'
ARTIFACTS = DATA_DIR / 'paper-artifacts.json'
HEADERS = {"User-Agent": "Mozilla/5.0 (Eye-AI-Research-Bot)"}


def ensure_dirs():
    for d in [PDF_DIR, TEXT_DIR, FIG_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def load_json(path: Path):
    return json.loads(path.read_text())


def save_json(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def clean_filename(s: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]+', '-', s).strip('-').lower()


def fetch(url: str) -> requests.Response:
    r = requests.get(url, headers=HEADERS, timeout=45)
    r.raise_for_status()
    return r


def discover_pdf_url(page_url: str) -> str:
    if 'arxiv.org/abs/' in page_url:
        return page_url.replace('/abs/', '/pdf/') + '.pdf'
    html = fetch(page_url).text
    soup = BeautifulSoup(html, 'html.parser')
    for sel in [
        'meta[name="citation_pdf_url"]',
        'meta[property="og:pdf"]',
        'meta[name="dc.identifier"]'
    ]:
        node = soup.select_one(sel)
        if node and node.get('content'):
            c = node['content']
            if c.endswith('.pdf'):
                return c
    for a in soup.find_all('a', href=True):
        href = a['href']
        if '.pdf' in href.lower():
            return urljoin(page_url, href)
    return ''


def download_pdf(paper_id: str, page_url: str, pdf_url: str = '') -> Path:
    resolved = pdf_url or discover_pdf_url(page_url)
    if not resolved:
        raise RuntimeError(f'No PDF URL found for {paper_id}')
    out = PDF_DIR / f'{clean_filename(paper_id)}.pdf'
    if out.exists() and out.stat().st_size > 0:
        return out
    r = fetch(resolved)
    if 'pdf' not in r.headers.get('content-type', '').lower() and not resolved.lower().endswith('.pdf'):
        raise RuntimeError(f'URL did not return PDF for {paper_id}: {resolved}')
    out.write_bytes(r.content)
    return out


def extract_text(pdf_path: Path, paper_id: str) -> str:
    doc = fitz.open(pdf_path)
    chunks = []
    max_pages = min(4, doc.page_count)
    for i in range(max_pages):
        chunks.append(doc.load_page(i).get_text('text'))
    text = '\n'.join(chunks)
    (TEXT_DIR / f'{clean_filename(paper_id)}.txt').write_text(text)
    return text


def heuristic_summary(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    patterns = [r'Abstract\s*(.+?)(Introduction|1\.|I\.)', r'ABSTRACT\s*(.+?)(Introduction|1\.|I\.)']
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:900]
    return text[:900].strip()


def extract_images(pdf_path: Path, paper_id: str, min_dim: int = 220):
    out_dir = FIG_DIR / clean_filename(paper_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    saved = []
    for page_index in range(min(doc.page_count, 8)):
        page = doc.load_page(page_index)
        images = page.get_images(full=True)
        for img_idx, img in enumerate(images):
            xref = img[0]
            base = doc.extract_image(xref)
            if not base:
                continue
            width = base.get('width', 0)
            height = base.get('height', 0)
            if width < min_dim or height < min_dim:
                continue
            ext = base.get('ext', 'png')
            out = out_dir / f'p{page_index+1:02d}-{img_idx+1:02d}.{ext}'
            out.write_bytes(base['image'])
            saved.append({
                'path': str(out.relative_to(ROOT)),
                'page': page_index + 1,
                'width': width,
                'height': height
            })
    return saved


def choose_model_figure(candidates):
    if not candidates:
        return ''
    ranked = sorted(candidates, key=lambda x: (x['width'] * x['height']), reverse=True)
    return ranked[0]['path']


def run_sync():
    ensure_dirs()
    papers = {p['id']: p for p in load_json(DATA_DIR / 'papers.json')['papers']}
    sources = load_json(DATA_DIR / 'paper-sources.json')['papers']
    artifacts = {'updated_at': None, 'papers': {}}
    for src in sources:
        pid = src['id']
        try:
            pdf = download_pdf(pid, src['page_url'], src.get('pdf_url', ''))
            text = extract_text(pdf, pid)
            images = extract_images(pdf, pid)
            artifacts['papers'][pid] = {
                'pdf_path': str(pdf.relative_to(ROOT)),
                'text_path': str((TEXT_DIR / f'{clean_filename(pid)}.txt').relative_to(ROOT)),
                'image_candidates': images,
                'selected_model_figure': choose_model_figure(images),
                'heuristic_summary': heuristic_summary(text)
            }
        except Exception as e:
            artifacts['papers'][pid] = {'error': str(e)}
    artifacts['updated_at'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
    save_json(ARTIFACTS, artifacts)

    changed = False
    papers_obj = load_json(DATA_DIR / 'papers.json')
    for p in papers_obj['papers']:
        meta = artifacts['papers'].get(p['id'], {})
        sel = meta.get('selected_model_figure')
        if sel and p.get('model_figure_url_or_path', '').endswith('placeholder-model.svg'):
            p['model_figure_url_or_path'] = sel
            changed = True
        hs = meta.get('heuristic_summary')
        if hs and len(p.get('summary', '')) < 40:
            p['summary'] = hs
            changed = True
    if changed:
        save_json(DATA_DIR / 'papers.json', papers_obj)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'sync'
    if cmd == 'sync':
        run_sync()
        print('sync complete')
    else:
        raise SystemExit(f'Unknown command: {cmd}')


if __name__ == '__main__':
    main()

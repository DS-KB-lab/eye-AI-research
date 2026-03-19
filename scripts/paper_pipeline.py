#!/usr/bin/env python3
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import fitz
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
LIB_DIR = ROOT / "library"
PDF_DIR = LIB_DIR / "pdfs"
TEXT_DIR = LIB_DIR / "text"
FIG_DIR = LIB_DIR / "figures"
PUBLIC_FIG_DIR = ROOT / "assets" / "figures"
ARTIFACTS = DATA_DIR / "paper-artifacts.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (Eye-AI-Research-Bot)"}


def ensure_dirs():
    for directory in [PDF_DIR, TEXT_DIR, FIG_DIR, PUBLIC_FIG_DIR]:
        directory.mkdir(parents=True, exist_ok=True)


def load_json(path: Path):
    return json.loads(path.read_text())


def save_json(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def clean_filename(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-").lower()


def fetch(url: str) -> requests.Response:
    response = requests.get(url, headers=HEADERS, timeout=45, allow_redirects=True)
    response.raise_for_status()
    return response


def is_pdf_response(response: requests.Response, url: str) -> bool:
    content_type = response.headers.get("content-type", "").lower()
    return "pdf" in content_type or url.lower().endswith(".pdf")


def publisher_pdf_candidates(page_url: str):
    candidates = []
    if "arxiv.org/abs/" in page_url:
        candidates.append(page_url.replace("/abs/", "/pdf/") + ".pdf")
    if "nature.com/articles/" in page_url and not page_url.lower().endswith(".pdf"):
        candidates.append(page_url.rstrip("/") + ".pdf")
    if "openaccess.thecvf.com/" in page_url and page_url.endswith("_paper.html"):
        candidates.append(page_url.replace("/html/", "/papers/").replace("_paper.html", "_paper.pdf"))
    if "proceedings.neurips.cc/paper_files/paper/" in page_url and page_url.endswith("-Abstract-Conference.html"):
        candidates.append(page_url.replace("/hash/", "/file/").replace("-Abstract-Conference.html", "-Paper-Conference.pdf"))
    if "sciencedirect.com/science/article/pii/" in page_url and "/pdfft?" not in page_url:
        candidates.append(page_url.rstrip("/") + "/pdfft?isDTMRedir=true&download=true")
    return candidates


def resolve_pubmed_page(page_url: str, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    doi_meta = soup.select_one('meta[name="citation_doi"]')
    if doi_meta and doi_meta.get("content"):
        return f"https://doi.org/{doi_meta['content'].strip()}"
    for link in soup.find_all("a", href=True):
        href = urljoin(page_url, link["href"])
        if "doi.org/" in href:
            return href
    for link in soup.find_all("a", href=True):
        href = urljoin(page_url, link["href"])
        if any(host in href for host in ["ieeexplore.ieee.org", "sciencedirect.com", "nature.com"]):
            return href
    return page_url


def resolve_page_url(page_url: str) -> str:
    if "pubmed.ncbi.nlm.nih.gov" not in page_url:
        return page_url
    html = fetch(page_url).text
    return resolve_pubmed_page(page_url, html)


def discover_pdf_urls(page_url: str, pdf_url: str = ""):
    candidates = []
    if pdf_url:
        candidates.append(pdf_url)
    candidates.extend(publisher_pdf_candidates(page_url))

    html = fetch(page_url).text
    soup = BeautifulSoup(html, "html.parser")
    for selector in [
        'meta[name="citation_pdf_url"]',
        'meta[property="og:pdf"]',
        'meta[name="dc.identifier"]'
    ]:
        node = soup.select_one(selector)
        if node and node.get("content"):
            content = node["content"].strip()
            if ".pdf" in content.lower():
                candidates.append(urljoin(page_url, content))

    for link in soup.find_all("a", href=True):
        href = link["href"].strip()
        if ".pdf" in href.lower() or "/pdfft?" in href.lower():
            candidates.append(urljoin(page_url, href))

    for match in re.findall(r"https?://[^\"'\\s]+(?:\\.pdf|/pdfft\\?[^\"'\\s]+)", html):
        candidates.append(match)
    for match in re.findall(r"/science/article/pii/[^\"'\\s]+/pdfft\\?[^\"'\\s]+", html):
        candidates.append(urljoin(page_url, match))

    deduped = []
    seen = set()
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        deduped.append(candidate)
        seen.add(candidate)
    return deduped


def download_pdf(paper_id: str, page_url: str, pdf_url: str = ""):
    resolved_page = resolve_page_url(page_url)
    candidates = discover_pdf_urls(resolved_page, pdf_url)
    if not candidates:
        raise RuntimeError(f"No PDF URL found for {paper_id}")

    out = PDF_DIR / f"{clean_filename(paper_id)}.pdf"
    if out.exists() and out.stat().st_size > 0:
        return out, resolved_page, candidates[0]

    last_error = None
    for candidate in candidates:
        try:
            response = fetch(candidate)
            if not is_pdf_response(response, candidate):
                raise RuntimeError(f"URL did not return PDF for {paper_id}: {candidate}")
            out.write_bytes(response.content)
            return out, resolved_page, candidate
        except Exception as exc:  # noqa: PERF203
            last_error = exc
    if last_error:
        raise last_error
    raise RuntimeError(f"Failed to download PDF for {paper_id}")


def extract_text(pdf_path: Path, paper_id: str) -> str:
    document = fitz.open(pdf_path)
    chunks = []
    for page_index in range(min(4, document.page_count)):
        chunks.append(document.load_page(page_index).get_text("text"))
    text = "\n".join(chunks)
    (TEXT_DIR / f"{clean_filename(paper_id)}.txt").write_text(text)
    return text


def heuristic_summary(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    patterns = [r"Abstract\s*(.+?)(Introduction|1\.|I\.)", r"ABSTRACT\s*(.+?)(Introduction|1\.|I\.)"]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()[:900]
    return text[:900].strip()


def extract_images(pdf_path: Path, paper_id: str, min_dim: int = 220):
    out_dir = FIG_DIR / clean_filename(paper_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(pdf_path)
    saved = []
    for page_index in range(min(document.page_count, 10)):
        page = document.load_page(page_index)
        for image_index, image in enumerate(page.get_images(full=True)):
            xref = image[0]
            base = document.extract_image(xref)
            if not base:
                continue
            width = base.get("width", 0)
            height = base.get("height", 0)
            if width < min_dim or height < min_dim:
                continue
            ext = base.get("ext", "png")
            out = out_dir / f"p{page_index + 1:02d}-{image_index + 1:02d}.{ext}"
            out.write_bytes(base["image"])
            saved.append({
                "path": str(out.relative_to(ROOT)),
                "page": page_index + 1,
                "width": width,
                "height": height
            })
    return saved


def figure_score(candidate):
    area = candidate["width"] * candidate["height"]
    aspect = candidate["width"] / max(candidate["height"], 1)
    page = candidate["page"]
    page_bonus = 1.35 if page in {2, 3, 4} else 1.15 if page == 5 else 0.92 if page == 6 else 0.7
    aspect_bonus = 1.25 if 1.15 <= aspect <= 3.6 else 0.95 if aspect >= 0.9 else 0.55
    return area * page_bonus * aspect_bonus


def choose_model_figure(candidates):
    if not candidates:
        return ""
    return max(candidates, key=figure_score)["path"]


def promote_public_figure(selected_path: str, paper_id: str) -> str:
    if not selected_path:
        return ""
    source = ROOT / selected_path
    if not source.exists():
        return ""
    destination = PUBLIC_FIG_DIR / f"{clean_filename(paper_id)}{source.suffix.lower()}"
    if source.resolve() != destination.resolve():
        shutil.copyfile(source, destination)
    return str(destination.relative_to(ROOT))


def run_sync():
    ensure_dirs()
    papers_obj = load_json(DATA_DIR / "papers.json")
    source_rows = load_json(DATA_DIR / "paper-sources.json")["papers"]
    artifacts = {"updated_at": None, "papers": {}}

    for source_row in source_rows:
        paper_id = source_row["id"]
        try:
            pdf_path, resolved_page, resolved_pdf = download_pdf(
                paper_id,
                source_row["page_url"],
                source_row.get("pdf_url", "")
            )
            text = extract_text(pdf_path, paper_id)
            images = extract_images(pdf_path, paper_id)
            selected_figure = choose_model_figure(images)
            public_figure = promote_public_figure(selected_figure, paper_id)
            artifacts["papers"][paper_id] = {
                "page_url": resolved_page,
                "resolved_pdf_url": resolved_pdf,
                "pdf_path": str(pdf_path.relative_to(ROOT)),
                "text_path": str((TEXT_DIR / f"{clean_filename(paper_id)}.txt").relative_to(ROOT)),
                "image_candidates": images,
                "selected_model_figure": selected_figure,
                "public_figure_path": public_figure,
                "heuristic_summary": heuristic_summary(text)
            }
        except Exception as exc:  # noqa: PERF203
            artifacts["papers"][paper_id] = {
                "page_url": source_row["page_url"],
                "pdf_url": source_row.get("pdf_url", ""),
                "error": str(exc)
            }

    artifacts["updated_at"] = datetime.utcnow().isoformat() + "Z"
    save_json(ARTIFACTS, artifacts)

    changed = False
    for paper in papers_obj["papers"]:
        meta = artifacts["papers"].get(paper["id"], {})
        public_figure = meta.get("public_figure_path")
        if public_figure and paper.get("model_figure_url_or_path") != public_figure:
            paper["model_figure_url_or_path"] = public_figure
            changed = True
        heuristic = meta.get("heuristic_summary")
        if heuristic and len(paper.get("summary", "")) < 40:
            paper["summary"] = heuristic
            changed = True
    if changed:
        save_json(DATA_DIR / "papers.json", papers_obj)


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "sync"
    if command == "sync":
        run_sync()
        print("sync complete")
        return
    raise SystemExit(f"Unknown command: {command}")


if __name__ == "__main__":
    main()

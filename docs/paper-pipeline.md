# Local paper pipeline

This repository includes a local-first paper pipeline for the strict public library.

## What it does
- downloads PDFs into `library/pdfs/`
- extracts early-page text into `library/text/`
- extracts candidate images into `library/figures/<paper-id>/`
- generates `data/paper-artifacts.json` locally
- lets you promote selected model figures into `assets/figures/`

## Public vs local
- **Public dataset**: `data/papers.json`
- **Public figures**: `assets/figures/`
- **Local-only artifacts**: PDFs, extracted text, raw figure candidates, and `data/paper-artifacts.json`

The public site now follows a strict venue-first policy. Non-whitelisted papers should not stay in `data/papers.json`, even if they remain useful in a local watchlist.

## Environment
```bash
cd /Users/mortal/.openclaw/workspace/publish/eye-AI-research
. .venv/bin/activate
python scripts/paper_pipeline.py sync
```

## Main inputs
- `data/papers.json` — public site dataset
- `data/paper-sources.json` — official source/page/PDF URLs for the public strict library

## Notes
- some journal pages expose PDFs directly; others only expose article pages or DOI redirects
- conference PDFs are usually the easiest to automate
- the largest extracted image is not always the true architecture figure, so public promotion still needs review

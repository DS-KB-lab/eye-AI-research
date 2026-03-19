# Local paper pipeline

This repository now includes a local-first paper pipeline.

## What it does
- download PDFs into `library/pdfs/`
- extract early-page text into `library/text/`
- extract candidate images into `library/figures/<paper-id>/`
- generate `data/paper-artifacts.json`
- select a best-effort candidate model figure

## Environment
Use the repo-local virtual environment:

```bash
cd /Users/mortal/.openclaw/workspace/publish/eye-AI-research
. .venv/bin/activate
python scripts/paper_pipeline.py sync
```

## Data files
- `data/papers.json` — public site dataset
- `data/paper-sources.json` — source URLs for download
- `data/paper-artifacts.json` — generated local extraction artifacts

## Notes
- arXiv sources are the easiest to automate.
- some journal pages may not expose direct PDF links cleanly.
- image extraction is best-effort; the largest image is not always the true model diagram.
- the next step is to add a review pass that promotes the right image into the site intentionally.

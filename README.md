# Ophthalmic AI Paper Hub

A static GitHub Pages website for sharing and organizing ophthalmic AI papers.

## Focus areas

- Ophthalmic foundation models
- Visual grounding & region-text alignment
- Parameter-efficient fine-tuning (PEFT)
- Hyperbolic methods

## Site structure

- `index.html` — homepage
- `papers/index.html` — searchable paper list
- `topics/*.html` — topic pages
- `updates/index.html` — update log / automation-ready page
- `data/papers.json` — curated seed dataset
- `assets/css/style.css` — styling
- `assets/js/site.js` — theme toggle + client-side rendering/filtering
- `assets/images/*.svg` — logo and placeholder figures

## Local preview

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## GitHub Pages

This repository is designed to deploy directly from the repository root on the default branch.

## Editorial direction

This is a paper-sharing site, not a project homepage. The priority is:

1. useful paper selection,
2. concise summaries,
3. original links,
4. clean topic structure,
5. model figures over time.

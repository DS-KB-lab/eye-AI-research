# Eye AI Research

A static GitHub Pages site for tracking ophthalmic AI research across:

- Ophthalmic foundation models
- Visual grounding & region-text alignment
- Parameter-efficient fine-tuning (PEFT)
- Hyperbolic methods

## Structure

- `index.html` — homepage
- `papers/index.html` — searchable paper index
- `topics/*.html` — topic landing pages
- `updates/index.html` — automation-ready update log
- `data/papers.json` — seed dataset
- `assets/css/style.css` — site styling
- `assets/js/site.js` — theme toggle + client-side rendering/filtering
- `assets/images/*.svg` — logo and placeholders

## Local preview

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Publish to GitHub Pages

1. Push to the repository default branch.
2. Enable GitHub Pages from the repository settings.
3. Set source to **Deploy from a branch**.
4. Choose the default branch and **/(root)**.

## Current status

This is a first public version with a deliberately small seed dataset. The next priorities are:

1. Add more verified ophthalmic foundation model papers.
2. Expand visual grounding entries using a broader region-text alignment lens.
3. Add PEFT papers under LoRA / adapters / prompt tuning terminology.
4. Add hyperbolic papers, starting with transferable methods and any direct ophthalmic hits.
5. Replace placeholder figures with paper-native model diagrams or clean redraws.

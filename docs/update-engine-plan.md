# Paper Update Engine Plan

This site needs more than a static JSON file. It needs a repeatable update engine.

## Goal
Automatically discover, review, and enrich new ophthalmic AI papers.

## Core pipeline
1. Search target venues and trusted sources
2. Extract candidate papers
3. De-duplicate against existing `data/papers.json`
4. Enrich metadata
5. Generate concise summaries
6. Attach original links
7. Collect or redraw core model figures
8. Append updates to the site

## Venue-first policy (Mar 19, 2026)
- New papers are selected strictly from venues listed in `../venues-list.md`.
- For ophthalmic topics (foundation-models, visual-grounding, PEFT), prefer ophthalmic-focused works within those venues; when ophthalmic papers are sparse, allow closely related medical-imaging works from the same venue list and label them as such.
- Hyperbolic topic may include general-method papers from allowed CS venues (CVPR/ICCV/ECCV, ICLR/NeurIPS/ICML/AAAI, TPAMI/IJCV/TIP, etc.).
- Source links prioritize official venue pages (CVF/IEEE/Elsevier/Nature/OpenReview), DOIs, or PubMed. Avoid relying solely on preprints when an archival venue exists.
- Keep PDFs, extracted text, raw figure candidates, and `data/paper-artifacts.json` local; only curated figures promoted into `assets/figures/` should become public.
- The public dataset may keep `npj Digital Medicine` only as an explicit supplemental journal exception; other non-whitelist sources should not remain public.

## Target search sources
- Nature / Nature family
- IEEE TMI / JBHI / TBME / TPAMI / TIP / TMM
- Medical Image Analysis
- CVPR / ICCV / ECCV
- ICLR / NeurIPS / ICML / AAAAI
- ACL
- arXiv (supporting source, not the only source)
- PubMed / DOI pages

## Search dimensions
- topic
- venue
- year
- modality
- disease
- paper type (journal / conference / preprint / benchmark)

## Required enrichment fields
- title
- venue
- venue_type
- year
- priority
- highlight
- original link
- concise summary
- modality
- task tags
- disease tags
- DOI
- code URL
- model figure path
- notes

## Figure policy
For every important paper, try in order:
1. official paper figure
2. official project/repo figure
3. clean redrawn diagram
4. placeholder

## Suggested next implementation
- create `data/paper-sources.json`
- create `scripts/update_papers.py`
- create `data/updates.json`
- add a cron job that refreshes the dataset daily or weekly
- add a manual review step before publishing newly found papers

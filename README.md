# VC Scout — MVP (Open Source Enrichment)

Overview
A thesis-first VC discovery interface (discover → profile → enrich → act). This MVP uses server-side HTML parsing (Cheerio) to extract structured fields from public pages — no external LLM API keys required.

Key features
- Companies list with search and pagination
- Company profile with Enrich button
- Server-side enrichment using open-source parsing (Cheerio)
- localStorage caching for enrichment results
- Deployable to Vercel

Local setup
1. `git clone <repo>`
2. `npm install`
3. `cp .env.example .env` (no API key required for default extraction)
4. `npm run dev`

API
- `POST /api/enrich` body: `{ "url": "...", "companyId": "..." }`
- Response: `{ summary, whatTheyDo, keywords, derivedSignals, sources }`

Notes
- This MVP uses heuristics and HTML parsing; it is not a full LLM extractor.
- For JS-heavy sites, results may be limited; consider a rendering service for complex pages.

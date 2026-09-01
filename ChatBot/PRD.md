# Product Requirements Document (PRD)
## branv.in — AI Customer-Support & Outfit-Recommendation Agent

| Field | Value |
|---|---|
| **Product** | AI chatbot + recommendation agent for www.branv.in |
| **Version** | v1.0 (draft) |
| **Date** | 2026-08-31 |
| **Owner** | aiteam@deccansoft.net |
| **Status** | In design — pending approval |
| **Frameworks** | LangChain (components) + LangGraph (orchestration) |

---

## 1. Executive Summary
branv.in is a curated men's-fashion **affiliate** platform (no inventory, no payments, no orders — "Buy
Now" redirects to Amazon/Flipkart). This project adds an embedded, real-time, human-like **chatbot +
outfit-recommendation agent** that answers customer queries and recommends products grounded in the
site's own catalog via a **RAG** pipeline, gives styling advice grounded in curated fashion knowledge,
supports multiple Indian languages, and gracefully handles budget/price questions without ever quoting a
(volatile) price. The agent's intelligence fuses four sources: **product-catalog RAG (KB1) + a distilled
Styling Knowledge Base (KB2) + database structured filters + LLM reasoning.**

## 2. Background & Problem Statement
- Shoppers browsing an affiliate catalog need help **finding products** and **assembling coordinated
  outfits**, but the site has **no search/filter UI** and no assistant today.
- Live retailer prices **fluctuate with sales**; storing them produces stale, trust-damaging numbers.
  Price was therefore deliberately removed — but users still ask budget/premium questions.
- Generic RAG bots hallucinate products, prices, and dead affiliate links — unacceptable on a
  revenue-through-trust affiliate site.
- Outfit/colour matching needs real styling intelligence, not keyword matching or ungrounded LLM guesses.

## 3. Goals & Non-Goals
### 3.1 Goals
- G1: Answer product and navigational questions grounded in the live catalog.
- G2: Recommend coordinated, colour-matched outfits (multi-item) with working affiliate links.
- G3: Handle vague requests by asking clarifying questions until context is sufficient.
- G4: Handle budget/premium intent **without quoting any price**, via graceful pivot to value tiers.
- G5: Support English, Hindi, and other Indian languages (detect + respond in-language).
- G6: Never hallucinate a product, price, collection, or affiliate link; never surface dead links.
- G7: Stay fresh in near real time as products are added/updated/removed.

### 3.2 Non-Goals (v1)
- No payments, cart, orders, inventory, or order tracking (affiliate model).
- No live price display or price tracking.
- No human-agent handoff/ticketing (leave a graph stub for future).
- No generic web Q&A outside men's-wear scope.

## 4. Target Users
- **Shoppers** on branv.in seeking product discovery, styling help, and outfit ideas.
- **Store owner/admin** (you) who uploads products as-is and curates value/styling knowledge.

## 5. Scope
### 5.1 In scope
Product Q&A, outfit-builder with clarification loop, styling advice, navigational/meta answers,
budget-intent handling via value tiers, multilingual chat, multi-LLM with fallback, evaluation harness.
### 5.2 Out of scope
See Non-Goals (§3.2).

---

## 6. Functional Requirements

### 6.1 Data & Ingestion
- **FR-1** Products are ingested **as-is** with fields: `product_id`, `name`, `brand`, `category`,
  `subcategory`, `colour[]` (multi-value), `retailer` (Amazon/Flipkart), `affiliate_url`, `image_url`,
  `active`. **No price field.**
- **FR-2** Ingestion runs on the **write-path** (product create/update/delete via DB/API, not HTML
  scraping). Idempotent upsert keyed by `product_id`.
- **FR-3** A per-product **searchable text** (name + brand + category + subcategory + colour) is embedded
  with a **multilingual** embedding model; re-embed only when that text changes (text-hash gated).
- **FR-4** On delete/unpublish → set `active = false`. **Every retrieval MUST filter `active = true`**
  (guarantees no dead affiliate links).
- **FR-5** Store embeddings + structured columns in **Postgres + pgvector**; build hybrid-search indexes
  (HNSW/IVFFlat on vector, GIN on full-text, btree on brand/category/subcategory/colour).

### 6.2 Value / Premium Inference
- **FR-6** Derive a `value_tier` (Value / Smart / Premium / Luxury) **at ingestion** from **brand
  (primary) + product-name keywords (secondary)** — not per query.
- **FR-7** Maintain a **brand → tier knowledge base**: new brands are LLM-classified once, cached, and
  **reviewable/overridable** by the admin.
- **FR-8** `value_tier` is stored on the product and used as a retrieval filter.

### 6.3 Retrieval (KB1)
- **FR-9** Use **hybrid retrieval**: dense (semantic) + BM25/full-text (exact brand & product-name),
  fused with Reciprocal Rank Fusion.
- **FR-10** Apply structured **metadata filters** (colour, category, subcategory, brand, `value_tier`)
  AND `active = true` before/with ranking.

### 6.4 Styling Knowledge Base (KB2)
- **FR-11** Build an **evergreen** styling KB: the LLM generates a **normalized rule-set**
  (colour-compatibility map, formality-pairing rules, occasion→outfit templates), **seeded by a few
  authority reference links** (e.g. Lookastic, The Formal Club, Bear House).
- **FR-12** The rule-set is **materialized once into a structured, reviewable table** (not improvised
  live). Store distilled **facts**, not verbatim source text (copyright/ToS-safe).
- **FR-13** Storage = **structured rules + a small RAG layer** (short "why" notes) for nuance.
- **FR-14** KB2 refreshes **periodically** (evergreen); adding reference links → regenerate, no
  re-architecture.

### 6.5 Orchestration Graph (LangGraph)
- **FR-15** **Input guard**: rate-limit, prompt-injection neutralization, PII scrub.
- **FR-16** **Language detection**: capture the user's language; answer in the same language.
- **FR-17** **History-aware query rewrite**: resolve follow-ups ("cheaper ones", "in blue instead") into
  standalone queries using conversation memory.
- **FR-18** **Router + light extraction** (structured output): intent ∈ {`product_recommend`,
  `outfit_builder`, `style_advice`, `navigational`, `off_topic`, `budget_intent`} + filters
  (category, brand, colour, value intent).
- **FR-19** **Conditional branches** per intent (see §7 flows).
- **FR-20** **Clarification loop (no cap)**: for vague requests, ask needed questions until context is
  sufficient; **never re-ask** what the user already answered (LangGraph `interrupt` + persisted state).
- **FR-21** **Outfit compose**: pull KB2 rules + real candidate products per slot; the LLM composes the
  best-looking grounded combo with brief reasons + buy-links.
- **FR-22** **Generation (streamed)**: recommend **real products only**; quote `affiliate_url` + image
  **verbatim from metadata**; **never quote a price**; never invent a product/brand/collection; if
  nothing matches, say so + suggest the nearest option.
- **FR-23** **Output guard**: verify every product/link in the answer exists in the retrieved context and
  contains no price; regenerate on violation.
- **FR-24** **Memory**: LangGraph **Postgres checkpointer** (same DB), keyed by session/thread id.

### 6.6 Budget-Intent Handling
- **FR-25** For price/budget queries ("under ₹500", "cheap", "premium"): **acknowledge once**, state
  honestly that pricing is live on the retailer's page, and **pivot to the inferred `value_tier`** with
  **descriptive** language (never a fabricated collection name), **preserving the user's stated style**
  (budget+formal → value-formal). Do not repeat the price disclaimer within the same conversation.

### 6.7 Multi-LLM
- **FR-26** Provider-agnostic chat model with **one primary + automatic fallback** (`.with_fallbacks`)
  across the configured providers/keys/endpoints.

---

## 7. Key User Flows

### 7.1 Attribute query
"navy formal shirts" → router=`product_recommend`, filters {colour=navy, subcategory=formal} → hybrid
retrieval (`active=true`) → grounded list with buy-links.

### 7.2 Outfit builder (marquee)
"premium looking formal combination with sneakers for my birthday"
→ intent=`outfit_builder`; aesthetic=premium; occasion=birthday
→ value inference filters to Premium-tier brands
→ clarify loop (no cap): "Any colour preference — classic white, or bolder?" … until context complete
→ KB2 styling rules + real products per slot → LLM composes colour-matched combo + reasons + buy-links.

### 7.3 Budget intent
"show me a look under ₹1000" → acknowledge once + honest price note + pivot to Value-tier products in the
same requested style + CTA. No number quoted.

### 7.4 Navigational / meta
"is this an affiliate site?" → answer from Help/policy content (affiliate disclosure, how buy-links work).

### 7.5 Off-topic
"who is the PM of India?" → templated refuse + redirect to men's-wear scope.

### 7.6 Multilingual
Hindi query → detected → retrieved + answered in Hindi with correct products.

---

## 8. System Architecture (Components)
| Component | Responsibility |
|---|---|
| Ingestion worker | website/DB → pgvector; hash-gated re-embed; delete→`active=false`; compute `value_tier` |
| Brand→tier KB | curated map + one-time LLM classify for new brands (cached, overridable) |
| Styling KB (KB2) | LLM-generated pairing/colour/occasion rules seeded by refs; structured + RAG; periodic refresh |
| Retrieval module | hybrid (dense + BM25 / RRF) + metadata filter; `active=true` always |
| LangGraph app | guards, language, rewrite, router, branches, clarify-loop, compose, generation, output-guard |
| Multilingual layer | multilingual embeddings + detect-and-respond-in-language |
| LLM provider layer | primary + `.with_fallbacks()` across keys/endpoints |
| Memory | LangGraph Postgres checkpointer (session threads) |
| Eval harness | golden set + grounding/link/language/tier metrics + LangSmith tracing |
| Chat widget API | streaming endpoint; session id → checkpointer thread |

## 9. Data Model (high level)
- **products**: `product_id` (PK), `name`, `brand`, `category`, `subcategory`, `colour[]`, `retailer`,
  `affiliate_url`, `image_url`, `value_tier`, `active`, `searchable_text`, `embedding vector(N)`, `tsv`,
  `text_hash`, `updated_at`.
- **brand_tier**: `brand` (PK), `tier`, `source` (auto/reviewed).
- **styling_rules**: structured pairing/formality/occasion rules (+ small RAG notes store).
- **help_content**: policy / affiliate-disclosure / navigational snippets (embedded).
- **checkpoints**: LangGraph conversation state (managed by checkpointer).

## 10. Non-Functional Requirements
- **NFR-1 Freshness**: a new/updated product is retrievable within seconds of the write; removed products
  never appear.
- **NFR-2 Grounding**: hallucinated-product/price/link rate = **0** (enforced by output guard).
- **NFR-3 Latency**: streamed first token fast enough for a live chat widget; semantic cache for repeated
  navigational/FAQ queries.
- **NFR-4 Reliability**: automatic LLM fallback on provider error/rate-limit.
- **NFR-5 Multilingual**: correct language detection + in-language responses for supported languages.
- **NFR-6 Security/Safety**: prompt-injection hardening; output link/product whitelist; PII scrub; user
  text treated as data, not instructions.
- **NFR-7 Observability**: LangSmith tracing on every node; misroutes logged to grow the golden set.
- **NFR-8 Legal**: KB2 stores distilled facts, not verbatim third-party text; respect robots.txt/ToS.

## 11. Technical Stack
Postgres + **pgvector**; **langchain-postgres** (`PGVectorStore`, `HybridSearchConfig`,
`reciprocal_rank_fusion`); **LangGraph** + `langgraph-checkpoint-postgres`; multilingual embeddings;
provider-agnostic chat models with fallback (one primary + others); LangSmith; RAGAS for eval.

## 12. Phased Roadmap
- **Phase 0 — Data & environment audit**: confirm product schema, add-flow (ingestion hook), embedding
  model + dimension, brand list, Help/policy content.
- **Phase 1 — Ingestion & index**: write-path ingestion, hybrid index, `value_tier` derivation.
- **Phase 2 — Core graph**: single-turn Q&A path (guards, router, retrieval, generation, output guard,
  memory, multilingual, LLM fallback).
- **Phase 3 — Outfit-builder**: KB2 build + clarification loop + compose.
- **Phase 4 — Evaluation & hardening**: golden set, RAGAS, LangSmith, budget/pivot + language tests.

## 13. Success Metrics / Acceptance Criteria
- Retrieval hit-rate@k on the golden set ≥ target.
- **Hallucinated-link / hallucinated-price rate = 0.**
- Router-intent accuracy ≥ target; `value_tier` correctness ≥ target.
- Language-correctness (answered in the asked language) ≥ target.
- Outfit-builder: vague request → clarifies to sufficient context → returns a coherent, colour-matched,
  grounded combo with working buy-links.
- Freshness: add→retrievable seconds; unpublish→never recommended.

## 14. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Stale prices erode trust | No price stored; MRP/live-price out of scope; value tiers + honest pivot |
| Dead affiliate links | `active=true` on every retrieval; delete→deactivate |
| LLM hallucinates products/links | Output guard whitelist against retrieved context |
| LLM-generated styling rules too generic | Materialize once + admin review; seed with refs; regenerate to improve |
| Brand-tier misjudged | Reviewable/overridable brand→tier KB |
| Multilingual quality (Hinglish/Indian langs) | Multilingual embeddings; language-tagged eval set |
| Copyright/ToS on styling sources | Store distilled facts only; respect robots.txt |
| Over-asking clarifications | Ask only missing slots; never repeat known answers |

## 15. Open Questions / Assumptions
- Exact multilingual embedding model + vector dimension (Phase 0).
- The few authority reference links to seed KB2 (admin-provided).
- Unknown-brand fallback behaviour + admin review flow for `value_tier`.
- Product add/remove mechanism (admin panel / API / direct DB) — the ingestion hook point.

## 16. Future (post-v1)
- Amazon PA-API / Flipkart affiliate-API **live-price sync** (true real-time pricing).
- Human-agent handoff / ticketing.
- Full distillation of styling authorities (stronger KB2) as usage grows.
- Wishlist-aware / account-personalized recommendations.

---

## 17. Verification (end-to-end)
1. **Freshness**: add product → retrievable in seconds; unpublish → never recommended, link never shown.
2. **Grounding**: no-match → "not found" + nearest suggestion; no fabricated product/link/price.
   Off-topic → refuse+redirect. Budget → acknowledge-once + grounded value pivot in same style.
3. **Value inference**: premium brand → tagged Premium; "premium look" pulls from it.
4. **Language**: Hindi query → answered in Hindi with correct products.
5. **Outfit-builder**: vague "birthday look" → clarifies until context complete → coherent, colour-matched,
   grounded combo with working buy-links.
6. **Eval gate**: golden set through RAGAS + link/language/tier checks in CI; block on regressions.

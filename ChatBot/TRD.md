# Technical Requirements Document (TRD)
## branv.in — AI Customer-Support & Outfit-Recommendation Agent

| Field | Value |
|---|---|
| **Product** | AI chatbot + recommendation agent for www.branv.in |
| **Version** | v1.0 (draft) |
| **Date** | 2026-08-31 |
| **Owner** | aiteam@deccansoft.net |
| **Companion doc** | See [PRD.md](PRD.md) for product requirements (FR/NFR referenced here) |
| **Stack** | LangChain · LangGraph · RAG · multilingual embeddings · Postgres + pgvector |

> **Scope of this document:** it specifies **which** technologies, components, data, and design are
> required — not implementation code. Code-level signatures are decided at build time (Phase 0).

---

## 1. Purpose & Scope
Translate the PRD into a technical specification: the technology stack, system components, data model,
retrieval and embedding design, the LangGraph orchestration structure, the multi-provider LLM layer,
APIs, guardrails, observability, testing, and deployment for v1.

**Non-goals (technical):** no payment/order services, no live price scraping in v1, no human-handoff
service (design leaves a stub only). See PRD §3.2.

---

## 2. Architecture Overview

```
   branv.in web widget ──► Chat API (streaming) ──► LangGraph Agent
                                                       │
        ┌──────────────────────────────┬──────────────┼───────────────┐
        ▼                              ▼               ▼               ▼
  Retrieval service           LLM provider layer   Styling KB (KB2)  Memory
  (hybrid + filters)          (primary + fallback) (rules + notes)  (checkpointer)
        │                                                │
        └───────────────► Postgres + pgvector ◄──────────┘
                          (products · brand_tier · styling_rules ·
                           styling_notes · help_content · checkpoints)
                                    ▲
                                    │ write-path upsert / deactivate
                          Ingestion worker (product create/update/delete)
```

**Component responsibilities**
| Component | Responsibility |
|---|---|
| Chat API | Streaming chat endpoint; maps session → conversation thread |
| LangGraph Agent | Orchestrates guards, routing, retrieval, clarification, generation |
| Retrieval service | Hybrid semantic + keyword search with metadata filters |
| LLM provider layer | One primary model + automatic fallback across providers |
| Styling KB (KB2) | Distilled colour/formality/occasion rules + supporting notes |
| Ingestion worker | Keeps the catalog index fresh on the write-path |
| Postgres + pgvector | Single datastore for catalog, KBs, and conversation state |

---

## 3. Technology Stack (the required stack)

| Layer | Required technology | Purpose |
|---|---|---|
| Language / runtime | **Python 3.11+** (async) | Application runtime |
| Orchestration | **LangGraph** (+ Postgres checkpointer package) | Stateful graph, clarification loop, memory |
| LLM framework | **LangChain** (core) | Model abstraction, structured output, fallbacks |
| LLM providers | **Provider-agnostic** — 1 primary + fallbacks | Answer generation + routing (your keys/endpoints) |
| Embeddings | **A multilingual embedding model** | Cross-lingual product + query embeddings |
| Vector store | **Postgres + pgvector** via `langchain-postgres` | Vectors + structured filters in one store |
| Search | **Hybrid** (dense vectors + full-text/BM25, RRF fusion) | Exact brand match + fuzzy intent |
| API | **FastAPI** with streaming (SSE) | Chat + ingestion endpoints |
| Evaluation | **RAGAS** + **LangSmith** | Grounding metrics + tracing |
| Cache (optional) | **Redis** or Postgres | Semantic cache for repeated FAQ |
| Packaging / infra | **Docker** | API, worker, Postgres containers |

> **Decision points (Phase 0):** pick the exact multilingual embedding model and its vector dimension;
> pick the primary + fallback provider/model list. Changing the embedding model later requires a full
> re-embed, so commit deliberately.

---

## 4. Data Model — Postgres + pgvector

The datastore holds six logical entities. Fields listed are **what data is required**, not DDL.

### 4.1 `products` (KB1)
| Field | Type | Notes |
|---|---|---|
| product_id | text (PK) | Stable id from catalog |
| name, brand, category | text | Core attributes |
| subcategory | text | Carries formality (Formals/Checks/…) |
| colour | text[] | Multi-value |
| retailer | text | Amazon / Flipkart |
| affiliate_url, image_url | text | Quoted verbatim; never generated |
| value_tier | text | Derived (Value/Smart/Premium/Luxury) |
| searchable_text | text | Composed text used for embedding |
| text_hash | text | Re-embed gate |
| embedding | vector | Dimension = chosen model's |
| tsv | tsvector | Keyword/BM25 channel |
| active | boolean | Retrieval filters `active = true` always |
| updated_at | timestamp | Freshness |

**Indexes required:** vector index (HNSW) on `embedding`, full-text (GIN) on `tsv`, and standard indexes
on `brand`, `category`/`subcategory`, `colour`, `active`.

### 4.2 `brand_tier` — brand → value tier
`brand` (PK), `tier`, `source` (auto | reviewed), `updated_at`. Admin can review/override.

### 4.3 `styling_rules` (KB2, structured)
`rule_id`, `rule_type` (colour_pair | formality | occasion_template), `key_a`, `key_b`, `payload` (JSON),
`status` (generated | reviewed).

### 4.4 `styling_notes` (KB2, RAG nuance)
`note_id`, `content` (short distilled fact — not verbatim source text), `embedding`. Vector index required.

### 4.5 `help_content` — navigational/meta
`help_id`, `topic` (affiliate_disclosure / how_buy_links / contact), `content`, `embedding`. Vector index required.

### 4.6 Conversation checkpoints
Managed by the LangGraph Postgres checkpointer (conversation state per session/thread).

---

## 5. Embedding Strategy (requirements)
- A **single multilingual embedding model** embeds both product `searchable_text` and user queries →
  cross-lingual retrieval with no catalog translation.
- **Searchable text** composed from name + brand + category + subcategory + colours.
- **Re-embed only on change**, gated by a stored content hash (avoids cost on unrelated edits).
- **Fixed vector dimension** across all vector columns; changing the model = full re-embed.

---

## 6. Ingestion Pipeline (requirements — FR-1..FR-8)
- **Source:** product create/update/delete events from your admin/API (preferred) or a sync job against
  your product DB. **No HTML scraping.**
- **Upsert** keyed by `product_id`; recompute `value_tier` and searchable text; re-embed only if the
  content hash changed.
- **Delete/unpublish** sets `active = false` → the product is never retrieved (no dead affiliate links).
- **Value-tier derivation:** look up `brand_tier`; unknown brand → one-time LLM classification cached to
  the table (admin-reviewable); apply product-name keyword nudges.
- **Reliability:** an outbox/retry queue so embedding failures don't block the product write.

---

## 7. Retrieval Service (requirements — FR-9, FR-10)
- Use `langchain-postgres` **PGVectorStore** with **hybrid search** (dense + full-text/BM25) fused via
  **reciprocal rank fusion**.
- Apply **metadata filters** — colour, category/subcategory, brand, `value_tier` — always ANDed with
  `active = true`.
- Hybrid is required so exact **brand/product-name** matches and **fuzzy style** intent are both covered.
- **Reranking (optional):** a cross-encoder rerank on the fused results — add only if evaluation shows
  weak top-k precision.

---

## 8. Knowledge Bases
- **KB1 — Catalog** (`products`): served by the retrieval service (§7).
- **KB2 — Styling** (`styling_rules` + `styling_notes`):
  - **Built offline** — an LLM, seeded by a few authority reference links, generates a normalized
    rule-set; **admin reviews and promotes** it; short "why" notes are embedded for nuance.
  - **Used at query time** — deterministic rule lookup for core pairings + semantic lookup over notes for
    explanation. **Never improvised live.**
  - **Refreshed periodically**; adding reference links → regenerate (no schema change).
- **Help** (`help_content`): embedded snippets for navigational/meta answers.

---

## 9. LLM Provider Layer (requirements — FR-26, NFR-4)
- **Provider-agnostic** via LangChain, configured as **one primary model + an ordered fallback list**
  with automatic failover on error/rate-limit.
- Two logical roles behind the same fallback chain: a fast **router** (structured output for
  intent + filters) and a **generation** model (streamed).
- Providers, models, keys, and endpoints are **configuration**, not code — swapping a provider is a
  config change.

---

## 10. Orchestration — LangGraph Design (structure, not code)

### 10.1 Conversation state (fields the graph carries)
`messages` (history), `language`, `standalone_query` (after rewrite), `intent`, `filters`, `slots`
(outfit slots + fill status), `retrieved` (grounding context), `answer`.

### 10.2 Nodes required (map to FR-15..FR-24)
| Node | Responsibility |
|---|---|
| input_guard | Rate-limit, prompt-injection neutralize, PII scrub |
| detect_language | Identify user language |
| rewrite_query | Resolve follow-ups into a standalone query |
| router | Structured intent + filter extraction |
| retrieve_products | Hybrid + filtered catalog retrieval |
| outfit_slot_check | Detect missing context; pause to ask (clarify loop) |
| compose_outfit | Combine KB2 rules + real products into a grounded outfit |
| style_advice | Advice grounded in KB2 + catalog |
| navigational | Answer from help content |
| off_topic | Refuse + redirect to men's-wear scope |
| generate | Stream the grounded final answer |
| output_guard | Verify products/links exist in context; no price emitted |

### 10.3 Routing (conditional edges)
`router` branches by intent: `product_recommend`/`budget_intent` → retrieval → generate;
`outfit_builder` → slot-check → (clarify loop) → compose → generate; `style_advice` / `navigational` /
`off_topic` → their node → generate. All paths end at `generate` → `output_guard` → stream.

### 10.4 Clarification loop (FR-20)
`outfit_slot_check` uses LangGraph's **interrupt/human-in-the-loop** capability to pause, ask one needed
question, and resume with the user's reply — looping until context is sufficient, **with no cap** and
**never re-asking** a known slot.

### 10.5 Memory / persistence (FR-24)
The **LangGraph Postgres checkpointer** persists conversation state per session thread → the app stays
stateless and horizontally scalable.

---

## 11. Multilingual Handling (FR-16, NFR-5)
- **Detect** the user's language and carry it in state.
- **Retrieve** directly via the multilingual embedding (no catalog translation).
- **Generate** in the user's language; product names/brands/links remain verbatim.
- Evaluation set is **language-tagged** to measure in-language correctness.

---

## 12. Grounding & Guardrails (FR-22, FR-23, NFR-6)
- **Generation rules:** recommend only retrieved products; output affiliate/image URLs **verbatim**;
  **never** state or invent a price; never invent a brand/product/collection; empty retrieval → say so +
  nearest-category suggestion.
- **Budget intent:** acknowledge once + honest "price is live on the retailer" + pivot to `value_tier`
  in the same style; no repeated disclaimer in-thread.
- **Input guard:** treat user text as data (not instructions); rate-limit; PII scrub.
- **Output guard:** deterministic whitelist check — every product/link in the answer must exist in the
  retrieved context; reject any price/number-as-price; regenerate on violation.

---

## 13. API (endpoints required)
| Endpoint | Purpose |
|---|---|
| `POST /chat/stream` | Streamed chat; resumes the session's conversation thread |
| `POST /chat/resume` | Supply an answer to a clarification pause |
| `POST /ingest/product` | Write-path upsert (service-auth) |
| `DELETE /ingest/product/{id}` | Deactivate a product |
| `GET /healthz` | Health check |

`/chat/*` is rate-limited per session/IP; `/ingest/*` is protected by a service token.

---

## 14. Non-Functional / Performance (NFR-1..NFR-8)
- **Latency:** stream first token; semantic cache for repeated navigational/FAQ; router on a fast tier.
- **Freshness:** write-path upsert → retrievable within seconds; `active=false` removes instantly.
- **Reliability:** LLM fallback; ingestion retry queue; DB connection pooling.
- **Scaling:** stateless app (state in checkpointer) → horizontal scale; pgvector HNSW recall tuning.
- **Security:** input/output guards, no price emission, secrets in a secret manager, least-privilege DB roles.

---

## 15. Observability (NFR-7)
- **LangSmith** tracing on every node (inputs/outputs/latency/tokens).
- Structured logs for router decisions, retrieval filters, and guard rejections.
- Misroutes / empty retrievals logged to grow the golden set.

---

## 16. Testing & Evaluation (PRD §13)
- **Unit:** filter builder, value-tier derivation, searchable-text + hash, output-guard whitelist.
- **Integration:** ingestion→retrieval freshness; deactivate→never-returned; hybrid ranking.
- **Agent eval (RAGAS + custom):** faithfulness, answer-relevancy, **hallucinated-link/price = 0**,
  router-intent accuracy, value-tier correctness, language-correctness.
- **Golden set:** 50–100 language-tagged queries across intents; run in **CI**, block on regression.
- **Outfit-builder scenarios:** vague request → asserts clarification loop → coherent, colour-matched,
  grounded combo with working links.

---

## 17. Deployment / Infra
- **Containers:** API (FastAPI + LangGraph), ingestion worker, Postgres (pgvector).
- **Migrations:** schema (§4) + checkpointer setup.
- **Environments:** dev / staging / prod with separate DBs and LangSmith projects.
- **CI/CD:** lint + unit + integration + eval gate → build image → deploy.

---

## 18. Configuration (what must be configurable)
- Database connection.
- Embedding model + provider + vector dimension.
- Primary model/provider + ordered fallback model list.
- Per-provider API keys and endpoints.
- LangSmith project/key.
- Supported languages list.

---

## 19. Proposed Repository Structure
```
branv-agent/
├─ app/
│  ├─ api/          # chat_stream, resume, ingest, health
│  ├─ graph/        # state, nodes, edges, graph build
│  ├─ retrieval/    # pgvector store, hybrid config, filter builder
│  ├─ ingestion/    # upsert, deactivate, value_tier, searchable_text
│  ├─ kb/           # brand_tier, styling KB build + lookup, help
│  ├─ llm/          # provider layer + prompts
│  ├─ guards/       # input + output guards
│  ├─ i18n/         # language detect + response language
│  └─ config.py
├─ migrations/      # schema
├─ eval/            # golden set, RAGAS harness
├─ tests/
├─ docker/
├─ PRD.md
└─ TRD.md
```

---

## 20. Open Technical Decisions (resolve in Phase 0)
- Exact **multilingual embedding model + vector dimension**.
- **Primary + fallback** provider/model list.
- Ingestion trigger: **event hook vs sync job** against your product DB.
- Rerank on/off (measure first).
- Semantic-cache backend (Redis vs Postgres).
- Unknown-brand fallback + admin review flow for `brand_tier` / `styling_rules`.

---

## 21. Build Sequence (maps to PRD roadmap)
1. **Phase 0** — pin stack, embedding dimension, schema, ingestion hook.
2. **Phase 1** — ingestion + hybrid retrieval + value-tier.
3. **Phase 2** — core LangGraph (guards→router→retrieve→generate→output-guard) + memory + i18n + fallback.
4. **Phase 3** — Styling KB build + clarify-loop + outfit compose.
5. **Phase 4** — eval harness + LangSmith + hardening; CI eval gate.
```

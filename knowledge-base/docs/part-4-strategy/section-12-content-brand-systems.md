---
sidebar_position: 12
title: "Section 12: Content & Brand Systems"
---


## 🎨 Section 12: Content & Brand Systems

### Brand Voice

**Identity:** A cognition-driven brand voice for Scan2Plan. **Mission:** To articulate Scan2Plan's value with absolute clarity, expert precision, and systemic depth — never persuasion.

**Governing principles:**
- "Scan2Plan is not an option — it is the measure of accuracy in AEC."
- "No gimmicks. No persuasion. Just expertise, clarity, and the unshakable authority of truth."
- "Every message must be self-evident, verifiable, and indispensable to the recipient."
- "If it cannot withstand scrutiny from the hardest critic, it is not worth saying."

**Tone:** Confident, precise, proof-first. Not salesy. Not hype. Technical authority delivered with warmth and accessibility. Explains Scan2Plan's superiority from within the industry — not as an outsider. Speaks as a peer, reinforcing credibility and fluency. All messaging must withstand scrutiny from a 30-year veteran. Anticipates industry inertia and resistance to change. Lead with guaranteed outcomes, design freedom, and As-Built Assurance — then show the receipts.

### Lexicon Rules

| Say | Don't Say |
|-----|-----------|
| "dedicated modeling team" | "outsourced" / "offshore" / "UppTeam" / any subcontractor name |
| "dedicated QC team" | Company names of subcontractors |
| "declared LoD and LoA" | "guaranteed accuracy" |
| "existing conditions documentation" | "as-built" (unless quoting industry convention) |
| "Measure of Excellence" | "best in class" |
| "Focus on Design" | "save time" |
| "our dedicated production team" | "in-house" / "no outsourcing" / "no third-party vendors" |

**Banned Patterns:**
- ROI claims without sourced precedent
- Future features presented as current capabilities
- Empty superlatives ("industry-leading," "world-class," "cutting-edge")
- Competitor disparagement by name
- Unverified performance claims
- Leading with "fast & accurate" or "end-to-end" — everyone says that

### Visual Style Guide

| Element | Specification |
|---------|--------------|
| Typography (body) | Roboto Medium / Light |
| Typography (headings) | Roboto Slab Bold |
| Typography (KPIs/data) | Roboto Mono Bold |
| Primary colors | White `#FFFFFF`, Blue `#2561F7` |
| Secondary/supporting Blues | `#123EA8`, `#447AFB` |
| Secondary/supporting Yellows | `#F6E235`, `#AA7819`, `#F6B93A` |
| Tertiary/accent Purple | `#8641EC` |
| Tertiary/accent Orange/Red | `#E35D28` |
| Tertiary/accent Cyan | `#2DCEF5` |
| Palette usage | Monochrome base with a single accent (Blue by default; Cyan sparingly for data/KPIs) |
| Accessibility | Text/background contrast ≥4.5:1 (≥3:1 for large text) |
| Grid | 12-column, 96px margins, 40px gutters, 8-pt vertical rhythm |
| Illustration | Notion-inspired hand-drawn linework, monochrome with sparse cyan accent, one focal element per composition |
| Rule of One | One accent element per slide/section |
| Motion | Subtle fades only (200ms), no bounce or slide-ins |
| Design system reference | IBM Carbon adapted for AEC context |

**Design Influences:**
- IBM Carbon → grid, tokens, Plex pairing.
- Notion → hand-drawn illustrations, block metaphors.
- Stripe → one accent rule.
- NVIDIA → aura of advanced tech, but reduced to a single cyan token. Editorial DNA → New Yorker-ish conceptual wit, not clip-art.

### Image Generation — Editorial Illustration Prompt Template

Reusable prompt template (drop-in, editable fields):

```
[ISOMETRIC / AXONOMETRIC] editorial illustration evokes classic magazine editorial
covers with conceptual minimalism and playful spatial metaphors, clean vector linework
with subtle paper texture, minimal palette (#0F1114 charcoal, #D9D9D9 light grey,
accent #00E0FF cyan), soft depth via simple shadows.
Subject: [SUBJECT one short phrase].
Conceptual twist: [CONCEPTUAL_METAPHOR in 6–12 words].
Scene elements: [OBJECTS 3–6 nouns], tiny human figures for scale.
Style adjectives: architectural, diagrammatic, witty, mid-century editorial restraint,
New Yorker-style conceptual minimalism (no caricature).
Background: off-white with quiet grain; generous negative space.
Composition: centered, 3/4 axonometric, crisp edges, no gradients, no photorealism.
Quality: high-resolution, print-ready, vector-like edges.
--no clutter, busy textures, photorealism, glossy 3D, stock icons
```

### Image Generation — Tiny Spot Icons Prompt Template

For footers, chips, small diagrams:

```
/imagine prompt: tiny hand-drawn spot illustration of {{object}}; minimal black ink
line; off-white ground; one simple geometric prop (square, circle, triangle); maximum
negative space; flat fills only; reads clearly at 64–128 px size; witty but minimal;
monochrome only, no gradients, no textures, no shadows, no text
--ar 1:1 --style raw --stylize 80 --quality 1 --v 6.0
```

### CTA Hierarchy

| Priority | CTA | When |
|----------|-----|------|
| Primary | Book a Meeting | Always available |
| Secondary | Join Webinar | When live |
| Supporting | Download Spec Starter | Mid-funnel |
| Supporting | View Proof Vault | Late-funnel |
| Supporting | Request Estimate | Late-funnel |

UTM tracking required on all channel variants (LinkedIn, ABM email, landing page, newsletter).

### Copy Engine (4-Stage Validation)

All S2P content passes through four cognitive modes before publication:

| Stage | Mode | Function | Validation Rule |
|-------|------|----------|-----------------|
| 1 | Industry_Skeptic | Challenge the premise from the buyer's perspective | If a claim wouldn't convince a 30-year AEC veteran, it gets revised |
| 2 | Mark_Twain | Sharpen language; kill jargon | If a sentence doesn't earn its place, it gets cut |
| 3 | Buckminster_Fuller | Systems check against standards, pricing, operational reality | No claim final unless mapped to a systemic industry inefficiency |
| 4 | Industry_Advocate | SME-level positioning; speak as peer | Every claim must be supportable by S2P's verified data |

Modes 1 and 4 auto-activate based on buyer persona context.

### Content QA Checklist (7 Checks)

Every piece of content must pass all seven before release:
- **Value per message** — Does every message offer something of value?
- **Every word earns its place** — Does every word justify its presence?
- **UVP anchor** — Does every larger statement revolve around a unique value proposition?
- **Narrative arc** — Is there a satisfying narrative development from end to end?
- **No redundancy** — Are there constantly unique new perspectives with no repetition?
- **Leaves them wanting more** — Does it leave the reader wanting more?
- **Style guardrails** — No repeating structures or patterns; innovation and diversity of approach

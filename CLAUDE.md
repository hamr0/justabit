# CLAUDE.md — agent doctrine for justabit

Repo-only; for whoever is *building* this. Adopters read `README.md` and
`docs/02-proposals/camara-attested-windowed-disclosure.md`.

This is a **standards repo**, not a software product. The deliverable is text
that survives working-group scrutiny; the PoC exists to make the text
undeniable. Optimize for the reader in a CAMARA/AAIF meeting, not for elegance.

## The one invariant

**A profile-mode response is a signed boolean bound to the requester's nonce
with an expiry — never the underlying raw value.** If a change lets a
timestamp, country, number, or address reach the requester in profile mode,
the change is wrong, however useful. Bands are a declared, transitional
exception (profile rule 7), not a loophole.

## Claims discipline (most-litigated)

- **Mode A is "attested windowed disclosure" and must NEVER be described as
  zero-knowledge** — not in docs, commits, descriptions, topics, or talks.
  ZK language is reserved for Mode B (holder presentment). Inherited from
  zkagent: *the name may be aspirational; the claims may not.*
- **Floors are monotone.** Downstream parties tighten; nothing ever loosens or
  silently widens a window. Widening is an explicit, distinct, consent-visible
  operation (profile rule 8).
- **The hub stays blind.** The aggregator meters and bills; it must never be
  able to read identifiers, predicates, or answers. This is the A2P lesson —
  readable middle layers eventually monetize against the ecosystem. Any design
  that "just lets the hub cache/inspect for efficiency" is wrong.
- **Honest limits stay in the text.** Economic scarcity ≠ uniqueness; Mode A
  retains the operator query log; the trust directory is a centralization
  point; MNP breaks naive tenure. These are stated on purpose — do not
  "clean them up".
- **Never promise what SIMs can't give**: a SIM is not a principal root
  (farmable); "one accountable human" needs a document-rooted layer above.
  Consumer-agent floor (voice+data) and machine-agent profile (M2M) must not
  be conflated.

## Grounding discipline (from 8een's evidence practice)

Every claim about CAMARA/GSMA/AAIF state is pinned to a source — spec YAML,
repo, or dated page — and re-verified before any submission. Current verified
baseline (2026-08-14, re-verified 2026-08-24): SimSwap v2.1.0 (`/check`,
`/retrieve-date`, `/retrieve-age-band`), NumberVerification v2.1.0 (`/verify`
requires an identifier; `/device-phone-number` takes no request body and
derives the line from the 3-legged token), KYC split post-Spring25 into
kyc-match (r1.2, v0.4.0), kyc-fill-in (r1.3, v0.4.1), kyc-age-verification
(r1.3, v0.2.1 — Sandbox). If a claim dies on re-verification, retract it
visibly — retractions build WG credibility.

## Strategy invariants

- **Profile first, API second.** The ask to CAMARA is "finish what
  `/retrieve-age-band` and `GET /device-phone-number`'s no-body shape
  started, catalog-wide" — never "approve my API". CarrierAttestation as a
  new case exists only for what no existing API covers (agent floors, Mode B).
- **Two tracks, one seam.** CAMARA = operator/attestation side; AAIF =
  agent/delegation side; they meet at the RFC 9421 header. Each cites the
  other; neither depends on the other's approval. Keep submission docs
  standards-neutral — zkagent/8een are cited as *one implementation* of the
  principal layer, never as dependencies.
- **Mode A ships first** because it preserves per-query billing and the
  aggregator revenue share — the commercial rail is the adoption wedge.
  Do not let Mode B enthusiasm leak scope into Mode A.

## Process facts that gate the work

- CAMARA: proposals freeze after 6+ weeks GitHub inactivity or 3 missed WG
  meetings. Sustained presence is part of the deliverable.
- Author is independent (no member company). Supporters must be recruited
  before the APIBacklog PR, not after.
- PoC targets Orange Network APIs Playground (free, instant; +990 test
  numbers, scriptable backstories). Blocked on account credentials.

## Where the reasoning lives

```
docs/01-product/   prd.md — THE leading doc: requirements, sequence, no-go list,
                   decisions log. 3-doc inventory is a hard rule (PRD + 2 proposals);
                   new design content folds in here, never into a side-doc.
docs/02-proposals/ camara-attested-windowed-disclosure.md — CAMARA proposal, carries
                   the normative profile (the standard) + APIBacklog template mapping
                   aaif-agent-auth.md — AAIF proposal (agent/delegation side only)
spec/              carrier-attestation.yaml — illustrative OpenAPI sketch, not normative
poc/               Mode A demo: mock backend default, Orange adapter swappable;
                   four assertions (each with its negative), Node zero-dep, PRD §4
.claude/           local session context (gitignored — never publish)
```
<!-- MEMORY:START -->
@.claude/remember/MEMORY.md
<!-- MEMORY:END -->

<!-- AGENT_RULES:START -->
Consult when building something new or adding a feature — a standards guide, not hot
context like MEMORY.md above:
@.claude/remember/AGENT_RULES.md
<!-- AGENT_RULES:END -->

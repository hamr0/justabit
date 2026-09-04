# CLAUDE.md — agent doctrine for justabit

Repo-only; for whoever is *building* this. Adopters read `README.md` and
`camara/v1/docs/camara-attested-windowed-disclosure.md` (v1, as filed;
v2 working copy under `camara/v2/docs/`).

This is a **standards repo**, not a software product. The deliverable is text
that survives working-group scrutiny; the PoC exists to make the text
undeniable. Optimize for the reader in a CAMARA/IETF meeting, not for elegance.

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
  able to read identifiers, predicates, or answers. A readable middle layer
  holds the structural option to accumulate and monetize what it can see, so
  the design removes the capability rather than trusting restraint. Any design
  that "just lets the hub cache/inspect for efficiency" is wrong. (The
  historical "A2P decayed / aggregators monetized subscriber data" framing was
  RETRACTED 2026-08-28 as ungrounded — see `docs/logs/findings.md` — do not
  reintroduce it.)
- **Honest limits stay in the text.** Economic scarcity ≠ uniqueness; Mode A
  retains the operator query log; the trust directory is a centralization
  point; MNP breaks naive tenure. These are stated on purpose — do not
  "clean them up".
- **Never promise what SIMs can't give**: a SIM is not a principal root
  (farmable); "one accountable human" needs a document-rooted layer above.
  Consumer-agent floor (voice+data) and machine-agent profile (M2M) must not
  be conflated.

## Grounding discipline (from 8een's evidence practice)

Every claim about CAMARA/GSMA/IETF state is pinned to a source — spec YAML,
repo, or dated page — and re-verified before any submission. Current verified
baseline (2026-08-14, re-verified 2026-08-24): SimSwap v2.1.0 (`/check`,
`/retrieve-date`), NumberVerification v2.1.0 (`/verify` requires an
identifier; `/device-phone-number` takes no request body and derives the
line from the 3-legged token), KYC split post-Spring25 into kyc-match
(r1.2, v0.4.0), kyc-fill-in (r1.3, v0.4.1), kyc-age-verification (r1.3,
v0.2.1 — Sandbox). **RETRACTED (2026-08-31):** the baseline previously
listed `/retrieve-age-band` as part of SimSwap v2.1.0. VERIFIED FALSE
against every tagged release (r3.3/r3.2 both `info.version: 2.1.0`, r3.1
`2.1.0-rc.2`, r2.2 `2.0.0`) — none of them carry `/retrieve-age-band`; it
exists only on unreleased branch `main` (`info.version: wip`). Any
reference to `/retrieve-age-band` must say "unreleased, `main` only," not
"v2.1.0." If a claim dies on re-verification, retract it visibly —
retractions build WG credibility.

**No orphaned references.** Retracting a claim, renaming/moving a file,
dropping a term, or changing a heading is not done until the whole repo is
swept for the old term/path and every hit is classified — corrected, or
kept on purpose as dated history. Sweep: docs/code, generated indexes,
GitHub repo metadata (description/topics), empty directories (invisible to
git diff/status), and internal anchors (a changed heading changes its
slug). Evidence: `docs/logs/findings.md` (2026-08-28).

## Strategy invariants

- **Profile first, API second.** The ask to CAMARA is "finish what
  `/retrieve-age-band` and `GET /device-phone-number`'s no-body shape
  started, catalog-wide" — never "approve my API". CarrierAttestation as a
  new case exists only for what no existing API covers (agent floors, Mode B).
- **Two tracks, one seam.** CAMARA = operator/attestation side; IETF
  (OAuth WG) = agent/delegation side; they meet at the RFC 9421 header.
  Each cites the other; neither depends on the other's approval. Keep
  submission docs standards-neutral — zkagent/8een are cited as *one
  implementation* of the principal layer, never as dependencies.
- **Mode A ships first** because it preserves per-query billing and the
  aggregator revenue share — the commercial rail is the adoption wedge.
  Do not let Mode B enthusiasm leak scope into Mode A.

## Process facts that gate the work

- CAMARA: proposals freeze after 6+ weeks GitHub inactivity or 3 missed WG
  meetings. Sustained presence is part of the deliverable.
- Author is independent (no member company). **RETRACTED (v0.6.0, no-go 12
  retired):** this line previously read "Supporters must be recruited before
  the APIBacklog PR, not after." That was verified FALSE as a CAMARA
  requirement — the template's own Supporters field is filled by the
  Working Group during evaluation, downstream of filing — and was the
  author's own risk-management judgement, not a process fact. Corrected
  position: file first, network later.
- PoC targets Orange Network APIs Playground (free, instant; +990 test
  numbers, scriptable backstories). Blocked on account credentials.

## Where the reasoning lives

prd.md is the contract: it states what is true NOW — requirements, sequence,
no-go list. The why — reasoned decisions and course-change rationale — lives
in `docs/logs/findings.md`; prd.md §9 is an index into that log, not a
rationale store.

```
docs/product/      prd.md — THE contract: requirements, sequence, no-go list.
                   camara-attested-windowed-disclosure.md — stub: file moved on
                   2026-08-31, kept because filed APIBacklog issue #330/PR #331
                   link to this path and GitHub does not redirect
docs/logs/         findings.md — dated EVIDENCE + DECISION log: evidence is what was
                   RUN and OBSERVED, decisions are reasoned course changes with the why
docs/archive/      aaif-agent-auth.md — SUPERSEDED 2026-08-25, retained as a dated
                   record only
camara/v1/docs/    frozen record of what was actually filed 2026-08-28
                   (camara-attested-windowed-disclosure.md, camara-filing-issue.md,
                   camara-filing-template.md) plus the 2026-08-31 reviewer feedback
camara/v1/poc/     Mode A demo: mock backend default, Orange adapter swappable;
                   four assertions (each with its negative), Node zero-dep, PRD §4
camara/v1/spec/    carrier-attestation.yaml — illustrative OpenAPI sketch, not normative
camara/v2/docs/    working copy being reshaped per the 2026-08-31 feedback — not filed
camara/v2/poc/     v1 M1-M6/demo copied unchanged 2026-08-31 (still what M2/M6/
                   demo run on) PLUS a new JWS attestation core built the same
                   day (m1-jws.mjs, m1-jws-check.mjs) — caller migration is V2-M3
camara/v2/spec/    working copy of camara/v1/spec/, rewritten 2026-08-31 for the
                   JWS envelope (renamed schemas, required phoneNumber, replaces
                   the old {claims,sig} shape) — 215 -> 319 lines, not unchanged
ietf/v1/docs/      frozen record of draft-hamr-oauth-agent-delegation-00 as
                   posted 2026-08-31 (agent/delegation side, OAuth WG target);
                   ietf-agent-delegation.md is the companion prose proposal
ietf/v1/poc/       the actionClass floor axis spike (M7) -00 was validated
                   against; copied unchanged into v2, never edit this copy
ietf/v2/docs/      -01 SUBMITTED and posted 2026-09-02, expires 2027-03-06:
                   all four items and Appendix A direction 4 drafted; two
                   review rounds run and their findings fixed; the PoC
                   catch-up done
ietf/v2/poc/       DIVERGED from the frozen v1 copy: m7-actionclass.mjs and
                   m7-check.mjs now carry the -01 text's rules (verifier-
                   derived chain identifier, path-template menu matching,
                   origin binding, the link-to-link omitted-axis rule), 40
                   cases against v1's 24 — v1 stays frozen as the -00
                   record; spike-a/ holds the catalogue-survey dataset
                   (specs/ omitted, reproducible from its SHA column),
                   moved in 2026-09-01
.claude/           local session context (gitignored — never publish)
```
<!-- MEMORY:START -->
@.claude/remember/MEMORY.md
<!-- MEMORY:END -->

<!-- AGENT_RULES:START -->
Consult when building something new or adding a feature — a standards guide, not hot
context like MEMORY.md above:
.claude/remember/AGENT_RULES.md
<!-- AGENT_RULES:END -->

<!-- DOCS_INDEX:START -->
Docs map: `docs/index.md` — every doc in this project, with line counts.
Search this corpus instead of reading it whole: `/docs-builder search <query words>`
<!-- DOCS_INDEX:END -->

# Changelog

## 0.0.3 — 2026-08-15

- **M1 (attestation core) built under the §4.4 ladder** — first module of the
  PoC rebuild. `poc/m1-attestation.mjs` (Ed25519 via `node:crypto`, zero
  deps, sign-the-exact-bytes) + `poc/m1-check.mjs` (17 cases, negatives
  first, every rejection reason exactly asserted; 17/17, exit 0). The
  verifier enforces a CLOSED claim set `{predicate, result, nonce, exp}` —
  a validly signed envelope smuggling a raw value alongside the boolean is
  rejected, not passed through. Process: throwaway spike (user-validated) →
  build → two review rounds (16 findings validated, fixed, and
  mutation-proven) → coverage-gap closure. Evidence and dead ends recorded
  in `docs/01-product/findings.md` (new — dated experiments log
  complementing the PRD).
- **Doc sweep from the M1 predicate decision:** the signed response now
  carries the predicate everywhere it is described — normative profile rule
  2 (predicate echo + the stateless-verification limit made explicit), spec
  sketch (`predicate` in the response + sig restated as a detached
  signature over the exact payload bytes; `Predicate.value` can express its
  array example), `poc/README.md` architecture diagram, PRD §4.4 ladder
  wording (M1 proves binding; single-use nonces assigned to M6's RP side).

- **Consolidated to a 3-doc inventory led by a PRD.**
  `docs/01-product/prd.md` is now the leading document (goals/gates,
  deliverables, PoC requirements, an explicit no-go list, sequence, grounded
  process facts, dated decisions log, AGENT_RULES-conformance note). The
  former `carrier-attestation-proposal.md`, `camara-plan.md`, `aaif-plan.md`,
  and `docs/02-features/attested-windowed-disclosure.md` are deleted — their
  content folded into the PRD (internal strategy/process) and two outward
  proposal docs in `docs/02-proposals/`:
  `camara-attested-windowed-disclosure.md` (problem + the normative 8-rule
  profile + modes + phase plan + risks + a pre-filled APIBacklog template
  mapping) and `aaif-agent-auth.md` (agent/delegation side only).
- **APIBacklog template re-grounded 2026-08-14** — it now carries a CAMARA
  scope-alignment section (northbound API type, Project Charter fit,
  no-overlap declaration); the CAMARA doc's §10 mapping pre-fills all fields.
- **PoC re-scoped to shippable-simplest** (`poc/README.md`): Node ≥20, zero
  deps, one command (`node poc/demo.mjs`), mock operator backend by default
  (zero credentials), Orange Playground as a swappable `--backend orange`
  adapter; four assertions each demonstrated with their negative.
- **First PoC build ROLLED BACK (2026-08-15)** — an initial implementation
  (mock + live Orange runs) was built monolith-then-integrate without
  per-module user validation, violating the build-incrementally rule. Code
  removed from the tree; the rebuild follows the PRD §4.4 module ladder
  (M1–M6), each module POC'd against its toughest assumption and
  user-validated before the next.
- **Playground reality grounded by a raw spike (kept as evidence,
  2026-08-15, recorded in `poc/README.md`):** CAMARA playground calls
  tokenize at `/openidconnect/playground/v1.0/token` while the Admin API
  needs `/oauth/v3/token` (not interchangeable — measured `401`); sim-swap
  `403 FORBIDDEN` means unknown number, not an auth failure; `/check`'s
  `maxAge` is in HOURS capped at 2400 (~100 days), so a 90-day floor is
  `maxAge: 2160` and longer floors must be computed from `/retrieve-date`;
  built-in test numbers echo backstory writes back while silently ignoring
  them — only Admin `READ` proves a write landed, so scripted backstories
  need a custom slot and READ-verification.

## 0.0.2 — 2026-08-14

- **Docs reorganized to the house convention** (matching zkagent/8een):
  `docs/01-product/` now holds the master proposal plus both submission plans
  (former `01-proposal/` + `03-submissions/`); `docs/02-features/` holds the
  normative profile (former `02-profile/`). All cross-references updated.
- **CLAUDE.md added** — agent doctrine: the one invariant (signed nonce-bound
  boolean, never raw values), claims discipline (Mode A never called ZK),
  strategy invariants (profile-first, two tracks/one seam), grounding
  discipline, process gates.

## 0.0.1 — 2026-08-14

- Repo scaffolded. Name: **justabit** ("just a bit — never more, never less").
  npm name reserved-checkable (free at scaffold time); repo-first by design —
  standards live as specs, npm is for an eventual reference SDK only.
- Master proposal imported from planning drafts
  (`docs/01-proposal/carrier-attestation-proposal.md`).
- Horizontal profile drafted (`docs/02-profile/attested-windowed-disclosure.md`).
- Submission plans for CAMARA and AAIF tracks (`docs/03-submissions/`).
- OpenAPI sketch (`spec/carrier-attestation.yaml`).
- PoC plan awaiting Orange Playground credentials (`poc/`).

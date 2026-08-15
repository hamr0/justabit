# Changelog

## 0.0.5 — 2026-08-15

- **M3 (floor gate) built under the §4.4 ladder — user-validated 14/14.**
  `poc/m3-floor.mjs`: `checkFloor(published, requested)` — pure logic, zero
  deps; closed 4-axis set (simType/tenureMin/swapAgeMin/class); strict
  `P<n>D`/`P<n>Y` durations (1Y = 365D stated; months rejected as ambiguous
  — user decision); no coercion (spike: `parseInt('3M')===3`,
  `Number(null)===0` would admit every request); unknown/typo'd axis =
  closed-set rejection (an ignored typo silently drops a constraint);
  omitted axis inherits the published floor, visible via the returned
  `effective`; broken PUBLISHED config throws loud, wire input never
  throws. `poc/m3-check.mjs`: 14 cases negatives-first. Mutation-proven: 3
  mutants (rejection disabled / unknown-axes ignored / string compare) all
  killed; check hardened to fail-clean (`?.`) after mutant C first died as
  a stack trace — the M2 "no RESULT line" lesson re-applied.

## 0.0.4 — 2026-08-15

- **Both v0.0.3 security Mediums closed (user decision: now, not M3).**
  (1) Duplicate-key equivocation: the M1 verifier rejects any signed payload
  with a repeated top-level claim key (`duplicate claim keys`), keys compared
  after JSON escape decoding; 2 new check cases (plain + `\u0072esult`
  spelling), mutation-proven — guard off, the equivocating blob is ACCEPTED;
  guard on, 19/19 exit 0, M2 regression 10/10. Normative rule 2 amended
  (proposal + README copy + spec YAML). (2) Key pinning: rule 3 now requires
  verifiers to pin the expected operator key before verification — unsigned
  `iss` is a lookup hint, never the key selector (text-only; the reference
  verifier already takes a caller-pinned key; enforceable surface lands with
  the M6 trust directory).

## 0.0.3 — 2026-08-15

- **Whole-branch release gates run before merge** — `/code-review medium`
  (8 findings, all fixed: honest README/PoC status, ECDH→RSA-OAEP doc
  parity, spec-vs-verifier mutual implementability, real hub-blind attack
  set, `.gitignore` scoped back so `.github/` is trackable, shared
  `poc/check-harness.mjs` extracted — superseding M2's "deliberate
  duplication" note) + fresh security and diff-review gates (unquoted
  inline YAML descriptions were silently truncating the spec's `exp`/
  `predicate` docs — quoted; case 8's reason is observed from `open()`
  again, not derived from the verdict; `.env`/`*.env` now actually
  gitignored as the PRD claims). Two Medium normative-text items (duplicate
  JSON-key ambiguity; verifier key-pinning rule) held as open decisions for
  the submission round — recorded in `findings.md`.
- **Normative profile rule 6 amended (size side channel)** — responses in a
  hub-carried deployment MUST NOT let payload size track the answer;
  grounded by M2's measured constant 512 B ciphertext. Plus decisions
  round: M6 gains the request-authenticity scope (unauthenticated request =
  open item), replay handling bounded, author filled, AAIF submission
  process grounded (`github.com/aaif/project-proposals`).
- **M2 (blind envelope) built under the §4.4 ladder** —
  `poc/m2-envelope.mjs` (RSA-4096 OAEP-SHA256 via `node:crypto`, one vetted
  primitive, zero deps; `seal` derives capacity from the recipient key,
  `open` rejects-never-throws on wire input, failure reasons deliberately
  collapsed against padding oracles) + `poc/m2-check.mjs` (10 cases,
  negatives first, exact reasons; 10/10 exit 0; happy path composes with
  the shipped M1 module end-to-end). Spike measured: real payloads fit
  (148 B request / 270 B response vs 446 B cap), hub blindness structural
  (own-private-key attempts + plaintext substring scan, 0 recoveries,
  mutation-falsifiable), ciphertext length CONSTANT at 512 B (the rule-6
  size side channel does not exist at this layer; count/timing/pairing
  remain visible and stated). Review round: 6 findings — 5 fixed (incl. a
  live-proven derived-capacity bug), 1 documented at the time
  (check-harness duplication — later extracted in the release-gate round,
  see top bullet).
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

# justabit — PRD

**Status:** ACTIVE — this document leads all specs, proposals, and the PoC.
**Date:** 2026-08-14 (consolidated from `carrier-attestation-proposal.md`,
`camara-plan.md`, `aaif-plan.md` — all three deleted; outward content moved to
`docs/02-proposals/`).
**Doctrine:** `CLAUDE.md` (invariants, claims discipline). This PRD is the
*what/when/how-good*; CLAUDE.md is the *never-break*.

---

## 1. What this project is

A standards effort: make telecom network APIs answer with **exactly what the
requester needs — a signed, nonce-bound, expiring boolean under monotone
floors — and nothing else, ever** ("attested windowed disclosure").

This is a **docs-and-proposals project with one small runnable PoC**, not a
software product. The deliverable is text that survives CAMARA/AAIF
working-group scrutiny; the PoC exists to make the text undeniable. The
decision this PRD serves: *what do we write, build, and file — in what order —
to get the profile adopted catalog-wide, as an independent author with no
member company behind them?*

## 2. Goals and success criteria

Define "good" before building (AGENT_RULES). In order of proof strength:

| Gate | Success looks like | Evidence |
|---|---|---|
| G0 Docs consolidated | Exactly 3 living docs (this PRD + 2 proposals); no orphan cross-references | repo grep |
| G1 PoC runnable | `node poc/demo.mjs` passes all 4 assertions on a clean clone, zero credentials, exit code 0 | run output |
| G2 PoC live | Same demo, `--backend orange`, against Orange Playground with scripted backstories | run output |
| G3 Circulated | Profile posted to ICM discussion / GitHub Discussion; reactions collected | links |
| G4 Supported | 2–3 named operator supporters (DT / Orange / Telefónica the likely pool) | names in template |
| G5 Filed | Commonalities guideline proposal + sim-swap adoption PR + APIBacklog PR (with supporters) submitted | PR links |
| G6 AAIF filed | Agent-auth project proposal submitted once their process is grounded | link |

Timescale is telecom-speed: quarters, not weeks. Sustained presence is itself
a deliverable (CAMARA freezes proposals after 6+ weeks GitHub inactivity or 3
missed WG meetings).

## 3. Deliverables and the 3-doc inventory

**Hard rule: three living documents, no more.** New design content is folded
into one of these (this PRD grows a dated Decisions entry, §9); side-docs are
not created. Proposal docs follow the target body's proposal standards.

| # | Deliverable | Where | Consumer |
|---|---|---|---|
| D1 | **This PRD** — requirements, sequence, no-gos, decisions | `docs/01-product/prd.md` | us |
| D2 | **CAMARA proposal** — problem, the normative profile (8 rules), modes, phase plan, risks, pre-filled APIBacklog template mapping | `docs/02-proposals/camara-attested-windowed-disclosure.md` | CAMARA Commonalities / ICM / APIBacklog WG |
| D3 | **AAIF proposal** — agent/delegation side only | `docs/02-proposals/aaif-agent-auth.md` | AAIF Identity & Trust WG |
| D4 | **PoC** — Mode A demo, 4 assertions, mock + Orange backends | `poc/` | WG readers, demo audiences |
| D5 | Sustained WG presence (meetings, mailing lists, PR responses) | calendars, minutes | CAMARA anti-staleness rules |

Supporting artifacts (not documents): `spec/carrier-attestation.yaml` stays an
illustrative OpenAPI sketch (non-normative); `README.md` is the adopter-facing
front door and mirrors — never forks — the proposals;
`docs/01-product/findings.md` is the dated evidence log (what experiments
showed, including dead ends) — it complements this PRD, which stays the home
of decisions. Design content still folds into the 3 docs, never into findings.

## 4. PoC requirements (the only build)

**Objective:** prove the four load-bearing claims of Mode A in the simplest
runnable form. A WG reader who clones the repo and runs one command must see
them pass. The PoC is *evidence*, not a product — it never ships as a
library, package, or SDK (AGENT_RULES: never ship the POC).

### 4.1 Functional requirements — the four assertions

Each assertion must be able to FAIL, and the demo must show the negative:

- **FR1 Windowing** — the wire carries `swapAge ≥ 90d → true|false`, never
  the swap timestamp; roaming → "in FR: yes/no", never a country list.
  Negative: flip the backstory ("swapped yesterday" ↔ "swapped 120d ago") and
  watch the boolean flip while the wire payload shape stays identical.
- **FR2 Nonce + expiry** — the signed response echoes the requester's nonce
  and carries an expiry. Negative: a replayed captured response is rejected;
  an expired response is rejected.
- **FR3 Blind hub** — requester↔operator legs are genuinely end-to-end
  encrypted (real crypto, not a comment); the hub's own log is printed and
  contains metering records only (count, route, "bill") — no numbers, no
  predicates, no answers. Negative: show the hub attempting to read yields
  ciphertext.
- **FR4 Monotone floor** — a request below the operator's published floor is
  **rejected**, never silently answered wider. Negative: loosen the floor in
  the request and show the rejection; tighten it and show acceptance.

### 4.2 Backend adapter seam

- **FR5** One operator-facts interface, two backends:
  - `mock` (default): local stub with scriptable backstories mirroring the
    Playground's admin model (per-number swap date, roaming country,
    reachability). Zero credentials, zero network, deterministic.
  - `orange`: Orange Network APIs Playground (+990 test numbers, backstories
    via its Admin API). Credentials come **only** from the environment
    (`ORANGE_CLIENT_ID` / `ORANGE_CLIENT_SECRET` or the Playground Basic Auth
    string) — never the tree.
  - The demo, assertions, and printed evidence are byte-for-byte the same code
    path either way; only the facts source swaps. Anyone with a free Orange
    account can flip `--backend orange` and re-prove the point live.
- **FR6** Single entry point: `node poc/demo.mjs [--backend mock|orange]`.
  Prints per-assertion evidence, exits 0 only if all four (including
  negatives) hold.

### 4.3 Non-functional requirements

- Node ≥ 20, **zero dependencies** — `node:crypto` for Ed25519
  signing/verification and the E2E leg (RSA-4096 OAEP-SHA256 envelopes, per
  the 2026-08-15 decision log entry — one vetted primitive, no hand-glued
  hybrid), `node:http` if a
  process split is ever needed (default: in-process actors, one file per
  role max).
- No secrets in the tree; `.env` gitignored; no real subscriber numbers ever
  (+990 test range or mock only).
- The demo's output never uses ZK language (claims discipline is enforced in
  the artifact, not just the docs).
- Simplicity bound: the whole PoC should stay small enough to read in one
  sitting (~a few hundred lines). If it grows past "readable by a WG member
  over coffee", it is doing too much.

### 4.4 Build ladder — modular, POC-first per module, user-validated per gate

**Binding rule (2026-08-15):** the PoC is a **product**. It is built as
independent modules; **each module is POC'd first (spike aimed at its toughest
assumption), then built properly, then works end-to-end ON ITS OWN, then the
USER validates it — before the next module starts.** No chaining builds, no
integrating an unvalidated module, no "the orchestrator checked it" — the
user runs each module's check themselves.

| Module | Scope (works alone) | Toughest assumption its POC must attack |
|---|---|---|
| M1 attestation core | sign + verify `{predicate, result, nonce, exp}` (closed claim set) | tamper/expired/wrong-key/wrong-question responses genuinely REJECT (negatives first); nonce check = stateless BINDING — single-use nonces are the RP's job (M6) |
| M2 blind envelope | E2E encryption past a hub that logs metering only | the hub truly cannot read; envelope SIZE side-channel stated honestly |
| M3 floor gate | monotone floor check | below-floor is NEVER answered — no silent widening path exists |
| M4 facts adapter (mock) | scriptable backstories behind one interface | flipping the backstory flips the bit; fixture can show the negative |
| M5 facts adapter (orange) | same interface, live Playground | built-ins shadow writes (measured) — READ-verify is load-bearing |
| M6 integration | one-command demo = the four assertions; RP issues single-use per-request nonces (completes rule-2 replay rejection); RP signs requests, operator verifies via trust directory before answering (request authenticity — closes the M2 audit open item) | the modules compose without weakening any single module's guarantee |

Gate mapping: G1 = M1–M4 + M6 all user-validated; G2 = M5 user-validated live.

Ladder status (2026-08-16): **M1 user-validated 19/19** (user ran 17/17
pre-hardening, then 19/19 post-release — dated findings entry).
**M2 user-validated 10/10** (post-release user run, 2026-08-15 — the first
dated user-run record for M2; spike user-validated → build → review round, 5
findings fixed → runbook green). **M3 user-validated 22/22** (user ran 14/14
at the pre-review build gate, then 22/22 post-release after two review rounds
plus a release-gate round hardened the module to 22 cases) (spec
signed off with 3 user decisions → spike at the silent-widening traps →
build → user ran `node poc/m3-check.mjs` 14/14 → 3 mutants killed → review
round 1: 7 warnings fixed, +3 canary cases → 17/17 → review round 2: 8
findings, +2 canary cases → 19/19 → release gate: 3 surviving mutants found
on already-fixed guards, +3 cases → 22/22, plus 500k-iteration differential
fuzz clean). **M4 user-validated 30/30 at `5d5e8aa`; current state agent-run
33/33 after the release gate, user re-run pending** (spec signed off with 4 user
decisions → spike observed six
fail-opens in the naive adapter incl. the headline flip with a working
negative control → build → 24 cases → 28 guards mutation-tested, 27 killed,
1 proven redundant by probe rather than left looking load-bearing → adversarial
review round: an independent 19-case check written from the spec alone before
reading the suite, plus an independent 28-mutant sweep that left EIGHT
survivors, closed 1 code defect (`describe()` could throw, breaking "wire input
never throws" — so M3's release-gate open item 1 was only partially closed),
5 unpinned load-bearing guards (+6 cases → 30) and 2 shared-harness fail-opens
(truthy-non-boolean `extra.ok`; a silently shrinking suite reading as green);
200k-round leak fuzz clean, all 13 spike claims reproduced; then a
`/code-review medium` round on PR #4: 8 findings, all confirmed by execution,
all fixed — wire-supplied country-set arrays running caller code (a sparse array
reached a SIGNED answer), a revoked proxy escaping `plainSnapshot`, two
unclamped diagnostics, an unbounded `describe()` input, a green last line on a
failing run, and a self-contradicting spec sketch; case count unchanged at 30,
mutation-proven; then the v0.2.0 **release gate**: 3 more fail-opens, all of one
shape — unbounded wire-reachable work no cap actually bounded — incl. a
TOCTOU `length` re-read that walked 5,000,000 indices to a SIGNED answer past
the 300 cap, and a `describe()` fallback chain whose `toJSON` hook killed the
process at **exit 134** (fatal OOM, uncatchable); renderer rewritten to invoke
nothing caller-supplied, +3 cases → 33, four mutations each red on its own case
incl. a guard-off control returning the OOM; dated findings entries 2026-08-16).
M5–M6 not started.

**M1/M2/M3's counts are from one user run on the user's own machine at commit
`5d5e8aa`** (dated findings record, 2026-08-16): 19/19, 10/10, 22/22 — and
30/30 for M4 at that commit. That run closed every re-run marker the tree was
then carrying. Two open items had been settled by the user in an earlier pass —
the three deliberately-unpinned redundant guards stay as documented
defence-in-depth, and `reachable` was minted into the illustrative spec-sketch
`Predicate` enum now rather than at M6 (no normative surface enumerates
predicate types, so nothing else moved).

**Honesty note — what has changed since that user run.** The v0.2.0 release
gate landed after it and changed two files, `poc/m4-facts-mock.mjs` and
`poc/m4-check.mjs`:

- **M4 is user-validated at 30/30 on the `5d5e8aa` tree; its current 33/33 is
  agent-run and a user re-run is pending** — the 0.1.0 precedent, where the
  user closes that gap after the release.
- **M1/M2/M3 are untouched by that round** — no module source, no check file,
  and `poc/check-harness.mjs` is unchanged — so their user-validated 19/19,
  10/10 and 22/22 stand at the current tree state.

(For the record, an earlier version of this note said the `/code-review` round
"changed exactly four files … verified by `git diff --stat`". `git show --stat
5d5e8aa` reports **seven**: those four plus `findings.md`, `prd.md` and
`poc/README.md`. The four were the code/spec files; the claim as written was
checkable and did not check out, so it is corrected here rather than dropped.)

### 4.5 POC-first discipline applied to each module

The riskiest assumption is **not** the crypto (stdlib, boring) — it is that
the **Orange Playground's sim-swap/roaming facts and backstory Admin API
actually fit the adapter shape** (auth flow, response fields, backstory
scripting). So:

1. Build mock backend + demo first (unblocked today; G1).
2. The moment credentials exist, run a ~15-min spike against the real
   Playground **before** writing the orange adapter — hit sim-swap +
   backstory-set endpoints raw, capture real responses, then shape the
   adapter to reality (a pasted doc sample under-specifies; verified pattern).
3. Stated caveat carried into all demo output: the operator shim simulates
   operator-side predicate computation and signing; consent/legal-basis legs
   are out of scope.

## 5. No-go list

Explicit and binding. "Useful" is not a defense for any of these.

1. **Never describe Mode A as zero-knowledge** — in docs, code output,
   commits, repo metadata, talks. ZK language is reserved for Mode B.
2. **No raw value ever reaches the requester in profile mode** — no
   timestamp, country, number, address. Bands are a declared transitional
   exception (profile rule 7), not a loophole.
3. **No readable hub, ever.** No caching, inspection, or "efficiency"
   features that let the aggregator see identifiers, predicates, or answers.
4. **No loosening.** Floors tighten downstream only; widening a window is an
   explicit, distinct, consent-visible operation — never a default, never
   silent.
5. **No Mode B build.** Holder presentment stays design-on-paper (D2 §Mode B)
   until Mode A has landed; no holder app, no proof circuits, no wallet
   integration now.
6. **No new vertical API as the primary ask.** Profile first; the
   CarrierAttestation new-case covers only what no existing API can (agent
   floors, Mode B).
7. **No product-ization.** No npm package, no SDK, no hosted service. The PoC
   is demo evidence only.
8. **No SIM-as-principal-root claims.** A SIM is farmable; floors price
   resets (economic scarcity), they do not create uniqueness. Never conflate
   the consumer-agent floor (voice+data) with the machine-agent profile (M2M).
9. **No unpinned claims, no stale submissions.** Every CAMARA/GSMA/AAIF state
   claim is pinned to a source and re-verified before filing; a claim that
   dies on re-verification is retracted visibly.
10. **No dependencies on zkagent/8een in submission docs.** They are cited as
    *one implementation* of the principal layer; the proposals must stand
    standards-neutral.
11. **No fourth document.** Design content folds into the 3-doc inventory
    (§3); this PRD's Decisions log absorbs what would otherwise be a side-doc.
12. **No APIBacklog PR before supporters.** Recruit 2–3 named supporters
    first (G4 gates G5); an unsupported PR from an independent burns the one
    first impression.
13. **No secrets or real subscriber data in the repo** — test ranges and env
    credentials only. `.claude/` session context is never published.

## 6. Sequence

```
Phase 0  Consolidate docs (this change)                          [G0]
Phase 1  PoC on mock backend — build + 4 assertions green        [G1]
Phase 2  USER: create Orange Playground account (free, instant)
         → 15-min raw spike → orange adapter → live re-run       [G2]
Phase 3  Circulate D2 profile in ICM / GitHub Discussion;
         collect reactions; recruit supporters                   [G3→G4]
Phase 4  File: Commonalities guideline proposal + sim-swap
         adoption PR (nonce+expiry on /check)                    [G5]
Phase 5  File: APIBacklog PR (CarrierAttestation new-case) with
         named supporters, template pre-filled from D2 §mapping  [G5]
Phase A  (parallel) Ground AAIF submission process → finalize D3
         → submit to Identity & Trust WG                         [G6]
Phase ∞  Attend cadence: Backlog WG + ICM + sub-project calls;
         respond within the 6-week/3-meeting staleness windows   [D5]
```

Phases 1 and 3 can overlap; Phase 5 strictly follows G4.

## 7. Process facts that gate the work (grounded)

- **CAMARA** (Linux Foundation; participation open, no membership fee). Our
  two deliverables ride **two different processes** (both grounded 2026-08-14
  from `Governance/documentation/API-Onboarding-and-Lifecycle.md` +
  `APIBacklog/README.md`):
  - **Profile → Commonalities/ICM (the light path):** ordinary WG
    contribution — issue + PR against the design guidelines, argued in their
    meetings/mailing list; **adoption = the maintainers merging the PR** into
    a guidelines release, which then propagates to all APIs via the
    meta-release cycle (every API must align with latest Commonalities to
    release). No TSC new-repo machinery.
  - **CarrierAttestation → APIBacklog (the heavy path):** GitHub issue
    (their issue template) + linked PR with the filled
    `API-proposal-template.md` → codeowners validate the template → member
    companies decide support (**each supporter commits ≥1 maintainer**) →
    bi-weekly Backlog WG sessions (2nd Thu 09:00 UTC, 4th Thu 15:00 UTC)
    check charter fit + overlap; objections must be resolved — the bar is
    **lazy consensus** → **TSC approves or rejects** → onboarding tracker →
    Sandbox repo created.
  - Template re-verified 2026-08-14: now includes a **CAMARA scope
    alignment** section — northbound API type (Service API vs Service
    Management API), Project Charter fit, no-overlap declaration, explicit
    out-of-scope items, owner declaration. East-west/federation APIs are out
    of scope. D2 §template-mapping pre-fills all of it.
- **Nothing is ever accepted by inactivity — inactivity only kills.**
  6+ weeks without GitHub activity, or the owner missing 3 consecutive WG
  meetings, or (post-TSC-approval) no onboarding progress within 3 WG
  sessions → **Frozen** (label, open PRs closed, off the agenda). Frozen ~6
  months / two meta-release cycles → **Archived**; resuming requires a brand
  new proposal. A Sandbox repo dies too: 3 months without contributions or
  no initial release within 6 months → archived.
- **Adoption is three ascending events:** WG lazy consensus → TSC approval →
  operators implementing. Lifecycle gates after Sandbox: **Incubating**
  requires one released API version **implemented by ≥1 real operator**,
  meta-release participation, and **3 committed maintainers from 3 different
  companies**; **Graduated** requires 2 release cycles with a stable version
  + multi-market certified deployment. An independent can carry steps up to
  TSC approval with supporters' votes; past Sandbox the ecosystem must
  co-own it by rule — which is why supporter recruitment (G4) is
  existential, not political nicety. Sub-project cadence example: SimSwap
  meets every 4 weeks, Thu 07:30 UTC.
- **Verified spec baseline (2026-08-14):** SimSwap v2.1.0 (`/check`,
  `/retrieve-date`, `/retrieve-age-band`), NumberVerification v2.1.0
  (`/verify`, `/device-phone-number`; 3-legged identifier omission is
  normative), KYC r2.2 (`kyc-match`, `kyc-fill-in`, `kyc-age-verification`).
  All Incubating. Open Gateway: 86 operator groups, 300+ networks. Full
  citations live in D2 §References.
- **AAIF (grounded 2026-08-15):** hosts community projects; Identity & Trust
  WG mandate matches D3 verbatim. Submission process verified from
  `github.com/aaif/project-proposals` (README + issue template
  `.github/ISSUE_TEMPLATE/project-proposal.yml`): (1) review eligibility
  guidance → (2) submit a new issue via the proposal template, all required
  sections complete → (3) backlog triage, scheduled before the Technical
  Committee → (4) TC vote at a scheduled meeting, majority (>50%) advances
  to the Governing Board. Declined proposals may reapply after 3 months
  with demonstrated progress. Next: map D3's sections onto the template
  fields (needs a logged-in view of the form or the raw template YAML).
- **Orange PoC rail:** Network APIs Playground — free instant developer
  account, 15 built-in +990 test numbers plus 10 custom, Admin API scripts
  backstories. Lab tier (real lab numbers +40789103050–59) exists but may
  change without notice — demo material, not a dependency.

## 8. Risks (execution)

Outward/technical risks (SD-JWT-vs-ZK pushback, holder availability, operator
incentive asymmetry, aggregator capture, MNP-vs-tenure, trust-directory
centralization, residual issuance metadata) live in D2 §Risks — they are
part of the proposal's honesty and stay in the outward text. Execution risks
we manage here:

1. **Solo author + staleness rules.** Mitigation: recruit a member-company
   co-owner early; calendar the cadences; the repo itself shows activity.
2. **Orange account is a user action** — PoC live tier (G2) blocks on it;
   mock tier (G1) does not. Don't let G2 block G3.
3. **AAIF template mapping pending** — process now grounded (§7); D3 still
   needs mapping onto the proposal template's required fields; keep it
   modular (summary / proposal / seam sections survive any format).
4. **Scope leak from Mode B enthusiasm** — the no-go list (§5.5) is the
   guard; PoC reviews check against it.

## 9. Decisions log

Dated, append-only. Rationale in one line; details in the stash/history.

- **2026-08-16 — M4 facts-adapter spec signed off (4 user decisions).**
  (1) **Fake clock:** backstories store RELATIVE time ("swapped N days ago")
  and every evaluation takes an INJECTED `now` — deterministic forever, no
  wall clock anywhere; relative→absolute conversion happens only at the
  M5/Orange boundary. (2) **Setter calls:** `setBackstory(number, {…})` is
  callable mid-run, mirroring the Playground Admin API — re-scripting a
  number and re-asking is how the FR1 negative is shown. (3) **Raw facts
  only:** the adapter returns raw facts (swap age, roaming country,
  reachability) and NEVER a boolean; a separate `evaluatePredicate(facts,
  predicate)` turns facts + predicate into the bit — this split is what
  makes M5 a drop-in swap. (4) **Unknown number = loud error**, never a
  default backstory (a silent default is fail-open — the trap family M3
  closed, measured again here answering for subscribers who do not exist).
  Trusted/untrusted follows M2/M3: operator input (backstories, numbers,
  clock) throws; wire input (the predicate) never throws.
- **2026-08-15 — Versioning scheme corrected (user-decided).** Module
  releases are features, not patches: this M3 release ships as **0.1.0**
  (not 0.0.5); each subsequent module bumps MINOR (M4→0.2.0 … M6→0.4.0);
  PATCH is for fixes; **1.0.0 = PoC complete + proposals submission-ready**.
  Existing 0.0.x tags stay untouched (history is not rewritten).
- **2026-08-15 — M3 floor-gate spec signed off (3 user decisions).**
  (1) Durations: `P<n>D` and `P<n>Y` only, 1 year = 365 days stated;
  months REJECTED as ambiguous (28–31 days — no honest compare exists).
  (2) Omitted axis in a request floor: the operator's published value
  applies anyway (omission = silent tightening, allowed); the returned
  `effective` floor makes the inheritance visible. (3) Unknown/typo'd
  axis: closed-set rejection (an ignored typo silently drops a constraint
  — the exact widening path M3 kills). Gate = pure function
  `checkFloor(published, requested)`; published floor is per-OPERATOR
  config (never hardcoded — the §3.4 reference values are the demo
  operator's choice); broken published config throws loud, wire input
  never throws.
- **2026-08-15 — Both v0.0.3 security Mediums closed now (user-decided:
  "fix both now").** (1) Duplicate claim keys are a rejection — normative in
  profile rule 2, implemented in the M1 verifier (byte-level scan, keys
  compared after escape decoding; mutation-proven: guard off, one signed
  blob reading true-to-last-wins/false-to-first-wins parsers is ACCEPTED;
  guard on, 19/19). (2) Key pinning — normative in profile rule 3: the
  verifier pins the expected operator key before verification; unsigned
  `iss` is a lookup hint and must never select the trusted key (the
  reference verifier already had this shape — text-only; code lands with
  the trust directory at M6).
- **2026-08-15 — Decisions round after the M2 gate (all user-decided).**
  (1) Profile rule 6 gains the size line: envelopes MUST NOT expose payload
  size to the aggregator (fixed-length or padded) — backed by the M2
  measurement that a length-tracking transport turns the billing log into a
  side channel. (2) Request authenticity assigned to M6: the RP signs
  requests, the operator verifies via the trust directory before answering
  (closes the M2 audit open item). (3) Envelope replay to the operator =
  documented honest limit (billing noise only; production API auth, rate
  limits and billing reconciliation cover it) — no stateful nonce memory in
  the demo. (4) Guardrails pre-tool hook wired locally (`.claude/`,
  gitignored): denies secret-file writes and destructive shell, asks on
  auth/CI/settings — armed before M5 touches Orange credentials. (5) Author
  placeholders filled: Amr Hassan. (6) AAIF submission process grounded
  (§7) from the aaif/project-proposals repo.
- **2026-08-15 — M2 envelope shape settled.** One vetted stdlib primitive:
  RSA-4096 OAEP-SHA256 (`publicEncrypt`/`privateDecrypt`), keys exchanged
  via the trust directory — NEVER inside payloads (this is what makes the
  446-byte cap workable). `seal` throws loudly on the sender's own faults
  (oversize, non-RSA key — capacity derived from the recipient key);
  `open` rejects-never-throws on untrusted wire input, with failure modes
  deliberately collapsed to one reason (padding-oracle avoidance).
  Measured: ciphertexts constant 512 B → the hub's byte log carries no
  content signal; count/timing/pairing remain visible (stated honestly).
  Bigger payloads (Mode B, bundles) exceed one envelope and require a
  vetted AEAD hybrid as an explicit future decision — never hand-glued
  primitives. Demo transport only; production = TLS + HPKE-class.
- **2026-08-15 — M1 built under the ladder; verifier shape settled.**
  Spike (throwaway, user-validated) → build → review round. Attestation =
  Ed25519 (`node:crypto`, one vetted primitive, zero deps), sign-the-exact-
  bytes (no canonicalization), unix-ms `exp` in the demo. Verify order:
  response shape → signature over raw bytes (throw-safe) → parse →
  non-null-object claims → predicate matches the question asked → `result`
  is a boolean → nonce (type-gated) → expiry → closed claim set (any field
  beyond `{predicate, result, nonce, exp}` rejects — the one-invariant's
  requester-side enforcement point). Verifier is STATELESS —
  single-use nonces are the requester's job (honest limit, in the tests'
  wording). `predicate` added to the spec sketch's signed set (it was
  missing — a signed answer to a different question would have verified).
  Production note: demo picks Ed25519 for determinism; the profile picks
  whatever standard JOSE algorithm the WG settles on.
- **2026-08-15 — `findings.md` created (user-ordered).** Dated evidence log
  at `docs/01-product/findings.md`: experiments and dead ends, complementing
  this PRD. Not a design side-doc — design still folds into the 3 docs.
- **2026-08-15 — PoC build ROLLED BACK to G0; module ladder made binding
  (§4.4).** The first build went monolith-then-integrate with orchestrator-only
  checks — violating AGENT_RULES build-incrementally and keeping the user out
  of validation. Code archived out of the repo; grounded spike findings
  (Playground token endpoints, maxAge in HOURS capped 2400, built-in
  write-shadowing, 403=unknown-number) are KEPT as dated evidence in
  `poc/README.md` — knowledge survives, code restarts. Every module: POC →
  build → user validates → only then the next.

- **2026-08-14 — Consolidation (this PRD).** 3-doc inventory (PRD + CAMARA +
  AAIF proposals); `carrier-attestation-proposal.md`, `camara-plan.md`,
  `aaif-plan.md`, and `docs/02-features/attested-windowed-disclosure.md`
  folded and deleted. PoC = Node zero-dep, mock backend default + swappable
  Orange adapter, one command, four assertions with negatives. No-go list
  made a first-class PRD section.
- **2026-08-14 — Template re-grounded.** APIBacklog template gained a scope-
  alignment section (northbound type, charter fit, overlap declaration) —
  folded into D2's pre-filled mapping.
- **2026-08-14 (earlier) — Core standard = attested windowed disclosure.**
  Signed, nonce-bound, expiring booleans under monotone floors; never raw
  values.
- **2026-08-14 (earlier) — Two modes; Mode A ships first.** Mode A preserves
  per-query billing + aggregator revenue share (the adoption wedge); Mode B
  (holder presentment, true ZK) is roadmap. A2P lesson → the hub is
  structurally blind, not contractually trusted.
- **2026-08-14 (earlier) — Horizontal profile, not a new vertical API.**
  CAMARA precedent (`/retrieve-age-band`, identifier-free 3-legged,
  `kyc-age-verification`) makes "finish what you started, catalog-wide" the
  ask; CarrierAttestation new-case only for agent floors + Mode B.
- **2026-08-14 (earlier) — Two tracks, one seam.** CAMARA = operator side,
  AAIF = agent side; they meet at the RFC 9421 header; neither depends on the
  other's approval.
- **2026-08-14 (earlier) — Agent-grade floor.** Consumer:
  `voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d (∧ postpaid optional)`, monotone.
  Machine-agent profile is separate and embraces M2M. Economic scarcity,
  explicitly not uniqueness.
- **2026-08-14 (earlier) — Name: justabit; repo-first, not npm-first.**

## 10. AGENT_RULES conformance (the caveat, stated)

This repo follows `.claude/remember/AGENT_RULES.md` with one declared
adaptation: **the product is documents; the only code is a small PoC that
must stay shippable/runnable in its simplest form.** Concretely:

- **Applies unchanged:** spec-before-build (this PRD), POC-first aimed at the
  riskiest assumption (§4.4), prove-don't-assert (assertions must show the
  negative), no secrets in the tree, dependency hierarchy (zero deps),
  surgical changes, no papering over (honest limits stay in the text).
- **Merge/release gates:** nothing merges blind — every merge goes through
  code review plus the release flow (`/code-review`; `/security` on anything
  touching credentials or untrusted input; `/ship` pre-release). Outward
  submissions additionally re-verify every grounded claim (no-go 9).
- **Adapted:** the Testing Trophy does not govern prose — a proposal's "test
  suite" is (a) grounded-claim re-verification before every submission and
  (b) WG scrutiny; retractions are the regression fixes. The PoC gets
  assertion-style self-checks in the demo itself (exit code is the test);
  a separate test pyramid would be heavier than the artifact it tests.
- **Unchanged even for the PoC:** it is never shipped as a product (§5.7),
  and a real secret never enters the tree even in a spike.

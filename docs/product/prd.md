# justabit — PRD

**Status:** ACTIVE — this document leads all specs, proposals, and the PoC.
**Date:** 2026-08-14 (consolidated from `carrier-attestation-proposal.md`,
`camara-plan.md`, `aaif-plan.md` — all three deleted; outward content moved to
`docs/product/`).
**Last updated:** 2026-09-02.
**Doctrine:** `CLAUDE.md` (invariants, claims discipline). This PRD is the
*what/when/how-good*; CLAUDE.md is the *never-break*.

---

## 1. What this project is

A standards effort: make telecom network APIs answer with **exactly what the
requester needs — a signed, nonce-bound, expiring boolean under monotone
floors — and nothing else, ever** ("attested windowed disclosure").

This is a **docs-and-proposals project with one small runnable PoC**, not a
software product. The deliverable is text that survives CAMARA/IETF
working-group scrutiny; the PoC exists to make the text undeniable. The
decision this PRD serves: *what do we write, build, and file — in what order —
to get the profile adopted catalog-wide, as an independent author with no
member company behind them?*

## 2. Goals and success criteria

Define "good" before building (AGENT_RULES). In order of proof strength:

| Gate | Success looks like | Evidence |
|---|---|---|
| G0 Docs consolidated | Exactly 3 living docs (this PRD + 2 proposals); no orphan cross-references | repo grep |
| G1 PoC runnable | `node camara/v1/poc/demo.mjs` passes all 4 assertions on a clean clone, zero credentials, exit code 0 | run output |
| G2 PoC live | Same demo, `--backend orange`, against Orange Playground with scripted backstories | run output |
| G3 Circulated | Profile posted to ICM discussion / GitHub Discussion; reactions collected | links |
| G4 Filed (CAMARA) | Commonalities guideline proposal + sim-swap adoption PR + APIBacklog issue/PR submitted (API family owner: Cairenes Solutions) — filing does not wait on named supporters | issue/PR links |
| G5 Supported | Named operator supporters recorded in the template's Supporters field — populated by the Working Group during evaluation, downstream of filing (no-go 12 retired 2026-08-25) | names in template |
| G6 IETF filed | Internet-Draft submitted covering agent/delegation semantics (target: OAuth WG automated-agent-authorization work item; CATALIST as a routing venue if OAuth WG doesn't fit) | MET 2026-08-31, re-posted 2026-08-31 as `draft-hamr-...`: https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/ |

Timescale is telecom-speed: quarters, not weeks. Sustained presence is itself
a deliverable (CAMARA freezes proposals after 6+ weeks GitHub inactivity or 3
missed WG meetings).

## 3. Deliverables and the 3-doc inventory

**Hard rule: three living documents, no more.** New design content is folded
into one of these (this PRD grows a dated Decisions entry, §9); side-docs are
not created. Proposal docs follow the target body's proposal standards.

| # | Deliverable | Where | Consumer |
|---|---|---|---|
| D1 | **This PRD** — requirements, sequence, no-gos, decisions | `docs/product/prd.md` | us |
| D2 | **CAMARA proposal** — problem, the normative profile (8 rules), modes, phase plan, risks, pre-filled APIBacklog template mapping. CAMARA filing is now versioned per project, per version at the repo root: v1 is the frozen record as filed 2026-08-28; v2 is the working rescoping draft opened 2026-08-31 after WG feedback. | `camara/v1/docs/camara-attested-windowed-disclosure.md` (v1); `camara/v2/docs/camara-attested-windowed-disclosure.md` (v2, drafting) | CAMARA Commonalities / ICM / APIBacklog WG |
| D2 v2 | **CAMARA resubmission** — as a Commonalities Scope Enhancement, not a new sub-project. Five files: `camara-attested-windowed-disclosure.md` (rewrite), `camara-filing-template.md`, `camara-filing-issue.md`, `pr331-reply-posted-2026-08-31.md`, `wg-deck-outline.md` | `camara/v2/docs/` — drafting, not filed | CAMARA Commonalities WG |
| D3 | **Agent/delegation proposal** — agent/delegation side only, targets the IETF OAuth WG. Now versioned per project like CAMARA: v1 is the frozen record of `-00` as posted 2026-08-31; v2 is `-01`, SUBMITTED and posted 2026-09-02 (expires 2027-03-06): all four scope items and Appendix A direction 4 drafted; two review rounds run and their findings fixed; the PoC catch-up done; author-tools and idnits both ran clean on the submitted bytes. | `ietf/v1/docs/ietf-agent-delegation.md` (v1); `ietf/v2/docs/draft-hamr-oauth-agent-delegation-01.xml` (v2, posted) | IETF (OAuth WG); supersedes `docs/archive/aaif-agent-auth.md`, retained only as a dated, superseded record of the earlier AAIF-targeted text |
| D4 | **PoC** — Mode A demo, 4 assertions, mock + Orange backends | `camara/v1/poc/` | WG readers, demo audiences |
| D5 | Sustained WG presence (meetings, mailing lists, PR responses) | calendars, minutes | CAMARA anti-staleness rules |
| D6 | **IETF submission artifact** — posted 31 August 2026 as `draft-hassan-oauth-agent-delegation-00`, then re-posted the same day as `draft-hamr-oauth-agent-delegation-00` (https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/), `Replaces` pointing at the `-hassan-` draft, which is now Datatracker state `repl`/Replaced (stays posted, un-deleted, until its own 4 March 2027 expiry); the live document expires 4 March 2027; an individual submission, NOT adopted by the OAuth WG, and reviewed by no one — posting confers a timestamp and visibility, not standing; submission is not adoption, adoption is not publication | `ietf/v1/docs/draft-hamr-oauth-agent-delegation-00.xml` | IETF (OAuth WG) |

Supporting artifacts (not documents): `camara/v1/spec/carrier-attestation.yaml` stays an
illustrative OpenAPI sketch (non-normative); `README.md` is the adopter-facing
front door and mirrors — never forks — the proposals;
`docs/logs/findings.md` is the dated evidence log (what experiments
showed, including dead ends) — it complements this PRD, which stays the home
of decisions; `camara/v1/docs/camara-filing-issue.md` (step 1, the GitHub
issue body) and `camara/v1/docs/camara-filing-template.md` (step 2, the
filled API-proposal template) are the filed CAMARA APIBacklog deliverables,
derived verbatim from D2 §10 and never a source of design
content — each is an immutable record now that it has been filed. A stub at
the old `docs/product/camara-attested-windowed-disclosure.md` path keeps the
filed issue #330/PR #331 links resolving (GitHub has no redirects). Design content
still folds into the 3 docs, never into findings.

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

- **FR7 The wired predicate set (added 2026-08-17, PRD §9 user-signed).** The
  PoC answers `simSwapAge`, `deviceSwapAge`, `roamingIn`, `presentIn`,
  `numberMatch` and `reachable`, and nothing else. Every one is backed by an
  endpoint OBSERVED answering live; a type nothing computes is never minted (the
  fabricated-fact rule, one layer up). Five rules bind all six, without
  exception: (1) the answer is a signed boolean or a refusal — never a value, a
  score or a date; (2) an off-menu threshold is refused LOUDLY and never rounded
  to the nearest bucket; (3) anything the operator cannot answer honestly is a
  refusal; (4) the operator publishes the floor and the requester may only
  tighten; (5) raw values the operator legitimately holds stay operator-side.
  Each new predicate ships with its own negative and its own disabled-guard
  control, like every assertion before it.

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
- **FR6** Single entry point: `node camara/v1/poc/demo.mjs [--backend mock|orange]`.
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
| M1 attestation core | sign + verify `{predicate, result, nonce, exp}` (closed claim set) | tamper/expired/wrong-key/wrong-question responses genuinely REJECT (negatives first); nonce check = stateless BINDING — single-use nonces are the requester's job (M6) |
| M2 blind envelope | E2E encryption past a hub that logs metering only | the hub truly cannot read; envelope SIZE side-channel stated honestly |
| M3 floor gate | monotone floor check | below-floor is NEVER answered — no silent widening path exists |
| M4 facts adapter (mock) | scriptable backstories behind one interface | flipping the backstory flips the bit; fixture can show the negative |
| M5 facts adapter (orange) | same interface, live Playground | built-ins shadow writes (measured) — READ-verify is load-bearing |
| M6 integration | one-command demo = the four assertions; requester issues single-use per-request nonces (completes rule-2 replay rejection); requester signs requests, operator verifies via trust directory before answering (request authenticity — closes the M2 audit open item) | the modules compose without weakening any single module's guarantee |

Gate mapping: G1 = M1–M4 + M6 all user-validated; G2 = M5 user-validated live.

Ladder status (2026-08-16): **M1 user-validated 19/19** (user ran 17/17
pre-hardening, then 19/19 post-release — dated findings entry).
**M2 user-validated 10/10** (post-release user run, 2026-08-15 — the first
dated user-run record for M2; spike user-validated → build → review round, 5
findings fixed → runbook green). **M3 user-validated 22/22** (user ran 14/14
at the pre-review build gate, then 22/22 post-release after two review rounds
plus a release-gate round hardened the module to 22 cases) (spec
signed off with 3 user decisions → spike at the silent-widening traps →
build → user ran `node camara/v1/poc/m3-check.mjs` 14/14 → 3 mutants killed → review
round 1: 7 warnings fixed, +3 canary cases → 17/17 → review round 2: 8
findings, +2 canary cases → 19/19 → release gate: 3 surviving mutants found
on already-fixed guards, +3 cases → 22/22, plus 500k-iteration differential
fuzz clean). **M4 user-validated 33/33** (user ran 30/30 at `5d5e8aa`, then
33/33 post-release at v0.2.0 after the release-gate round — dated findings
entry) (spec signed off with 4 user
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
**M5 user-validated LIVE 48/48 + 11/11 at `8e842c3`, the shipped v0.3.0 state
— G2 MET, no asterisk, nothing pending.** (User ran 47/47 + 11/11 at
`69b6f2e`, which met G2 first; the release gate then changed all three M5
files, so the user re-ran at `4ac60e9` clean; a post-gate code review round
(2026-08-17) fixed two more adapter redaction-order defects, an `assertNow`
range bound and three live-check faults — again all three M5 files — so the
user re-ran once more at `8e842c3` clean. Counts were unchanged (48/11)
throughout; each gap was closed by a run, not assumed to carry over. An earlier
44/44 + 10/10 user run at `2fd62ba`, undated at the time, is recorded in the
findings log for completeness.) Spike first: six live rounds re-ran
every recorded Playground finding before a line was written, because they were
measured on 2026-08-14/15 and a sandbox can move. Seven findings held, **three
changed** — `403 FORBIDDEN` no longer means "unknown number" on its own (a
wrong-surface token gives the same status with a different message), sim-swap
is no longer the whole interface (roaming AND reachability are both live, so
all three axes are wired and nothing is faked), and THE TRAP holds with a
sharper mechanism (a bare `UPDATE` on an unclaimed built-in now fails loud with
`400`, but the adapter's own CREATE-then-UPDATE path reproduces the echo-lies
behaviour exactly: echo carried the written date, the next READ did not). The
spike also found the stored credential is already `Basic `-prefixed — a
double-prefix that fails both token endpoints, and cost the spike's first
round. Build: `camara/v1/poc/m5-facts-orange.mjs` (same interface, `evaluatePredicate`
NOT reimplemented — M5 exports `createOrangeFacts` and nothing else, asserted
by a case). **Offline `node camara/v1/poc/m5-check.mjs` 47/47 exit 0 with zero
credentials and zero network** (injected transport replaying the spike's
captured bytes, so it runs on a clean clone); **live `node
camara/v1/poc/m5-check-live.mjs` 11/11 exit 0**, including the FR1 negative on real
infrastructure and the write-trap defence firing on a real built-in with the
custom-slot control succeeding; **32 mutations, 32 killed, 0 survivors.** The
sweep found two defects in the CHECK itself — a redaction case that was
vacuous (its body never reached a branch that quotes bodies, so it could not
fail) and an assertion too crude to survive its own error text — both fixed.
Then an **adversarial review round** (2026-08-16, dated findings entry) took
the suites 44 → **47** and 10 → **11** on three confirmed issues, found by an
independent 30-case check written from the spec BEFORE either shipped suite was
opened plus an independent 16-mutant sweep: (1) the write-verification
diagnostic — the message the module's most load-bearing guard produces — was
the single throw path that skipped `redact()`, leaking a planted credential half
and a planted bearer token, and it clamped AFTER serializing (measured 2354ms on
a 2e8-char value, and a `RangeError` at V8's max string length that destroyed
the loud message entirely); (2) a required mutant SURVIVED — "one token per
surface" was unpinned because the check answered both token endpoints with the
same fixture, though the two are measured non-interchangeable; (3) the live
check's cleanup DELETE was unobserved, so an interrupted run leaked a custom
slot toward the 10-cap silently. All three fixed and mutation-proven (18/18
killed, 0 survivors — the 16 above plus 2 minted against the new guards); a
315-combination leak fuzz with a planted-leak control is clean, and M1–M4 are
unchanged by exit code.

**Then the user ran M5 on their own machine and G2 was MET** — `node
camara/v1/poc/m5-check.mjs` **47/47** and the live `node camara/v1/poc/m5-check-live.mjs` **11/11**
at commit `69b6f2e` (dated findings entry, 2026-08-16). That is the first G2
validation in the project, and it stands as a record of that tree state.

**The v0.3.0 release gate then found five more issues, which re-opened the
gate** — the same post-validation pattern v0.2.0 hit with M4, and recorded the
same way rather than blurred into the line above. Two were real code defects: a stored
`countryName` element was COERCED by `Array.prototype.join`, so a hostile
element replaced the module's loudest guard with a bare 40-char `TypeError`
(offline 47 → **48**); and the live quota assertion compared `end === start`
against a baseline taken before the CUSTOM demo slot existed, so a FRESH
account's first run went RED and blamed the trap case's cleanup, which had in
fact succeeded — reproduced live (`start=0 end=1`, exit 1) and green on the
identical condition after the fix. Three were docs-honesty defects, incl. a
catalog-mapping table whose illustrative shape M1 would have REJECTED under a
sentence claiming the PoC produced it. **The user then re-ran the fixed tree at
`4ac60e9` and reported 48/48 offline + 11/11 live**, re-establishing G2 at that
state (dated findings entry, 2026-08-16). A post-gate code review round
(2026-08-17) then found and fixed two more adapter defects — `joinStored()`
clamped stored `countryName` strings BEFORE `redact()` saw them, so a >48-char
credential echoed off the wire rode an un-redactable 48-char fragment into the
write-verify diagnostic (the exact clamp-before-redact leak the `show()`
comment warns about, one step upstream of it); and `tokenFor()`'s body read sat
outside the try that redacts, the unfixed sibling of the `post()` /security
Low — plus three live-check faults (an unguarded raw-admin token bootstrap
that cached `undefined` and made case 11 blame quota for auth, an unguarded
courtesy re-script that could kill an all-green run before the tally, and case
11's at-cap conjunct blaming a successful cleanup), plus an `assertNow()` bound
at `MAX_EPOCH_MS` (a safe integer past `Date`'s range replaced the module's
loud message with a bare `RangeError`). Counts unchanged (48/11) — **and the
user re-ran the two-line runbook on the fixed tree the same day and reported
both clean, re-closing G2 at `8e842c3`**.

**M6 round (2026-08-17) — two user-validated modules changed, so two counts
moved.** The M6 composition spike attacked "the modules compose without
weakening any single module's guarantee" and came back with two module-level
asks, both user-signed and both built surgically: M1 now **exports** its
duplicate-top-level-key scanner so a signed REQUEST can be checked for the same
equivocation (**19 → 20 cases**), and M3's declared fix point is closed — its
rejection-message builder threw a bare `TypeError` on a BigInt or a
throwing-`toJSON` value instead of producing the loud named-input rejection
(**22 → 23 cases**, every previously pinned reason byte-identical). Both counts
are **AGENT-RUN 20/20 and 23/23 by exit code; a user re-run is PENDING.** The
user's 19/19 and 22/22 records stand for the trees they were run on and are not
transferred to these — same rule the M4 and M5 rounds followed.

**M6 BUILT (2026-08-17) — `camara/v1/poc/demo.mjs` + `camara/v1/poc/m6-check.mjs`. AGENT-RUN 22/22
(demo) and 28/28 (check) by exit code; USER VALIDATION PENDING, so G1 is NOT
yet met.** POC first: a throwaway composition spike outside the tree attacked
"the modules compose without weakening any single module's guarantee" and came
back with five findings that shaped the build rather than being discovered
during it — (1) the repeated-query oracle (decision #1 above), (2) the
hand-rolled request verifier had no duplicate-key defence because M1's scanner
was module-private (decision #2), (3) M3's rejection-message builder threw on a
non-JSON value (the fix point, above), (4) the obvious canonical-predicate
spelling is NOT injective — a mutation dropping the threshold left the whole
spike green while the operator answered `gte P1D` to a `gte P90D` question, and
`[FR,BE]` collided with the single-element set `['FR,BE']` — and (5) M3's
unclamped, wire-derived reasons can exceed M2's envelope capacity, where `seal()`
THROWS, so an unclamped refusal crashes the operator instead of refusing it.
M6 therefore owns four things no module owns: the transport frame
`{iss, payload, sig}`, the injective canonical predicate string, the single-use
nonce store (M1's nonce check is stateless BINDING and says so), and the reason
clamp. A FIFTH was not in the plan and is the round's own finding: an
adversarial probe of the finished, green `demo.mjs` showed the top-level REQUEST
field set was still open, so a request carrying `floors` — one letter off — had
its floor silently dropped and got a signed answer under the operator's own
`P90D` while the requester believed it demanded `P365D` (decision log entry
above). Closing it took the demo to 22 assertions and the check to 27 cases (28
after the exit-code fix logged above, and **38 after the 2026-08-17 adversarial
review round** — four real defects, one more found while fixing them, and ten
independent mutation survivors, all pinned).
The lesson is worth more than the fix: **a closed-set discipline is only as good
as its outermost layer, and the composition owns a layer none of the modules
do** — which is exactly the failure class M6's own POC gate was aimed at, found
one level above where the spike was looking. Beyond the four assertions the demo also shows the request-path guards —
off-menu refusal, duplicate-key refusal, response key pinning — each with its
own disabled-guard control, and signs its refusals so the blind hub cannot forge
a denial. The check is offline in both modes: `--backend orange` is exercised
through an injected transport replaying captured Playground bytes, and with the
keys and nonce held fixed the two backends produce a **byte-identical signed
frame**, which is one honest half of the FR5 "only the facts source swaps"
claim: it shows the wire carries the bit and nothing about where the bit came
from. The other half is that the orange leg drives the bit at all — replay a
5-day-old swap through the same injected transport and the same question comes
back `false` — added 2026-08-17, because byte-identity alone would also pass for
an adapter that ignored its own responses.

**Mutation coverage, corrected 2026-08-17.** This paragraph used to claim "18
mutations against M6's own guards, all killed". An INDEPENDENT sweep of 34
meaningful mutations then found **10 survivors — 29% survival**, so the original
18 were a self-selected set that happened to hit what the suite already pinned.
The survivors were: the malformed-frame and missing-nonce transport rejects;
the floor gate's position relative to `getFacts` (the ordering argument the
whole pipeline rests on, claimed in two comments and asserted nowhere); three of
`verifyRefusal`'s four checks; two of `unpackSigned`'s guards; the hub log's
open field set; and M3's `render` symbol/function branches. All ten are pinned
by cases added the same day (m6-check 29–38, m3-check 24), and the review's four
real defects plus one found while fixing them are pinned beside them. The live
`--backend orange` run is the user's, in the runbook — nothing in this round
touched the network.

On §4.3's simplicity bound, honestly: `camara/v1/poc/demo.mjs` is 1093 lines, of which 452
are comment, 90 blank and 551 code — and roughly half of that code is the narrative
PRINTING the reader asked for (the `Q:`/`A:`/negative-flip transcript), not
composition machinery, which is closer to 200 lines. That is over "a few hundred
lines" if the whole file is counted and inside it if the explanation is counted
as prose, which it largely is. Recorded rather than trimmed: the comments and
the narrative are the deliverable for a WG reader, and cutting them to hit a
line count would optimise the wrong thing.

**Scope of that claim, corrected 2026-08-17.** It used to read "every count
above is from a run on the user's own machine", and by the time the M6 and
review rounds landed above it that was false: M6's 22/38, M1's 20 and M3's 24
are all marked AGENT-RUN in the paragraphs directly above, and this was the one
place in the repo claiming user validation for M6. It contradicted the ladder's
binding rule, so it is narrowed to what actually happened rather than deleted.

**The user-run counts are M1 19/19, M2 10/10, M3 22/22, M4 33/33 and M5 48/48
offline + 11/11 live**, at the commits named below. Everything the 2026-08-17
rounds changed — M1 19→20, M3 22→24, M6 22 assertions / 38 cases — is AGENT-RUN,
with a **user re-run PENDING**. At commit
`5d5e8aa` (dated findings record, 2026-08-16) the user ran 19/19, 10/10, 22/22
and 30/30. The v0.2.0 release gate then changed two files —
`camara/v1/poc/m4-facts-mock.mjs` and `camara/v1/poc/m4-check.mjs` — taking M4 to 33 cases, leaving
M1/M2/M3 untouched (no module source, no check file, and `camara/v1/poc/check-harness.mjs`
unchanged). **After the v0.2.0 merge (main at `7c41c83`, tag `v0.2.0`) the user
re-ran all four and reported 19/19, 10/10, 22/22, 33/33** (dated findings record,
2026-08-16) — closing the last "user re-run pending" marker, per the 0.1.0
precedent where the user closes that gap after the release. Two open items had
been settled by the user in an earlier pass — the three deliberately-unpinned
redundant guards stay as documented defence-in-depth, and `reachable` was minted
into the illustrative spec-sketch `Predicate` enum now rather than at M6 (no
normative surface enumerates predicate types, so nothing else moved).

**M2, M4 and M5 carry no asterisk** — user-validated at their current case
counts on the shipped tree. **M1, M3 and M6 do**: the 2026-08-17 rounds moved
M1 to 20 and M3 to 24 and built M6, and none of those counts has been run by the
user yet. (Amended 2026-08-17 — this line said "all five are user-validated" and
had not been re-read against the rounds that landed after it.) **Amended again,
2026-08-18: M4 no longer belongs in the no-asterisk group either.** The 3 → 6
predicate round (same day, landing after this line was written) moved
`m4-check.mjs` 33 → 40 without a user re-run — the maintainer's last M4 run
was still at 33 — so M4 carries an asterisk too, same as M1 and M3. (M3's own
count also moved again the same round, 24 → 25, per the `presentIn` entry
below; still no user re-run at either count.) M5's asterisk was raised twice and
retired twice by runs, not by argument: G2 was met at `69b6f2e`, re-opened by
the release-gate fixes and re-established at `4ac60e9`, re-opened again by the
2026-08-17 post-gate review round (all three M5 files touched) and re-closed at
`8e842c3`. Keeping the asterisk visible until a run retires it is deliberate —
the alternative is to ship fixes unmentioned and let an earlier G2 record
appear to cover code it never saw.

**M5's asterisk was raised a third time and retired a third time, same rule
(2026-08-18).** The 3 → 6 predicate round moved `m5-check-live.mjs` 11 → 19
cases without a user re-run at the time (recorded PENDING in the decisions
log below); the user then ran it live at tip `3276ed0` and reported 19/19,
retiring it again. The same live session also produced **M6's first CLEAN
user run of `camara/v1/poc/demo.mjs` itself**, `--backend orange` → 33/33 — but not its
first user run: the user had already run it live on 2026-08-17 and scored
**32/33**, and that run is what surfaced the vacuous leaky-operator control
(the fix this whole entry is about). M6's asterisk stayed up through that
first, failing run and is retired only now, by the second, clean one.
`m6-check.mjs`'s own offline count (45) and M1's (20) and M3's (25) are
unaffected by either run and stay asterisked. Full detail in the 2026-08-18
decisions-log entry.

**All asterisks retired (2026-08-18, superseding the four paragraphs
above).** Two `/code-review` rounds the same day moved M1 to 20, M3 to 26,
M4 to 40, M5's offline count to 60, M5's live count to 19 and built M6 to 46
— every count above this paragraph is now stale by module count, not just
by asterisk. The user then ran the FULL suite at code commit `4446517` /
docs commit `c921508` (2026-08-18 08:16) and reported every module clean at
its current count: M1 20/20, M2 10/10, M3 26/26, M4 40/40, M5 60/60 offline
+ 19/19 live, M6 46/46, `demo.mjs` 33/33 mock and 33/33 live. **M1–M6 all
carry no asterisk as of `4446517`/`c921508`** — this is the first time every
module has been user-validated at its current count on the same tree. See
`findings.md`, 2026-08-18 (latest).

(For the record, an earlier version of this note said the `/code-review` round
"changed exactly four files … verified by `git diff --stat`". `git show --stat
5d5e8aa` reports **seven**: those four plus `findings.md`, `prd.md` and
`camara/v1/poc/README.md`. The four were the code/spec files; the claim as written was
checkable and did not check out, so it is corrected here rather than dropped.)

**Asterisks raised and retired a further time, on the uncommitted tree
(2026-08-18, superseding the paragraph above).** Two further rounds moved
M4 to 42 (case 42, the guard-text-search fix) and M5's offline count to 66
(the axis-signal-unification round, finishing what the roaming/reachability
round started), both AGENT-RUN with a user re-run PENDING at the time — see
the two decisions-log entries below the top one. The user then ran the FULL
suite on their own machine against the CURRENT uncommitted working tree and
reported every module clean at its current count: M1 20/20, M2 10/10, M3
26/26, M4 42/42, M5 66/66 offline + 19/19 live, M6 46/46, `demo.mjs` 33/33
mock and 33/33 live — every count user-run. **M1–M6 all carry no asterisk
on this tree.** Because the tree is uncommitted, this record is pinned to
the tree itself rather than a commit pair: it covers exactly the working
tree present at the time of the run, and per this repo's own rule, any
later change to a covered file (commit or no commit) re-opens the relevant
gate again. Full record: `CHANGELOG.md`, Unreleased, and the top entry of
the decisions log below.

**Asterisks raised again by a further fix round (2026-08-18, superseding the
paragraph above): `demo.mjs` moved 33 → 34 cases, agent-run only.** The
six-item fix round (top decisions-log entry) added a persisted regression
case for the pre-seal capacity guard fix, so `demo.mjs`'s own count is no
longer the `33/33` the paragraph above reports — it is **34/34, agent-run,
NOT yet user-validated at this count**. `m6-check.mjs` (which shells out to
`demo.mjs` and now PARSES its result line rather than matching the literal
`'RESULT: 33/33'`, closing the same "pins a spelling, not a behaviour"
defect class fixed twice already for `m4-check.mjs` case 42) moved 46 → 47
for its own new case. Every `33/33` figure ABOVE this paragraph remains an
accurate dated record of the tree it was measured against and is NOT
rewritten; it simply no longer describes the current tree. **M1–M6 all
carry an asterisk again** pending a user run at the new counts. Full
record: `CHANGELOG.md`, Unreleased, and the top entry of the decisions log
below.

**Asterisks raised again by a `/code-review medium --fix` round (2026-08-18,
superseding the paragraph above): `m5-check.mjs` moved 66 → 67, `demo.mjs`
moved 34 → 35, both agent-run only.** The review closed two test-coverage
gaps found during its own review of a two-item DRY consolidation: a case
pinning the axis-signal gate's `=== true` strictness (`m5-check.mjs`) and a
case pinning the exact set `PLAIN_MIN_NEEDLE` drops from the leak scan
(`demo.mjs`). Both are mutation-proved (see the top decisions-log entry).
Every `66/66`/`34/34` figure ABOVE this paragraph remains an accurate dated
record of the tree it was measured against and is NOT rewritten; it simply
no longer describes the current tree. **M1–M6 all carry an asterisk again**
pending a user run at the new counts. Full record: `CHANGELOG.md`,
Unreleased, and the top entry of the decisions log below.

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

### 4.6 Known limits of the PoC (accepted, parked)

Standing home for the PoC's honest limits — so a reader does not have to dig
through the append-only Decisions log (§9) to find what is still weak. These
are **accepted limits, parked by user decision (2026-08-18)**, not open
defects: "for the sake of demoing I think they can be parked, we are not
seeking perfection but valid and solid code/prototype." The PoC's job is to
make the proposal text undeniable, not to be production-hardened. Per this
repo's stated discipline (CLAUDE.md, "Honest limits stay in the text"),
neither item below is softened.

1. **The raw-value leak scan cannot test very short values.**
   `camara/v1/poc/demo.mjs`'s raw-value leak scan drops needles shorter than
   `PLAIN_MIN_NEEDLE = 2` — a value whose every spelling is under 2
   characters cannot be leak-tested by this scan at all. Accepted because the
   alternative is worse: `DEVICE_FLIPPED_DAYS_AGO = 4` produces the bare
   needle `"4"`, which matches ordinary digit content (epoch timestamps, byte
   counts, billing counters) in nearly every frame — a needle that reds a
   clean run asserts nothing, the same reasoning already applied at
   `OPAQUE_MIN_NEEDLE = 8`. Still covered: that value's LONG spellings
   (`345600000`, its ISO instant, `2026-08-13`) remain in the leak inventory
   and are scanned, so the value itself is not unguarded — only its
   1-character spelling is. **What would make it bite:** a future secret
   whose ONLY meaningful spelling is a single character; that value would be
   structurally unreachable by this scan and would need a dedicated check.
   First recorded 2026-08-18 (§9, `d85d3cf`-tree entry).

2. **`m5-check.mjs` case 67 proves itself by crashing, not by asserting.**
   The case pins that the axis-signal gate requires strictly `=== true`, not
   merely truthy. Under mutation (relaxing the gate to `hasOwn(q, key)`
   alone) the case does go RED with a non-zero exit — but via an UNCAUGHT
   `location-verification` 404 escaping to the wire, not via its own
   assertion evaluating false. The failure IS detected, and fail-loud on an
   unexpected live call is itself correct defence-in-depth, but the case's
   designed proof path (its own assertion firing) has never been observed
   exercised. **What would make it bite:** if that stray call ever returned
   success instead of a 404, the crash would not happen, and detection would
   rest entirely on the case's own assertion — which would then need to have
   actually been proven to fire. First recorded 2026-08-18 (§9, the
   `/code-review medium --fix` round entry that introduced case 67).

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
9. **No unpinned claims, no stale submissions.** Every CAMARA/GSMA/IETF state
   claim is pinned to a source and re-verified before filing; a claim that
   dies on re-verification is retracted visibly.
10. **No dependencies on zkagent/8een in submission docs.** They are cited as
    *one implementation* of the principal layer; the proposals must stand
    standards-neutral.
11. **No fourth document.** Design content folds into the 3-doc inventory
    (§3); this PRD's Decisions log absorbs what would otherwise be a side-doc.
12. ~~No APIBacklog PR before supporters.~~ **RETIRED 2026-08-25 —
    verified false as a CAMARA requirement.** The APIBacklog template's own
    Supporters field reads verbatim: "List of supporters. *NOTE: That shall
    be added by the Working Group.*" — the WG populates it during
    evaluation, downstream of filing; supporter maintainer commitments bind
    only at Sub Project creation, further downstream still. This was never
    a CAMARA process fact — it was the author's own risk-management
    judgement about first impressions, stated as if it were a gate. Per
    no-go 9's own rule, retracted visibly rather than silently dropped. The
    user's decision: file first, network later (§9 decisions log,
    2026-08-25).
13. **No secrets or real subscriber data in the repo** — test ranges and env
    credentials only. `.claude/` session context is never published.
14. **No orphaned references.** After retracting a claim, renaming or moving
    a file, dropping a target/term, or changing a heading, sweep the whole
    repository for the old term or path and classify every hit before
    calling the change done — corrected, or deliberately preserved as dated
    history, and the second must be a decision, never an oversight. The
    sweep covers markdown, code, spec files, generated indexes, GitHub repo
    metadata (description and topics), directory structure (git cannot see
    an empty directory), and internal anchors (a changed heading changes
    its slug). Evidence: five instances missed in one session,
    `docs/logs/findings.md` (2026-08-28).
15. **Never file CarrierAttestation, or any predicate API, as a new CAMARA
    sub-project again.** The delta is the envelope, not a new API; it
    belongs in Commonalities, as a Scope Enhancement (findings 2026-08-31).
16. **No overlap declaration without a full APIBacklog table sweep, dated**
    (findings 2026-08-31).
17. **CONFIRMED (user's call, 2026-08-31; findings 2026-08-31):** Never
    cite a path or field that exists only on `main` as a released
    capability — check the release tags, and say "on main, unreleased"
    when that is the truth. (Triggered by the `/retrieve-age-band`
    retraction, §7 baseline above.)
18. **CONFIRMED (user's call, 2026-08-31; findings 2026-08-31):** Never
    assume a CAMARA parameter name carries the same unit or meaning across
    APIs — `maxAge` is hours/event-window on the swap APIs and
    seconds/data-staleness on location verification.

## 6. Sequence

```
Phase 0  Consolidate docs (this change)                          [G0]
Phase 1  PoC on mock backend — build + 4 assertions green        [G1]
Phase 2  USER: create Orange Playground account (free, instant)
         → 15-min raw spike → orange adapter → live re-run       [G2]
Phase 3  Circulate D2 profile in ICM / GitHub Discussion;
         collect reactions                                       [G3]
Phase 4  File: Commonalities guideline proposal + sim-swap
         adoption PR (nonce+expiry on /check) — still open; open
         the APIBacklog issue + PR (CarrierAttestation new-case,
         template pre-filled from D2 §mapping, API family owner
         = Cairenes Solutions) — supporters are NOT a
         precondition (no-go 12 retired 2026-08-25). **APIBacklog
         half DONE 2026-08-28: issue #330
         (github.com/camaraproject/APIBacklog/issues/330) + PR #331
         (github.com/camaraproject/APIBacklog/pull/331), both
         OPEN, awaiting Working Group evaluation — nothing
         approved yet. The Commonalities/ICM half is still
         outstanding.**                                           [G4 partial]
         2026-08-31: APIBacklog codeowner feedback on #330/#331 —
         new sub-project rejected in favour of a Scope Enhancement
         on Commonalities; use case 2 dropped from CAMARA (IETF
         only). v2 in `camara/v2/docs/`, drafting. See findings
         2026-08-31.
         v2 drafted 2026-08-31 (agent-run, user review pending), signing = JWS.
         2026-08-31: reply posted to PR #331 with two scoping questions
         (route, blind hub); answers pending.
         2026-08-31: v2 scope = four items (attested response, floor rule,
         blind hub, range on open responses); V2-M1 JWS core approved and
         building.
         2026-08-31 14:06 UTC: route answered by a Commonalities
         codeowner — file an enhancement issue in Commonalities;
         blind-hub placement pending.
         2026-08-31: user validated the consolidated branch at `8a454c9`
         (nine suites, exit 0 — findings).
         2026-08-31: blind-hub placement DECIDED (§8 risk 6, findings) —
         filing scope is now 2.1/2.2/2.4 only; 2.3 (blind hub) held for a
         separate companion filing.
         2026-08-31: V2-M2 defined (§8 risk 7, findings) — shrink
         `PUBLISHED_THRESHOLD_MENU` to 30/60/90 days (720/1440/2160h) and
         re-aim `demo.mjs`'s leak control to assert REFUSAL of an
         above-cap/off-menu request; not yet built.
Phase 5  WG evaluation populates named supporters (template
         validation → company support analysis → bi-weekly
         Backlog WG lazy consensus)                                [G5]
Phase B  (re-homed from AAIF, 2026-08-25) Draft the agent/
         delegation Internet-Draft (RFCXML/xml2rfc v3,
         `draft-<lastname>-<wg>-<topic>-00`) → SUBMITTED 31 August
         2026 as `draft-hassan-oauth-agent-delegation-00`, then
         re-posted same-day as `draft-hamr-oauth-agent-delegation-00`
         (author's own surname mismatch is deliberate, §9) → attend
         the IETF 127 Hackathon, 14–15 Nov 2026 (free, non-members
         welcome) → IETF 127 meeting, 14–20 Nov 2026, San
         Francisco. Target WG: OAuth (automated-agent-
         authorization work item); CATALIST as a fallback routing
         venue. D3 (`ietf/v1/docs/ietf-agent-delegation.md`) is
         drafted and IS `draft-hamr-oauth-agent-delegation-00`,
         submitted above — G6 MET, not adopted                    [G6]
Phase ∞  Attend cadence: Backlog WG + ICM + sub-project calls +
         IETF WG list/meetings; respond within the 6-week/
         3-meeting staleness windows (CAMARA) and I-D 185-day
         expiry (IETF)                                            [D5]
```

Phases 1 and 3 can overlap; Phase 4 does not wait on Phase 5. Phase B runs
independently of the CAMARA phases — no shared gate, per "two tracks, one
seam" (CLAUDE.md), except that AAIF is no longer one of the two tracks
(§9, 2026-08-25 decisions).

**Immediate order of work inside Phase 1 (2026-08-17, agreed):** (1) the M6
adversarial review round's findings land and get fixed; (2) the six-predicate
build round (§9, dated today — signed off as DESIGN, nothing wired yet);
(3) proposal edits, including the `kyc-match` retraction; (4) the USER
validation run; (5) release 0.4.0. Deliberately in that order: a review round's
findings against a 3-predicate tree are cheaper to fix than against a
6-predicate one, and a user validation run before the build round would have to
be repeated.

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
    release). No TSC new-repo machinery. Confirmed as the route on
    2026-08-31 (findings).
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
  co-own it by rule — which is why WG-populated supporters (G5) are
  existential past Sandbox, not political nicety, even though they are no
  longer a precondition for filing (G4; no-go 12 retired 2026-08-25).
  Sub-project cadence example: SimSwap meets every 4 weeks, Thu 07:30 UTC.
- **Verified spec baseline (2026-08-14, re-verified 2026-08-24, RETRACTED
  and corrected 2026-08-31 — findings):** SimSwap v2.1.0 ships `/check` and
  `/retrieve-date` ONLY — `/retrieve-age-band` is NOT in v2.1.0 (confirmed
  absent from every released tag r2.2/r3.1/r3.2/r3.3; it exists only on
  unreleased `main`, `info.version: wip`). Do not cite it as a shipped
  capability. `maxAge` on both SimSwap and DeviceSwap `/check` is
  canonical, not just Playground-measured: hours, `minimum:1`,
  `maximum:2400`, `default:240`. NumberVerification v2.1.0 (`/verify`,
  `/device-phone-number`) holds; both APIs still Incubating.
  `GET /device-phone-number` takes no request body and is structurally
  identifier-free off the 3-legged token (its sibling `POST /verify` still
  requires an identifier). KYC is no longer one r2.2 spec — it split into
  three repos post-Spring25: kyc-match (r1.2, v0.4.0 — its primary response
  is per-field discrete match indicators, NOT a similarity score;
  `MatchScoreResult` is optional and returned only when the corresponding
  field is `false`), kyc-fill-in (r1.3, v0.4.1), kyc-age-verification (r1.3,
  v0.2.1, Sandbox per its lifecycle badge — though its own README body text
  still says "Incubating stage since February 2025", an unresolved
  contradiction; `ageCheck` is a string enum "true"/"false"/"not_available",
  not a JSON boolean). Open Gateway: 86 operator groups, 300+ networks.
  Full citations live in D2 §References and in the 2026-08-31 findings
  entry.
- **AAIF — DROPPED as a submission target (2026-08-25 re-verification).**
  **Correction (2026-08-25 re-verification):** the entry that stood here
  said the process was "grounded 2026-08-15" and described a 4-stage
  proposal-review track. That framing was WRONG — the URLs and stage
  mechanics it cited were accurate, but it treated a project-DONATION gate
  as a standards-proposal track. AAIF is "Agentic AI Foundation", a Linux
  Foundation project since December 2025 (founding contributions MCP,
  goose, AGENTS.md; sources: linuxfoundation.org press release, aaif.io).
  Its `github.com/aaif/project-proposals` intake, verified verbatim from
  `.github/ISSUE_TEMPLATE/project-proposal.yml`, requires "evidence of
  production deployments in at least two different organizations", "at
  least 2 core maintainers from different organizations and at least 10
  contributors", and a signed Contribution Agreement transferring all
  project trademarks and accounts to the Foundation before the Governing
  Board can vote. This author is a solo independent with a single-author
  PoC and zero external adoption — roughly 8 of ~14 required fields cannot
  be filled honestly. These are facts we do not have, not writing tasks.
  The Identity & Trust WG's TOPIC still fits the work; the DOOR is wrong,
  not the idea — recorded that way, not as "AAIF was a dead end." D3 has
  since been re-homed onto the IETF track below as
  `ietf/v1/docs/ietf-agent-delegation.md`;
  `docs/archive/aaif-agent-auth.md` is retained only as a dated,
  superseded record of the earlier AAIF-targeted text.
- **Agent/delegation arm re-homed to IETF (grounded 2026-08-25).** An
  unaffiliated individual can submit an Internet-Draft with no membership,
  no sponsor, and no fee (authors.ietf.org/submitting-your-internet-draft;
  datatracker.ietf.org/submit/tool-instructions/) — exactly the gates that
  disqualified AAIF do not exist here. RFC 9421 (HTTP Message Signatures)
  is PUBLISHED, Proposed Standard, February 2024, from the HTTPBIS WG — it
  is not in progress and there is nothing to submit to for it; new work
  CITES it. HTTPBIS's charter excludes new domain-specific extension
  semantics, so delegation semantics do not belong there. **Best first
  target: the OAuth WG** — its charter (datatracker.ietf.org/doc/
  charter-ietf-oauth/, updated 2026-06-04) carries a work item developing
  "new mechanisms or/and extensions for authorization of automated agents
  working on behalf of users, including addressing scenarios where
  automated agents act across multiple administrative domains." Other
  venues noted: WIMSE (workload identity; charter explicitly EXCLUDES
  personal identities, cutting against a human-rooted model), SPICE
  (credential formats only), CATALIST (a coordination/routing venue, not a
  drafting WG — good place to float the idea and get routed). I-D
  mechanics: format RFCXML (xml2rfc v3); naming
  `draft-<lastname>-<wg>-<topic>-00`; an I-D EXPIRES 185 days after
  posting unless refreshed. **Key dates:** `draft-hassan-oauth-agent-
  delegation-00` was SUBMITTED 31 August 2026, then re-posted the same
  day as `draft-hamr-oauth-agent-delegation-00` (a posted I-D cannot be
  renamed; a new `-00` with `Replaces` set is the only route, and it
  creates two documents — §9). The live document expires 4 March 2027
  (185 days after posting) unless refreshed by a -01 — the IETF 127
  I-D submission cutoff, 2 November 2026 23:59 UTC, is noted for context
  only and is not a pending deadline for this draft. IETF 127 Hackathon
  **14–15 November 2026** (free, open to non-members, needs only a free
  Datatracker account); IETF 127 meeting 14–20 November 2026, San
  Francisco. Main-meeting registration fee COULD NOT BE VERIFIED — left
  unstated, not guessed. **Prior art, load-bearing:**
  `draft-klrc-aiagent-auth-03` (6 July 2026, expires 7 Jan 2027,
  https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/) — six authors
  from Defakto Security, AWS, Zscaler, Ping Identity, OpenAI and Okta,
  composing WIMSE/SPIFFE agent identity + RFC 9421 + OAuth 2.0 delegation,
  close to our architecture. It is an INDIVIDUAL draft, not WG-adopted.
  Verified by direct fetch: it contains NO reference to SIM cards, mobile
  network operators, carrier attestation, telco APIs, or physical identity
  documents (passport/eMRTD) — so our two differentiators survive intact:
  (a) SIM-anchored economic scarcity via operator APIs, (b) a
  document-rooted human principal. **OPEN DECISION, pending a full read of
  that draft:** fold our work in as an extension of it versus write a
  distinguishing draft — not to be settled until the draft has been read
  in full (§9). **Naming trap, recorded so it isn't re-discovered the hard
  way:** IETF already owns "PASSporT" (STIR/SHAKEN, Personal Assertion
  Token) — our document-rooted layer must always be written as "ICAO/
  eMRTD passport" or "travel-document identity", never bare "PASSporT".
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
   **The staleness clock is now live** (§5 no-go 9, §7): issue #330 / PR
   #331 filed 2026-08-28, both open — 6+ weeks of GitHub inactivity or 3
   missed WG meetings freezes the proposal per §7, so sustained presence on
   the two threads is no longer preparatory, it is due.
2. **Orange account is a user action** — PoC live tier (G2) blocks on it;
   mock tier (G1) does not. Don't let G2 block G3.
3. **The draft is submitted but NOT adopted (§7, §9).** The AAIF→IETF
   re-homing is DONE (D3 already targets IETF) and `draft-hassan-oauth-
   agent-delegation-00` was SUBMITTED 31 August 2026, then re-posted the
   same day as `draft-hamr-oauth-agent-delegation-00` — but posting an
   I-D confers a timestamp and visibility, not standing: it is an
   individual submission, reviewed by no one, with no formal standing in
   the IETF process. The remaining risk is sustained mailing-list
   participation and WG meeting presence over multiple IETF cycles, and
   the draft expires 4 March 2027 unless refreshed by a -01; keep it
   modular (summary / proposal / seam sections survive any format).
4. **Scope leak from Mode B enthusiasm** — the no-go list (§5.5) is the
   guard; PoC reviews check against it.
5. **DECIDED (user's call, findings 2026-08-31): kyc-match has no
   request-side threshold field, and the operator publishes ONE threshold
   and applies it itself — the requester chooses nothing.** No bisection,
   no hill-climbing, no new request field for this predicate; the
   proposal's §2.2 rule ("nothing is added to the request to carry the
   menu itself") is preserved. This supersedes the four-bucket
   `numberMatch: [60, 70, 80, 90]` menu for kyc-match specifically (that
   menu still applies to the swap-recency predicates, which reuse the
   existing `maxAge` field). Implementation in `demo.mjs` is deferred to
   V2-M2, not done in this round.
6. **DECIDED (blind-hub scope, main session on the user's explicit
   delegation, 2026-08-31; findings 2026-08-31): file 2.1/2.2/2.4 only,
   hold 2.3 (blind hub) for a separate companion filing.** The
   codeowner's invitation was worded narrowly around a signing mechanism;
   2.1/2.2/2.4 are one coherent subject (what is signed, how tightly
   bounded), 2.3 is a different one (who can read the exchange) and is
   documented as politically sensitive; v1 was rejected in part for
   bundling. This supersedes the earlier suggestion to ride the JWE
   envelope in alongside signing — that JWE precedent (Commonalities'
   notification-signing guide) is real but expands the filing beyond what
   was invited, so it is withdrawn. Honest cost, stated not hidden:
   without 2.3, an aggregator in the path still sees the identifier and
   the question in this filing; holding 2.3 is sequencing, not
   abandonment — the proposal text says a companion proposal follows.
7. **DECIDED (user's call, 2026-08-31; findings 2026-08-31): swap-recency
   threshold menu is 30/60/90 days** — `P30D`=720h, `P60D`=1440h,
   `P90D`=2160h, all under the canonical 2400-hour `maxAge` cap, removing
   the above-cap fallback to `/retrieve-date` entirely rather than
   guarding it. **Implementation is deferred to V2-M2** (see §6 module
   sequence) — `PUBLISHED_THRESHOLD_MENU` in `camara/v2/poc/demo.mjs` is
   unchanged this round, because `demo.mjs`'s `LEAK_PREDICATE` relies on
   `P365D` being above the 2400h cap to keep the leak-control assertion
   reachable; V2-M2 must re-aim that assertion to REFUSAL of an
   above-cap/off-menu request in the same change that shrinks the menu.

## 9. Decisions log

The full rationale for every decision lives in `docs/logs/findings.md`; this table is the index.

| Date | Decision | Status | Where |
|---|---|---|---|
| 2026-09-03 | CAMARA TSC relay on PR #331 answered: sign-then-encrypt composition order stated as normative for coexisting with GSMA OPG's parallel response-encryption discussion (no OPG seat, cannot carry it there directly); the TSC's aggregator description ("meters and bills without reading the predicate or answer") CORRECTED — that is the deferred blind hub, not the filed scope, which signs but does not encrypt, so an aggregator can still read the identifier and answer; Commonalities confirmed as the home now, with one boundary condition named rather than a migration pre-committed (algorithm set / JWKS discovery / replay window would be Security and Interoperability Profile work, mirroring its request-side `camara:qh`/`camara:bh` DPoP claims). Stated honest limits: no aggregator operator has reviewed the design; companion blind-hub filing may be named publicly | active | [findings.md](../logs/findings.md#2026-09-03--camara-tsc-relay-answered-sign-then-encrypt-order-stated-aggregator-claim-corrected-commonalities-vs-security-profile-boundary-condition-named) |
| 2026-09-02 | Asor ack wording CONFIRMED identical after transmission corruption on the wire between the user and Rafael Asor: he filled two hand-gaps (one from his own earlier sentence, the final word cut at "e" completed as "example"); a `diff` of the sent sentence against his reconstruction reported no content differences. Corruption origin UNKNOWN, not asserted. Separately, an archive check for the same corruption or a delivery failure on the WIMSE/OAuth lists (three messages sent) came back inconclusive from three reads (two live page loads, one 403'd search endpoint) and was correctly reported as a gap in evidence rather than a finding; the user then confirmed the messages did reach both lists, resolving it as a false alarm caused by a fetch/summariser limitation — the -02 citation "settled with both on the WIMSE and OAuth lists in September 2026" (row below) stands unchanged. Rafael also confirmed `tenure_years` stays in asor's own example, names nothing in the HAMR draft, and nothing is needed on the alignment paragraph. No -02 item changed | active | [findings.md](../logs/findings.md#2026-09-02--asor-ack-wording-confirmed-identical-after-transmission-corruption-archive-check-inconclusive-then-resolved-as-false-alarm) |
| 2026-09-02 | OAuth WG thread CLOSED: Jijie Wei and Sangam Das both independently confirmed the per-path/system-wide split (boundary identification per effect-capable path; closure an anti-bypass invariant across all paths) and both converged on reframing the boundary as a ROLE in an effectuation path, not a component. Naming: Sangam Das granted attribution but gave no preferred form; Jijie Wei granted attribution as "Jijie Wei (varwof)". -02's Verifier Placement subsection is now fully specified and REPLACES rather than extends -01's "upstream of that boundary" wording (re-verified verbatim at `draft-hamr-oauth-agent-delegation-01.xml` lines 919-920, not line 917 as this task was briefed). One drafting question left open, not decided: where the closure invariant is placed in -02 text — the main session recommends keeping both statements adjacent in Verifier Placement, and the sent reply already commits to that placement and order | active | [findings.md](../logs/findings.md#2026-09-02--oauth-wg-thread-closed-per-path-identification-and-system-wide-closure-agreed-boundary-reframed-as-a-role-not-a-component-naming-permissions-received--02-verifier-placement-fully-specified) |
| 2026-09-02 | OAuth WG boundary rule RESOLVED: Sangam Das confirmed reading (i) for in-process dispatch, with a general rule ("the relevant boundary is the first point whose successful admission is necessary for the effect to occur") and a bypass test; -02 will add this as an additive check to Verifier Placement, attributed to Jijie Wei (host wrap) and Sangam Das (definition). Separately, Sangam Das corrected this repo's own prior email — not the draft — for conflating tool identity with actionClass; verified against `draft-hamr-oauth-agent-delegation-01.xml` lines 227/243/248 that the draft never made that error. A new drafting problem raised by the user: the boundary property is per path, not per system, where a resource has two disjoint guarded paths. Two questions open: per-path vs per-system confirmation, and permission to name both correspondents | active | [findings.md](../logs/findings.md#2026-09-02--oauth-wg-boundary-rule-resolved-sangam-das-actionclass-predicate-correction-traced-to-the-prior-email-not-the-draft-per-path-drafting-problem-raised-two-questions-still-open) |
| 2026-09-02 | Asor acknowledgment consent sent (private, correcting Rafael's proposed sentence from `tenure_years` to the actual `tenureMin`, duration-typed) and a reply sent on the public OAuth WG thread (Jijie Wei, Sangam Das) offering `actionClass`/`classSource` as shared vocabulary and asking the thread to settle Verifier Placement's in-process-dispatch reading rather than pre-deciding it. Neither reply has a response yet. This entry CORRECTS the "independent convergence" reading recorded in the -01-submission entry below: reading the actual thread messages shows a stated tension the draft's own text does not resolve, not agreement. Two -02 items opened: the min-pending wording goes stale once asor -01 posts (expected Thursday); Verifier Placement needs a sentence choosing between two readings of "boundary" for in-process dispatch, BLOCKED on the thread's answer | active | [findings.md](../logs/findings.md#2026-09-02--asor-acknowledgment-consent-and-oauth-wg-thread-reply-sent-earlier-convergence-reading-corrected-to-a-stated-tension) |
| 2026-09-02 | `draft-hamr-oauth-agent-delegation-01` SUBMITTED and posted — verified live against the Datatracker API: rev 01, state "posted", submission_date 2026-09-02, expires 2027-03-06, 48 pages. User ran author-tools and idnits on the uploaded XML, both CLEAN — the first author-tools schema validation reported this cycle; submitted XML sha256 `cc1f8435231db0fe`, 2364 lines, byte-unchanged from `49e3fab` onward. All seven cited I-D references re-verified live against `bib.ietf.org` on submission day; `asor-wimse-agent-delegation-chain` still rev 00, so the min-pending wording stands as posted. Contents: items 1-4, Appendix A direction 4, vectors V7-V11, two-case omitted-axis rule, Resource Owner defined term, new Verification Procedure step. Release v0.12.0 cut (`851efb4`), PR #22 squash-merged to `main` (`6400324`), tag `v0.12.0` pushed. PoC at submission: `m7-check` 40/40, `m3-check` 26/26, exit 0. Submission is not adoption — remaining: reply to the live OAuth WG thread (Sangam Das, Jijie Wei enforcement-placement convergence, mirrored by -01's Verifier Placement subsection); watch for asor -01 to post and revisit min-pending wording when it does; -01 expires 2027-03-06; CAMARA Commonalities issue #705 still open awaiting a maintainer label | active | [findings.md](../logs/findings.md#2026-09-02--draft-hamr-oauth-agent-delegation-01-submitted-and-posted) |
| 2026-09-02 | Second `/branch-review` ran at HEAD `d5b7194` (target `7384e07..d5b7194`, stage 1 medium, stage 2 security full, tree clean start/exit); found one Critical, two Warnings, one Suggestion, all independently reproduced by the orchestrator. The first review's own fix commit (`e638d6a`) was the previously unreviewed code this round was aimed at. CRITICAL: the first collision fix (strict base64url charset check) closed out-of-alphabet collisions only, leaving the decoder's own truncation open — `deriveChainId('AA')`, `('AB')`, `('AC')`, `('AD')` (and the `'AAA'`/`'AAB'`/`'AAC'`/`'AAD'` set) all decoded to the same digest, because a string 2 or 3 past a multiple of four discards low-order bits of the final group; cases 29-30 could not catch it since both used out-of-alphabet input. Fixed by requiring the CANONICAL unpadded form (decode, re-encode with `toString('base64url')`, reject unless identical); cases 35-37 pin the collider, the mod-4 input, and padded-input rejection. WARNING 1: the `hasOwnProperty` presence guard was correct but undefended — a truthiness test or `in` both left the suite green; closed by case 38 (falsy-but-legitimate `writeBudget` 0) and cases 39-40 (`Object.prototype` polluted with the axis name, cleaned up in a `finally`). WARNING 2: the unpadded contract was untested — widening the alphabet regex to accept `'='` left the suite green; closed by case 37. SUGGESTION (not fixed, recorded): the link-to-link omission rule tests presence by `hasOwnProperty` while per-link default substitution tests `=== undefined`, diverging only for a future non-tightest default — harmless today. Six non-canonical fixtures replaced with canonical base64url; no case's expected result changed. REPORTED, NOT HIDDEN: the charset guard is now subsumed by the round-trip check (removing or widening it leaves the suite green) and is kept as documented defense in depth, per the commit message and `ietf/v2/poc/README.md`. Orchestrator mutation proofs: removing the round-trip check reds case 35; `hasOwn`->truthiness reds 38/39/40; `hasOwn`->`in` reds 39/40; removing the charset guard reds nothing — all at exit 0/1 as expected, every restore byte-identical. `m7-check` 40/40, `m3-check` 26/26 at commit `bb880ed`. Draft XML is byte-identical to the `49e3fab` tree the user ran idnits against (sha256 `cc1f8435231db0fe` both); no author-tools schema validation has been reported at any tree this cycle. USER VALIDATED 2026-09-02 at the tree of `bb880ed` (both suites exit 0, m7 40/40, m3 26/26; the 34-case record is void). Lesson: a fix and its own tests aimed at one narrow class leave the neighbouring class untouched and reading as solved. Remaining: a THIRD `/branch-review` at `bb880ed` (HEAD moved past the reviewed SHA); merge PR #22; re-verify every cited draft revision live on submission day (asor -01 unposted); the user's author-tools run on the final XML; then submit before -00 expiry 2027-03-04; then reply to the live OAuth WG thread citing the layers section and Verifier Placement | active | [findings.md](../logs/findings.md#2026-09-02--second-branch-review-round-on-the--01-poc-one-critical-fixed-suite-34---40-cases) |
| 2026-09-02 | `/branch-review` ran at HEAD `6f40ffc` (target `7384e07..6f40ffc`, stage 1 medium, stage 2 security full, tree clean start/exit); found no Critical, two Warnings, one Suggestion, all three independently reproduced by the orchestrator both before and after the fix. Finding 1 (real defect): `deriveChainId` collided on malformed input because `Buffer.from(s,'base64url')` silently strips out-of-alphabet characters instead of rejecting them — `deriveChainId('abcd')`, `('ab!!cd')` and `('ab cd')` all produced the same digest, defeating the function's one purpose. Fixed with a strict unpadded base64url charset check before decoding, returning `null` on any other character; cases 29-30 pin non-collision. Finding 2 (conformance gap this session's OWN earlier text fix created): the two-case omitted-axis rule written at `49e3fab` was never implemented in `checkActionFloor`, which admitted a declared-menu-omitting child as inherited `method` rather than rejecting. Fixed using `Object.prototype.hasOwnProperty.call` for every presence test (writeBudget 0 and classSource 'method' are legitimate and falsy-adjacent); cases 31-32 pin the rejection, 33-34 pin that link-to-published-floor inheritance still admits. USER DECISION: implement in code, not disclose as a text gap. Finding 3 (test-quality gap): case 27's comment claimed it pinned the enumeration guard against prototype-walking, but swapping `Object.keys` for `for...in` left the suite green (Object.prototype members are non-enumerable). Fixed by adding case 28, which defines a temporary enumerable property on `Object.prototype` inside a try/finally to make the guard falsifiable. Orchestrator mutation proofs on all three: each regression reds only its own case(s) at exit 1, restores are byte-identical exit 0. `m7-check` 34/34, `m3-check` 26/26 at commit `e638d6a`. The review agent's cited-draft-revision gap (no network access) was already closed — the orchestrator had independently re-verified all seven I-D references against `bib.ietf.org` canonical bibxml. USER VALIDATED 2026-09-02 at the tree of `e638d6a` (both suites exit 0; author-tools run not reported this tree; the prior 27-case validation is void). Two standing lessons: a fix round creates orphans of its own (second time this session — the 49e3fab text fix orphaned the code, mirroring the earlier stale 24-case count); a test whose guard mutation leaves the suite green isn't pinning what its comment claims. Remaining: merge PR #22; re-verify every cited draft revision live on submission day (asor -01 unposted); the user's author-tools run on the final XML; then submit before -00 expiry 2027-03-04; then reply to the live OAuth WG thread citing the layers section and Verifier Placement | active | [findings.md](../logs/findings.md#2026-09-02--branch-review-round-on-the--01-poc-three-findings-fixed-suite-27---34-cases) |
| 2026-09-01 | IETF -01 review round: PoC catch-up committed as `47ebce6` (`ietf/v2/poc` cases 22-24 brought up to the -01 text, suite 24 -> 27 cases; case 22 derives the chain identifier via `deriveChainId(rootSignature)` reading no caller-supplied field, case 23 does deterministic path-template matching, case 24 binds the menu's `iss` to the request origin, case 25 is V10's step sequence, case 26 pins the equal-literal fail-closed tie, case 27 pins a literal `__proto__` menu key as a real own property; five agent mutation proofs plus one independent orchestrator proof on the chain identifier). A read-through review found 1 blocker (the omitted-axis rule stated three incompatible ways across attenuation rule 2/V4, the registry's Omitted-axis rule field, and the classSource/writeBudget passages — two conforming verifiers would have disagreed on the same wire input), 4 should-fix, 1 nit. USER DECISION (orchestrator assumption under a "continue" instruction, flagged reversible): the rule is now stated as two distinct cases — link-to-link omission stays a rejection per unchanged rule 2/V4, link-to-published-floor inheritance (no link in the chain constrains the axis) covers the classSource/writeBudget defaults — rather than making omission always mean inheritance, which would have loosened posted -00 rule 2 and deleted V4. Four other fixes: `effective` defined with response encoding out of scope; "Resource Owner" added as a defined term (eleven prose sites capitalized); a Verification Procedure step added for actionClass/menu/writeBudget ordering; the Floor definition now states aggregate per-axis constraints, at most one per axis. Live citation re-verification found `draft-reece-wimse-cross-org-delegation` had moved to rev 02 with a stale -01 `<date>`; corrected, then all seven I-D references re-checked against `bib.ietf.org` on both revision and date (a sweep bounded to the one flagged row would not have been a sweep). A stale-claim sweep caused by this session's own PoC commit found three locations still describing the code as 24 cases/short by three points; all corrected (orphan created by this session's own change, not inherited). Three -01 changes missing from "Changes since -00" added. `m7-check` 27/27, `m3-check` 26/26, xmllint/non-ASCII/forbidden-tag/BCP14 scans all exit 0; XML 2315 -> 2364 lines. Commits `47ebce6`, `49e3fab`. USER-VALIDATED at the tree of `49e3fab` (both PoC suites exit 0, `idnits` clean; author-tools validator run NOT separately reported this tree). -01 is text-complete for all four scope items plus Appendix A direction 4 and the PoC now matches the text; NOT submitted. Remaining: push and merge the branch; re-verify every cited draft revision live again on submission day (asor -01 not yet posted); an author-tools run on the final XML; then the user submits, before the -00 expiry of 2027-03-04 | active | [findings.md](../logs/findings.md#2026-09-01---01-review-round-poc-catch-up-24---27-cases-one-blocker-and-five-other-review-findings-fixed-citation-and-stale-claim-sweeps-not-submitted) |
| 2026-09-01 | IETF -01 item 4 drafted: a new normative section, anchor `write-budget`, placed after Action Class Floors, specifying `writeBudget` (max, lower only, omitted inherits the published floor, zero by default); Limit and Count (`r` never spends; `w`/`x` reserve-then-decrement as one admission outcome; exhaustion produces the verifier's uniform rejection outcome, count undisclosed — an orchestrator brief that pointed this refusal at the Attestation Issuer's signed-refusal section was escalated by the agent and corrected); Chain Identifier (SHA-256, RFC 6234, this document's first use of any hash function, over L(0)'s signature bytes, verifier-derived, never caller-supplied — the user's chosen option one, a digest of the root link's signature shared by every hop, over a whole-chain digest, because the budget belongs to the delegation as a whole and a per-hop digest would let re-delegation mint fresh budgets); Limits (per-verifier count, N verifiers imply N budgets, cumulative per chain not per action, no writeBudget size named practical). Registry `writeBudget` row's TODO resolved to a cross-reference; the last `<!-- TODO -01 item 4 -->` marker removed. Vectors V10 (positive, sequential admission against a budget of 2) and V11 (negative control: re-presented with a different caller-supplied chain identifier against an already-exhausted chain, refused) added, using a step table rather than the V1-V9 chain-shape table since V10/V11 test sequential admission, not one-shot chain validity — closing PoC case 22 in the text. Implementation Status and Security Considerations paragraphs added; "Changes since -00" bullet appended. Fix round: the exhaustion cross-reference corrected as above, one clause trimmed. `m7-check` 24/24, `m3-check` 26/26, xmllint/non-ASCII/forbidden-tag/BCP14 scans all exit 0; diff +262/-18; XML now 2315 lines. USER-VALIDATED at the uncommitted tree (both PoC suites exit 0, `idnits` clean; author-tools validator run not reported this tree). All four -01 scope items plus Appendix A direction 4 are now drafted; the draft is NOT submitted. Remaining, in order: a full read-through review round; PoC catch-up for cases 22-24 with fresh user validation at the new count; re-verify every cited draft revision live on submission day; the user's own author-tools and `idnits` run on the final XML; the user submits. Open: asor -01 not yet posted; when it posts, the min-pending wording in the axis-registry alignment paragraph must be revisited | active | [findings.md](../logs/findings.md#2026-09-01---01-item-4-drafted-write-budget-all-four--01-items-and-appendix-a-direction-4-now-in-the-text-user-validated-at-the-uncommitted-tree) |
| 2026-09-01 | IETF -01 item 3 drafted: a new normative section, anchor `action-class`, placed after the Floor Axis Registry, specifying `actionClass` (r<w<x, rank, child may only lower) and `classSource` (registered method < declared, both rank axes tighten by lowering, default method, declared->method the only permitted change — the PoC names the two values in the opposite order with identical semantics, stated in text); Classification (RFC 9110 method default; a verified, resource-bound declared menu replaces rather than combines with it; any menu failure or absence falls back to the method default, never the maximum; a verifier never synthesizes a menu); The Declared Menu (a JWS, RFC 7515, payload `iss` = an RFC 6454 origin plus a `"METHOD path-template"` -> class map; deterministic template matching, more literal segments wins, an equal-literal tie is a miss, fail closed; `iss` must equal the request target's origin; key from a trust source, never the payload; EdDSA/Ed25519 only); Publication (non-normative, out of scope); Verifier Placement; and an honest-limits paragraph backed by the committed 292-op/60-repo survey (57 of 138 POSTs named as reads still classed x under method; survey caveats carried). Registry table's `actionClass`/`classSource` TODO cells now cross-reference the new section (the `classSource` cell had said "item 4", a labelling slip, corrected); `writeBudget`'s TODO remains. Vectors V7 (accept, x->w), V8 (declared menu admits `POST` as r), V9 (negative control: mismatched `iss` falls back to method x and refuses — a verifier skipping the origin check would wrongly admit) added. Implementation Status bullet names 24 PoC cases and three named code-vs-text gaps (caller-supplied chain id, exact-string menu keys, no origin check); text is authoritative. Two orchestrator-ordered fix rounds: rank direction made uniform across both axes; a fail-closed tie-break added; two em dashes removed after the agent's own non-ASCII scan was found structurally unable to fail (a `grep -x` line-anchor paired with a zero-width lookahead), caught by the orchestrator's independent count. `m7-check` 24/24, `m3-check` 26/26, xmllint/non-ASCII/forbidden-tag/BCP14 scans all exit 0; diff +393/-19; XML now 2071 lines. USER-VALIDATED at the uncommitted tree (both PoC suites exit 0, `idnits` clean, section 9 and V7-V9 read; author-tools validator run not reported this tree). Item 3 done; the PoC's code is behind the text on the three named points — updating the spike to match is a later step, not part of -01 drafting. Next: item 4 (`writeBudget`, option one under consideration: chain identifier = digest of the root link's signature) | active | [findings.md](../logs/findings.md#2026-09-01---01-item-3-drafted-action-class-floors-actionclass-classsource-declared-menu-user-validated-at-the-uncommitted-tree) |
| 2026-09-01 | IETF -01 Appendix A direction 4 (harness-side experience) drafted: three single-author, open-source experiments (bareguard, bareloop, bareagent) added as a fourth, non-normative direction, placed after directions 1-3's summary paragraph, one intro line plus exactly three bullets each, closing on "control sat at the credential boundary or the resource, never in the harness"; explicitly NOT implementations of this profile and so absent from Implementation Status (RFC 7942). Every bullet traces to a local, gitignored research note and through it to a file:line in the three sibling repos. TODO comment in the `layers` section removed; "Changes since -00" bullet added; diff +56/-1. `m7-check` 24/24, `m3-check` 26/26, xmllint/non-ASCII/forbidden-tag/BCP14 scans all exit 0. USER-VALIDATED at the uncommitted tree (both PoC suites exit 0, `idnits` clean, rendered direction 4 skimmed clean; author-tools validator run not reported this tree). Next: item 3 (`actionClass`/`classSource`, menu JWS shape defined in this document), then item 4 (`writeBudget`) | active | [findings.md](../logs/findings.md#2026-09-01---01-appendix-a-direction-4-harness-side-experience-drafted-user-validated-at-the-uncommitted-tree) |
| 2026-09-01 | IETF -01 item 2 drafted: a new informational section "Position Among Delegation Layers" (anchor `layers`) placed after Motivation, stating three layers (who-may-act, per-invocation binding, receipts), that this document occupies layer (a) plus floors evaluated per link not per call, and naming neighbours RFC 9396, `draft-das-agentic-tool-binding-02`, `draft-schrock-ep-authorization-receipts-12`, and asor -00 §9.1's shared parent-stays-valid-after-attenuation problem (no token-profile fix offered). Citations re-verified live against the Datatracker (das rev 02, schrock rev 12, asor rev 00). `m7-check` 24/24, `m3-check` 26/26, xmllint/non-ASCII/forbidden-tag/BCP14 scans all exit 0; diff +119/-3. USER-VALIDATED at the uncommitted tree (both PoC suites exit 0, `idnits` clean; author-tools validator run not reported this tree). Next: Appendix A direction 4, then items 3-4 | active | [findings.md](../logs/findings.md#2026-09-01---01-item-2-drafted-position-among-delegation-layers-section-user-validated-at-the-uncommitted-tree) |
| 2026-09-01 | IETF -01 round opened at `ietf/v2/`: item 1 (Floor Axis Registry) drafted in `draft-hamr-oauth-agent-delegation-01.xml` (1528 lines) — four comparators (`min`/`max`/`rank`/`one_of`), eight registered axes (the five -00 §8 axes plus `actionClass`/`classSource`/`writeBudget` with semantics deferred to items 3-4), IANA "HAMR Floor Axis Registry" request, asor -00 §10 cited (never asor -01, unposted). An orchestrator-caught spec error (CAMARA PoC axis names substituted for -00's) was escalated and fixed before build. `m7-check` 24/24, `m3-check` 26/26, xmllint/non-ASCII/forbidden-tag/BCP14 scans all exit 0; USER-VALIDATED at the uncommitted tree (both PoC suites, author-tools validator, `idnits` clean). Items 2-4 next; Appendix A held until all four exist | active | [findings.md](../logs/findings.md#2026-09-01--ietf--01-round-opened-ietfv2-item-1-floor-axis-registry-drafted-user-validated-at-the-uncommitted-tree) |
| 2026-09-01 | Rafael (asor) replied a third time on the EMILIA pre-flight thread: accepts the correction that the registry and fail-closed rule are already in asor -00 §4.1/§10, not -01; reframes `min` as a missing constraint TYPE (not a `max`-over-negation normalization), and says asor -01 (not yet submitted) will add it to the initial registry entries with a mirrored subsumption line (`C.min >= P.min`, non-droppable); confirms §9.1's parent-stays-valid-after-attenuation problem is shared and structural. -01 scope item 1's comparator-registry alignment now includes `min`, gated on asor -01 actually posting — until then, cite asor -00 §10 only. No reply sent yet | active | [findings.md](../logs/findings.md#2026-09-01--rafael-asor-accepts-the--00-10-correction-asor--01-will-register-a-mirrored-min-comparator-91-parent-validity-confirmed-shared) |
| 2026-09-01 | Second EMILIA-thread reply sent (2026-09-01T20:11:29+02:00), against a full read of asor -00 (672 lines): corrects Rafael's registry citation from -01 to -00 §10, names the comparator vocabulary (not shared axis names) as the real bridge between the two drafts, notes asor's `rank` comparator and its missing `min`, and names §9.1 (parent stays valid after attenuation) as a shared, out-of-scope problem for both. Rafael and Iman both replied aligned; a no-menu default state and the non-HAMR-site verifier placement were settled in discussion but not yet written into any draft text. -01 scope item 1 refined: axis names bound to comparator types (`actionClass`=`rank`, `writeBudget`=`max`, duration floors=`min`), aligning with asor's registry. PR #19 (Spike B) merged to `1f3ee21`, `m7-check` re-verified exit 0 on merged main | active | [findings.md](../logs/findings.md#2026-09-01--second-reply-sent-on-the-emilia-pre-flight-thread-after-a-full-read-of-asor--00-rafael-asor-and-iman-emilia-both-aligned-the-no-menu-case-and-who-verifies-settled-in-discussion-pr-19-merged) |
| 2026-09-01 | Spike B built at `ietf/v1/poc/` (actionClass / classSource / writeBudget gate, copied M3 floor machinery plus new `m7-actionclass.mjs`/`m7-check.mjs`), 24/24, USER-VALIDATED at the working tree on tip `ac18310`; three assumptions the spike silently makes were pinned as cases 22-24 (caller-supplied chainId refills the budget, menu keys are exact strings not path templates, menu `iss` is not bound to the target resource) — all three recorded as -01 requirements. Rafael Asor's EMILIA-thread reply confirms asor already has a constraint-type registry with must-understand semantics in -00 (not -01, which is unposted) and the same three-layer boundary; a corrected reply drafted, not yet sent | active | [findings.md](../logs/findings.md#2026-09-01--spike-b-built-at-ietfv1poc-actionclass--classsource--writebudget-gate-2424-user-validated-at-the-working-tree-on-tip-ac18310-three-assumptions-pinned-as-cases-22-24-rafael-asor-reply-aligns-on-registry-shape-and-the-three-layers) |
| 2026-09-01 | IETF track resumed: EMILIA Protocol's private pre-flight source-check (their conformance matrix's reading of draft-hamr-oauth-agent-delegation-00) confirmed accurate and replied to; spike A ran on 292 real operations across the CAMARA catalogue testing whether an `actionClass` method-default hides consequential ops behind safe methods — readout R2 (zero GET-hidden writes, two designed-path tightenings), but 57/138 POSTs (`retrieve-*`/`check`/`verify`/`status` — the predicate catalogue this project targets) default to `x` under a method rule and that cost side was never audited by the agent's own report. User chose Option B: a `classSource` floor axis (`declared < method`, default `method`, monotone, owner-published signed menu, delegator-trusted, agent tightens only) over the stricter Option A; added `writeBudget` to -01 scope (four items total). Spike B (the gate) approved, build in progress, not yet validated | active | [findings.md](../logs/findings.md#2026-09-01--ietf-track-resumed-emilia-source-check-reply-sent-spike-a-on-the-actionclass-method-default-run-across-the-camara-catalogue-readout-r2-cost-side-unaudited-classsource-chosen-for--01) |
| 2026-09-01 | CAMARA v2 filed: `camaraproject/Commonalities#705` open (step 1 of the four-step sequence); author is `pull`-only and cannot apply the `enhancement` label; link-back posted on PR #331 (comment `5493181312`); two of the main session's own earlier retractions (the "#276 precedent" and the "RFC 7515 §2" citation) were themselves wrong and are retracted — the RFC 9449/response-side rewrite happened anyway to match the framing publicly promised to reviewers. Step 2 also complete: supporting material (revised proposal + OpenAPI sketch) posted on APIBacklog #330 (comment `5493292509`); the `.yaml` upload was rejected by GitHub's uploader despite YAML being documented as an allowed type, and succeeded only after renaming to `.txt` — a main-session claim made from memory about `.yaml` being disallowed was itself wrong; the comment also posted with its descriptive text missing and was repaired by PATCH; three-for-three GitHub posts today needed a read-back to catch what actually landed, two of three wrong on the first attempt with no error raised | active | [findings.md](../logs/findings.md#2026-09-01--camara-v2-filed-commonalities705-open-author-pull-only-cannot-label-pr-331-link-back-posted-two-of-the-main-sessions-own-earlier-retractions-were-themselves-wrong-and-are-retracted) |
| 2026-09-01 | docs-builder off-by-one CONFIRMED and fixed upstream (peer-session hypothesis, independently validated on this repo's own data at `9f7a49f`: prd.md 998 real / 999 claimed, findings.md 6340 real / 6341 claimed); root cause is `split('\n')`'s trailing empty element; three existing upstream tests measured expected values with the same broken primitive, which is how the bug survived four fix rounds; `docs/index.md` not yet regenerated | active | [findings.md](../logs/findings.md#2026-09-01--docs-builder-off-by-one-confirmed-and-fixed-upstream-independently-reproduced-on-this-repos-own-data-at-9f7a49f-three-of-the-tests-that-hid-it-measured-with-the-same-broken-primitive-as-the-code) |
| 2026-09-01 | Reply posted on PR #331 confirming the four-step sequence (Commonalities issue first, supporting material on #330, WG slot only after discussion, aggregator item separate); operational finding — the first post was silently truncated by a heredoc paste while `gh` still exited 0, repaired in place by PATCH from a file | active | [findings.md](../logs/findings.md#2026-09-01--reply-posted-on-pr-331-confirming-the-four-step-sequence-first-post-silently-truncated-by-a-heredoc-paste-repaired-in-place-by-patch) |
| 2026-09-01 | User validation run at `0a261e4`: all seven v2 check suites exit 0 at `m1-jws-check` 94/94 (20/20, 94/94, 10/10, 26/26, 42/42, 67/67, 47/47) — first user run covering the equivalent-mutant and empty-answer-schema fixes, supersedes the voided `4ba6f5e` 82/82 record | active | [findings.md](../logs/findings.md#2026-09-01--user-validation-run-at-0a261e4-all-seven-v2-suites-green-at-m1-jws-check-94-first-user-run-covering-the-equivalent-mutant-and-empty-answer-schema-fixes) |
| 2026-09-01 | Fourth `/branch-review` cycle at `f07bf75` came back clean on findings (no Critical, no Warning) but exposed an EQUIVALENT MUTANT: the projection layer had no test that could fail. S1 (deleted `projectClaims` call sites, still 82/82) and S2 (`__proto__`-key answer-schema footgun) both fixed; `m1-jws-check` 82 -> 94; user validation VOID pending a fresh run | active | [findings.md](../logs/findings.md#2026-09-01--fourth-branch-review-cycle-at-f07bf75-came-back-clean-but-found-an-equivalent-mutant-the-projection-layer-had-no-test-that-could-fail-m1-jws-check-82---94) |
| 2026-09-01 | User validation run at `4ba6f5e`: all seven v2 check suites exit 0 at `m1-jws-check` 82/82 (20/20, 82/82, 10/10, 26/26, 42/42, 67/67, 47/47) — first user run covering the prototype-chain fix, supersedes the voided `2c71a20` 39/39 record | active | [findings.md](../logs/findings.md#2026-09-01--user-validation-run-at-4ba6f5e-all-seven-v2-suites-green-at-m1-jws-check-82-first-user-run-covering-the-prototype-chain-fix) |
| 2026-09-01 | Second `/branch-review` at `7bfe111` found a CRITICAL prototype-chain bypass leaking raw values through a signed response; fixed with `hasOwn` + a projection layer; `m1-jws-check` 39 -> 82 | active | [findings.md](../logs/findings.md#2026-09-01--second-branch-review-at-7bfe111-found-a-critical-prototype-chain-bypass-in-checkclosedpayload-raw-values-rode-through-a-signed-profile-mode-response-fixed-with-hasown--a-projection-layer-m1-jws-check-39---82) |
| 2026-09-01 | User validation run at `2c71a20`, first clean-tree run this session: all seven v2 check suites exit 0 at `m1-jws-check` 39/39 (20/20, 39/39, 10/10, 26/26, 42/42, 67/67, 47/47) — supersedes the voided `64f8c26` 33/33 record | active | [findings.md](../logs/findings.md#2026-09-01--user-validation-run-at-2c71a20-first-clean-tree-run-this-session-all-seven-v2-suites-green-at-m1-jws-check-39) |
| 2026-09-01 | `/branch-review` gate at `f1c73a1` — 2 warnings fixed, a regression caught inside the fix round, `m1-jws-check` 33 -> 39, user validation VOID pending a fresh run | active | [findings.md](../logs/findings.md#2026-09-01--branch-review-gate-at-f1c73a1-two-findings-a-regression-caught-in-the-fix-round-itself-m1-jws-check-33---39) |
| 2026-09-01 | User validation run on the uncommitted `camara/v2-rescope` tree at tip `64f8c26`: all seven v2 check suites green (20/20, 33/33, 10/10, 26/26, 42/42, 67/67, 47/47), every one exit 0 — supersedes the voided `8a454c9` nine-suite record | active | [findings.md](../logs/findings.md#2026-09-01--user-validation-run-at-the-uncommitted-camarav2-rescope-tree-all-seven-v2-suites-green-superseding-the-voided-8a454c9-record) |
| 2026-08-31 | Live re-verification vs canonical CAMARA YAML: SimSwap age-band retracted (v2.1.0 has no `/retrieve-age-band`), kyc-match score claim refuted, Commonalities notification-signing precedent found; two candidate no-gos proposed | active | [findings.md](../logs/findings.md#2026-08-31--live-re-verification-against-canonical-camara-yaml-simswap-age-band-retracted-kyc-match-score-refuted-commonalities-notification-signing-precedent-found) |
| 2026-08-31 | kyc-match threshold DECIDED (user's call): operator publishes one threshold, applies it itself — no bisection, no hill-climbing, no new request field; supersedes the `numberMatch` menu for kyc-match only | active | [findings.md](../logs/findings.md#2026-08-31--live-re-verification-against-canonical-camara-yaml-simswap-age-band-retracted-kyc-match-score-refuted-commonalities-notification-signing-precedent-found) |
| 2026-08-31 | Swap-recency bucket set DECIDED (user's call): 30/60/90 days (720/1440/2160h), all under the 2400h cap — implementation deferred to V2-M2 | active | [findings.md](../logs/findings.md#2026-08-31--live-re-verification-against-canonical-camara-yaml-simswap-age-band-retracted-kyc-match-score-refuted-commonalities-notification-signing-precedent-found) |
| 2026-08-31 | Blind-hub scope DECIDED (main session, on the user's delegation): file 2.1/2.2/2.4 only, hold 2.3 for a separate companion filing — supersedes the earlier JWE-riding-along suggestion | active | [findings.md](../logs/findings.md#2026-08-31--live-re-verification-against-canonical-camara-yaml-simswap-age-band-retracted-kyc-match-score-refuted-commonalities-notification-signing-precedent-found) |
| 2026-08-31 | No-gos 17 and 18 CONFIRMED by the user (were candidate) | active | [findings.md](../logs/findings.md#2026-08-31--live-re-verification-against-canonical-camara-yaml-simswap-age-band-retracted-kyc-match-score-refuted-commonalities-notification-signing-precedent-found) |
| 2026-08-31 | Fix round: V2-M1-JWS reserved-claim clobber closed (mutation-proven); 3 items deferred and documented; orphaned-reference sweep (CLAUDE.md repo map, demo.mjs "profile rule 4", m4-facts-mock.mjs spec citation, v2 docs identifier-omission reversal) | active | [findings.md](../logs/findings.md#2026-08-31--v2-m1-jws-fix-round-reserved-claim-clobber-closed-three-items-deferred-and-documented) |
| 2026-08-31 | CAMARA v2 drafted as a Commonalities Scope Enhancement (agent-run, user review pending) | active | [findings.md](../logs/findings.md#2026-08-31--camara-v2-drafted-as-a-commonalities-scope-enhancement-agent-run-user-review-pending) |
| 2026-08-31 | CAMARA feedback and rescoping: Scope Enhancement on Commonalities, use case 2 dropped, layout option B | active | [findings.md](../logs/findings.md#2026-08-31--camara-feedback-on-330331-profile-framing-rejected-use-case-2-charter-excluded-signing-layer-routed-to-commonalities-tenure-api-overlap-missed-by-the-filed-no-overlap-declaration) |
| 2026-08-31 | Draft renamed via replacement: `draft-hamr-...-00` posted, `draft-hassan-...-00` now Replaced | active | [findings.md](../logs/findings.md#2026-08-31--draft-renamed-via-replacement-draft-hamr-oauth-agent-delegation-00-posted-draft-hassan-oauth-agent-delegation-00-now-replaced) |
| 2026-08-31 | IETF draft-00 SUBMITTED — individual, NOT adopted, no formal standing | active | [findings.md](../logs/findings.md#2026-08-31--scope-made-mechanically-decidable-test-vectors-with-a-negative-control-two-cross-repo-handovers-closed) |
| 2026-08-31 | Scope made mechanically decidable; test vectors + negative control; 2 cross-repo handovers closed | active | [findings.md](../logs/findings.md#2026-08-31--scope-made-mechanically-decidable-test-vectors-with-a-negative-control-two-cross-repo-handovers-closed) |
| 2026-08-30 | IETF draft-00 written and VALIDATED (not submitted); RFC 9421 has no delegation vocabulary; 2 ZK attributions corrected | active | [findings.md](../logs/findings.md#2026-08-2930--ietf-draft-00-written-and-validated-rfc-9421-has-no-delegation-vocabulary-two-zk-attributions-corrected) |
| 2026-08-25 | Fold-in-vs-distinguish resolved as HYBRID (klrc-aiagent-auth-03 read) | active | [findings.md](../logs/findings.md#2026-08-25--open-decision-from-the-entry-below-closed-fold-in-versus-distinguish-resolved-as-hybrid-after-a-full-read-of-draft-klrc-aiagent-auth-03-raw-text) |
| 2026-08-25 | AAIF dropped; agent arm re-homed to IETF; no-go 12 retired | active | [findings.md](../logs/findings.md#2026-08-25--submission-strategy-shift-aaif-dropped-agent-arm-re-homed-to-ietf-no-go-12-retired-api-family-owner-decided) |
| 2026-08-18 | Full user validation run, uncommitted tree — BOTH GATES MET | active | [findings.md](../logs/findings.md#2026-08-18--user-ran-the-full-validation-suite-on-their-own-machine-against-the-current-uncommitted-tree-the-tree-the-entries-below-describe-every-suite-clean-zero-fail-zero-typeerror-zero-error-lines-in-either-log-both-gates-met-on-this-tree) |
| 2026-08-18 | code-review --fix on fix round below (agent-run, NOT user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--code-review-medium---fix-round-on-the-fix-round-below-agent-run-not-user-validated--g1-and-g2-stay-re-openedpending-at-the-new-counts) |
| 2026-08-18 | Fix round on 5 items at `bb0b52f` COMPLETE (agent-run, not user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--fix-round-on-the-five-open-items-recorded-at-bb0b52f-now-complete-agent-run-not-yet-user-validated--g1-and-g2-stay-re-openedpending) |
| 2026-08-18 | Full user validation run on PRIOR tree `bb0b52f` — BOTH GATES MET (does not carry forward) | active | [findings.md](../logs/findings.md#2026-08-18--user-ran-the-full-validation-suite-on-their-own-machine-against-the-current-uncommitted-working-tree-this-record-applies-to-that-prior-tree-at-bb0b52f-only--it-does-not-carry-forward-to-the-fix-round-in-the-entry-above-which-changed-executable-code-both-gates-cover-every-suite-clean-zero-fail-zero-typeerror-zero-error-lines-in-either-log-both-gates-met-on-this-tree) |
| 2026-08-18 | Fixes `m4-check.mjs` case 42 — pinned spelling not behaviour (agent-run, not user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--fixes-m4-checkmjs-case-42-itself-it-pinned-the-guards-spelling-not-its-behaviour-agent-run-not-yet-user-validated) |
| 2026-08-18 | Finishes axis-signal unification, all 6 axes (agent-run, not user-validated) | superseded | [findings.md](../logs/findings.md#2026-08-18--finishes-the-axis-signal-unification-the-prior-entry-started-agent-run-not-yet-user-validated-all-six-operator-axes-now-gate-on-predicatesaxesneedxxx-closing-the-two-the-prior-round-left-on-the-old-per-axis-pattern) |
| 2026-08-18 | Closes roaming/reachability unconditional-read item (agent-run, not user-validated) | active | [findings.md](../logs/findings.md#2026-08-18--closes-the-roamingreachability-unconditional-read-open-design-item-agent-run-not-yet-user-validated-both-axes-are-now-conditional-on-getfacts-gated-on-a-factquery-carried-needroaming-needreachability-signal--the-same-pattern-the-simdevice-axes-already-used) |
| 2026-08-18 | Full user validation run at `4446517`/`c921508` — BOTH GATES MET, same commit | active | [findings.md](../logs/findings.md#2026-08-18--user-ran-the-full-validation-suite-on-their-own-machine-at-4446517c921508-log-timestamped-0816-every-suite-clean-zero-fail-zero-typeerror-zero-error-lines-in-the-entire-log-both-gates-met-at-4446517-for-the-first-time-at-the-same-commit) |
| 2026-08-18 | 2nd code-review --fix: cross-requester sealing fixed (m6 45→46); G1/G2 pending | superseded | [findings.md](../logs/findings.md#2026-08-18--second-code-review-medium---fix-round-cross-requester-sealing-fixed-m6-45--46-spec-closure--g1-and-g2-were-pending-at-4446517-until-the-full-user-run-above) |
| 2026-08-18 | code-review --fix + /security: 6 fixes; G1 AND G2 RE-OPENED (PENDING) at `9b04854` | superseded | [findings.md](../logs/findings.md#2026-08-18--code-review-medium---fix-round--security-6-fixes-1-user-approved-behaviour-change-m3-25--26-m5-58--60-g1-and-g2-both-re-opened-pending-at-9b04854) |
| 2026-08-18 | LIVE Orange run 32/33 caught vacuous control; fixed, RE-RUN 33/33 (USER-RUN, `3276ed0`) | active | [findings.md](../logs/findings.md#2026-08-18--a-live-orange-run-at-3233-caught-a-vacuous-negative-control-fixed-and-then-re-run-live-at-3333-user-run-tip-3276ed0) |
| 2026-08-17 | LIVE convergence probe (user-run) settled Admin `location` write shape | active | [findings.md](../logs/findings.md#2026-08-17--a-throwaway-live-convergence-probe-user-run-990100000099-settled-the-admin-location-write-shape-and-moved-two-other-axes-from-assumed-to-measured-good) |
| 2026-08-17 | Live run exposed grounding failure: `m5-check-live.mjs` untouched by 3→6 round | active | [findings.md](../logs/findings.md#2026-08-17--the-same-live-run-exposed-a-grounding-failure-m5-check-livemjs-was-the-one-file-the-3--6-round-never-touched-11--19-cases) |
| 2026-08-17 | First LIVE run of 3→6 tree corrected Admin `location` write shape (user-measured) | active | [findings.md](../logs/findings.md#2026-08-17--the-first-live-run-of-the-3--6-tree-corrected-the-admin-location-write-shape-measured-by-the-user-agent-has-no-credentials) |
| 2026-08-17 | `numberMatch` BUILT; predicate set now signed SIX (agent-run, user validation PENDING) | active | [findings.md](../logs/findings.md#2026-08-17--numbermatch-built-the-wired-predicate-set-is-now-the-signed-six-agent-run-user-validation-pending) |
| 2026-08-17 | `presentIn` BUILT; predicate set 3→5 (agent-run, user validation PENDING) | active | [findings.md](../logs/findings.md#2026-08-17--presentin-built-the-predicate-set-is-3--5-so-far-this-round-agent-run-user-validation-pending) |
| 2026-08-17 | `deviceSwapAge` BUILT; predicate set 3→4 (agent-run, user validation PENDING) | active | [findings.md](../logs/findings.md#2026-08-17--deviceswapage-built-the-predicate-set-is-3--4-so-far-this-round-agent-run-user-validation-pending) |
| 2026-08-17 | Wired predicate set goes 3→6 (user-signed DESIGN, not yet built) | active | [findings.md](../logs/findings.md#2026-08-17-latest--the-wired-predicate-set-goes-3--6-user-signed-design-not-yet-built) |
| 2026-08-17 | `deviceSwapAge` takes identical shape to `simSwapAge` (user-signed DESIGN) | active | [findings.md](../logs/findings.md#2026-08-17-latest--deviceswapage-takes-the-identical-shape-to-simswapage-user-signed-design) |
| 2026-08-17 | `numberMatch`: threshold off published menu; boolean out, score never wired (user-signed) | active | [findings.md](../logs/findings.md#2026-08-17-latest--numbermatch-the-requester-declares-its-threshold-in-the-question-off-a-published-menu-of-60--70--80--90-and-nothing-else-the-operator-compares-internally-and-answers-a-boolean-the-score-never-crosses-the-wire-user-signed-design) |
| 2026-08-17 | `presentIn`: boolean out, `PARTIAL` REFUSES (user-signed DESIGN) | active | [findings.md](../logs/findings.md#2026-08-17-latest--presentin-boolean-out-and-partial-refuses-user-signed-design) |
| 2026-08-17 | Five rules apply to all six predicates, no exceptions (user-signed DESIGN) | active | [findings.md](../logs/findings.md#2026-08-17-latest--five-rules-apply-to-all-six-predicates-no-exceptions-user-signed-design) |
| 2026-08-17 | Probing oracle: residual walk priced/bounded above this profile (user's stance) | active | [findings.md](../logs/findings.md#2026-08-17-latest--on-the-probing-oracle-generally-the-residual-walk-is-priced-and-bounded-at-the-layer-above-this-profile-users-position-recorded-as-the-projects-stance) |
| 2026-08-17 | `/retrieve-age-band` DOES NOT EXIST on Orange Playground — CLOSED unfavourably | active | [findings.md](../logs/findings.md#2026-08-17-latest--retrieve-age-band-does-not-exist-on-the-orange-playground-the-previous-entrys-unverified-is-now-closed-unfavourably) |
| 2026-08-17 | Exit 2 reserved for backend that COULD NOT RUN; crashed mock run is FAILURE (M6) | active | [findings.md](../logs/findings.md#2026-08-17--exit-2-is-reserved-for-a-backend-that-could-not-run-a-crashed-mock-run-is-a-failure-m6) |
| 2026-08-17 | requester nonce store's unbounded growth DOCUMENTED, not built (M6) | active | [findings.md](../logs/findings.md#2026-08-17--the-requester-nonce-stores-unbounded-growth-is-documented-not-built-m6) |
| 2026-08-17 | Four DEPENDENCY-INJECTION seams, one code path each (M6) | active | [findings.md](../logs/findings.md#2026-08-17--four-dependency-injection-seams-one-code-path-each-m6) |
| 2026-08-17 | Why PoC reads a PRECISE SIM-swap date (M5/M6, documentation only) | active | [findings.md](../logs/findings.md#2026-08-17--why-the-poc-reads-a-precise-sim-swap-date-and-what-that-does-and-does-not-say-m5m6-documentation-only) |
| 2026-08-17 | Predicate thresholds QUANTISED to published menu; repeated-query oracle is honest limit (M6 #1) | active | [findings.md](../logs/findings.md#2026-08-17--predicate-thresholds-are-quantised-to-a-published-menu-m6-decision-1-user-signed-and-the-repeated-query-oracle-is-recorded-as-an-honest-limit) |
| 2026-08-17 | Top-level REQUEST field set is CLOSED (M6) | active | [findings.md](../logs/findings.md#2026-08-17--the-top-level-request-field-set-is-closed-m6) |
| 2026-08-17 | Subscriber number rides INSIDE sealed, signed request (M6, user-signed) | active | [findings.md](../logs/findings.md#2026-08-17--the-subscriber-number-rides-inside-the-sealed-signed-request-m6-user-signed) |
| 2026-08-17 | Spec sketch `Predicate` enum trimmed 7→3 (M6, user-signed) | active | [findings.md](../logs/findings.md#2026-08-17--spec-sketch-predicate-enum-trimmed-7--3-m6-user-signed) |
| 2026-08-17 | M1 exports duplicate-key scanner; duplicate-key requests rejected (M6 #2, user-signed) | active | [findings.md](../logs/findings.md#2026-08-17--m1-exports-its-duplicate-key-scanner-duplicate-key-requests-are-rejected-outright-m6-decision-2-user-signed) |
| 2026-08-17 | M3 fix: `checkFloor` never throws on wire input | active | [findings.md](../logs/findings.md#2026-08-17--m3-fix-point-closed-checkfloor-never-throws-on-wire-input) |
| 2026-08-16 | M4 facts-adapter spec signed off (4 user decisions) | active | [findings.md](../logs/findings.md#2026-08-16--m4-facts-adapter-spec-signed-off-4-user-decisions) |
| 2026-08-15 | Versioning scheme corrected (user-decided) | active | [findings.md](../logs/findings.md#2026-08-15--versioning-scheme-corrected-user-decided) |
| 2026-08-15 | M3 floor-gate spec signed off (3 user decisions) | active | [findings.md](../logs/findings.md#2026-08-15--m3-floor-gate-spec-signed-off-3-user-decisions) |
| 2026-08-15 | Both v0.0.3 security Mediums closed now (user-decided) | active | [findings.md](../logs/findings.md#2026-08-15--both-v003-security-mediums-closed-now-user-decided-fix-both-now) |
| 2026-08-15 | Decisions round after M2 gate (all user-decided) | active | [findings.md](../logs/findings.md#2026-08-15--decisions-round-after-the-m2-gate-all-user-decided) |
| 2026-08-15 | M2 envelope shape settled | active | [findings.md](../logs/findings.md#2026-08-15--m2-envelope-shape-settled) |
| 2026-08-15 | M1 built under the ladder; verifier shape settled | active | [findings.md](../logs/findings.md#2026-08-15--m1-built-under-the-ladder-verifier-shape-settled) |
| 2026-08-15 | `findings.md` created (user-ordered) | active | [findings.md](../logs/findings.md#2026-08-15--findingsmd-created-user-ordered) |
| 2026-08-15 | PoC build ROLLED BACK to G0; module ladder made binding | active | [findings.md](../logs/findings.md#2026-08-15--poc-build-rolled-back-to-g0-module-ladder-made-binding-44) |
| 2026-08-14 | Consolidation (this PRD) | active | [findings.md](../logs/findings.md#2026-08-14--consolidation-this-prd) |
| 2026-08-14 | Template re-grounded | active | [findings.md](../logs/findings.md#2026-08-14--template-re-grounded) |
| 2026-08-14 | Core standard = attested windowed disclosure | active | [findings.md](../logs/findings.md#2026-08-14-earlier--core-standard--attested-windowed-disclosure) |
| 2026-08-14 | Two modes; Mode A ships first | active | [findings.md](../logs/findings.md#2026-08-14-earlier--two-modes-mode-a-ships-first) |
| 2026-08-14 | Horizontal profile, not a new vertical API | active | [findings.md](../logs/findings.md#2026-08-14-earlier--horizontal-profile-not-a-new-vertical-api) |
| 2026-08-14 | Two tracks, one seam | active | [findings.md](../logs/findings.md#2026-08-14-earlier--two-tracks-one-seam) |
| 2026-08-14 | Agent-grade floor | active | [findings.md](../logs/findings.md#2026-08-14-earlier--agent-grade-floor) |
| 2026-08-14 | Name: justabit; repo-first, not npm-first | active | [findings.md](../logs/findings.md#2026-08-14-earlier--name-justabit-repo-first-not-npm-first) |

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

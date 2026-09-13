# IETF -02 reduction plan

Date: 2026-09-13.
Status: APPROVED by the user 2026-09-13 ("agreed to reduction plan"). All
questions decided 2026-09-13. No XML change until the findings entry is
written.
Source: `ietf/v3/docs/draft-hamr-oauth-agent-delegation-02.xml`, 2592 lines,
preserved at `52066e3` on `main`.
Branch: `ietf/02-reduction`.

## 1. Rule for the rewrite

Technical calls are the user's. The agent's part is wording, clarity, and
checks against sources. Every sentence must pass one test: could the author
explain it at the mic without notes. The user writes the Abstract and the
Introduction in their own voice. The agent does only a wording pass on those
two sections.

## Scope and style (the user, 2026-09-13)

Keep only what the author knows and uses:

- Agent delegation and auth.
- The principal layer, instantiated by CAMARA (telecom) and zkagent
  (passport/ID), with 8een as the ZK case.
- A harness that reads APIs to grade r/w/x and feed MCP hints with safe
  defaults, accepting low leaks on the long tail.
- r/w/x with open limits or budgets, for example "rw+2x" (no number on r
  and w, 2 on x).
- On A2A, a child is a subset of its parent, never more.

Style: follow the usual IETF flow and way of explaining. No ornate or showy
wording. Plain terms the author can explain at the mic.

The user's words, verbatim: "goal is to stick to what i know, agentic auth
camara+zkagent (telecom, passport/id) harness to read apis feed mcphints
with safe defaults and possible low leaks on longtail, rwx open limits or
rw+2x and on A2A no reesigning but could be a subset of the parent never
more. any other fluff tough lang to seem sophsiticated is prohibited, stick
to ietf expetcations of flow and way of explanation no problem just don't
over sophsiticate to appear smart and i look dumb"

## 2. Section table

All "now" counts were verified today with `grep -n` on section open tags and
`Read` on section boundaries. Every value matched the brief within 2 lines.
Two exact checks (`iana`, `acknowledgments`) matched exactly once blank
lines were excluded.

| Section | anchor | now | target | action | agreements |
|---|---|---|---|---|---|
| front + abstract | - | 41 | 40 | Keep structure. User rewrites abstract in own voice. | - |
| Introduction + Motivation | introduction, motivation | 58+29 | 50 | Merge. User writes. Frame: RFC 9421 signs a message but carries no delegation, no accountable principal, no limit on what the agent may do; this profile adds the chain, the principal floor, the action floor. Keep the car-rental scenario in 2-3 sentences. | - |
| Conventions and Terminology | conventions | 73 | 45 | Keep terms; shorten Resource Owner definition. | - |
| Position Among Delegation Layers | layers | 85 | 55 | Cut the "informational" opener and the closing Appendix A pointer. Keep verbatim: layer (c) label, receipts sentence, AEB sentence, the "not the arguments of any single call" sentence, the asor 9.1 parent-stays-valid paragraph. | A1 A2 A9 A12 |
| Agent-Delegation Header Field | header | 37 | 25 | Tighten. | - |
| Profile of RFC 9421 | rfc9421-profile | 68 | 40 | Keep all MUSTs; cut the RFC 9421 7.2.2 paraphrase to one sentence plus reference. | - |
| Scope | scope | 52 | 30 | Keep exact-match rule and forbidden-matching list; tighten prose. | - |
| Attenuation Rules | attenuation | 62 | 55 | Keep. Core. | - |
| Floor Axes | floors (+axis-registry, duration-grammar, monotone) | 197 | 80 | One table of the eight axes (name, type, comparator). One paragraph: comparators match asor-01 Sections 4.2-4.3. Keep unknown-axis rejection, both omitted-axis cases, `effective`, duration grammar. Fold Monotone Tightening into the table text. Remove anchors `axis-registry`, `monotone`. | A10 A11 A13 |
| Action Class Floors, without Verifier Placement | action-class | 244 | 115 | Keep r<w<x, classSource, method default, declared menu with path-template match and origin binding. Cut the PoC written-order note. Cut the Limits subsection (F2 below); remove anchor `action-class-limits`. Redefine r, w and x per F8 (wording pending Q3). | - |
| Verifier Placement | action-class-verifier-placement | 63 | 62 | Verbatim. No change. | A3 A7 |
| Write Budget | write-budget | 156 | 85 | Keep limit vs count, verifier-derived chain identifier, per-verifier limit, no-practical-size statement. Cut the case-22 paragraph. Split into one budget per class, w and x (Q1 decided). Notation example: "rw+2x" = no limit on r and w, 2 on x. Rewrite the omitted-budget rule per F9. Update vectors V10 and V11 to the split. | - |
| Attestation Properties | attestation | 95 | 65 | Keep all five MUSTs, signed refusal, nonce-is-not-replay. | - |
| Agent Identifier | agent-identifier | 21 | 25 | Absorb Appendix B as one paragraph; keep the klrc Section 6 tension stated as open. | - |
| Verification Procedure | verification | 30 | 29 | Keep. | - |
| A Worked Example | example | 101 | 0 | Cut. Scenario stays in the Introduction; negative-control vectors carry the rules. | - |
| Privacy | privacy | 39 | 30 | Keep issuer query-log limit. Remove the header-field personal-data repeat (already in `header`). | - |
| Relationship to Existing Work | related-work | 101 | 30 | Charter item in one sentence. klrc composition in one paragraph. Cut the revocation-light paragraph. Move CAMARA paragraph to Appendix A. asor paragraph shrinks — comparators now live in Floor Axes. | - |
| Implementation Status | implementation-status | 47 | 45 | justabit PoC (re-run counts on the day) plus rwxmap as a trial of mechanical r/w/x classification from OpenAPI. rwxmap numbers only here, never in normative text. See F3. | - |
| Security Considerations | security | 101 | 65 | Keep every honest limit: lazy verification, no uniqueness, no revocation, trust-source centralization, uniform rejection, query log, forgeable chain identifier, menu downgrade surface. Tighten; remove restatements. Add one limit: the method default grades every GET as r; in rwxmap's corpus 17 of 550 GET rows (3.1%) are really w or x, so an r-only link admits them. | - |
| IANA | iana | 34 | 18 | Header field registration only. | - |
| References | - | 124 | 125 | Add zkagent, 8een, rwxmap. Re-verify every I-D version (F4). | - |
| Appendix A Instantiations | appendix-a | 155 | 55 | Direction 1 = CAMARA (current state, F1). Direction 2 = 8een (F5). Direction 3 = zkagent (F5). Direction 4 cut to one short paragraph, bullets removed. | A6 |
| Appendix B | appendix-b | 28 | 0 | Folded into Agent Identifier. | - |
| Test Vectors | vectors | 233 | 40 | Keep only the negative controls V4, V6, V9, V11 in one table. Full V1-V11 set lives in the repo, cited by commit SHA. | - |
| Changes since -01 | changes-since-01 | 140 | 20 | Rewrite short: the reduction, the registry cut, the AEB/Verifier Placement change keeping the substance Iman approved, the acknowledgments. | A4 |
| Changes since -00 | changes-since-00 | 158 | 0 | Cut. -01 as posted already records it. | - |
| Acknowledgments | acknowledgments | 10 | 16 | Iman Schrock line verbatim, plus the Sangam Das / Jijie Wei (varwof) text. | A5 A8 |

Target sum is about 1250 lines, a little over the 1230 proxy (25 pages at the
-01 ratio of 48 pages / 2364 lines). If the author-tools page count is over
25, the next cut is the vector table — move it all to the repo.

## 3. Agreements map

Every row below was read from its own source record, not from this plan.

| ID | with | what was agreed | source | survives in | risk |
|---|---|---|---|---|---|
| A1 | Iman Schrock | AEB sentence, verbatim, including "exact-action matching": *"[AEB] complements it with an executor-side model for exact-action matching, local authorization, atomic consumption, and outcome reconciliation at invocation, including a requirement to enumerate every path that bypasses it."* | `emilia-final-text-sent-2026-09-06.md`, `emilia-layering-reply-received-2026-09-05.md` | Layers, verbatim | none |
| A2 | Iman Schrock | Receipts sentence and layer (c) label, *"What was approved and consumed, once"* | `emilia-layering-reply-sent-2026-09-04.md` | Layers, verbatim | none |
| A3 | Iman Schrock | AEB Section 9 condition stated in full; distinction is placement, not scope; "narrower" removed; no equivalence, no priority | `emilia-comparison-note-received-2026-09-06.md`, `emilia-comparison-reply-sent-2026-09-06.md` | Verifier Placement, verbatim | none |
| A4 | Iman Schrock | he called the wording, change note, and acknowledgment "right"; the reply says the appendix change note "says the same thing" | same two records | shortened Changes since -01 | FLAG: appendix shrinks 140→20 lines; keep the AEB bullet's substance or the approved note is gone |
| A5 | Iman Schrock | acknowledgment in his narrow form, exactly: *"Iman Schrock for clarifying the receipts/AEB execution boundary and bypass relationship."* | `emilia-layering-reply-received-2026-09-05.md` | Acknowledgments, verbatim | none |
| A6 | Iman Schrock | Appendix A's post-result detector "fits none of the three layers" | `emilia-layering-reply-sent-2026-09-04.md` | cut with Direction 4 bullets | LOW: the wrong mapping it corrected goes too; nothing agreed is contradicted |
| A7 | Sangam Das, Jijie Wei | boundary is a role, not a component; per-path identification; system-wide closure; bypass test; the two statements adjacent and in that order | `oauth-wg-round3-received-2026-09-02.md`, `oauth-wg-reply-3-sent-2026-09-02.md` | Verifier Placement, verbatim | none |
| A8 | Sangam Das, Jijie Wei | naming granted; the user proposed acknowledgment text publicly in reply-3; no objection recorded | `oauth-wg-reply-3-sent-2026-09-02.md` | Acknowledgments: use that proposed text verbatim, "Sangam Das" and "Jijie Wei (varwof)" | GAP TODAY: -02 names neither (checked — current Acknowledgments has only the Iman entry); the reduction closes it. |
| A9 | public lists | the user stated the draft says a floor constrains a category of action, *"not the arguments of any single call"* | `oauth-wg-reply-2-sent-2026-09-02.md` | Layers, keep that sentence | if cut, the public record points at text that is gone |
| A10 | Rafael Asor | asor-01's acknowledgment names HAMR's "duration-typed \"tenureMin\" axis"; asor-01 cites hamr-01 by title | `asor-01-posted-confirmed-2026-09-03.md` | Floor Axes keeps tenureMin as duration-typed; title unchanged | none |
| A11 | Rafael Asor | the user wrote *"if a HAMR registry happens I would rather match yours than invent a second one"* | `emilia-preflight-reply-2-sent-2026-09-01.md` | Floor Axes comparator paragraph (Option A) | none; Option A honours it directly |
| A12 | Rafael Asor | asor 9.1 parent-stays-valid is shared, *"worth saying in both documents"* | same record | Layers, verbatim | none |
| A13 | Iman Schrock (matrix) | HAMR rejects an unknown floor by design (fail-closed) | `docs/logs/findings.md`, "2026-09-01 — Second reply sent on the EMILIA pre-flight thread" (verified present) | Floor Axes unknown-axis rejection | none |

If A4 is kept as planned, no cut in this plan drops agreed content, so no
notice to anyone is needed.

## 4. Claims that must change

- **F1.** `related-work` and `appendix-a` call CAMARA-PROPOSAL "open,
  unreviewed" and say it "proposes a horizontal profile". Both are dead.
  CAMARA reviewed it: the 2026-08-31 feedback rejected the profile framing
  and asked for changes, and a 2026-09-03 TSC round followed
  (`docs/logs/findings.md`). The author answered the change requests and
  filed the signing layer in Commonalities as issue #705, a scope
  enhancement. No response or feedback has come since. State on
  2026-09-13: APIBacklog #330 open, PR #331 open, Commonalities #705 open,
  no label. New text says: reviewed, changes requested and answered,
  signing layer filed in Commonalities, awaiting response; not accepted or
  adopted. Re-check the three items live on the day of writing. Retract
  the old claim visibly in `findings.md`.
- **F2.** The Action Class Limits figure, "57 of 138 POST operations are
  named as reads," reads as a rule output. It is a reader's judgement from
  the spike; the prefix pass gave 54, the substring pass gave 43. Remove it.
- **F3.** rwxmap run-proof (`rwxmap/run-proof/rwxmap-runs.md`, run date
  2026-09-13, HEAD `9218104`): 5465 rows, leave-one-vendor-out, model-read
  truth. Wrong loosenings (goal 2): 37 truth-x predicted w, unchanged by
  D58. Wrong tightenings: goal 1 false alarms 2650 (D60, commit `9218104`;
  was 2727 at `dd16c52`, 2703 at `d4c9124`), goal 3 over-tight 49,
  unchanged. Separately, 13 truth-x rows are predicted r; all 13 are GET
  floor rows (rule `floor`), not the POST read-verb rule. Total wrong
  loosenings 50 = 37 + 13: 0.9% of all 5465 rows, 5.3% of the 936 truth-x
  rows. Implementation Status must name which denominator it uses. rwxmap
  changes several times a day: take every number from a fresh run of
  `node poc/m1/run/proof.mjs` on the day the section is written, and pin
  the commit.
  MCP hints (`learnings.md` 3153-3166, D59): hinting only evidence rows
  (floor:false, 3273/5465) gives zero wrong `readOnlyHint`/`idempotentHint`;
  hinting every row gives 17/50 wrong. `idempotentHint`'s mapping is still
  open in rwxmap (`prd.md` line 324, class vs RFC 9110 §9.2.2 method) — do
  not present it as decided. Caveats to carry: corpus is tuning, not a
  clean exam (`prd.md` 134-141); M1's gate (D30) not met
  (`module-ladder-and-shape.md` line 91); truth is model-read, not hand
  labelled; rwxmap has no confidence score, only evidence vs floor (D44);
  no code emits MCP hints yet (M3); output is advisory, not enforcement.
- **F4.** Every cited I-D version must be re-verified live on the day of
  writing: das-agentic-tool-binding-02, schrock-ep-authorization-receipts-12,
  schrock-action-evidence-boundary-05, asor-wimse-agent-delegation-chain-01,
  klrc-aiagent-auth-03 ("current as of 2026-08-28" in the text),
  reece-wimse-cross-org-delegation-02, sweeney-wimse-credential-delegation-00,
  google-cfrg-libzk-02.
- **F8.** -02 `action-class-values` defines w as "an idempotent write" and
  x as "a consequential, non-idempotent action", and `classification`
  justifies the method default by RFC 9110 safe and idempotent methods.
  The user defines w as a write to your own account and x as a write to
  third-party accounts. rwxmap already diverged from -02 on this: decision
  D16 (2026-09-06, `rwxmap/docs/wiki/decisions-log.md` line 30) reads x as
  consequence, not non-idempotence, and names it "M0's proposed correction
  to that text". D16 (2026-09-06) was refined by D20 (2026-09-07,
  `decisions-log.md` line 35): the current definition is D20 plus the
  labelling brief (`data/exam4-2026-09-12/LABELLING-BRIEF.md` lines 31-53):
  "x — either of two roads is enough: 1. it REACHES BEYOND THE CALLER ...
  2. it is NOT REPEATABLE"; "w — it changes only the caller's OWN stuff
  ... Deleting your own thing is w, even if it is permanent"; "r — it
  changes nothing". rwxmap's labelled truth also shows this: DELETE rows
  are 19% x and PUT rows 15% x (`rwxmap/docs/product/prd.md` floor table),
  although RFC 9110 calls both idempotent. New text: define r, w, x by
  effect; keep the method default only as a starting floor, not as the
  definition. Until this changes, the rwxmap trial in Implementation
  Status measures a different x than the draft defines. rwxmap also
  carries a separate `destructive` boolean (D28) that -02 has no axis for.
- **F9.** -02 `write-budget-axis` says an omitted writeBudget inherits the
  issuer's published floor, "which is zero unless the issuer's published
  floor for the chain states otherwise". The user's rule: no number means
  no budget limit; actionClass alone then governs, so a link with r, w, x
  lets the agent do everything its scope allows. Two parts stay unchanged:
  a child that omits a budget its parent carried is still rejected (rule 2,
  link-to-link case), and an issuer's published floor can still set a cap.
- **F5.** Appendix A. 8een (`zk8een` v0.5.0, 2026-07-20,
  github.com/hamr0/8een) is a real zero-knowledge proof over an ISO 18013-5
  mdoc via google/longfellow-zk; its README states the limit, verified
  today: *"No proof from a real phone has ever reached this verifier."* That
  limit must appear next to it. zkagent (v0.7.1, 2026-09-07,
  github.com/hamr0/zkagent) reads the passport/ID NFC chip and returns one
  bit; its README states, verified today: *"v1 is never \"zero-knowledge\"";
  third-party ZK enters only as an optional evidence plug, never the
  default."* Never call zkagent zero-knowledge. zkagent's README names its
  default evidence as its own signing (ES256 request objects, a device
  attester key in P-256 or Ed25519); device attestation is an optional
  evidence plug, with Play Integrity as one example, never a default. Both
  are cited as one implementation each, never as dependencies.
- **F6.** Implementation Status case counts: re-ran `m7-check.mjs` today,
  result 43/43, exit 0. Re-run again on the day the section is written.
- **F7.** Removed anchors break xrefs. Counted today with
  `grep -c 'xref target="<anchor>"'`: `example` 0, `axis-registry` 18,
  `monotone` 3, `action-class-limits` 1, `appendix-b` 2, `changes-since-00`
  0. The `axis-registry` and `monotone` xrefs must be repointed to the new
  Floor Axes table before those anchors are removed. Sweep every other
  removed or renamed anchor the same way before the whole-document read.

## 5. Open questions for the user

- **Q1 — DECIDED 2026-09-13.** One budget per class, w and x, not one
  shared budget. The user: "if we collapse them together then no point for
  rwxmap to split them at the first place". A child's budget on each class
  may not exceed its parent's. Budget names are chosen at rewrite time.
- **Q2 — DECIDED 2026-09-13.** Keep the four negative controls V4, V6, V9,
  V11 in the draft. The user: "keep vectors".
- **Q3 — DECIDED 2026-09-13.** r, w, x use rwxmap D20 plus its labelling
  brief: x reaches beyond the caller or is not repeatable; w changes only
  the caller's own things, even permanently; r changes nothing. The user:
  "yes to both".
- **Q4 — DECIDED 2026-09-13.** No destructive axis in -02. The user: "yes
  to both".
- **Q5 — DECIDED 2026-09-13.** Reading (a): on A2A the sub-agent gets no new
  grant; it narrows the parent itself and signs the narrower link with its
  own key. This is -02 today; the chain model does not change. The user:
  "option 1".

## 6. Process after approval

1. Dated `findings.md` entry for the plan decisions (Option A, 25 pages,
   plan approval, Q1 split, Q2 vectors kept, Q3 x wording, F8 and F9 rule
   changes, the F1 retraction).
2. Rewrite one section at a time; the user reads each.
3. Whole-document read; orphan sweep (F7 and repo-wide); the user runs
   author-tools and reports the page count.

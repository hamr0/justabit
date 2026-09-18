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
| front + abstract | - | 41 | 40 | APPROVED 2026-09-14 (abstract 20 lines). The user's notes, reworded by the main session: builds on RFC 9421; chain that only narrows; floors on who is behind the agent (signed yes/no, never the value) and on what it may do (r/w/x, optional counts, signed menu); no credential format, identity system, or revocation. See findings.md. | - |
| Introduction + Motivation | introduction, motivation | 58+29 | 50 | APPROVED 2026-09-14 (148 lines). User's notes, reworded: problem, flight example (replaces car-rental, user's choice), gap, four things added, five things not done. Motivation cut; anchor removed; its one xref (changes-since-00) made plain text. References RWXMAP, ZKAGENT, MCP 2026-07-28 added. Points to Implementation Status for rwxmap figures (added 2026-09-14). See findings.md. | - |
| Conventions and Terminology | conventions | 73 | 45 | DONE 2026-09-18 (68 -> 64 lines, target missed by 19). All eight terms kept; none unused (usage counted: Attestation Issuer 21, Relying Service 13, API Provider 13, Delegate 10, Delegator 6, Floor 5, Scope 3, Link 1). BCP 14 paragraph untouched. Cuts are wording only, including the shorter API Provider definition this row called for. The target was reachable only by collapsing `<dd>` tags onto their text lines, which renders zero pages; rejected, because the line targets are a page proxy and tag-only lines do not render. See findings.md. | - |
| Position Among Delegation Layers | layers | 85 | 55 | DONE 2026-09-18 (84 -> 69 lines, target missed by 14). Cut the "informational" opener and the closing Appendix A pointer; cut two restating phrases from the layering paragraph. Agreements A1, A2, A9 and A12 each read from their own source record and kept word for word; the check script fails if any is altered. Two stale claims fixed in one paragraph: line 302 called `writeBudget` an axis (the draft now has rBudget/wBudget/xBudget), and lines 300-301 called Floor Axes an "extensible registry" although the registry was dropped and the axis set is closed (second defect found while reading, raised not fixed silently). Target unreachable without cutting agreed text: the three-layer list is 18 lines and the asor paragraph 15, both protected. See findings.md. | A1 A2 A9 A12 |
| Agent-Delegation Header Field | header | 37 | 25 | DONE 2026-09-17 (30 lines, 3 of them the wire-form example). Tightened; both MUSTs kept; the wire form added back. See findings.md. | - |
| Profile of RFC 9421 | rfc9421-profile | 68 | 40 | DONE 2026-09-17 (46 lines). All six MUST/SHOULD statements kept; the RFC 9421 quotations for tag, expires and nonce cut to the rules plus their section references; the three-expiry sentence added. The RFC 8941 citation stays here; the RFC 9651 swap stays in the References row. See findings.md. | - |
| Scope | scope | 52 | 30 | DONE 2026-09-18 (51 -> 44 lines, target missed by 14). Exact-match rule and all six forbidden-matching items kept. Normative content held constant and proven so: three `MUST NOT` before and after, zero other normative keywords, with the check script failing on a weakened keyword, a dropped list item, a loosened containment rule, or an added keyword. Cuts are wording only; "OUT OF SCOPE" lowercased, as it is not a BCP 14 keyword. The forbidden list alone is 11 lines and was not cut to reach a number. See findings.md. | - |
| Attenuation Rules | attenuation | 62 | 55 | Keep. Core. | - |
| Floor Axes | floors (+duration-grammar) | 197 | 80 (now 96) | DONE 2026-09-13. Removed accountClass and partialPolicy from the table and every sentence. subjectClass is enum/equals with two plain values, interactive and machine (telecom case as a short example only, no prepaid/postpaid). actionClass and classSource typed as ordered lists (r < w < x; method < declared), comparator rank. Three budget rows, rBudget/wBudget/xBudget, type non-negative integer, comparator max, semantics deferred to Write Budget. Kept the word "axis"; added one plain sentence defining it. Cut the sentence naming `effective` and its out-of-scope clause; kept the inheritance rule itself. Replaced "one_of (singleton)" with "equals"; asor sentence now says equals is asor-01's one_of with one value. Plain-language pass on the whole section; every MUST/rejection/refusal rule kept, nothing new added. Anchors `axis-registry` and `monotone` were already removed in the prior rewrite (xrefs repointed to `floors`). ageMin added (non-negative integer, years, min comparator; yes/no answer only; issuer publishes supported thresholds, off-list refused). | A10 A11 A13 |
| Action Class Floors, without Verifier Placement | action-class | 244 | 115 | APPROVED 2026-09-14 (144 lines). Kept r<w<x, classSource, method default, declared menu with path-template match and origin binding. Cut the PoC written-order note. Cut the Limits subsection (F2 below); removed anchor `action-class-limits` (the Implementation Status paragraph that pointed at the Limits survey was removed with it, per F2). Redefined r, w and x per F8 (Q3 decided: rwxmap D20 plus its labelling brief). Method default, from rwxmap's floor: GET/HEAD/OPTIONS r, PUT/DELETE/PATCH w, POST x; PATCH moves x to w (from the user's rwxmap floor). "Any other method: x" added as tighter-on-unknown (confirmed). Publication section gained one sentence: a classifier tool's output is advice to a Resource Owner writing its menu, not a class source (approved; owner-signing reading still open, see section 5). Reopened 2026-09-14: menu may be signed by the API Provider or by the party that runs the agent; provider menu first; Publication story rewritten; re-approved 2026-09-14. Publication sentence fixed and approved 2026-09-14: measured figures (78.4% / 17.5% / 4.2%, tuning corpus, each vendor left out in turn) replace the accuracy claim; GET/HEAD/OPTIONS exception stated (see findings.md). | - |
| Verifier Placement | action-class-verifier-placement | 63 | 62 | Verbatim. No change. | A3 A7 |
| Write Budget | write-budget | 156 | 85 | REWRITTEN 2026-09-14 (117 lines), APPROVED 2026-09-14; heading renamed Budgets (reviewer's wording), first subsection renamed Budget Axes; anchors kept (write-budget, write-budget-axis, write-budget-limit-count, write-budget-chain-identifier, write-budget-limits). Split into three budgets, rBudget/wBudget/xBudget, each a max-compared non-negative integer limiting one actionClass value; a call spends only against its own class's budget. Omitted-budget rule rewritten per F9: no number means no count limit, actionClass alone governs; an issuer's published floor can still set one; a child omitting a budget its parent set is still rejected. Notation example "rw+2x" kept and stated explicitly as shorthand, not a wire format. Added the confirmed rBudget sentence: it limits how many reads, not how much one read returns. Cut writeBudget, the "zero unless ... states otherwise" wording, the effective-zero sentence, and the case-22 paragraph. PoC vector catch-up (V10/V11) not done in this pass. | - |
| Attestation Properties | attestation | 95 | 65 | REWRITTEN 2026-09-14 (93 lines), APPROVED 2026-09-14; two refusal rules added (cannot answer an axis; incomplete data). Keep all five MUSTs, signed refusal, nonce-is-not-replay. State plainly that an issuer with incomplete data refuses and never rounds (the rule partialPolicy carried, now that the axis itself is cut). State plainly that an issuer that cannot answer an axis in a floor refuses, and never skips it (no issuer answers every axis: a telecom issuer cannot answer ageMin; an identity-document issuer cannot answer tenureMin). | - |
| Agent Identifier | agent-identifier | 21 | 25 | DONE 2026-09-17 (24 lines). Appendix B folded in as one paragraph; the klrc Section 6 tension stays stated as open. See findings.md. | - |
| Verification Procedure | verification | 30 | 29 | APPROVED 2026-09-14 (31 lines). Kept steps and order; added step 7 (L(0) against the published floor and the Delegator's authority, unknown axis rejected, published floor applied where no link sets an axis) and step 10 (floor attestation result must be yes; signed no or signed refusal rejects); step 9 -> 11 uses the three budgets instead of the writeBudget ledger. Each restates an existing MUST (see findings.md). "step 5" reference in Security still valid. | - |
| A Worked Example | example | 101 | 0 | DONE 2026-09-17. Cut. Two items it alone carried move to later rows: the one-line wire form to Header, the three-expiry distinction to the RFC 9421 profile. See findings.md. | - |
| Privacy | privacy | 39 | 30 | Keep issuer query-log limit. Remove the header-field personal-data repeat (already in `header`). | - |
| Relationship to Existing Work | related-work | 101 | 30 | DONE 2026-09-17 (86 -> 37 lines, target missed by 7). Three paragraphs kept: the charter work item quoted to its operative clause, composition with klrc-aiagent-auth at its two extension points, and the three adjacent Internet-Drafts. Cut the klrc Section 11 revocation-light paragraph (Security already says this document has no revocation), the klrc Section 6 identifier paragraph (Agent Identifier states the same tension in full; the new text cross-references it), and the asor Section 10 registry paragraph (Floor Axes already carries the comparator bridge). The asor Section 4.2 deny-on-unknown alignment is not restated anywhere; the rule itself survives in Floor Axes as A13 (user chose option 1, 2026-09-17). Agreements A10 and A11 untouched, both in Floor Axes. Earlier note: CAMARA paragraph deleted 2026-09-15, "open, unreviewed" retracted, its header point moved to Direction 1. See findings.md. | - |
| Implementation Status | implementation-status | 47 | 45 | APPROVED 2026-09-14 (77 lines). RFC 7942 intro; justabit PoC suites passed 2026-09-14 by exit code (114 attestation cases in camara/v2/poc; 26 floor and 43 action-class cases in ietf/v3/poc); four ways the code has not caught up with -02; what is not implemented; rwxmap: three steps, signs nothing, no MCP annotations yet; table pinned to rwxmap `56b3310`, reproduced from a clean copy (78.4% right / 17.5% tighter / 4.2% looser); 17 GET leaks, 179 of the leaks among 1998 marked calls; limits: tuned on the same calls, no clean-test figure, labels written by models, goal about 80% / 20% / 1-2% stated apart. Earlier notes in this row (pin 7ee981c, no pinned numbers, 2441 / 192) superseded. "5465 labelled calls" kept in Introduction and Publication (option 1). See findings.md. | - |
| Security Considerations | security | 101 | 65 | APPROVED 2026-09-14 (89 lines, target missed by 24). Ten paragraphs, every honest limit kept: lazy verification, replay, no uniqueness, no revocation, trust source, uniform rejection, query log, chain identifier (now three budgets, V11 kept), menu downgrade (API Provider or the party that runs the agent may sign). Added the GET limit with no number. See findings.md. | - |
| IANA | iana | 34 | 18 | Header field registration only. | - |
| References | - | 124 | 125 | Add zkagent, 8een, rwxmap (all three in by 2026-09-15; CAMARA-SIGNING also added 2026-09-15). F4 RUN LIVE 2026-09-17 against the Datatracker API: six of eight cited versions match (klrc-aiagent-auth -03, asor-wimse-agent-delegation-chain -01, reece-wimse-cross-org-delegation -02, sweeney-wimse-credential-delegation -00, schrock-action-evidence-boundary -05, google-cfrg-libzk -02); two are STALE and still to fix here, das-agentic-tool-binding cited -02 against -03 live and schrock-ep-authorization-receipts cited -12 against -13 live. Those two are the idnits warnings. Bumping either means re-reading the draft and re-checking every claim -02 makes about it, not swapping a version string. Also swap RFC 8941 for RFC 9651 (new bibxml entry). | - |
| Appendix A Instantiations | appendix-a | 155 | 55 | APPROVED 2026-09-15 (69 lines, target missed by 14). Three directions (operator, 8een, zkagent), each with what it does today and what it lacks against Attestation; "all three satisfy" removed as false (user option 1). No number-portability clause (user). Direction 4 one paragraph, label and role-model sentence kept. References CAMARA-SIGNING and ZK8EEN added. See findings.md. Original plan: Direction 1 = CAMARA (current state, F1); drop the accountClass/partialPolicy line from the network-observable-attributes mapping now that both axes are cut. Direction 2 = 8een (F5). Direction 3 = zkagent (F5). Direction 4 cut to one short paragraph, bullets removed. Directions 2 and 3 (identity document) map to subjectClass `interactive` and ageMin; tenureMin and credentialAgeMin do not apply to them. | A6 |
| Appendix B | appendix-b | 28 | 0 | DONE 2026-09-17. Folded into Agent Identifier. | - |
| Test Vectors | vectors | 233 | 40 | APPROVED 2026-09-15 (43 lines). Kept only the negative controls V4, V6, V9, V11 in one table (Vector, Input, Expected outcome, A verifier that gets it wrong). V11 uses xBudget 2 and states the whole admit, admit, refuse, refuse sequence. accountClass/partialPolicy note dropped. Full V1-V11 set cited in the posted -01's Test Vectors appendix by datatracker URL, not a repo file (user's option 2, replaces "lives in the repo, cited by commit SHA"); one sentence says -01's V10/V11 use writeBudget 2, xBudget 2 in -02. "Not executed by anyone" replaced by what the PoC runs (V9; two-request V11 in -01 form; V4 rule on classSource/writeBudget; nothing runs V6). See findings.md. | - |
| Changes since -01 | changes-since-01 | 140 | 20 | DONE 2026-09-17 (18 lines). Nine bullets covering what -02 actually changes; A4 kept by bullets 2 and 3 (closure versus complete mediation, and the receipts layering correction). See findings.md. | A4 |
| Changes since -00 | changes-since-00 | 158 | 0 | DONE 2026-09-17. Cut, including -02's own edits inside it (61 diff lines against posted -01, all history-consistency edits). | - |
| Acknowledgments | acknowledgments | 10 | 16 | DONE 2026-09-17 (18 lines). Iman Schrock line unchanged (A5); the proposed list text added word for word from ietf/v2/docs/oauth-wg-reply-3-sent-2026-09-02.md, closing the A8 gap. See findings.md. | A5 A8 |

Target sum is about 1250 lines, a little over the 1230 proxy (25 pages at the
-01 ratio of 48 pages / 2364 lines). If the author-tools page count is over
25, the next cut is the vector table — move it all to the repo.

Measured 2026-09-15 at `688f9a4` (author-tools, run by the user): 2284 lines render as 43 text pages (34 PDF), about 53 lines per page, so 25 pages is about 1330 lines, not 1230. Finishing every remaining row at its target gives about 1576 lines, about 30 pages; the approved rows are about 215 lines over their targets. idnits: 2 errors (RFC 8941 obsolete, use RFC 9651; RFC 6234 downref, in the downref registry) and 2 warnings (das-agentic-tool-binding -03 and schrock-ep-authorization-receipts -13 exist; F4). See findings.md.

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
- **F10 - PoC catch-up, new 2026-09-13.** `ietf/v3/poc/m3-floor.mjs` still
  uses `class` and `partialPolicy`, and the old CAMARA axis names; it has
  not caught up to the Floor Axes rewrite (accountClass/partialPolicy cut,
  subjectClass interactive/machine). The m7 budget ledger still carries
  one shared budget and never spends on r; it has not caught up to the
  rBudget/wBudget/xBudget split. Both need catch-up before the
  whole-document read; this plan does not edit PoC code.

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
- **Section order - DECIDED 2026-09-13.** Rewrite Action Class Floors and
  Write Budget next; Abstract and Introduction last. The user: "#3 option
  1" (message 1), where option 1 is "Action Class and Write Budget next,
  Abstract/Intro last".
- **Submission of -02 - DECIDED 2026-09-13.** Decide whether to submit
  only after the whole-document read, not before. The user: "#4 option 2"
  (message 1), where option 2 is "decide on submission after the
  whole-document read".
- **Security Considerations GET number — DECIDED 2026-09-14: dropped.**
  The user: "#2 GET number 17 are the leaks? drop it".
- **Owner signing — DECIDED 2026-09-14.** Resource Owner renamed API
  Provider. A menu may be signed by the API Provider, or by the party
  that runs the agent (for example a customer that deploys it),
  responsible for the menu it signs. A verifier that looks for a menu
  uses one signed by the API Provider first; if there is none, it may
  use one signed by the party that runs the agent, if configured to
  trust that key; if neither, the method default applies. A menu
  signed by the party that runs the agent limits only the verifiers
  that party configures and never makes an API Provider's verifier
  admit more. Replaces the prior proposed reading (unsigned list as
  advice only, only a signed menu changes the class a verifier uses).

## 6. Process after approval

1. Dated `findings.md` entry for the plan decisions (Option A, 25 pages,
   plan approval, Q1 split, Q2 vectors kept, Q3 x wording, F8 and F9 rule
   changes, the F1 retraction).
2. Rewrite order: Action Class Floors and Write Budget next; Abstract and
   Introduction last (Section order, decided 2026-09-13).
3. Rewrite one section at a time; the user reads each.
4. Whole-document read; orphan sweep (F7 and repo-wide); the user runs
   author-tools and reports the page count. Decide whether to submit -02
   only after this read (Submission of -02, decided 2026-09-13).

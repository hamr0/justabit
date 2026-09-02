# Changelog

## Unreleased

- **`draft-hamr-oauth-agent-delegation-01` SUBMITTED and posted**
  (2026-09-02). Verified live against the IETF Datatracker API: rev 01,
  state "posted", submission_date 2026-09-02, expires 2027-03-06, 48
  pages, title "An Attenuated Delegation Profile for Automated Agents".
  The user's own `author-tools` and `idnits` runs on the uploaded XML
  both reported CLEAN — the first author-tools schema validation
  reported this cycle. Submitted XML: sha256 prefix `cc1f8435231db0fe`,
  2364 lines, byte-unchanged from commit `49e3fab` onward. All seven
  cited I-D references re-verified live against `bib.ietf.org` on
  submission day; all seven matched on revision and date. Submission is
  not adoption — watching for `asor` -01 to post remains open.
- **Asor acknowledgment consent sent; OAuth WG thread reply sent**
  (2026-09-02). Consented, privately, to being named in the
  acknowledgments of draft-asor-wimse-agent-delegation-chain-01, with a
  correction to Rafael's proposed example (`tenureMin`, duration-typed,
  not `tenure_years`). Replied on the public cross-posted WIMSE/OAuth
  thread with Jijie Wei and Sangam Das, offering `actionClass`/
  `classSource` as shared vocabulary and asking the thread to settle
  Verifier Placement's in-process-dispatch reading rather than
  pre-deciding it. Neither reply has a response yet. This reply also
  corrects this repo's own prior "independent convergence" reading of
  that thread into a stated, unresolved tension.

## 0.12.0 — 2026-09-02

- **CAMARA PR #331 reply and nit closed** (`ac18310`, #18). Posted the
  four-step reply to PR #331; first post was silently truncated by a
  heredoc paste and repaired in place by PATCH; body verified by reading
  it back against source. JSDoc nit closed on the return union of
  `signJws`/`attestAnswer`/`verifyAnswer`/`attestRefusal`/`verifyRefusal`
  in `camara/v2/poc/m1-jws.mjs`.
- **IETF ActionClass spike built and user-validated** (`1f3ee21`, #19).
  New PoC at `ietf/v1/poc/` gates `actionClass` (ordered enum r<w<x),
  `classSource` (ordered enum declared/method), and `writeBudget`
  (monotone-down integer, stateful per-chain ledger); 24/24 cases,
  five mutation proofs (classSource short-circuit, JWS verify, budget
  decrement, r-never-spends, monotone writeBudget), user-validated at
  tip `ac18310`. Cases 22-24 pin three assumptions the -01 text would
  later have to resolve (caller-supplied chain id, exact-string menu
  keys, no menu-origin check). EMILIA pre-flight reply recorded.
- **Second EMILIA-thread reply, asor -00 read in full, -01 scope
  refined** (`431b315`, #20). Corrected a registry citation from asor
  -01 (not posted) to asor -00 §10; identified the comparator vocabulary
  (not shared axis names) as the real bridge between the two drafts;
  named asor's `rank` comparator and its missing `min`. The no-menu
  default state and non-HAMR-site verifier placement were settled in
  discussion. -01 scope item 1 refined: axis names bound to comparator
  types (`actionClass`=rank, `writeBudget`=max, duration floors=min).
- **IETF -01 drafted: all four scope items plus Appendix A direction 4**
  (`7384e07`, #21). Floor Axis Registry (item 1, anchor `axis-registry`):
  registers axis names each bound to one comparator from the closed set
  min/max/rank/one_of, non-droppable, eight initial entries. Position
  Among Delegation Layers (item 2, anchor `layers`): a three-layer
  boundary statement (who may act / what exactly per invocation / what
  happened once), positioning this document as layer (a) plus floors,
  citing RFC 9396, `draft-das-agentic-tool-binding-02`,
  `draft-schrock-ep-authorization-receipts-12`, and asor -00 §9.1.
  Action Class Floors (item 3, anchor `action-class`): `actionClass`
  and `classSource` axes, an RFC 9110 method-default classification a
  verified declared menu (JWS, RFC 7515) can replace but never combine
  with, deterministic path-template matching, fail-closed tie-break;
  vectors V7-V9. Write Budget (item 4, anchor `write-budget`): a
  monotone-down `writeBudget` axis, reserve-then-decrement admission,
  and a chain identifier derived as the SHA-256 digest (RFC 6234) of
  L(0)'s signature bytes rather than a caller-supplied field; vectors
  V10-V11. Appendix A direction 4: three non-normative, single-author
  harness experiments (bareguard/bareloop/bareagent), explicitly not
  implementations of this profile. Spike A's catalogue-survey dataset
  (292 ops across 60 CAMARA repos, SHA-pinned) committed under
  `ietf/v2/poc/spike-a/` (`specs/` omitted, reproducible from its SHA
  column). Each item was user-validated at its own uncommitted tree
  (PoC suites exit 0, `idnits` clean); author-tools schema validation
  was not separately reported for any of these trees.
- **IETF -01 PoC catch-up, review round, and sweeps** (`47ebce6`,
  `49e3fab`). `ietf/v2/poc` cases 22-24 brought up to the -01 text,
  suite grown 24 -> 27 cases: case 22 derives the chain identifier via
  `deriveChainId(rootSignature)` rather than reading a caller-supplied
  field; case 23 does deterministic path-template matching; case 24
  binds the menu's `iss` to the request target origin; cases 25-27 pin
  V10's step sequence, the equal-literal fail-closed tie, and a literal
  `__proto__` menu key as a real own property. A read-through review of
  the whole -01 found 1 blocker (the omitted-axis rule stated three
  incompatible ways across attenuation rule 2/V4, the registry's
  Omitted-axis rule field, and the classSource/writeBudget passages),
  4 should-fix, and 1 nit — all fixed, with the omitted-axis rule now
  stated as two distinct cases (link-to-link omission stays a rejection
  per unchanged rule 2/V4; link-to-published-floor inheritance covers
  the classSource/writeBudget defaults). A live citation sweep found and
  fixed a stale revision and date on `draft-reece-wimse-cross-org-delegation`,
  then re-checked all seven I-D references against `bib.ietf.org`. A
  stale-claim sweep, caused by this branch's own PoC-catch-up commit,
  found and fixed three locations still describing the code as 24 cases
  short by three points. Checks by exit code: non-ASCII 0, `xmllint` 0,
  forbidden RFCXML tags 0, BCP 14 capitals after `<back>` 0, `m7-check`
  27/27, `m3-check` 26/26. User-validated at the tree of `49e3fab`
  (both PoC suites exit 0, `idnits` clean).
- **`/branch-review` round on the -01 PoC, three findings fixed, suite
  27 -> 34 cases** (`e638d6a`). Ran at HEAD `6f40ffc`, target
  `7384e07..6f40ffc`, stage 1 medium, stage 2 security full; found no
  Critical, two Warnings, one Suggestion, all three independently
  reproduced by the orchestrator both before and after the fix. A real
  defect: `deriveChainId` collided on malformed input because
  `Buffer.from(s,'base64url')` silently strips out-of-alphabet
  characters instead of rejecting them — three differently-malformed
  inputs produced the same digest, defeating the function's one
  purpose; fixed with a strict unpadded base64url charset check,
  returning `null` on any other character (cases 29-30). A conformance
  gap this branch's OWN earlier text fix (`49e3fab`) had created: the
  omitted-axis rule written into the -01 text was never implemented in
  `checkActionFloor`, which admitted rather than rejected when a child
  omitted an axis its parent's declared menu constrained; fixed with
  `Object.prototype.hasOwnProperty.call` presence checks throughout,
  since `writeBudget` 0 and `classSource` 'method' are legitimate and
  falsy-adjacent (cases 31-34). A test-quality gap: case 27's comment
  claimed it pinned the enumeration guard against prototype-walking,
  but swapping `Object.keys` for `for...in` left the suite green
  because `Object.prototype` members are non-enumerable; fixed by
  adding case 28, which temporarily defines an enumerable property on
  `Object.prototype` to make the guard falsifiable. Orchestrator
  mutation proofs on all three fixes, verified by exit code: `m7-check`
  27 -> 34/34, `m3-check` 26/26. User-validated 2026-09-02 at the tree
  of `e638d6a` (both suites exit 0; the prior 27-case validation is
  void).
- **Second `/branch-review` round on the -01 PoC, one Critical fixed,
  suite 34 -> 40 cases** (`bb880ed`). Ran at HEAD `d5b7194`, target
  `7384e07..d5b7194`, stage 1 medium, stage 2 security full; found one
  Critical, two Warnings, one Suggestion, all reproduced independently
  by the orchestrator; aimed at the first review's own fix commit
  (`e638d6a`), the previously unreviewed code. CRITICAL: the first
  collision fix (strict base64url charset check) closed out-of-alphabet
  collisions only, leaving the decoder's own truncation open — a string
  2 or 3 characters past a multiple of four discards low-order bits of
  its final group, so distinct in-alphabet strings (`'AA'`/`'AB'`/`'AC'`/
  `'AD'`, and separately `'AAA'`/`'AAB'`/`'AAC'`/`'AAD'`) all decoded to
  the same digest; cases 29-30 could not catch it since both used
  out-of-alphabet input, meaning the fix and its own tests targeted the
  same narrow class. Fixed by requiring the CANONICAL unpadded form —
  decode, re-encode with `toString('base64url')`, reject unless
  identical to the input (cases 35-37, pinning the same-length collider,
  the mod-4 input, and padded-input rejection). Two test-quality gaps
  closed: the `hasOwnProperty` presence guard was undefended against a
  truthiness test or `in` (closed by case 38, a falsy-but-legitimate
  `writeBudget` 0, and cases 39-40, an `Object.prototype`-pollution
  probe cleaned up in a `finally`); the unpadded contract itself was
  untested against a widened, padding-accepting regex (closed by case
  37). The base64url charset guard is now subsumed by the round-trip
  check and kept as documented defense in depth (commit message and
  `ietf/v2/poc/README.md` both say so) — reported, not hidden, as a
  deliberate redundancy rather than a defect. Orchestrator mutation
  proofs, verified by exit code: removing the round-trip check reds
  case 35; the `hasOwnProperty` weakenings each red only their own
  cases; removing the now-subsumed charset guard reds nothing. `m7-check`
  34 -> 40/40, `m3-check` 26/26. User-validated 2026-09-02 at the tree
  of `bb880ed` (both suites exit 0, m7 40/40, m3 26/26; the prior
  34-case validation is void).
- **Honest limits.** A third `/branch-review` ran at HEAD `8844e44`,
  target `d5b7194..8844e44`, verdict "Ready to merge? Yes" — no Critical
  or High findings, one non-blocking item recorded in the local
  gitignored fix ledger. The -01 draft is drafted and PoC-matched but
  still NOT submitted — remaining steps are a final live citation
  re-verification on submission day (asor -01 still unposted) and the
  user's own author-tools schema validation run (not reported at any
  tree this cycle; local `xmllint` well-formedness is not schema
  validity). The Commonalities enhancement issue
  camaraproject/Commonalities#705, filed for the CAMARA v2 track, is
  still open and awaiting a maintainer label. This release contains no
  CAMARA code change — every code change in this cycle is in
  `ietf/v2/poc/`.

## 0.11.0 — 2026-09-01

- **CAMARA v2 rescoped as a Commonalities Scope Enhancement.** After
  reviewer feedback on the v1 filing (issue #330 / PR #331), the proposal
  moved from a new API-family case to an enhancement against
  Commonalities. Items 2.1 (attested response), 2.2 (floor rule) and 2.4
  (range on open responses) are filed; item 2.3 (blind hub) is HELD for
  a separate companion filing, on the main session's delegated decision.
  Working copy: `camara/v2/docs/`. Findings: `docs/logs/findings.md`,
  2026-08-31.
- **New JWS attestation core**, `camara/v2/poc/m1-jws.mjs`, replacing the
  v1 `{claims, sig}` envelope with a signed-JWS shape (required
  `phoneNumber`, renamed schemas). Its check suite,
  `m1-jws-check.mjs`, grew from 29 to 94 cases across this branch as
  successive `/branch-review` rounds found and closed real defects.
  Caller migration to the new core is tracked as V2-M3, not yet wired
  into `demo.mjs`.
- **Security fixes in the JWS core, five `/branch-review` cycles, each
  mutation-proven:**
  - a reserved-claim clobber, where a schema key colliding with a base
    claim overwrote both the value and the required type and defeated
    the `exp > iat` guard;
  - a schema self-collision, where a key named in both `params` and
    `answer` silently dropped the caller's `params` value;
  - **a CRITICAL prototype-chain bypass**: `k in allowed` on a plain
    object literal walks the prototype chain, so a claim named after any
    `Object.prototype` member bypassed the `EXTRA_CLAIM` guard, escaped
    type-checking, and rode through a signed, verified profile-mode
    response carrying a raw value. All 12 `Object.prototype` member
    names leaked on the wire path. Fixed with a `hasOwn()` helper at
    four lookup sites plus a `projectClaims()` layer returning only
    declared claims;
  - a reject-never-throw violation on a hostile schema, fixed with a
    try/catch backstop on the four entry points;
  - an EQUIVALENT MUTANT: deleting both `projectClaims` call sites still
    passed 82/82 — the projection layer had no test that could fail.
    Closed with key-order assertions;
  - `EMPTY_ANSWER_SCHEMA`, rejecting a schema whose answer half declares
    zero fields — what a literal `__proto__:` key silently produces.
- **Live re-verification against canonical CAMARA YAML.** RETRACTION:
  SimSwap v2.1.0 does NOT ship `/retrieve-age-band` — confirmed again
  this branch; it exists only on unreleased branch `main`
  (`info.version: wip`). Also found: `maxAge` means two different things
  in two different units across CAMARA APIs (event lookback in HOURS,
  bounded 1-2400, on the swap APIs; cached-fix staleness in SECONDS,
  unbounded, on location verification); the kyc-match similarity-score
  claim was REFUTED; and a Commonalities prior-art precedent was found
  for signing asynchronous CloudEvent notifications with JWS/JWE, which
  the filing cites, with the delta stated as synchronous response
  signing.
- **Four dated user validation runs this branch**, the last at
  `0a261e4` with all seven v2 PoC check suites green
  (`m1-check` 20/20, `m1-jws-check` 94/94, `m2-check` 10/10, `m3-check`
  26/26, `m4-check` 42/42, `m5-check` 67/67, `m6-check` 47/47) — see
  `docs/logs/findings.md`, 2026-09-01 (latest), for the full sequence
  and the superseded counts each run replaced.
- **The v1 CAMARA filing and PoC are frozen** under `camara/v1/` as the
  as-filed record (issue #330 / PR #331, filed 2026-08-28); this
  release does not touch it.

## 0.10.0 — 2026-08-31

- **The IETF companion Internet-Draft is SUBMITTED.**
  `draft-hassan-oauth-agent-delegation-00`, "An Attenuated Delegation
  Profile for Automated Agents", posted 31 August 2026, expires 4 March
  2027 (185 days after posting). Author Amr Hassan, Independent. Intended
  status Standards Track. Verified directly on the Datatracker page:
  https://datatracker.ietf.org/doc/draft-hassan-oauth-agent-delegation/.
  It is an INDIVIDUAL submission, NOT a working-group document, NOT
  adopted, and reviewed by no one. Posting confers a timestamp and
  visibility, not standing; submission is not adoption, and adoption is
  not publication. The Datatracker page's own words: the draft is "not
  endorsed by the IETF" and has "no formal standing in the IETF standards
  process."
- **Renamed via replacement, same day: `draft-hamr-oauth-agent-delegation-00`
  is now the live document.** The author's working identity across this
  repo and prior filings is `hamr0`/hamr, not the surname Hassan, so the
  draft was corrected to match. A posted I-D cannot be renamed in place —
  the confirmed route is a new `-00` with `Replaces` set (whether the
  secretariat renames in place on request was never verified either way;
  moot after submission), which creates a second document rather than
  editing the first. Verified live on the
  Datatracker: the new draft is
  https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/,
  state `posted`, submitted and dated 31 August 2026, expires 4 March
  2027, 28 pages, `replaces` correctly set to
  `draft-hassan-oauth-agent-delegation`, submission id 168367; the old
  draft's state is now `repl` (Replaced) — it stays posted until its own
  4 March 2027 expiry. The document is named `draft-hamr-...` while its
  author block still reads `Amr Hassan` — IETF convention names the
  surname, so this is a deliberate mismatch, the author's own call, not
  an oversight. The XML file is renamed to
  `ietf/v1/docs/draft-hamr-oauth-agent-delegation-00.xml`. The honest
  qualifiers above are unchanged by the rename: still an individual
  submission, not adopted, no formal standing. Findings:
  `docs/logs/findings.md`, 2026-08-31.
- **Six stale claims in `docs/product/prd.md` were corrected in the same
  change**, because the submission made them false at once and a partial
  sweep is the failure no-go 14 exists to name: the D6 deliverable row now
  carries the Datatracker URL and both dates; the G6 gate's evidence
  column held the placeholder `draft link` and now reads MET with the
  real URL; the Phase B sequence line that said "submit before the IETF
  127 cutoff" is now past tense; a second Phase B line that said
  "remaining work is turning it into an actual Internet-Draft" now
  reflects that the work is done; the Key dates block that presented 2
  November 2026 as this draft's deadline now states the submission and
  the 4 March 2027 expiry, with the cutoff kept as context only; and risk
  item 3, which named I-D conversion as the remaining risk, now names the
  real remaining risk as sustained mailing-list and meeting presence
  across multiple IETF cycles.
- **One §9 decisions row added, dated 2026-08-31.** The 2026-08-30 row
  below it still reads "not submitted" and is left alone on purpose — it
  was true on its date, and this repo keeps dated history rather than
  rewriting it.
- **The v0.9.0 changelog entry below is likewise left as written.** It
  says "NOT submitted", which was true when written. It is a dated
  record, not a live claim.
- **Honest limits unchanged and restated:** the draft's test vectors have
  still never been executed against any implementation by anyone,
  including the author — they were derived by hand, and no chain
  verifier exists to run them against. The proof-of-concept still does
  not implement RFC 9421 presentment, the multi-hop delegation chain, or
  the per-Relying-Service unlinkable identifier, and has no HTTP layer
  between the parties at all. Single author, no external review, no
  adoption.
- **Re-verified 2026-08-31 against the live Datatracker:**
  `draft-klrc-aiagent-auth` is still `-03`, 6 July 2026, expiring 7
  January 2027, still an individual submission not adopted by a working
  group, same six authors. The draft's citation of it is correct as
  posted.
- **Next:** the draft expires 4 March 2027; a `-01` before then is how it
  stays alive. IETF 127 is 14–20 November 2026 in San Francisco, Hackathon
  14–15 November.

## 0.9.0 — 2026-08-31

- **IETF companion Internet-Draft WRITTEN and author-tools VALIDATED. It is
  NOT submitted, NOT adopted, and reviewed by no one.** File
  `docs/product/draft-hassan-oauth-agent-delegation-00.xml`, RFCXML v3,
  1323 lines. The IETF 127 submission cutoff is 2 November 2026, 23:59
  UTC. Posting an Internet-Draft confers a timestamp and visibility, not
  standing; an I-D expires 185 days after posting.
- **Shape.** A profile, not a new credential format. It invents nothing and
  says normatively how existing pieces combine and how a verifier checks
  them. Intended status Standards Track. The normative body names an
  abstract Attestation Issuer only; SIM, mobile operator, MNO, carrier, and
  CAMARA appear solely in non-normative Appendix A.
- **Transport.** One new HTTP header field `Agent-Delegation`, an RFC 8941
  Structured Field List of Byte Sequences, registered with IANA. Signature
  parameters are profiled from RFC 9421 rather than reinvented.
- **The three attenuation rules**, checked on every link relative to its
  parent: scope must be a subset, floor must be at least as tight on every
  axis, expiry must not be later. Whole-chain verification is required, and
  a verifier that checks only the final link defeats the mechanism —
  stated as the primary security consideration.
- **Scope is now mechanically decidable.** Rule 1 previously required a
  subset check but the draft defined no value space for a scope, no
  meaning for "subset", and no case sensitivity — mandated but
  unexecutable, so two conforming verifiers could disagree on the same
  chain. A scope is now a set of opaque capability strings compared by
  exact set containment over case-sensitive, octet-for-octet equality.
  Wildcard and prefix matching, hierarchical containment, case folding,
  Unicode normalisation, whitespace trimming, and every other
  canonicalisation are forbidden. Wildcard and hierarchical semantics are
  stated out of scope for this version with no registry promised.
- **A non-normative test-vector appendix with a negative control.** Six
  vectors, each isolating one violation. V6 is the negative control: a
  three-link chain whose leaf pair attenuates correctly and whose interior
  pair violates rule 1, so a verifier that checks only the final link
  accepts it and does not conform. A suite composed only of chains
  expected to be accepted cannot distinguish a correct verifier from one
  that accepts everything. **The vectors have never been executed against
  any implementation by anyone, including the author** — they were derived
  by hand.
- **Test vectors were shipped instead of a mandated conformance harness**,
  deliberately: an IETF profile specifies the verification procedure, not
  anyone's implementation, and a mandated harness binds conformance to one
  codebase's assumptions.
- **Two corrections to `docs/product/ietf-agent-delegation.md`.**
  `draft-klrc-aiagent-auth-03` Section 11 says a participant MAY subscribe
  to SSF/CAEP change notifications; the doc previously said "requires".
  And the crowding limit named only that draft; three further individual
  drafts (`draft-asor-wimse-agent-delegation-chain-00`,
  `draft-reece-wimse-cross-org-delegation-01`,
  `draft-sweeney-wimse-credential-delegation-00`) are now named there and
  in the references. None of the three touches SIM, carrier, or economic
  scarcity, so the differentiator holds — recorded as a worsening limit,
  not a win.
- **Honest limits kept in the draft on purpose:** RFC 9421 presentment, the
  multi-hop chain, and the per-Relying-Service unlinkable identifier are
  NOT implemented in the proof-of-concept, which has no HTTP layer between
  the parties at all. Single author, no external review, no adoption, and
  no Attestation Issuer has reviewed or validated the profile.
- **Re-verified 2026-08-31 against the live Datatracker:**
  `draft-klrc-aiagent-auth` is still `-03`, 6 July 2026, expiring 7 January
  2027, still an individual submission not adopted by a working group,
  same six authors and affiliations.
- `docs/logs/findings.md` carries the full dated evidence and decision
  record for this round.

## 0.8.0 — 2026-08-28

- **FILED TO CAMARA.** `CarrierAttestation` is filed against
  `camaraproject/APIBacklog` — issue **#330**
  (https://github.com/camaraproject/APIBacklog/issues/330, `[API Proposal]
  CarrierAttestation`, label `API Proposal`) plus follow-up **PR #331**
  (https://github.com/camaraproject/APIBacklog/pull/331, adding
  `documentation/API proposals/APIProposal_CarrierAttestation.md` from fork
  `hamr0/APIBacklog`, branch `api-proposal-carrierattestation`, commit
  `87d36de`, body `Fixes #330`). **Both are OPEN.** Nothing has been
  approved, accepted, endorsed, or reviewed by CAMARA — this release marks
  the proposal as filed and awaiting Working Group evaluation, no more.
  CAMARA's own intake turned out to be two steps, not one: a short 4-field
  issue (Description, Use cases, Related to, Supporting material) first,
  then a linked PR adding the filled long template. The repo previously
  assumed a single-step filing, which would have meant pasting the
  223-line template document into a form that asks four short questions —
  caught and corrected before filing, not after.
- **Two A2P overclaims retracted from the proposal document**, per no-go 9,
  on an adversarial grounding pass of text that was already in the
  submission. "A2P SMS decayed [because a middle layer could see and
  arbitrage message value: grey routes, spam, fake DLRs, SIM farms]" is
  **CONTRADICTED**: total A2P messaging spend is growing (~$75–90B,
  forecast 4–7% CAGR across sources), and SMS A2P volume itself still
  grows ~2.6% CAGR — what's real is a channel-mix shift toward app-based
  business messaging (WhatsApp Business, RCS), not a fall of A2P as a
  category. "History (A2P) shows accumulated middle-layer value gets
  monetized against the ecosystem" is **UNGROUNDED**: no regulator
  finding, enforcement action, or documented incident ties an A2P
  aggregator or messaging hub to monetizing subscriber data against the
  ecosystem; the nearest real evidence is location-data brokers in
  ad-tech, a different industry, and citing it for A2P would be a category
  error. What survived the pass and stays in the text: grey routing and
  Artificial Inflation of Traffic (AIT) as documented, GSMA-named
  integrity failures; the price-driven migration toward app channels; and
  GDPR/ePrivacy as in-force constraints on any middle layer that can read.
  No single AIT dollar figure is asserted anywhere — sources disagree by
  roughly 2x.
- **New §1.1 "Why now"** in `camara-attested-windowed-disclosure.md`,
  merging the old §7.2. With the A2P monetization claim retracted, the
  argument for a blind hub is now made prospectively — the structural
  OPTION any readable middle layer holds to accumulate and monetize what
  it can see — which is a stronger, evidence-independent argument than the
  historical claim it replaces.
- **Role glossary added** (§3.1): customer / operator / aggregator /
  requester, defined once and used consistently. **RP** is defined
  explicitly as *roaming partner*, its standard telecom sense — the party
  asking a predicate question is spelled out as "requester" throughout,
  never abbreviated, because in a CAMARA room "RP" reads as roaming
  partner, not relying party.
- **No-go 14 added — "No orphaned references."** After a single session
  turned up five instances where an edit fixed the thing itself but missed
  a reference elsewhere to the thing, the no-go list now requires a
  repo-wide sweep (markdown, code, spec files, generated indexes, GitHub
  repo metadata, directory structure, internal anchors) after any
  retraction, rename, move, or dropped term — every hit classified as
  corrected or deliberately preserved as dated history, never left as an
  oversight.
- **Filing docs moved to `docs/product/`, named for purpose:**
  `camara-filing-issue.md` (step 1, the GitHub issue body) and
  `camara-filing-template.md` (step 2, the long template added by PR);
  both now carry absolute GitHub URLs throughout, since a repo-relative
  path is a dead string once pasted inside a CAMARA issue or PR body. Both
  files' bookkeeping headers now record the real issue/PR numbers, URLs,
  and filing date, cross-reference each other, and are marked as frozen
  records of what was filed — further changes go to
  `camara-attested-windowed-disclosure.md` instead.
- **No profile behaviour, wire contract, or PoC logic changed.** Every
  code-file edit in this release was a comment or a docs file. PoC green
  by exit code: m1 20/20, m2 10/10, m3 26/26, m4 42/42, m5 67/67, m6
  47/47, demo 35/35.

## 0.7.0 — 2026-08-26

- **PRD becomes the contract — docs-only release, no code changed.** All 53
  dated entries in `prd.md` §9 ("Decisions log") moved OUT of the PRD into
  `docs/logs/findings.md`; §9 is now an index table only (Date / Decision /
  Status / a `Where` link into findings.md), and every Decision cell was
  trimmed to one identifying line. `prd.md` goes 1903 → 859 lines. Zero
  content was lost in the move — proven by extracting the old §9 body and
  token-comparing it against the new findings.md content: the only two
  words present in the old text and absent from the new were "Rationale"
  and "stash/history", both from the replaced §9 intro sentence itself.
- **findings.md's charter widened to hold two labelled entry kinds.**
  `**EVIDENCE**` entries are things that were RUN and OBSERVED; `**DECISION**`
  entries are reasoned course changes with the why attached. Evidence is
  never presented as argument, and argument is never presented as evidence
  — all 92 headings in the file are labelled one or the other. findings.md
  goes 3148 → 4490 lines.
- **Docs reorganized into three buckets.** `docs/product/` holds the living
  docs (`prd.md`, `camara-attested-windowed-disclosure.md`,
  `ietf-agent-delegation.md`); `docs/logs/` holds the dated record
  (`findings.md`, `camara-apibacklog-filing.md`); `docs/archive/` holds
  retired material (`aaif-agent-auth.md`, plus the byte-frozen R100
  rename). `docs/index.md` is generated and is now the corpus's only
  index. `docs/01-product/` and `docs/02-proposals/` no longer exist.
- **CAMARA filing record added.** `docs/logs/camara-apibacklog-filing.md`
  carries the verbatim text prepared for filing to
  `camaraproject/APIBacklog`, derived from the proposal's §10. It is marked
  immutable — still NOT FILED.
- **A v0.6.0 release miss found and fixed.** v0.6.0 dropped AAIF and
  re-homed the agent arm to the IETF OAuth WG, but the sweep only touched
  the files it was editing — not the files that REFERENCED what changed.
  Live AAIF claims survived in four places: README.md's `tracks: CAMARA +
  AAIF` badge and opening paragraph; `camara-attested-windowed-disclosure.md`'s
  Companion line and §7, which still named AAIF as the live companion
  track and linked the superseded file — this is the submission text a
  CAMARA reviewer opens first; CLAUDE.md's "CAMARA/AAIF meeting" phrasing
  and its grounding-rule org list; and a header comment in
  `poc/demo.mjs`. The filing record itself was already clean. General
  lesson, stated plainly: after a course change, grep the WHOLE repo for
  the dropped term, not just the files being edited.
- **8 staleness gaps in prd.md fixed**, including a §9 (pre-move) row still
  pointing at the superseded `aaif-agent-auth.md`, and a Phase B block
  whose heading said "re-homed" while its body still said "PENDING".
- **CLAUDE.md:71 retracted visibly.** It still read as if supporters must
  be recruited before the APIBacklog PR; no-go 12 already retired that
  claim in v0.6.0 and the line now says so.
- **No profile behaviour, wire contract, or PoC logic changed.** Every
  code-file edit in this release was a comment. PoC green by exit code:
  m1 20/20, m2 10/10, m3 26/26, m4 42/42, m5 67/67, m6 47/47, demo 35/35
  (mock).

## 0.6.0 — 2026-08-25

- **Submission strategy release — no code changed.** Both submission
  tracks were re-verified against live sources on 2026-08-25; one of the
  two moved doors entirely. Everything below is a docs/strategy change:
  a new living doc, a superseded-header on an old one, a CLAUDE.md
  invariant correction, a no-go retraction, a template brought to
  filing-ready, and a fold-in-vs-distinguish decision closed against a
  1624-line raw-text read. No profile behaviour, wire contract, or PoC
  logic changed.
- **AAIF dropped as a submission target — the door was wrong, not the
  idea.** AAIF ("Agentic AI Foundation") is a Linux Foundation project
  since December 2025, founded on contributions including MCP, goose, and
  AGENTS.md. Its `github.com/aaif/project-proposals` intake was read in
  full and is NOT a standards-proposal track comparable to CAMARA's
  APIBacklog — it is an intake for DONATING AN EXISTING OPEN-SOURCE
  PROJECT. Verbatim requirements: "evidence of production deployments in
  at least two different organizations"; "at least 2 core maintainers
  from different organizations and at least 10 contributors"; all project
  trademarks and accounts donated to AAIF; a signed Contribution
  Agreement before the Governing Board can vote. A solo independent with
  a single-author PoC and zero external adoption cannot fill roughly 8 of
  the template's ~14 required fields honestly — these are facts we do
  not have, not writing tasks that could be done better. The Identity &
  Trust WG's TOPIC still fits; only the intake mechanism disqualifies
  this author. The prior 2026-08-15 "AAIF grounded" record had the right
  URLs and stage mechanics but the wrong KIND of process — it was
  **corrected in place, not deleted**, so the dated record still shows
  what was believed and when it was overturned.
- **The agent/delegation arm re-homed to IETF.** An unaffiliated
  individual can submit an Internet-Draft with no membership, sponsor, or
  fee — exactly the gates that disqualified AAIF do not exist at the
  IETF. New living doc `docs/02-proposals/ietf-agent-delegation.md` (283
  lines, matching D2's structure; a position paper, not itself an I-D)
  targets the OAuth WG, whose charter (updated 2026-06-04) carries a work
  item on authorization of automated agents acting on behalf of users
  across multiple administrative domains. `docs/02-proposals/
  aaif-agent-auth.md` got a SUPERSEDED header and nothing else — its body
  is untouched as a dated record, explicitly marked not-living so the
  PRD's G0 "exactly 3 living docs" rule still holds at three: PRD + D2
  (CAMARA) + D3 (IETF). CLAUDE.md's "Two tracks, one seam" invariant said
  AAIF; it now says IETF, and the repo file map was updated to match.
- **Fold-in-vs-distinguish CLOSED: HYBRID, decided against a full raw-text
  read, not a summary.** `draft-klrc-aiagent-auth-03` was read in full
  from raw text — 1624 lines, fetched from
  `ietf.org/archive/id/draft-klrc-aiagent-auth-03.txt` — not summarized.
  Six authors, from Defakto Security, AWS, Zscaler, Ping Identity, OpenAI,
  and Okta. It composes WIMSE/SPIFFE agent identity + RFC 9421 + OAuth
  2.0 delegation. It is an individual draft, NOT WG-adopted.
  - **THE HOOK**, quoted verbatim and verified byte-for-byte against raw
    text, its §8: posture-assessment signals "may include hardware-backed
    evidence, trusted execution environment (TEE) evidence, software
    integrity measurements, supply-chain provenance, platform or
    orchestration-layer metadata, workload placement information,
    configuration state, operator assertions, or other
    environment-specific signals", and "This document does not require
    any particular posture assessment mechanism, evidence format, or
    verifier architecture." A named extension point the draft never
    populates.
  - **Verified ABSENT** by raw-text keyword count: sybil 0, farm 0, "rate
    limit" 0, carrier 0, telco 0, MSISDN 0, eMRTD 0, passport 0, KYC 0,
    CAMARA 0. Word-boundary SIM 0 — the six case-insensitive hits are all
    "similar"/"simplifies". The single "mobile" hit is "mobile device" in
    an authenticator context. Nothing anywhere asks what it costs to mint
    another agent identity, and the monotone never-widen rule is likewise
    entirely absent.
  - **Verdict:** a short companion draft citing theirs, defining only
    three things — an operator-attested posture input for their §8; a
    document-rooted principal assertion for their §10.6 chaining flow;
    the monotone floor-tightening invariant layered onto their
    Transaction Tokens. Explicitly out of scope: agent identity,
    credential formats, the RFC 9421 signing profile, OAuth grant flows —
    all already specified there.
  - **The two-slot spine**, recorded as its own new section: the draft
    defines SLOTS, not implementations. Operator-assertion slot ← CAMARA
    (economic scarcity); principal-assertion slot ← zkagent (cryptographic
    scarcity). Separate, non-competing lanes. Neither implementation
    needs to exist for the draft to stand — it is the vacancy that is
    standardized, not the occupant. This is what keeps zkagent a citation
    and never a dependency; zkagent does not exist yet.
  - **Two divergences recorded, not hidden:** on revocation the draft
    goes FURTHER than us (SSF/CAEP revocation signals vs our reliance on
    short expiry); its identifier stability for audit is in tension with
    our per-service unlinkable tags. Both flagged as reconciliation
    items, not resolved.
  - **A precision point recorded so it cannot reach a filed draft:** our
    work is a companion to `draft-klrc-aiagent-auth-03`, NOT to RFC 9421.
    RFC 9421 is published and closed (Proposed Standard, February 2024)
    — the shared mechanism the new draft builds on, not the open gap.
- **no-go 12 RETIRED.** "No APIBacklog PR before supporters are named"
  was verified FALSE as a CAMARA process requirement. The APIBacklog
  template's Supporters field reads, verbatim: "List of supporters.
  *NOTE: That shall be added by the Working Group.*" The WG populates it
  during evaluation, downstream of filing. This was the author's own
  risk-management judgement stated as though it were a process fact.
  Retracted visibly, per the repo's own grounding rule, rather than
  quietly dropped. Decision: file first, network later.
- **CAMARA APIBacklog template mapping brought to filing-ready.** Six
  gaps closed in D2 §10: the header instruction that said "do not file
  before supporters are named" (rested entirely on the now-retired no-go
  12, replaced with the real sequence — issue, then a linked PR, with the
  template's own NOTE quoted as the reason supporters are not a
  precondition); the API family owner placeholder replaced with
  **Cairenes Solutions** (user decision); the Proposal owner declaration,
  which was MISSING entirely and required a Charter-scope review
  confirmation, added; the Supporters field, left blank per the
  template's own instruction, with the DT/Orange/Telefónica pool kept
  only as an internal targeting note, explicitly marked NOT a claim of
  existing support; "Validated in lab", which understated the truth as
  "planned" and is now **YES, sandbox tier only**; and "Validated with
  operators", which stays **NO**, with its stale "recruitment in
  progress" parenthetical removed rather than softened.
  The lab answer is recorded precisely, not rounded up: the Mode A PoC
  ran live against the Orange Network APIs Playground, an operator PUBLIC
  SANDBOX, not a production network. User-run, by exit code (from the
  0.5.0 entry below, dated 2026-08-18): `m5-check-live.mjs` 20/20 and
  `demo.mjs --backend orange` 35/35, injected clock, quota accounted 1-of-10
  custom slots at both start and end. No production environment has been
  exercised, no operator endorsement is implied, and no operator has
  reviewed the proposal.
- **Process lesson, recorded because it is the useful part of this
  release:** the AAIF finding came from verifying the DOOR before writing
  content for it. The 2026-08-15 record had correct URLs and stage
  mechanics, which made it look grounded on a skim — only fetching the
  actual donation template revealed it was the wrong KIND of process
  underneath the accurate surface details. A door that looks open in a
  summary can be shut in the template.
- **Validation state — stated precisely, not rounded up.** NO CODE
  CHANGED in this release; it is docs-only. This release is **NOT
  user-validated** — the offline/live suites were not re-run because
  nothing under `poc/` or `spec/` changed. The last user-validated run
  still stands at `d85d3cf`/v0.5.0 (2026-08-18); v0.5.1 was already
  agent-run only, and this release does not change that. This release
  did **not** run `/ship`, `/security`, or `/diff-review` — it follows
  the already-gated v0.5.1 release with a documentation and strategy
  change only; no gate is claimed to have passed here because none was
  run.

## 0.5.1 — 2026-08-25

- **Grounding round: the 2026-08-14 pinned CAMARA baseline was re-verified
  on 2026-08-24, and three claims did not survive.** No design, profile,
  or code behaviour changed — this release retracts overclaims and
  corrects stale detail across docs, spec, and PoC comments/output.
  1. **A fabricated quotation was retracted.** The docs asserted the
     NumberVerification spec "mandates" identifier-free 3-legged requests,
     with `phoneNumber` "MUST NOT be included" when derivable from the
     access token. That sentence exists in NO CAMARA source — not the
     NumberVerification spec, not the Commonalities design guide, not the
     ICM security docs. It was also wrong as a generalisation:
     `POST /verify` is 3-legged and REQUIRES an identifier
     (minProperties:1/maxProperties:1 over `phoneNumber`/
     `hashedPhoneNumber`), and the repo's OWN live measurement had already
     recorded `403 "Request must define a phoneNumber"`. The real
     precedent is structural and narrower: `GET /device-phone-number` has
     no request body at all and derives the line from the 3-legged token.
  2. **"Accepted in production" was retracted for `kyc-age-verification`.**
     Its lifecycle badge reads Sandbox — CAMARA defines Sandbox as
     experimental with no guarantee of stability. Its own README
     self-contradicts with a stale "Incubating stage since February 2025"
     line; that contradiction is recorded, not resolved.
  3. **"KYC r2.2 / all Incubating" was corrected.** KYC split
     post-Spring25 into kyc-match (r1.2, v0.4.0), kyc-fill-in (r1.3,
     v0.4.1), kyc-age-verification (r1.3, v0.2.1). SimSwap v2.1.0/r3.3 and
     NumberVerification v2.1.0/r3.2 re-verified and HOLD, both still
     Incubating. The APIBacklog proposal template and the CAMARA freeze
     policy (6+ weeks inactivity → Frozen) also re-verified and hold.
- **The retraction took four rounds to actually land, not one — recorded
  honestly because it's the most useful part of this entry.** The first
  sweeps grepped exact strings and missed every instance that paraphrased
  the claim instead of quoting it.
  - Round 1 fixed two passages and left the claim standing in four other
    places, including README.md's front page and — worst — the proposal's
    own NORMATIVE rule 4, which justified itself by citing the fabricated
    quote ~90 lines below its own retraction, so the document
    contradicted itself.
  - Round 2 found a fifth survivor in the proposal's ABSTRACT, missed by
    both earlier passes because it PARAPHRASED the claim rather than
    quoting it.
  - Round 3's paraphrase-aware sweep found six more, in file types the
    earlier passes never searched: `spec/carrier-attestation.yaml` (twice,
    including the operation description), `poc/demo.mjs` (in a comment
    AND in text PRINTED to the demo transcript), and `poc/README.md`.
  - The `poc/README.md` instance was the sharpest: it recorded the live
    measured `403 "Request must define a phoneNumber"` — direct proof
    `/verify` requires an identifier — and then glossed that same
    measurement as "the 3-legged shape where the subject comes from the
    token". The measurement was left byte-identical; only the gloss
    contradicting it was fixed.
  - One reviewer wrongly CLEARED a survivor by citing the very repo
    wording being retracted as its ground truth — a circular check.
    Recorded as a review-process lesson, not just a fixed finding.
  - Two dated decisions-log entries in `prd.md` (2026-08-14 and
    2026-08-17) received visible `**Correction (2026-08-24
    re-verification):**` notes. The decisions stand; only the dead
    premises are named. `docs/01-product/findings.md` was deliberately
    left untouched — its "r2.2" sits in a dated append-only evidence entry
    recording what was true on 2026-08-16.
  - Also fixed: `poc/README.md` case counts were stale (M4 40→42, M5
    60→67, M6 46→47) and its `conclude(...)` declaration listed `19`
    where `m5-check-live.mjs` declares `20`.
- **Validation state — stated precisely, not rounded up.** Offline suites,
  AGENT-RUN 2026-08-24/25, all exit 0: m1 20/20, m2 10/10, m3 26/26, m4
  42/42, m5 67/67, m6 47/47, `demo.mjs` (mock) 35/35. `poc/demo.mjs` was
  edited this round (one comment, one printed-output block; no logic
  change), so **the v0.5.0 user-validated record does NOT transfer
  forward.** The user-validated 35/35 stands at `d85d3cf`/v0.5.0 only.
  **This release is NOT user-validated — it is agent-run.** Live-credentialed
  suites were NOT run this round. Gates: `/security` CLEAN (run twice —
  once on the docs-only diff, re-run after code-touching fixes landed);
  `/ship` WARNINGS only (no criticals); `/diff-review` BLOCK → BLOCK →
  APPROVE-WITH-NITS, nits then cleared. `spec/carrier-attestation.yaml`
  re-parsed clean (`yaml.safe_load`, exit 0). `poc/demo.mjs` verified
  comment/string-only with no logic, request-shape, or crypto-path change;
  schema constraints (`additionalProperties: false`, required lists,
  Predicate enum) byte-identical to origin/main.

## 0.5.0 — 2026-08-18

- **User ran the full validation suite on their own machine against the
  CURRENT uncommitted tree (the tree this file's remaining entries below
  describe) — every suite clean, zero `FAIL`, zero `TypeError`, zero
  `Error:` lines in either log. BOTH GATES MET on this tree.** The main
  session verified with `find poc -newer` that no `.mjs` file changed after
  the run, so this record covers exactly this tree. Offline (user-run, by
  exit code, all exit 0): `m1-check.mjs` 20/20, `m2-check.mjs` 10/10,
  `m3-check.mjs` 26/26, `m4-check.mjs` 42/42, `m5-check.mjs` 67/67,
  `m6-check.mjs` 47/47, `demo.mjs` (mock backend) 35/35. Live (user-run,
  real Orange Network APIs Playground, injected clock
  `2026-08-18T19:24:42.422Z`, quota 1 of 10 custom slots in use at start
  AND at end — no slot leaked, all exit 0): `m5-check-live.mjs` 20/20,
  `demo.mjs --backend orange` 35/35 — every count user-run, none agent-run.
  G1 (M1–M4 + M6 user-validated) is MET at 20/10/26/42/47 plus `demo.mjs`
  (mock) 35/35. G2 (M5 user-validated live) is MET on both legs (offline
  67/67, live 20/20). **The headline: `m5-check-live.mjs` case 20 — written
  blind in this session and never executed until this run — PASSED live
  with `sim-swap calls=1, device-roaming-status calls=0,
  device-reachability-status calls=0`.** That is the FIRST live evidence
  for the call-count saving that motivated this whole round; until now the
  saving was proven only offline against an injected transport, recorded
  at `bb0b52f` as a known open item. That open item is now CLOSED by
  measurement, not by argument. Of the five open items recorded at
  `bb0b52f`: **CLOSED** — the saving proven live (above); case 42's
  source-text search replaced by a shape-based regex; `m6-check.mjs` now
  has case 47 pinning conditional reads through the full composed path;
  `m5-check.mjs` now catches a wrong axes mapping (`ROAM_Q`/`REACH_Q`
  built via `factQuery`); the `demo.mjs` pre-seal guard now derives
  capacity from the recipient key with its own persisted case; the `r6b`
  scan frame can now genuinely red. **NEW STATED LIMIT, kept visible, not
  softened:** the raw-value leak scan now drops needles shorter than
  `PLAIN_MIN_NEEDLE = 2`, so a value whose every spelling is under 2
  characters cannot be leak-tested by this scan at all. **STILL OPEN:**
  `poc/m5-check.mjs` case 67 reddens under mutation via an uncaught 404
  escaping to the wire rather than by its own assertion firing — a genuine
  red, but a scruffier proof than the others; recorded as a known
  weakness, not overstated as clean. **This record covers THIS TREE ONLY**:
  per this repo's own rule, any later change to a file either gate covers
  re-opens that gate, commit or no commit. Full record:
  `docs/01-product/prd.md`, Decisions log.

- **`/code-review medium --fix` round on the uncommitted fix round below
  (agent-run, NOT user-validated — G1 and G2 stay RE-OPENED/PENDING at the
  new counts).** Two DRY consolidations applied, both mutation-proved, plus
  two coordinator-directed test-coverage closures that change suite counts:
  (1) `poc/m5-facts-orange.mjs`'s six hand-copied axis re-checks
  (`hasOwn(q,'needXxx') && q.needXxx === true`, one per axis) consolidated
  into a single `asked(key)` helper — mutation-proved: forcing it to always
  return `true` reds both `m5-check.mjs` and `m6-check.mjs` (exit 1);
  restored → both green;
  (2) `poc/demo.mjs`'s byte-identical `plainNeedles`/`opaqueNeedles`
  filters consolidated into one `atLeast(min)` factory — this refactor was
  NOT independently pinned by any existing case at review time (nothing
  reds if its comparison operator flips); closed by finding (4) below,
  which now pins it — mutation-proved: changing `atLeast`'s `>=` to `>`
  reds `demo.mjs` (34/35, exit 1) via the new assertion's count check;
  restored → green;
  (3) **new case in `poc/m5-check.mjs`** pinning that the axis-signal gate
  requires the signal to be EXACTLY `true`, not merely truthy — a gap the
  review found by mutation (relaxing `asked` to `hasOwn(q,key)` alone left
  the whole suite green, 66/66). Case 67 sends `needSim:1`,
  `needDevice:'yes'`, `needRoaming:{}`, `needReachability:1`,
  `needLocation:'yes'`, `needKyc:{}` against otherwise well-formed values
  and asserts ZERO live calls and an absent axis on all six. **`m5-check.mjs`
  moves from 66 to 67 cases.** Mutation-proved: reverting `asked` to
  `hasOwn(q,key)` alone reds it (exit 1, an uncaught `location-verification`
  404 surfaces because the gate let a non-`true` signal through); restored →
  67/67, exit 0, `m5-facts-orange.mjs` byte-identical (md5) to
  pre-mutation;
  (4) **new case in `poc/demo.mjs`** pinning the exact set `PLAIN_MIN_NEEDLE`
  drops from the leak scan, not merely the count — `droppedPlain =
  RAW_NEEDLES.filter(n => n.length < PLAIN_MIN_NEEDLE)` asserted to equal
  `['4']` (the single-digit `DEVICE_FLIPPED_DAYS_AGO` spelling, the one
  documented drop) and nothing else. **`demo.mjs` moves from 34 to 35
  cases.** Mutation-proved: raising `PLAIN_MIN_NEEDLE` to 3 reds it (34/35,
  exit 1; dropped set becomes `["4","FR","97"]` — the country code and a
  score needle silently falling out of the scan); restored → 35/35, exit 0.
  Both new cases are agent-run only; G1/G2 were already RE-OPENED by the
  fix round below and stay PENDING at these new counts — no standing
  user-validation record was invalidated by the count change, since none
  covered this tree.
  Full offline suite by exit code, both before and after this round: m1
  20/20, m2 10/10, m3 26/26, m4 42/42, **m5 66/66 → 67/67**, m6 47/47,
  **demo(mock) 34/34 → 35/35** — all exit 0. `poc/m5-check-live.mjs`
  (case 20) stays UNRUN this round too — no credentials, no live Orange
  legs. Full record: `docs/01-product/prd.md`, Decisions log.
  (SUPERSEDED — see the top entry above: the user's full run on this exact
  tree subsequently MET both gates at these counts, including case 20
  live.)

- **Fix round on the five open items recorded at `bb0b52f`, now COMPLETE
  (agent-run, NOT yet user-validated — G1 and G2 stay RE-OPENED/PENDING).**
  All six agreed fixes, in two passes (the second after a coordinator
  decision on items 5 and 6):
  (1) `m5-check-live.mjs` gained case 20, asserting live that a `simSwapAge`
  question calls `sim-swap` and never `device-roaming-status`/
  `device-reachability-status` — WRITTEN, NOT RUN this session (no
  `ORANGE_BASIC_AUTH` credential available; stays unrun, per instruction, no
  live Orange legs this round);
  (2) `m4-check.mjs` case 42's fixture now locates the `reachable` predicate
  table entry and its `axes:[...]` sub-field by SHAPE (regex), not the
  verbatim literal `", axes: ['reachability']"` — mutation-proved both ways:
  reverting the real guard to bare `spec.axes` still reds (41/42, exit 1),
  and rewriting it as `Array.isArray(spec.axes) ? spec.axes : []` still stays
  green (42/42, exit 0);
  (3) `m6-check.mjs` gained case 47, driving a `simSwapAge` question through
  the FULL composed path (floor/menu/seal/hub/RP, the same injected Orange
  transport rig case 22 uses) and asserting no roaming/reachability call
  appears — mutation-proved: forcing the `needRoaming` gate in
  `m5-facts-orange.mjs` open unconditionally reds it (46/47, exit 1);
  restore → green (47/47, exit 0);
  (4) `m5-check.mjs`'s `ROAM_Q`/`REACH_Q` are now built via `factQuery` on
  the real `roamingIn`/`reachable` predicates instead of hand-written
  `{needRoaming:true}` literals — mutation-proved: flipping `roamingIn`'s
  `axes` to `['reachability']` now reds BOTH `m4-check.mjs` (41/42) and
  `m5-check.mjs` (61/66, 5 new failures), closing the gap where only
  `m4-check.mjs` caught it before;
  (5) `poc/demo.mjs`'s pre-seal capacity guard (inside `createOperator`'s
  `handle`) now derives capacity from `recipientEnc`'s own
  `asymmetricKeyDetails.modulusLength` — exactly as `seal()` in
  `m2-envelope.mjs` already does — instead of comparing against the module
  constant `OAEP_CAPACITY` (446, the RSA-4096 demo value); `m2-envelope.mjs`'s
  crypto was NOT touched, it was already correct — the gap was only the
  caller-side guard disagreeing with it for a non-4096 recipient. A
  PERSISTED regression case was added to `runDemo()` (an RSA-3072 recipient,
  real cap 318 B, gets a graceful signed refusal instead of a thrown
  exception) — **`demo.mjs` moves from 33 to 34 cases as a result: agent-run
  only, NOT user-validated at this new count.** Mutation-proved on the
  persisted case itself: reverting the guard to the constant makes the SAME
  scenario throw an uncaught `seal()` exception and ABORT THE WHOLE RUN
  (exit 1); restored → graceful refusal, 34/34, exit 0. An earlier throwaway
  `/tmp` repro script used mid-session to prove the mechanism before the
  persisted case existed has been deleted — it does not count as coverage;
  (6) `rawNeedles()` gained a `deviceFlippedDaysAgo` parameter so the `r6b`
  negative-control frame's own re-scripted value has spellings in the scan
  inventory. Adding those spellings first turned the suite red
  (`demo.mjs` 29/33, cascading to `m6-check.mjs` 45/47) and was escalated
  rather than silently fixed by trimming the needle set. Audited before
  being believed a leak: every failing hit was exactly the single character
  `"4"` (`DEVICE_FLIPPED_DAYS_AGO`'s own decimal spelling) — including the
  FIRST assertion in `runDemo()`, whose frame is built and scanned BEFORE
  the device-flip scenario ever runs, making it structurally impossible for
  that frame to carry the flipped value. Confirmed independently as a
  harness confound, not a leak. **Resolved per coordinator decision: a
  `PLAIN_MIN_NEEDLE = 2` cutoff (new `plainNeedles()` helper beside the
  existing `opaqueNeedles()`/`OPAQUE_MIN_NEEDLE = 8`) drops bare
  single-character needles from the plaintext scan, while keeping every
  2+-character needle already proven not to false-positive across this
  suite's run history — the 2-letter country code `FR` (kept deliberately,
  per this file's own comment, as the requester-echo case) and the 3-digit
  day counts (`137`/`211`).** `PLAIN_MIN_NEEDLE` is calibrated separately
  from `OPAQUE_MIN_NEEDLE` and says why in a comment: 8 is measured against
  RANDOM bytes/base64, where even a short needle is genuinely rare; this
  scan runs against STRUCTURED, low-entropy JSON text, where a bare digit
  is common (an `exp` timestamp alone makes a 1-character digit needle
  near-certain to collide) but a 2+-character token is not. **Stated as an
  honest limit, not softened: a value whose EVERY spelling is shorter than
  2 characters (i.e. a single-digit day count with no other spelling at
  all) cannot be leak-tested by this scan.** `DEVICE_FLIPPED_DAYS_AGO`
  itself is unaffected in practice — its longer spellings (its millisecond
  age `345600000`, its ISO instant, its date) were already in the inventory
  and remain fully leak-testable; only its bare `"4"` spelling is dropped.
  PROVED the frame can still genuinely fail: temporarily made `r6b`'s answer
  carry `facts.deviceSwapAgeMs` (the flipped value's millisecond spelling,
  reusing the existing `leakRaw` control) — the scan reds (exit 1, hits
  include `"345600000"`); reverted the temporary instrumentation — green
  again (exit 0, 33/33 at that point, before FIX 5's case was added).
  Full offline suite by exit code: BEFORE this whole round — m1 20/20,
  m2 10/10, m3 26/26, m4 42/42, m5 66/66, m6 46/46, demo(mock) 33/33 (all
  green). AFTER both passes — m1 20/20, m2 10/10, m3 26/26, m4 42/42,
  m5 66/66, m6 47/47, demo(mock) 34/34 — **all exit 0.** No case outside
  what each fix names was touched; no existing assertion was weakened or
  deleted. Full record: `docs/01-product/prd.md`, Decisions log.
  (SUPERSEDED — see the top entry above: the user's full run on the
  current uncommitted tree subsequently MET both gates.)

- **User ran the full validation suite on their own machine against the tree
  at `bb0b52f` (this record predates the fix round in the entry above, which
  changed executable code both gates cover — it does NOT carry forward to
  the current tree): every suite clean, zero `FAIL`, zero `TypeError`, zero
  `Error:` lines in either log. BOTH gates MET on that tree.** Offline (user-run, by exit code, all exit 0): `m1-check.mjs`
  20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26, `m4-check.mjs` 42/42,
  `m5-check.mjs` 66/66, `m6-check.mjs` 46/46, `demo.mjs` (mock backend)
  33/33. Live (user-run, real Orange Network APIs Playground, injected
  clock `2026-08-18T16:25:49.263Z`, quota 1 of 10 custom slots in use at
  start, all exit 0): `m5-check-live.mjs` 19/19, `demo.mjs --backend
  orange` 33/33 — every count user-run, none agent-run. G1 (M1–M4 + M6
  user-validated) MET at 20/10/26/42/46 plus `demo.mjs` (mock) 33/33. G2
  (M5 user-validated live) MET on both legs (offline 66/66, live 19/19).
  Notably, `m5-check-live.mjs` had two cases edited this session and had
  never been executed until this run — it passed 19/19 on its first ever
  execution against the real Playground. The first attempt at the live
  legs exited 2 (missing `ORANGE_BASIC_AUTH`) and was correctly NOT a
  pass — the successful re-run above is the one that counts. **This
  record covers the uncommitted working tree it was run against ONLY**:
  per this repo's own rule, a user validation covers only the exact tree
  it ran at, and any later change to a file either gate covers re-opens
  that gate, commit or no commit. Two known open items surfaced by this
  round are recorded, not quietly dropped: (1) the call-count saving that
  motivated the axis-signal unification is proven only OFFLINE (injected
  transport) — no live case asserts it; (2) `m6-check.mjs` gives no
  signal on the roaming/reachability-gating change — it stayed 46/46
  before and after; only `m4-check.mjs` catches a wrong `axes` mapping
  (flipping `roamingIn` to `['reachability']` left `m5-check.mjs` fully
  green at 63/63, measured before this round's 66/66 count). Also still
  open, pre-existing and unaffected by this round: `poc/m4-check.mjs`
  case 42 searches the source for the literal `", axes: ['reachability']"`
  to build its fixture — same brittleness class as the guard-text search
  already removed elsewhere, now aimed at the predicate table instead;
  `poc/m2-envelope.mjs:26` hardcodes `OAEP_CAPACITY = 446` rather than
  deriving it from the recipient key; and the `r6b` scan frame in
  `poc/demo.mjs` structurally cannot red because `rawNeedles` is built
  from `DEVICE_SWAPPED_DAYS_AGO` while `r6b` answers about
  `DEVICE_FLIPPED_DAYS_AGO`, so the value it could leak is not in the
  needle inventory. Full record: `docs/01-product/prd.md`, Decisions log.
  (SUPERSEDED — see the top entry above: the user's full run on the
  current uncommitted tree subsequently MET both gates again, at new
  counts, on a tree this record does not cover.)

- **Finishes the axis-signal unification: ALL SIX operator axes now gate on
  `PREDICATES.axes`/`needXxx`, not two.** The entry below closed the
  roaming/reachability over-read by moving THOSE two axes onto the
  `needRoaming`/`needReachability` signal, but left the claimed single-mapping
  design only half true: SIM, device, location and KYC still gated on the OLD
  pattern (`hasOwn(q, thresholdKey)` for SIM/device, `q.area`/`q.claimedName`
  value-presence for location/KYC) — two live sources of truth for the same
  question, the exact thing `axes` was supposed to remove.
  - **`poc/m5-facts-orange.mjs`**: SIM/device reads now gate on
    `hasOwn(q, 'needSim') && q.needSim === true` /
    `needDevice`, re-checked exactly as `needRoaming`/`needReachability`
    already were. `readSwapAxis` gained an explicit, FIRST guard —
    `!Number.isSafeInteger(thresholdMs) || thresholdMs <= 0` → no read at
    all — because moving the gate off the threshold key means the function
    can now be entered with `needSim: true` and no valid threshold at all;
    before this guard, a present-but-invalid threshold fell straight into
    the `/retrieve-date` branch (a raw-date read for a window nobody
    validated) rather than being refused. Location/KYC now gate on
    `needLocation`/`needKyc === true` **as well as** their existing value
    validation (`validArea(q.area)`, the claimed-name bound) — the signal
    decides WHETHER to read, the value still decides what body to send, and
    either one failing leaves the axis absent, never a guessed bit.
  - Tests (`poc/m5-check.mjs`, 63 → 66): every hand-built query literal
    that exercises a SIM/device/location/KYC read
    (`SIM_Q`, cases 49–51/53–57/59/60) now carries the matching `needXxx:
    true` alongside its value — without it, the axis is no longer read at
    all under the new gate. New case 64 pins the `readSwapAxis` fail-closed
    guard (missing/negative/zero/non-numeric threshold with `needSim`/
    `needDevice: true` → zero calls on either surface); new case 65 pins
    the location/KYC fail-closed outcome when the signal is true but the
    value is absent (complements case 60, which already covered a
    signal-true, value-malformed shape — case 60 itself was updated to
    carry `needLocation`/`needKyc: true` so it keeps testing value
    re-validation rather than going vacuous under the new gate); new case
    66 is the direct negative for the unification itself — a well-formed
    threshold/area/claim with the `needXxx` flag OMITTED now makes ZERO
    calls on all four axes, where the pre-unification code would have
    read anyway.
  - Mutation-proven (revert → confirm RED with a non-zero exit → restore →
    confirm GREEN), against the real files, not a copy: reverting the
    SIM/device/location/KYC gates back to their old threshold-key/value-only
    pattern reds `m5-check.mjs` case 66 (exit 1, dies on an unhandled 404
    before even reaching the tally — `location-verification` gets called
    with no route wired for it); reverting only the `readSwapAxis` threshold
    guard reds case 64 alone (65/66, exit 1). Both restores verified green
    at 66/66, exit 0.
  - **`m5-check-live.mjs` is unaffected and stays UNRUN**: every query it
    builds already goes through `factQuery(predicate)` (the real seam), so
    it was never on the old per-axis pattern to begin with. Not run this
    round — live Orange, quota + GPG cache, out of scope for this change.
  - **`m4-check.mjs` gains case 42**, closing a SEPARATE, pre-existing gap:
    the `spec.axes ?? []` guard added with the roaming/reachability round
    (below) had NO test able to detect it — reverting it to `spec.axes` left
    every offline suite green, because every CURRENT `PREDICATES` entry
    happens to declare `axes`, so the reverted line was never reached with
    an undefined value through the public API. Case 42 reads the real
    `m4-facts-mock.mjs` source at run time, dynamically imports a variant
    with one entry's `axes` field surgically stripped (proving the guard
    tolerates an axes-less table entry: `factQuery` returns `{}`, no throw)
    and a second variant that additionally locates the `for (const axis of
    ...) {` loop header by shape (not by matching one guard spelling) and
    replaces it with the bare, unguarded `spec.axes` — proving the identical
    input then throws `TypeError: spec.axes is not iterable` (the negative
    control). Mutation-proven against the real file, twice: reverting the
    real guard to bare `spec.axes` reds the whole suite at exit 1 (case 42's
    own behavioural assertion fails — the "guarded" variant, built from
    whatever the real file currently says, now throws too); restored, green
    at 42/42. **Fixed 2026-08-18 (this round):** the initial version of case
    42 additionally searched for the guard's exact source text
    (`'spec.axes ?? []'`) and threw a "fixture assumption broken" error if
    that string was absent — which meant the case pinned the guard's
    SPELLING, not its behaviour, and went red on a behaviourally identical
    refactor (`spec.axes ?? []` → `Array.isArray(spec.axes) ? spec.axes :
    []`) that broke nothing. That verbatim-text search and throw were
    removed; the negative-control variant now locates the loop by its
    syntactic shape instead, so case 42 passes under any correct guard
    spelling and still reds if the guard is dropped entirely. Re-proven:
    revert to bare `spec.axes` → RED (41/42, exit 1); restore → GREEN;
    swap to the `Array.isArray` ternary spelling → stays GREEN (42/42, exit
    0, the fix's whole point); restore original spelling → GREEN again.
  - **G1 and G2 stay PENDING.** This change touches executable code covered
    by both gates and has NOT been run by the user at this commit — nothing
    here claims user validation. (SUPERSEDED — see the top entry above: the
    user's full run on the uncommitted tree subsequently MET both gates.)

- **Closes the open design item recorded at the 2026-08-18 code-review
  round: `roaming`/`reachability` axes are now conditional on `getFacts`,
  the same way the SIM/device axes already were.** `m5-facts-orange.mjs`
  read `device-roaming-status` and `device-reachability-status` on EVERY
  live `getFacts` call, whether or not the predicate being answered asked a
  question those axes could answer — two extra billed operator calls for a
  question that never asked them, and (for `roaming`) a raw-ish upstream
  read for no reason at all.
  - **`poc/m4-facts-mock.mjs`**: `PREDICATES` gains an `axes` field — the
    single place the predicate → operator-axis mapping lives
    (`simSwapAge`→`sim`, `deviceSwapAge`→`device`, `roamingIn`→`roaming`,
    `reachable`→`reachability`, `presentIn`→`location`,
    `numberMatch`→`kyc`). `factQuery` now emits the axis as a flat
    top-level boolean (`needRoaming: true`, `needReachability: true`, …)
    whenever — and ONLY whenever — the predicate's own value validated; a
    malformed or unknown predicate still yields `{}`, unchanged.
  - **`poc/m5-facts-orange.mjs`**: the roaming and reachability reads are
    now gated on `hasOwn(q, 'needRoaming')`/`hasOwn(q, 'needReachability')`
    with the value re-checked `=== true` (this file re-validates every
    query field rather than trusting the caller, exactly as it already did
    for `q.area`/`q.claimedName`) — the identical pattern the SIM/device
    axes already used against their threshold keys.
  - Tests: `m4-check.mjs` 40 → 41 (new case 41, the "axis signal only when
    the predicate's own value validated" guard, mutation-proven); `m5-check.mjs`
    60 → 63 (15 existing cases rewired to declare the axis they exercise —
    `factsWith`/individual reachability cases now carry `ROAM_Q`/`REACH_Q`,
    generic auth/redaction cases 3–9/13/47 carry `REACH_Q` so `getFacts`
    still makes a live call to test against — plus 3 new cases: 61/62 the
    read-only-when-asked guard for each axis with a negative control, 63
    the fail-closed chain end to end (no query → zero live calls →
    `evaluatePredicate` refusal, never a guessed bit)); `m6-check.mjs`
    stays 46/46, case 40's incidental key-count expectation for the
    `roamingIn` query moves from 0 to 1 (it now correctly carries
    `needRoaming: true`) — `plain()` itself is unchanged. `m5-check-live.mjs`
    cases 17/18 updated to ask an explicit question (`factQuery`) so
    `getFacts` still reaches the Playground; **not run by this change** (no
    live credentials in this session) — flagged for the next live G2 run.
  - Six rewired/added `m5-check.mjs` cases were mutation-proven (revert →
    red → restore → green): removing the roaming gate reds cases 61/63
    (61/63, exit 1); removing the reachability gate reds cases 62/63
    (61/63, exit 1); dropping `REACH_Q` from case 5 reds case 5 alone
    (62/63, exit 1); dropping `ROAM_Q` from the `factsWith` helper reds
    cases 16/17/21/22 (59/63, exit 1). The underlying `factQuery`
    "only-emit-when-ok" logic was mutation-proven too: forcing
    `ok = true` unconditionally for the `countries`/`boolean` branches reds
    `m4-check.mjs` case 41 (40/41) and `m6-check.mjs` case 40 (45/46). All
    six restores verified green at their full counts.
  - **G1 and G2 are RE-OPENED (PENDING)**: this change touches executable
    code covered by both gates (`poc/m4-facts-mock.mjs`,
    `poc/m5-facts-orange.mjs`, and their check suites), and per this
    repo's own rule a user validation covers only the exact commit it ran
    at — the user has not yet run this change. `poc/demo.mjs` was not
    touched and its suite is unaffected (33/33), but that does not carry
    the gate forward on its own. (SUPERSEDED — see the top entry above: the
    user's full run on the uncommitted tree subsequently MET both gates.)

## 0.4.0 — 2026-08-18 — M6

- **User ran the full validation suite at code commit `4446517` / docs
  commit `c921508` (log timestamped 2026-08-18 08:16): every suite clean,
  zero `FAIL`, zero `TypeError`, zero `Error:` lines in the entire log.
  BOTH gates MET at `4446517`, for the first time at the same commit.**
  `m1-check.mjs` 20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26,
  `m4-check.mjs` 40/40, `m5-check.mjs` 60/60, `m6-check.mjs` 46/46,
  `demo.mjs` (mock) 33/33, `demo.mjs --backend orange` (live, real Orange
  Playground) 33/33, `m5-check-live.mjs` (live, real Orange Playground)
  19/19 — every count user-run. G1 (M1–M4 + M6 all user-validated) MET at
  the current counts; G2 (M5 user-validated live) MET on both legs. This
  record covers `4446517`/`c921508` only. See
  `docs/01-product/findings.md`, 2026-08-18 (latest).
- **Second `/code-review medium --fix` round: cross-requester sealing fixed
  (m6 45 → 46), spec closure — G1 AND G2 were PENDING at `4446517` until
  the full user run above.**
  Reviewed the round-1 tree (`c15fcc0`) and found the operator sealed EVERY
  signed refusal AND every answer to a hardcoded `keys.rpEnc.publicKey`
  instead of the envelope key of the issuer step 3/4 had just authenticated
  — the trust directory already carried `encPub` for exactly this and
  nothing read it. Concrete failure: with a second directory-listed
  requester B, B's query passes signature verification and the operator
  encrypts the answer under requester A's key — A can decrypt an answer to
  a query it never made, and B cannot read its own. Cross-requester
  disclosure between two authenticated principals, invisible in the demo
  only because it has ever had one RP. **Fixed:** `createOperator` now
  resolves `entry.encPub` off the directory at step 3 and threads it as
  `recipientEnc` through every `signedReject`/answer call site; a directory
  entry with no `encPub` reports `unknown issuer`. **Also fixed:**
  `spec/carrier-attestation.yaml`'s `Predicate` schema was the one shape
  still missing `additionalProperties: false`, while `evaluatePredicate`
  genuinely enforces a closed predicate field set in code — the sketch left
  open the exact door the code closes.
  - **New case, mutation-proven: m6 case 46 CROSS-REQUESTER SEALING (m6
    45 → 46).** A `twoRpWorld()` helper mints a second requester B sharing
    A's operator; the case asserts both directions and both reply kinds — B
    opens its own answer and its own signed refusal, A opens neither
    (`reason='undecryptable'`). Reverting the fix alone (keeping the case)
    gives `RESULT: 45/46`, exit 1, `answer-for-A=opened,
    refusal-for-A=opened`; cases 1–45 unaffected. The fix shipped with NO
    net to catch it until this case — every existing suite scored
    identically with the fix present or reverted, since a single-RP world
    structurally cannot exercise it. Third fix in this project's history to
    ship with no net at the time it landed (after m3-floor's hostile-key
    bound and m5's `getFacts` re-validation) — a finding about the suite,
    not only the code.
  - **Skipped, recorded not dropped:** (1) `m5-facts-orange.mjs`'s
    `roaming`/`reachability` reads are still unconditional on every
    `getFacts` — same class as the SIM/device axes just fixed in round 1,
    needs a `factQuery`-carrying signal design change, recorded as an OPEN
    item for the user. (2) `demo.mjs`'s `r6b` scan frame structurally
    cannot red against `NEEDLES` (3-digit-instant collision avoidance is
    the measured reason), a stated limit. (3) the pre-seal answer-size
    guard compares against the module constant `OAEP_CAPACITY` rather than
    a capacity derived from the actual recipient key — correct today
    (fixed RSA-4096), more reachable now the recipient key comes from the
    directory; needs an M2-owned capacity helper, a stated limit.
  - `/security` ran on this code earlier in the session and returned
    clean; it did NOT catch the cross-requester sealing defect. A clean
    security pass is not proof.
  - Verified green independently by exit code: m1 20/20, m2 10/10, m3
    26/26, m4 40/40, m5 60/60, **m6 46/46**, demo(mock) 33/33. **G1 and G2
    remained PENDING at this commit** (SUPERSEDED — see the entry above:
    the user's full run at `4446517` subsequently MET both gates) — this
    round changed `poc/demo.mjs` again, one of the exact files the last
    user validation (`3276ed0`) covered; no user record transfers forward
    across a tree change. See
    `docs/01-product/findings.md`, 2026-08-18 (latest).
- **`/code-review medium --fix` round + `/security`: 6 fixes, 1
  user-approved behaviour change, m3 25 → 26, m5 58 → 60 — G1 AND G2 BOTH
  RE-OPENED (PENDING) at `9b04854`.** (SUPERSEDED — see the top entry
  above: the user's full run at `4446517` subsequently MET both gates.)
  Reviewed the six live-touching files
  (`poc/demo.mjs`, `poc/m3-check.mjs`, `poc/m3-floor.mjs`,
  `poc/m5-check.mjs`, `poc/m5-facts-orange.mjs`,
  `spec/carrier-attestation.yaml`).
  - **Six review fixes:** (1) an unknown floor field name reached the
    refusal reason RAW — a newline/NUL could forge a fake log line; bounded
    to 40 chars printable ASCII. (2) the "effective floor is the tightened
    one" assertion recomputed `checkFloor` locally instead of reading the
    operator's own return, so it passed identically for an operator that
    computed and discarded the effective floor; `handle()` now returns
    `effectiveFloor` (operator-side only, never onto the wire). (3)
    `getFacts` re-validated `thresholdMs` but trusted `q.area`/
    `q.claimedName` verbatim; a caller bypassing `factQuery` could push a
    malformed area or a 50,041-char name straight to a live operator call —
    both now re-validated on the read path. (4) the RP registered a pending
    nonce BEFORE `seal()`, leaking one unconsumable store entry per
    oversize retry — seal first, register after. (5) `verifyResponse` with
    `skipNonceStore` and no `fallbackPredicate` threw a bare `TypeError`
    instead of returning a verdict, breaking its own "never throw on
    untrusted input" contract. (6) `carrier-attestation.yaml` — docs only:
    stated the deliberate `number`-field divergence instead of leaving it
    an unstated trap.
  - **Finding 7, escalated and USER-APPROVED as a behaviour change:** the
    SIM-swap axis was read UNCONDITIONALLY in `m5-facts-orange.mjs`, so a
    `reachable`/`roamingIn`/`presentIn`/`numberMatch` question — none of
    which carry a SIM threshold — still made a metered `/retrieve-date`
    call and pulled a raw SIM-swap date operator-side for a question nobody
    asked. Now conditional, matching the existing device-axis pattern.
    Reasoning: a reference operator holding an unrequested raw value
    undercuts the CAMARA proposal's own argument that `/check` leaves no
    raw value operator-side to leak in the first place. That change broke 7
    pre-existing pinned m5 cases (10, 11, 12, 14, 15, 27, 49) — REPAIRED,
    not weakened, via an explicit SIM-question fixture threaded through
    each so every assertion still exercises what it did before.
  - **Three new cases, each mutation-proven RED when its fix is reverted:**
    m3 case 26 (hostile floor key with an embedded newline), m5 case 59
    (SIM axis read only when asked), m5 case 60 (malformed area / oversize
    name never reach the wire). Two coverage gaps this closed: m3 and m5
    scored their old full counts whether fixes 1 and 3 were present or
    reverted, before these cases existed.
  - **Counts moved: m3 25 → 26, m5 58 → 60.** Independently re-verified by
    exit code (agent-run): m1 20/20, m2 10/10, m3 26/26, m4 40/40, m5
    60/60, m6 45/45, demo(mock) 33/33.
  - **`/security` re-run for the first time across this round: clean.** No
    new findings; fixes 1/3/4/5 above each close a real class (log-line
    forging, unbounded outbound request, unbounded store growth,
    uncontracted throw). Nothing Critical/High.
  - **Both gates re-opened.** This round changed exactly the two files
    (`poc/demo.mjs`, `poc/m5-facts-orange.mjs`) that gates G1 and G2 were
    user-validated against at tip `3276ed0`. A user record covers only the
    tree it was run on — this is a different tree (`9b04854`) — so **G1 and
    G2 are BOTH PENDING again**, and the `3276ed0` records for M1 (20/20),
    M2 (10/10), M4 (40/40), M6 (45/45) and the demo mock run (33/33) do NOT
    transfer forward either, even where their counts are unchanged, because
    the tree changed under all of them. See `docs/01-product/findings.md`,
    2026-08-18 (latest).
- **LIVE FIX: the assertion-1 leaky-operator negative control was VACUOUS on
  the orange backend (user's live `--backend orange` run: 32/33) — fixed
  offline, mutation-proven.** The control reused the section's shared
  `simSwapAge gte P90D` predicate. P90D is 2160 hours, under M5's measured
  2400-hour `/check` cap, so on orange this question runs `/check` — which
  never reads a raw date at all, so `facts.swapAgeMs` was `undefined` and
  there was nothing for `leakRaw` to leak. The control's asserted condition
  was false, not because the profile leaked but because a raw age was
  structurally absent on that path; the harness failed loudly rather than
  passing vacuously, which is correct — but a control that cannot fail must
  never be asserted as though it did. `poc/demo.mjs`'s `q1c`/`r1c` now ask a
  dedicated `LEAK_PREDICATE` at `P365D` (above the `/check` cap, forcing
  `/retrieve-date`, where a real raw date exists to leak on both backends).
  Verified offline, zero network, via an injected-transport replay mirroring
  `m6-check.mjs` case 22: the fixed control reds the leak on both mock and
  replayed-orange; replaying the OLD `P90D` shape against the same orange
  transport reproduces the exact live-observed vacuous pass offline. No
  offline case counts moved (demo stays 33/33) — the fix is inside an
  existing assertion, not a new one. Accidental finding recorded in
  `docs/01-product/findings.md` and `docs/02-proposals/camara-attested-windowed-disclosure.md`,
  2026-08-17: `/check` structurally closes off this whole class of operator
  mistake (nothing to leak), where `/retrieve-date` relies on the closed
  claim set alone. **LIVE-CONFIRMED at `3276ed0`, USER-RUN: `node
  poc/demo.mjs --backend orange` → `RESULT: 33/33`**, and, in the same
  session, `ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` → `RESULT: 19/19`
  (quota clean: start=1, end=1 of 10, cleanup DELETE status=204) — the
  vacuous control now reds the leak for real on the live backend, not just in
  the offline mutation-proof. The `m5-check-live.mjs` run postdates `19b2644`,
  so it settles gate G2's M5 leg forward to the current tip: **G2 (M5
  user-validated live) IS MET at `3276ed0`.** That run's own PASS 6 (`LIVE
  SURFACE CHOICE`) independently corroborates, on the wire, the cap-boundary
  premise this fix depends on: `P90D → check maxAge=2160h → true; P365D →
  retrieve-date maxAge=null → false=true`. See `docs/01-product/findings.md`,
  2026-08-18 (latest). Nothing about this fix, or G2, is PENDING any more.
- **MEASURED FIX: a live convergence probe settled the Admin `location` write
  shape and corrected two ASSUMED labels to MEASURED-GOOD.** Following on from
  the `LIVE FIX` entry below (which found `lastLocationTime` missing), the user
  ran a throwaway probe against `+990100000099` that kept re-submitting the
  same Admin UPDATE: round 1 → `400 "data.location.available" is required`;
  round 2 → `400 "data.location.radius" is required`; round 3 → `200 OK`, READ
  back intact. **This closes the "still untested" claim the entry below made
  about `kyc`** — the same converged READ returned `kyc:{name}` and
  `deviceSwap:{latestDeviceChange}` verbatim, so both move from ASSUMED to
  MEASURED-GOOD; the code comment, `poc/README.md` and the PRD decisions log are
  corrected in the same commit.
  - The settled `location` write shape is `{latitude, longitude,
    lastLocationTime, available, radius}` — two more fields than this repo
    wrote before today.
  - `available` is written `true` (every scripted position is one the operator
    can currently place). `radius` is written **`500`, not the probe's own
    placeholder `0`** — the ONE decision made outright for the round: 500
    matches the value the same READ showed already resident in the slot, and a
    zero-radius write would claim a precision the operator never asserted.
  - Both join the read-after-write verification loop as their OWN axes
    (`geoAvailable`, `geoRadius`) — the same `geoAt` precedent applies for the
    same reason: a mismatch folded into `geo` reads as the wrong bug.
  - The read-after-write guard on `deviceSwap`/`kyc`/`location` stays wired
    exactly as before — a measured-good shape still gets verified on every run,
    because "measured once" is not "guaranteed forever". The ASSUMED-shape
    caveat text in the write-verify diagnostic is removed, since no axis in
    that loop is assumed any more.
  - **Two new offline cases, both mutation-proven to red**: case 58 pins
    `available`/`radius` as their own axes (a shadow slot that flips either
    fails loud naming it), and case 52's assertions now also pin the written
    values directly. Counts moved: **m5 offline 57 → 58**. m6 stays 45 (its
    orange-replay READ fixture now carries the two new fields so the write it
    mirrors matches what M5 actually sends). Offline counts AGENT-RUN; the
    live gate itself was PENDING a user re-run as of this bullet — since MET
    at `3276ed0` (see the top bullet of this section).
- **GROUNDING FIX: `m5-check-live.mjs` was never updated by the 3 → 6 round
  (11 → 19 cases).** `git log 8238d02..81f8da4 -- poc/m5-check-live.mjs` is
  EMPTY: every sibling suite was widened to the six-field backstory and this one
  was not, so the user's live run died on M5's own closed-field validation before
  proving anything — the write-trap case caught a `invalid backstory` throw while
  asserting it had caught the built-in shadowing, and the script then crashed
  uncaught.
  - **Why this file and not the others:** it is the only check that cannot run
    offline. A file nobody can run drifts silently.
  - **New case 1 pins the story against the adapter's closed field set, OFFLINE
    and before any network call** — the full story must reach a throwing
    transport sentinel (proving it PASSES validation), each of the six fields
    must be required, and an unknown field must be refused by name. It reds on a
    clean clone with zero credentials, which is what would have caught this.
  - **The trap case now asserts it failed for its OWN reason** — the message must
    name the shadowing and must not be a validation refusal. "It threw" is not
    evidence a guard fired.
  - **The three new predicates are covered on the LIVE path** the way
    `m5-check.mjs` covers them offline: `deviceSwapAge` with its negative and
    axis-independence, `presentIn` both ways plus the third state, `numberMatch`
    both ways plus the gradient staying operator-side, and the
    `/check`-vs-`/retrieve-date` surface choice read off the wire via a recording
    pass-through transport.
  - Evidence is an **injected-transport REPLAY** (19/19, exit 0; the old file
    under the same replay reds exactly as the user's run did) plus five killed
    mutations. **It proves control flow, not the Playground** — that is a
    distinct claim from the actual live run, which is the user's; the live
    run against the real Playground, at this rewritten file, happened
    afterward at tip `3276ed0` (19/19, quota clean) and MET G2 — see the top
    bullet of this section.
- **LIVE FIX: the Admin `location` write shape was wrong, and it said so.** The
  user's first live Playground run of the 3 → 6 tree measured
  `admin UPDATE failed (status 400): {"code":"BAD_REQUEST","status":400,
  "message":"\"data.location.lastLocationTime\" is required"}`. The adapter wrote
  the bare `{latitude, longitude}` pair; the Orange Admin store will not hold a
  position without an observation instant. **This is the assumed-shape design
  working**: the axis was labelled the weakest of three guesses precisely because
  a wrong one had to fail LOUD naming the axis rather than script a position that
  never took effect, and that is what happened on first contact.
  - The instant is `new Date(nowMs).toISOString()` — **off the INJECTED clock,
    never `Date.now()`**, so the same demo writes the same bytes on every run.
  - **It is scripting, not disclosure.** `getFacts` still never reads a
    `lastLocationTime` from anywhere, and all three of its spellings (epoch ms,
    ISO, ISO date) plus the field name joined the demo's wire-byte needle
    inventory (22 → 26 needles, three more planted leaks in m6 case 18), so a
    future line that let it out reds.
  - It is verified by the same read-after-write loop as every other axis, as its
    own axis `geoAt`.
  - **Generalisable, and recorded against `kyc`:** an OBSERVED READ shape does not
    tell you the REQUIRED WRITE field set. The run **aborted at location**, so the
    `kyc: {name}` write shape is **still untested** and stays labelled ASSUMED.
  - Counts moved: **m5 offline 56 → 57**. m6 stays 45 and demo stays 33, but both
    changed, so all three are AGENT-RUN with a **user re-run PENDING**.
- **Part 3: `numberMatch` — the predicate set is now the signed SIX.** The
  requester declares its match threshold off the published menu
  (`60 | 70 | 80 | 90`) and the name it holds; the operator compares internally;
  **only the boolean crosses the wire.** This is the row where the raw value the
  profile protects is the catalog response itself: `kyc-match` returns a
  similarity SCORE, and a score is a gradient rather than a band (a wrong name
  scored 53; the registered name with ONE letter changed scored 97), so an
  unquantised threshold against it is a warmer/colder oracle that hill-climbs to
  the subscriber's real registered name.
  - **`claimed` is the only predicate field that is neither a type nor a
    window** — the attribute value the requester wants compared. Legal only for
    the types that declare it, refused by name elsewhere, and part of the SIGNED
    predicate string (otherwise an answer about "does Bob match?" verifies as an
    answer about "does Alice match?").
  - **Two measured response shapes a naive implementation gets wrong:**
    `nameMatch` is the STRING `"true"`/`"false"` (and `"false"` is truthy, so an
    unguarded read reports a non-match as a match), and an EXACT match carries no
    score at all (so "compare score against threshold" alone answers `false` to
    the strongest possible match).
  - **Recorded, not glossed: the operator learns what the requester claims.**
    Inherent to a comparison, and disclosure in the other direction. Profile mode
    narrows what the OPERATOR discloses; it does not make the requester's query
    private.
  - **A real FLAKE caught and fixed:** a new case scanned the two-character needle
    `97` against RSA ciphertext and an unblanked random nonce — a ~1-in-8 false
    red, the exact short-needle trap this repo already documented. Split by
    artifact class, as the wire scanner already was.
  - **A second unpinned guard of the same shape as part 2's:** the kyc-name
    write-back survived mutation in the same place the location one did.
- **Part 2: `presentIn` — and the third state is the whole point.**
  `location-verification/v1/verify` answers `TRUE`, `FALSE` and `PARTIAL`
  (measured), and `PARTIAL` produces a signed REFUSAL carrying no bit rather than
  a rounded `true`/`false`: a rounded answer is signed and indistinguishable on
  the wire from a real one.
  - **The PARTIAL policy is a published FLOOR AXIS** (`partialPolicy`, one legal
    value `refuse`), so "the operator publishes it and the requester may only
    tighten it" is the existing rule-5 machinery rather than a new mechanism — a
    request asking to have PARTIAL rounded for it dies at the floor gate before
    any fact is read. **This moved a user-validated module: `m3-check` 24 → 25.**
  - **The area is canonicalised by KEY, not by typing order.** `JSON.stringify`
    serialises in insertion order, so two spellings of the same circle would
    otherwise derive two signed predicate strings and one requester would get its
    own correct answer back as a `predicate mismatch`.
  - **`lastLocationTime` is never read** — not filtered on the way out; there is
    no line that reads it. Same for the subscriber's own position: the mock
    computes a real great-circle verdict and returns the VERDICT, never the place.
  - **An honest residual, added rather than removed:** an area is a dial (centre
    plus radius) and is walkable toward a position the way a duration threshold is
    bisectable. `presentIn` gets no bucket menu, so the cap is the operator's own
    resolution plus the rate-limit/billing backstop — weaker than the duration
    menu, and said to be weaker.
  - **A mutation SURVIVED on the first pass** and found a real gap: the
    read-after-write comparison that makes this round's assumed Admin write shapes
    survivable was pinned for the device axis and not for the location one.
- **The wired predicate set goes 3 → 6 (user-signed, PRD §9). Part 1:
  `deviceSwapAge`.** Every wired type is backed by an endpoint OBSERVED answering
  live; nothing is minted for a fact no source computes. `deviceSwapAge` takes the
  IDENTICAL shape to `simSwapAge` — same published bucket menu
  (`P30D | P90D | P180D | P365D`), same `≥` compare, its own fact — because two
  questions of the same shape must not teach a reader two grammars, and a second
  menu is a second place for the window to widen quietly.
  - **The reference adapter now calls the PROFILE-CONFORMING surface where it
    can.** `/check` answers a bit about a `maxAge` window in HOURS capped at 2400
    (boundary-tested), so `P30D`/`P90D` questions go to `/check` — on that path
    the operator never reads a date at all — and only `P180D`/`P365D`, which the
    cap cannot express, fall back to `/retrieve-date`. No rounding down to a
    window `/check` can express: that answers a question nobody asked, signed.
  - **A coarse `/check` answer carries the window it was computed for**, and the
    compare refuses unless that window EQUALS the threshold asked — otherwise an
    adapter could answer "not swapped in 30 days" to a "90 days?" question with a
    bit that is signed, verifiable and wrong.
  - **New seam `factQuery` (M4).** Three of the six predicates make the operator
    ask its own upstream a question-shaped question, so part of the predicate has
    to reach the adapter. It goes through one validating chokepoint — never
    throws, invokes nothing caller-supplied, returns frozen primitives or `{}` —
    rather than handing `req.predicate` to the module that builds outbound HTTP.
  - **The wire-byte scanner now excludes what the QUESTION itself carried**, and
    asserts the size of that exclusion. Found by the scan going red on its first
    run: `roamingIn ["FR","BE"]` puts `FR` in the signed claims by design (rule 2
    requires the answer to name its predicate). Honest limit recorded: the scan is
    therefore blind to a leak of the same value on the axis being asked about —
    M1's closed claim set is what prevents that, not the scanner.
  - **Stated, not claimed:** the Admin write shape for the `deviceSwap` axis and
    the `{phoneNumber, maxAge}` body of the two `/check` routes are ASSUMED
    (mirrored from measured siblings), never observed. Read-after-write
    verification is what makes a wrong guess fail LOUD instead of silently
    scripting a history that never took effect; the live run settles it.
  - **Counts: `m4-check` 33 → 36, `m5-check` 48 → 52, `m6-check` 38 → 40,
    `poc/demo.mjs` 22 → 27.** All AGENT-RUN by exit code; **user run PENDING.**
    Twelve mutations against the round's new guards, twelve killed.

- **M6 adversarial review round (2026-08-17): five ways to crash or deny-service
  the operator, all fixed and mutation-proven.** An independent review filed six
  defects with a repro script; all six reproduced on the first run. Four were
  real, and fixing them surfaced a fifth the review had not found.
  - **The operator could be crashed remotely, three ways** — all on requests
    that fit one envelope, from anyone holding its public envelope key, and all
    breaking the "wire input never throws" contract: an **unbounded echoed
    nonce** (200 characters → `seal()` threw out of `handle`); a **reason clamp
    counting UTF-16 code units where `seal` counts BYTES** (40 astral characters
    → a "clamped" 121-unit / 363-byte reason); and an **answer frame that
    overflows even when the request did not** (18 `roamingIn` country codes fit a
    446-byte request and produce a 448-byte answer, because the canonical
    predicate re-escapes every quote). The refusal budget is now COMPUTED and the
    arithmetic is written down (frame 136 B → payload 310 → claims 231 → reason +
    nonce ≤ 192 B, split 122/70 as JSON-encoded sizes); the clamp bounds encoded
    BYTES and cuts on a code-point boundary; an unechoable nonce is a transport
    reject; an oversize answer is a signed refusal. The comment claiming the
    worst reason had been *measured* to fit was simply false, and is replaced by
    a case that seals the worst admissible refusal (444/446 B).
  - **A forged response permanently burned the pending nonce.** The store
    deleted on any PRESENTED response, not any VERIFIED one, so the untrusted hub
    could inject one garbage sealed message and the operator's genuine answer
    then arrived to `unknown or already-used nonce` — a one-message denial of
    service by the party the design assumes is hostile. The in-code comment
    already stated the correct contract; the code did not implement it.
  - **`verifyRefusal` never ran the duplicate-key scan** that profile rule 2
    requires and `verifyAttestation` performs — in the same round M6 exported
    M1's scanner so the request path would not carry a second copy.
  - **Operator-internal diagnostics were signed and shipped to the requester.**
    The backend's exception message rode verbatim into the refusal; on the Orange
    path an upstream 500 delivers a core-network hostname. The requester now gets
    one stable reason, deliberately not distinguishing "unknown subject" from
    "temporarily unavailable" (that distinction is a subject-existence oracle);
    the full message stays operator-side.
- **Four labels corrected where the headline claimed more than the assertion
  checked** (no false PASS in any of them): a case whose `extra` was the literal
  `ok: true`; a "blind hub" assertion that actually exercised RSA-OAEP
  (blindness is structural and has no failing case — relabelled as narration);
  an "effective floor is visible" line asserting only `accepted === true`; and
  the backend-seam byte-identity headline, which is near-vacuous alone and now
  ships with a leg that CAN fail (a 5-day-old replayed swap flips the bit).
- **The wire-byte scanner was scanning one value five ways.** `rawNeedles` held
  five long-form spellings of the swap timestamp, so `{"swapDays":137}`,
  `{"c":"FR"}` (the roaming country VALUE), `{"m":"+990100000099"}` and
  `{"d":"2026-04-02"}` all scored ZERO while the printed line read "no raw value
  in ANY wire artifact". Inventory widened to nine, with a measured split:
  opaque artifacts take the seven long forms, plaintext takes all nine with the
  random hex nonce blanked so the 3-digit day count asserts instead of flaking.
- **Case counts: `m6-check` 28 → 38, `m3-check` 23 → 24.** Both AGENT-RUN;
  **user re-run PENDING**. The PRD's "every count above is from a run on the
  user's own machine" was false the moment M6/M1/M3 landed above it — it was the
  only place in the repo claiming user validation for M6 — and is corrected.
- **Spec sketch: `AttestRequest` closed with `additionalProperties: false`** (the
  outermost layer, which the code closed this round while the sketch left it
  open), and the `value` example no longer shows `"voice+data"`, a `simType`
  floor value left behind when `simType` left the `Predicate` enum.

- **Retracted, visibly: `kyc-match` does NOT "conform as-is because scores are
  already bands".** Measured against the Orange Playground 2026-08-17: a correct
  name returns `{"nameMatch":"true"}` with no score, a wrong name returns
  `nameMatchScore: 53`, and the registered name with **one letter changed**
  returns **97**. That is a similarity *gradient*, not a coarsening — it
  preserves the distance to the answer and lets a requester hill-climb to the
  subscriber's real registered name, which is strictly worse than binary
  guessing. The claim sat in two places in the CAMARA proposal (the §3.3
  adoption checklist and the §3.3.1 illustrative table); both are corrected, the
  old wording left visible with the measurement beside it. The profile's answer:
  threshold in the question off a published coarse menu, comparison
  operator-side, **only the boolean on the wire**.
- **Closed, unfavourably: `sim-swap/v1/retrieve-age-band` does not exist on the
  Playground** — `400 {"code":"BAD_REQUEST","message":"unhandled path"}`. The
  docs carried its availability as UNVERIFIED ("never probed, recorded as
  untested rather than assumed in either direction"); it has now been probed.
  Consequence: band → bucket mapping **cannot be demonstrated live** and stays
  mock-only or documented. The boolean `/check` surface, by contrast, does exist
  and answers on both sim-swap and device-swap, and its `maxAge` cap is now
  boundary-tested (`2400` → 200, `2401` → 400) on both — so `/check` can serve
  `P30D`/`P90D` and cannot express `P180D`/`P365D` at all.
- **Signed off, NOT yet built: the wired predicate set goes 3 → 6.**
  `simSwapAge`, `deviceSwapAge` (new — never one of the original seven),
  `roamingIn`, `presentIn`, `numberMatch`, `reachable` — each backed by an
  endpoint observed answering live. This is the same-day trim's *principle*
  applied to new evidence (wire only what a real fact source answers), not a
  reversal of it. `tenure` and `simType` stay out for a measured reason: the
  data exists operator-side but **no CAMARA read endpoint was found** at either
  `tenure/v1/retrieve` or `sim-tenure/v1/retrieve`. `spec/carrier-attestation.yaml`
  still lists three types — the enum follows the code, never the plan.
  `deviceSwapAge` takes the identical shape to `simSwapAge`; `numberMatch`
  publishes a **60 | 70 | 80 | 90** threshold menu (a free-choice threshold is
  bisectable exactly as the swap date was, and the score gradient makes it
  worse); `presentIn` **refuses** on `location-verification`'s third state
  `PARTIAL` rather than rounding it to yes or no. Five rules apply to all six
  with no exceptions: boolean or refusal; off-menu refused loudly, never
  rounded; unanswerable is a refusal; operator publishes the floor and the
  requester may only tighten; raw values stay operator-side. Recorded in PRD §9;
  the residual probing walk is priced and bounded at the layer above (rate
  limits, per-query billing, the operator's query log) — quantisation caps
  resolution and is not claimed to close the oracle.
- **Recorded: even a predicate-shaped catalog endpoint ships a raw value.**
  Every `location-verification/v1/verify` response carries `lastLocationTime`, an
  exact timestamp, beside its `TRUE`/`FALSE`/`PARTIAL` verdict. "Already
  predicate-shaped" is a statement about the headline field, not the payload.
- **A grounding failure is recorded rather than quietly corrected.** This
  session's orchestrator stated there was "no fact source known" for
  `tenure`/`simType` — while `findings.md` already recorded the Admin data model
  carrying seven axes including `tenure` and `kyc`. The conclusion survives, for
  a different and measured reason; the claim was made without re-reading the
  evidence log, and that is what got written down.
- **M6 built: `poc/demo.mjs`, the one-command reader-facing demo, and
  `poc/m6-check.mjs`, 28 cases. AGENT-RUN 22/22 and 28/28 by exit code; USER
  VALIDATION PENDING, so gate G1 is NOT yet met.** `node poc/demo.mjs` needs no
  credentials and touches no network; `--backend orange` swaps in M5 reading
  `ORANGE_BASIC_AUTH` from the environment and exits **2** with printed
  prerequisites if the credential is absent or the Playground is unreachable —
  never a silent fallback to the mock. Exit 0 only if all 22 assertions hold, 1
  if any fails.
- **Fixed — a crashed mock run was reported as a skipped prerequisite.**
  `main()` mapped ANY mid-run throw to exit 2, but exit 2 means *the chosen
  backend could not run*, and `--backend mock` has no prerequisites at all: no
  credential, no network, nothing that can be unavailable. So a backend that
  STARTED and then threw could only be a code regression, and a CI gate that
  correctly treats 2 as skip-on-prerequisite would have swallowed it in silence.
  Reproduced with a throwing `setBackstory` (exit 2 before, 1 after); mutation-
  proved by case 28, which reds at 27/28 with the fix reverted. Under
  `--backend orange` a mid-run throw stays 2 — an unreachable live operator
  genuinely IS a prerequisite failure. The in-code comment asserted the opposite
  rule and has been corrected. **M6 check: 27 → 28 cases.**
- **The RP nonce store's unbounded growth is now stated** (at the store and in
  the demo's own notes): a request that never receives a response leaves its
  nonce resident forever, and a real deployment evicts on expiry. Documented,
  deliberately not built — the demo would have to fake elapsed time to exercise
  a TTL, and a stated limit beats an untested one.
- **Why the PoC reads a precise SIM-swap date is now written down** where a
  reader hits it (M5 source, CAMARA proposal §2.1, PRD §9): the invariant
  governs the WIRE and the operator legitimately holds the raw value; `/check`
  is unusable for a **measured** reason (its `maxAge` is in hours, capped at
  2400 ≈ 100 days, which cannot express the published `P180D`/`P365D` buckets);
  and `/retrieve-age-band` — the surface that would fit — is provider-optional
  with **availability on the Playground UNVERIFIED, recorded as untested rather
  than assumed.** Documentation only: which endpoint M5 calls is unchanged.
- **Six deviations from the frozen M6 spec are now all recorded**, none left as
  a silent difference. Four were already in the decisions log (the parse-then-
  scan ordering, `findings.md`'s creation, the menu's ordered-thresholds-only
  scope, M3's reason length staying unclamped); the 20 → 22 assertion delta was
  recorded outside §9 and its entry now carries the count its siblings do; the
  three (now four) dependency-injection seams were unrecorded anywhere and have
  a new entry — including the honest note that guard-disabling is a separate,
  deliberately published `controls` seam.
- **The demo prints in plain language**, because it is the surface a CAMARA/AAIF
  reader sees: a `Q:` with the scripted backstory, the `A:` bit, then
  `negative flip → PASS`. Each of PRD §4.1's four assertions is followed by a
  control that disables that ONE guard and shows the same input being accepted —
  a guard never disabled has not been proven load-bearing.
- **The repeated-query oracle, found by the M6 composition spike and only partly
  closed.** Every individual response is a clean windowed bit; the SEQUENCE is
  not. Nine legal, signed, sealed, metered queries binary-searched the
  subscriber's exact swap age (137 days, recovered exactly) with every response
  passing every check. No module is wrong — M3 gates FLOORS, not predicate
  thresholds, and profile rule 1 hands the threshold to the requester. The demo
  operator now publishes a **coarse threshold menu** next to its floor
  (`P30D | P90D | P180D | P365D`) and REFUSES anything off it — refuses, never
  rounds. That CAPS the oracle at the bucket (≈2 bits/year); it does not close
  it, and it is written down as a cap in the CAMARA proposal §3.5 alongside the
  two other mitigations (rate limits + per-query billing, adopted; a
  tighten-only repeat rule, considered and declined — it costs the attacker ~15×
  and still recovers the value).
- **Duplicate-key REQUESTS are refused outright**, using M1's newly exported
  scanner (above): no partial acceptance, and never a pick between the two
  values. **Refusals are SIGNED and nonce-bound** past authentication, so the
  blind hub cannot forge a denial; before authentication they are deliberately
  unsigned, because an operator cannot sign a refusal to a party it cannot name.
- **M6 owns five things no module owns**, each one load-bearing and each one
  pinned: the transport frame `{iss, payload, sig}`; the **injective** canonical
  predicate string (a mutation dropping the threshold left the whole spike green
  while the operator answered `gte P1D` to a `gte P90D` question); the
  single-use nonce store (M1's nonce check is stateless BINDING and says so, so
  replay rejection lives entirely here); the reason clamp (M3 builds reasons
  from wire input unbounded, and M2's `seal()` THROWS above capacity, so an
  unclamped refusal crashes the operator instead of refusing); and the closed
  top-level request field set (below — the fifth was not in the plan, it was
  found by probing the finished file).
- **`poc/m6-check.mjs` is offline in BOTH backend modes.** The `--backend
  orange` seam runs through an injected transport replaying captured Playground
  bytes, and with the keys and the nonce held fixed the two backends produce a
  **byte-identical signed frame** — signature included, since Ed25519 is
  deterministic. That is the strongest form FR5's "only the facts source swaps"
  claim can take. The suite also runs the demo itself and asserts its exit code,
  its 22/22 tally, and **claims discipline**: every mention of zero-knowledge in
  the output must be a negation.
- **The top-level REQUEST field set is CLOSED — a defect found in M6's own code
  by an adversarial probe AFTER it was written and green, not a planned
  feature.** Every layer underneath was already closed (M1's claims, M3's axes,
  M4's predicate fields); the outermost envelope, which no module owns, was not.
  A request carrying `floors` — one letter off — had its floor silently DROPPED:
  `checkFloor` saw no requested floor, applied the operator's own `P90D`, and
  signed an answer while the requester believed it had demanded `P365D`. That is
  silent widening arriving through a spelling mistake — M3's closed-axis
  argument, one level further out. Unknown fields are now refused BY NAME (the
  misspelling is the actionable half), with the name rendered only while short
  and printable so an embedded newline cannot forge a log line. The general
  lesson, recorded in PRD §9: **a closed-set discipline is only as good as its
  outermost layer, and the composition owns a layer none of the modules do.**
- ~~**18 mutations against M6's own guards, 18 killed, 0 survivors**~~ —
  **corrected 2026-08-17.** An independent sweep of **34 meaningful mutations
  found 10 survivors (29% survival)**: the original 18 were self-selected and
  happened to hit only what the suite already pinned. Nine survivors are now
  pinned by new cases (`m6-check` 29–38, `m3-check` 24); the tenth,
  `unpackSigned`'s `Array.isArray`, was **proved redundant** rather than covered
  by a case that could not fail. Left struck through rather than rewritten,
  because a retracted measurement is worth more than a corrected one. See
  `docs/01-product/findings.md` 2026-08-17.
- **Spec sketch `Predicate` enum trimmed 7 → 3.**
  `spec/carrier-attestation.yaml` now lists only what the PoC wires end to end —
  `simSwapAge`, `roamingIn`, `reachable` (the boolean `value` branch stays;
  `reachable` needs it and the reference module rejects the string spelling).
  `tenure`, `simType`, `presentIn` and `numberMatch` were aspirational entries
  in an illustrative artifact: nothing computes them, so a reader could send a
  schema-valid request the reference operator refuses. They move to a
  **future-work note** in the CAMARA proposal §3.3.1 rather than being deleted —
  `tenure` and `simType` are still FLOOR axes, `presentIn` is
  location-verification's existing shape, `numberMatch` is
  number-verification's `/verify` which conforms today, and `tenure` carries the
  unresolved MNP question the trim declines to ship as settled. The **normative**
  profile enumerates no predicate types, so nothing normative moved.
- **M1 exports its duplicate-top-level-key scanner
  (`hasDuplicateTopLevelKey`).** A signed REQUEST is signed bytes too, and the
  equivocation is symmetric: one signature over bytes carrying `floor` twice
  lets the operator enforce `P90D` while the requester believes it demanded
  `P365D`. Verifying a request cannot reuse `verifyAttestation` (that demands
  the closed ANSWER set `{predicate, result, nonce, exp}`), so M6 borrows the
  byte-level scan rather than keeping a second, divergent copy of it — the copy
  that would face the wire first. The export carries a stated precondition (the
  text must already have parsed as JSON) and M6 calls it in M1's own order:
  signature → parse → scan. **M1's declared case count 19 → 20** (the new case
  pins the bare function directly, including a duplicated `floor` in a
  request-shaped payload, and that a depth-2 duplicate is not a top-level one).
- **M3 fix point closed: `checkFloor` no longer throws on wire input.** The
  rejection-message builder rendered the offending value with `JSON.stringify`,
  which THROWS on a BigInt and RUNS a caller-supplied `toJSON` — either way a
  bare `TypeError` escaped `checkFloor` and replaced the module's loud
  named-input rejection, breaking "wire input never throws" *in the rejection
  path itself*. Found by the M6 composition spike and recorded there as
  OBSERVED-not-fixed; fixed here. The renderer now invokes nothing
  caller-supplied (M4's post-release-gate `describe()` shape), and keeps the
  `[unrenderable]` floor because `Array.isArray` itself throws on a revoked
  Proxy. Neither shape survives a JSON round trip, so the envelope's transit is
  what kept this unreachable in the demo — a transport accident, not a contract.
  **M3's declared case count 22 → 23**; every previously pinned reason string is
  byte-identical.

## 0.3.0 — 2026-08-17

- **M5 (live Orange facts adapter) built under the §4.4 ladder —
  user-validated 48/48 offline + 11/11 LIVE at `8e842c3`, the shipped state,
  which MEETS gate G2 (`G2 = M5 user-validated live`) with no asterisk and
  nothing pending. M5's G2 is the first G2 in the project — first met at
  `69b6f2e` (47/47 + 11/11), re-established at `4ac60e9`, and re-closed at
  `8e842c3` after the post-gate review round below changed all three M5
  files. Each round of fixes re-opened the gate and each was closed by a run,
  never by assuming an earlier run carried over.**
  `poc/m5-facts-orange.mjs` exports `createOrangeFacts` and nothing else —
  `evaluatePredicate` is deliberately NOT reimplemented, so the M4 split
  (raw facts operator-side; one closed-answer evaluation step facing the wire)
  is what makes the backend a drop-in swap rather than a second code path.
- **The spike re-ran every recorded Playground finding before a line was
  written** — they were measured on 2026-08-14/15 and a sandbox can move.
  **Seven held, three changed.** (1) `403 FORBIDDEN` no longer means "unknown
  number" on its own — a wrong-surface token returns the same status with a
  different body, so the adapter now splits the two by body text rather than
  status. (2) Sim-swap is no longer the whole interface: roaming AND
  reachability are both live, so **all three axes are wired to real endpoints
  and nothing is faked**. (3) THE TRAP holds with a sharper mechanism — a bare
  `UPDATE` on an unclaimed built-in now fails loud with `400`, but the
  adapter's own CREATE-then-UPDATE path reproduces the echo-lies behaviour
  exactly: the echo carried the written date, the next READ did not. The spike
  also found the stored credential is **already `Basic `-prefixed** — a
  double-prefix that fails both token endpoints, and it cost the spike's first
  round.
- **READ-after-write is load-bearing, not belt-and-braces.** Because a write
  can be echoed back and silently discarded, every backstory write is verified
  by a subsequent READ; the mismatch path produces the module's loudest
  diagnostic. Two separate review findings landed on that one message, which is
  what a load-bearing guard attracts.
- **`null`-vs-absent roaming semantics are distinguished, not collapsed.** A
  device that is not roaming returns the key **PRESENT and `null`**; an
  unavailable axis returns the key **ABSENT**. The first is a real answer
  (`answered:false` for a country predicate, because there is no country), the
  second is a refusal (`fact unavailable: roamingCountry`). Collapsing them
  would turn "we cannot know" into a signed bit.
- **Three-layer redaction** over everything that can reach a diagnostic: exact
  known-secret match, pattern match, and a length clamp — composed in an order
  that matters (a string is redacted BEFORE it is clamped, or a clamp leaves an
  unmatched FRAGMENT of the credential printed).
- **Offline suite runs on a clean clone: 48 cases, zero credentials, zero
  network** — an injected transport replays bytes captured live, so the fixture
  can still show the negative. **Live suite: 11 cases with quota hygiene** — it
  consumes and returns one of the app's 10 custom slots, reclaims the slot
  BEFORE consuming it (so an interrupted run does not leak one), prints the
  count at both ends, and case 11 asserts it came back.
- **Adversarial review round: 3 confirmed issues, all fixed (44 → 47 offline,
  10 → 11 live).** Found by an independent 30-case check written from the spec
  BEFORE either shipped suite was opened, plus an independent 16-mutant sweep.
  (1) The write-verification diagnostic — the message the module's most
  load-bearing guard produces — was the **single throw path that skipped
  `redact()`**, leaking a planted credential half and a planted bearer token,
  and it clamped AFTER serializing (measured **2354ms** on a 2e8-char value,
  and a `RangeError` at V8's max string length that destroyed the loud message
  entirely). (2) A required mutant **SURVIVED**: "one token per surface" was
  unpinned because the check answered both token endpoints with the same
  fixture, though the two are measured non-interchangeable. (3) The live
  check's cleanup DELETE was unobserved, so an interrupted run leaked a slot
  toward the 10-cap silently. 18/18 mutants killed after the fixes; a
  315-combination leak fuzz with a planted-leak control is clean.
- **Release gate: five more findings, two of them real code defects (47 → 48
  offline).** `/security` returned 0 Critical / 0 High / 0 Medium; `/diff-review`
  returned "with fixes". Each was reproduced against the unfixed tree first.
  (1) **The stored country list was COERCED while being joined** —
  `Array.prototype.join` calls `String()` on every element, so a JSON-parsed
  `{"toString":"x"}` threw a bare **40-char `TypeError`** from the line that
  BUILDS the write-verify comparison, replacing the module's loudest guard
  before it could run (the benign control gave the correct **418-char**
  message). Closed by `joinStored()`. This is a direct sibling of the defect the
  previous round closed 30 lines below, in the RENDER of the same diagnostic —
  the render was guarded, the line feeding it was not. (2) **The live quota
  assertion used a baseline taken before the CUSTOM slot existed**, so a FRESH
  account's first run went red and blamed the trap case's cleanup, which had in
  fact succeeded — reproduced live at `start=0 end=1`, exit 1, with
  `cleanup DELETE status=204` printed alongside. Fixed by making the baseline
  deterministic rather than by loosening the assertion. Three were docs-honesty
  defects: the CAMARA proposal's catalog table **showed a response shape M1
  REJECTS** under a sentence claiming the PoC produced it (corrected to the real
  envelope, overclaim replaced, retraction left visible); two rows sat outside
  the §11 verified baseline (marked `†` with provenance); and a mutant count
  contradicted itself (18 was the POST-fix total, the pre-fix sweep was 15/16).
- **The three `/security` Lows were all confirmed and fixed**, each trivial and
  local: `await res.text()` sat OUTSIDE the try that redacts (a stream dying
  mid-response rejects there, so its message escaped unredacted) — now inside;
  the client-id pattern's `\S{0,80}` bound was **tighter than the thing it
  masks**, so an over-long identifier had its first 80 characters redacted and
  the REMAINDER printed — worse than not matching — now **256**, re-checked at
  1ms on a 200k-char pathological input to keep the ReDoS property. Operator-side
  timestamps in diagnostics were judged NOT a breach and deliberately left (they
  are operator-side by construction, never wire-reachable).
- **Both release-gate code fixes are mutation-proven**, restores byte-identical
  by sha256: reverting `joinStored` takes the offline suite to exit **1** (47/48,
  case 48 only) and restoring it to exit **0**; reverting the quota baseline on a
  freshly-emptied account takes the LIVE suite to exit **1** (10/11,
  `start=0 end=1`) and restoring it to exit **0** on the identical condition.
  A 110-run flake sweep across all five offline suites returned **0 non-zero
  exits**, and the credential was confirmed absent from the working tree and
  from all 35 commits of history by literal-value match.
- **A catalog-mapping table was added to the CAMARA proposal, labelled
  illustrative.** It maps the profile onto the existing catalog surfaces; the
  PoC produces the ENVELOPE, while the predicate spellings are illustrative and
  the PoC answers three axes, not nine. That distinction is stated in the
  document rather than left for a reviewer to find.
- **Ladder status: M1–M5 user-validated at their current case counts on the
  shipped tree — no module carries an asterisk.** M1 19/19, M2 10/10, M3 22/22,
  M4 33/33, M5 48/48 offline + 11/11 live. M5's G2 was first met at `69b6f2e`
  (47/47 + 11/11), RE-OPENED when the release gate's fixes touched all three M5
  files and re-established by a user run at `4ac60e9`, then RE-OPENED again by
  the post-gate review round below and re-closed by a user run at `8e842c3` —
  the shipped state. Each gap was closed by a run rather than assumed to carry
  over. An earlier 44/44 + 10/10 user run at `2fd62ba`, undated at the time, is
  recorded in the findings log for completeness. **M6 not started**, and
  `poc/demo.mjs` does not exist yet.
- **Post-gate code review round (2026-08-17): two more adapter defects, both
  redaction-order siblings, plus a third adjudicated after the round and three
  live-check hardenings — counts unchanged (48 offline / 11 live). This
  RE-OPENED G2, and the user re-ran the two-line runbook on the fixed tree the
  same day and reported both clean, re-closing it at `8e842c3`.** (1) `joinStored()`
  clamped stored `countryName` strings to 48 chars BEFORE `redact()` ever saw
  them — the exact clamp-before-redact fragment leak the `show()` comment
  warns about, one step upstream of it: a >48-char credential echoed inside
  `countryName` rode a 48-char un-redactable fragment into the write-verify
  diagnostic (reproduced red: fragment printed, no `[REDACTED]`; green after
  redact-first — the 44-char fixture secret planted in the sim axis could
  never catch it). (2) `tokenFor()`'s `await res.text()` sat OUTSIDE the try
  that redacts — the same /security Low fixed in `post()`'s send survived at
  this sibling site; a token stream dying mid-body escaped unredacted
  (reproduced: planted secret printed raw; wrapped and redacted after). (3)
  Adjudicated after the round rather than during it: `assertNow()` admitted a
  safe integer past `Date`'s representable range, so `9e15` cleared every check
  and then `toISOString()` threw a bare `RangeError: Invalid time value` — the
  same opaque-error-replaces-the-loud-one class — now bounded at `MAX_EPOCH_MS`
  (mutation-proven, no suite case added, 48/48 unchanged).
  Live-check hardenings: the raw admin token bootstrap now checks status and
  token shape before caching (a 401 JSON body used to cache
  `access_token: undefined`, and `undefined === null` never refetches — every
  later call sent `Bearer undefined` and case 11 blamed QUOTA for an AUTH
  fault; a non-JSON body threw a raw SyntaxError quoting the wire body); the
  courtesy re-script after case 11 is guarded (a transient failure there
  killed an all-green run before the tally printed); and case 11 no longer
  conjoins `endSlots < QUOTA_CAP` (at-cap is a separate warning, not a red
  blaming a cleanup that succeeded). Comment fixes: case 48's "three legs" now
  says four (it asserts four); the root README status lists all five modules.
- **Open items carried, not cleaned up.** M3 still carries the `describe`-throw
  class on its untrusted-side path (`checkFloor` with a BigInt throws a raw
  TypeError) — pre-existing, fails closed, and deliberately not retrofitted
  because it means touching a user-validated module; **M6 is the declared fix
  point**. The spec sketch still lists predicate types the PoC does not wire
  (seven listed, three answered), with **M6 as the declared wire-or-trim
  point** — restated because a schema looser than the implementation is exactly
  the silent-widening shape the profile exists to forbid.

## 0.2.0 — 2026-08-16

- **M4 (mock facts adapter) built under the §4.4 ladder — user-validated
  30/30 at `5d5e8aa`.** `poc/m4-facts-mock.mjs`: one facts interface with a
  scriptable per-number backstory store mirroring the Playground admin model
  (swap date, roaming country, reachability), an INJECTED clock (no ambient
  `Date.now()` — a fixture that cannot be moved cannot show the negative), and
  a hard split between `getFacts()` (raw facts, operator side only) and
  `evaluatePredicate()` (the only step that may face the wire — it never
  throws, and its success shape carries the boolean and NOTHING else). That
  split is what makes M5 a drop-in: the backend swaps the facts source, the
  evaluation step is unchanged. Closed sets everywhere and NO defaults: an
  unknown predicate type, an unknown axis, a non-canonical country, a negative
  age or a missing fact is `answered:false` — never a silent `false` bit that
  reads as a real answer.
- **The spike measured six fail-opens in the naive adapter before any code was
  written** — headline: a missing fact compared against a threshold yields a
  confident `false` and gets SIGNED (the negative control flips it, so the
  fixture can show both). All 13 spike claims were reproduced against the built
  module.
- **Adversarial review round: 1 real defect + 5 unpinned guards (24 → 30
  cases).** An independent 19-case check written from the spec alone (before
  reading the suite) plus an independent 28-mutant sweep left EIGHT survivors.
  Fixed: `describe()` could throw on hostile input, breaking "wire input never
  throws" — so M3's release-gate open item 1 was only partially closed. Five
  load-bearing guards had no case that could catch their regression; two
  shared-harness fail-opens were closed with them (a truthy-non-boolean
  `extra.ok` reading as a pass, and a silently shrinking suite printing a
  smaller green tally — every suite now declares its case count,
  `conclude(19|10|22|33)`, and exits 1 with `FAIL CASE COUNT`). 200k-round leak
  fuzz clean.
- **`/code-review medium` round on PR #4: 8 findings, all confirmed by
  execution, all fixed.** Nothing was accepted on argument — each was reproduced
  against the unfixed file and re-probed after. The headline: wire-supplied
  country-set arrays ran CALLER-CONTROLLED code three ways, one of them past
  every gate — a sparse `new Array(5)` made the empty-set gate see length 5 and
  `every` vacuously true, producing a SIGNED `{answered:true, result:false}`
  answer to the malformed question case 17 exists to refuse. Closed by an
  index-walked defensive copy inside `try/catch` with a `MAX_COUNTRIES = 300`
  cap. Also: a revoked Proxy escaping `plainSnapshot`, two unclamped
  diagnostics, an unbounded `describe()` input, and a green last line printed on
  a failing run.
- **Release gate: 3 more fail-opens, one of them process-fatal (30 → 33
  cases).** `/security` and `/diff-review` ran as independent passes over the
  release diff and found three defects of one shape — **wire-reachable work no
  cap actually bounded** — each defeating a guard the module explicitly claimed,
  and none catchable by the 30 existing cases. (1) `countrySet()` re-read
  `v.length` every iteration, so the 300-cap was a time-of-check/time-of-use
  window: measured, the cap was tested against **2**, the loop then walked
  **5,000,000 indices in 6.5s**, and the predicate returned **`{answered:true}`**
  — an answer built from a set the cap exists to refuse. (2) `describe()`'s
  guarded fallback chain could **kill the process**: a ~40-byte predicate whose
  `toJSON` returned `'x'.repeat(3e8)` produced a fatal OOM inside V8's
  `JsonStringifier` — **exit 134, SIGABRT** — because *a try/catch bounds a
  throw, not an allocation*, and a dead process cannot return
  `{answered:false}`. (3) The input bound covered only top-level values: the
  same 50MB string cost **657ms nested** vs **83ms** at top level. Fixed by one
  decision rather than three patches — **the renderer now invokes nothing
  caller-supplied**: primitives render directly, arrays render ≤16 elements one
  level deep, and an object is described by its KEY NAMES via
  `getOwnPropertyNames`, which reads no accessor and calls no hook. Post-fix
  657ms → 77.7ms and 527ms → 2.2ms. Four mutations, each red on exactly its own
  new case and each restored byte-identical — including the guard-off negative
  control that matters: **with the mutation the OOM probe exits 134, without it
  exits 0**.
- **Two pinned diagnostics changed, deliberately, and are recorded as such** —
  a circular object now renders `{self}` instead of `[object Object]`, and case
  25's hostile object `{self, toString, valueOf}` instead of `[unrenderable]`.
  Both old spellings were products of the caller-invoking fallbacks that were
  removed; `[unrenderable]` survives as the floor and is still pinned, by the
  one shape that genuinely cannot be enumerated (a revoked Proxy). The claim
  "the input is bounded first" from the review round is **visibly retracted** in
  `findings.md` rather than edited away.
- **Spec sketch: `reachable` minted into the `Predicate` enum and a boolean
  value branch added.** The reference module rejects the string spelling
  (`"true"`), so without the branch no `reachable` request could be both
  schema-valid and answerable — a self-contradicting sketch. Illustrative only;
  no normative surface enumerates predicate types.
- **Ladder status: M1–M4 all built; M1/M2/M3 user-validated at the current tree
  state.** The user re-ran all four suites at `5d5e8aa`: 19/19, 10/10, 22/22,
  30/30 — closing every re-run marker 0.1.0 carried. The release-gate fixes
  landed after that run and touched only `poc/m4-facts-mock.mjs` and
  `poc/m4-check.mjs`, so **M4's 33/33 is agent-run and a user re-run is
  pending** (the 0.1.0 precedent); M1/M2/M3 are untouched and stand. M5–M6 not
  started.
- **Open items carried, not cleaned up.** M3 still carries the `describe`-throw
  class on its untrusted-side path (`checkFloor` with a BigInt throws a raw
  TypeError) — pre-existing, fails closed, and deliberately not retrofitted
  because it means touching a user-validated module. The spec sketch remains
  looser than the reference module (seven predicate types listed, three
  answered; `operator` optional in the schema, mandatory in the code), with
  **M6 as the declared reconcile point** — restated because a schema looser
  than the implementation is exactly the silent-widening shape the profile
  forbids.

## 0.1.0 — 2026-08-15

- **M3 (floor gate) built under the §4.4 ladder — user-validated 14/14.**
  `poc/m3-floor.mjs`: `checkFloor(published, requested)` — pure logic, zero
  deps; closed 4-axis set (simType/tenureMin/swapAgeMin/class); strict
  `P<n>D`/`P<n>Y` durations (1Y = 365D stated; months rejected as ambiguous
  — user decision); no coercion (spike: `parseInt('3M')===3`,
  `Number(null)===0` would admit every request); unknown/typo'd axis =
  closed-set rejection (an ignored typo silently drops a constraint);
  omitted axis inherits the published floor, visible via the returned
  `effective`; broken PUBLISHED config throws loud, wire input never
  throws. `poc/m3-check.mjs`: 17 cases negatives-first (14 at build + 3
  review-round canaries). Mutation-proven: 5 mutants killed (rejection
  disabled / unknown-axes ignored / string compare / 360-day year /
  null-floor branch); check hardened to fail-clean (`?.`) after one mutant
  first died as a stack trace — the M2 "no RESULT line" lesson re-applied.
- **M3 review round (opus, adversarial + 200k-iteration differential fuzz
  vs an independent BigInt oracle — 36,452 allow-verdicts, 0 violations on
  wire-shaped input): 7 warnings fixed.** Non-plain published config (a
  prototype chain or a flip-flopping getter) could slip past validation and
  fail OPEN — closed by rejecting non-plain-prototype configs loud + a
  own-props snapshot before validation (validate and compare now see the
  same data); duration compare gained an explicit null guard (defense in
  depth — `r < null` coerces to `r < 0` = allowed); day counts past 2^53
  rejected (`Number()` can collapse strict-less into equal there, which
  strict `<` reads as not-below); the declared 1Y=365D constant and the
  null/absent-floor "wire never throws" branch each gained a
  mutation-proven canary case; two doc lines the code contradicted
  corrected (poc/README module status; findings.md 2^53 wording).
- **M3 review round 2: 8 findings (harness verdict guard, a `checkThrows`
  helper for the hand-rolled expect-throw cases, non-enumerable /
  non-plain-prototype closures on BOTH the operator and the wire side, an
  enum-mismatch guard, the rule-5 profile + spec sync, and the docs-honesty
  rewording below).** Two in-process fail-opens closed: a non-enumerable
  published axis passed the prototype check but vanished in the spread
  (intended constraint silently unenforced), and a request floor carrying
  its axes on the prototype came back ALLOWED with the demanded constraint
  silently dropped — both now mutation-proven by check cases 18 and 19
  (19 cases at that point). The three signed-off M3 rules (closed axis set,
  `P<n>D`/`P<n>Y` only with 1Y = 365D, numeric-not-lexicographic compare)
  reached the normative text at proposal rule 5 and the spec's Floor schema.
- **M3 release round: three unpinned guards closed (19 → 22 cases).** A
  release-gate mutation sweep found three *already-fixed* fail-opens with no
  case that could catch their regression — mutants removing them survived
  19/19 exit 0. Cases 18/19 pinned only one diagonal of
  {published,requested} × {prototype,non-enumerable}; the other diagonal and
  the 2^53 guard were uncovered. Added case 20 (published floor on a
  prototype throws — the mutant admitted a P1D request against a P90D floor
  with the operator's ENTIRE floor unenforced), case 21 (request carrying a
  demanded axis as a non-enumerable own prop rejects `malformed floor`, not
  ALLOWED-with-constraint-dropped), and case 22 (day counts past 2^53 —
  wire side rejects, operator side fails loud). Each mutation-proven: guard
  removed → that case alone red at 21/22 exit 1, restored → 22/22 exit 0.
  Two independent differential fuzzes against BigInt oracles written from
  the rule (not the code) — 200k and 300k iterations, ~156k allow-verdicts —
  found **0 monotonicity violations**, with a rejection-disabled negative
  control producing 6,200 violations (the fuzz can fail). Non-blocking items
  left open and recorded in `findings.md`, not fixed here: an untrusted-side
  `JSON.stringify` that can throw on BigInt/circular/throwing-`toJSON`
  (unreachable via the current `JSON.parse` path, fails closed), an
  unescaped key in one rejection reason (log injection), an unbounded reason
  echo, and the spec `pattern` lacking a magnitude bound.
  **User runs of this final 22/22 (M3), 19/19 (M1) and 10/10 (M2) state are
  pending at merge time** — those counts are agent-run. The standing
  user-validated M3 record remains 14/14 on the pre-review build.

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

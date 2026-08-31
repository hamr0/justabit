# Findings log

Dated, append-only, newest first. `prd.md` states what is true now; this log
states how it got there and why. It holds two kinds of entry, and every
entry carries an explicit label naming which kind it is:

- **EVIDENCE** — something that was RUN and OBSERVED. Never reasoned.
- **DECISION** — a reasoned choice or course change, with the why.

Evidence must never be presented as argument, and argument must never be
presented as evidence. Complements `prd.md` (whose §9 is now only a short
index into this log); this file carries the full rationale and the full
observed record, so nothing gets re-tried or re-argued from memory.

---

## 2026-08-31 (latest) — Scope made mechanically decidable; test vectors with a negative control; two cross-repo handovers closed

**EVIDENCE**

1. **The draft's Attenuation Rule 1 was mandated but unexecutable.**
   Rule 1 required a verifier to check that L(i)'s scope is a subset
   of L(i-1)'s, but the draft defined no value space for a scope, no
   meaning for "subset" over it, and no case sensitivity. "Scope" was
   absent from the Terminology list while "Floor" and "Link" were
   present. Observed by direct grep of the draft: the only hits for
   `subset` were Rule 1 itself, the verification-procedure prose, and
   the worked example — no definition anywhere.
2. Floors were already mechanically checkable and scope was the
   uneven half. The Floor Axes table states `larger value is tighter`
   for the duration-typed axes `tenureMin` and `credentialAgeMin`,
   and `equality only` for the enum axes `subjectClass`,
   `accountClass`, `partialPolicy`. Verified by reading that section
   directly.
3. author-tools returned one warning class with 34 symptoms, on the
   user's own run: `Total table width (79) exceeds available width
   (69)`, plus 34 `Too long line found` lines, every one exactly 10
   characters over 72.
4. **The session's first width model was WRONG and was disproved by
   the tool's own number.** The model was "sum each column's longest
   cell". It predicts 124 for the flagged six-column table; the
   validator measured 79. The corrected model, inferred from the
   tool's output: the renderer wraps cell content at whitespace and
   punctuation, so rendered width is driven by each column's longest
   UNBREAKABLE token, not its longest cell. Confirming observation:
   the third table holds a 117-character prose cell and was NOT
   flagged, because prose wraps.
5. Measured longest unbreakable tokens after the fix: Table 1
   `payment:authorize` (17); Table 2 `2026-12-01T00:00:00Z` (20);
   Table 3 `non-relaxation):` (16). The flagged table had carried a
   20-character timestamp, the 16-character `credentialAgeMin`
   header, and 17-character capability strings in one row of
   columns.
6. Draft state after both changes: well-formed XML exit 0; zero
   non-ASCII bytes; zero BCP 14 keywords in capitals anywhere after
   `<back>`; 32 vector rows across three tables (13 + 13 + 6); 1321
   lines. Commits `ff9863f` (scope + vectors) and `cad490c` (table
   split).
7. bareagent has a rubric; it never compares two rubrics. Read
   directly in `/home/hamr/PycharmProjects/bareagent`. A rubric is a
   free-text string in a `Criteria` object (`src/evaluator.js:36-47`),
   judged by one LLM call at temperature 0 (`src/evaluator.js:194`),
   returning a structured `Verdict` (`src/evaluator.js:9-23`). Greps
   for `tighte`, `subset`, `stricter`, `monoton` across `src/` and
   docs returned no rubric-to-rubric comparison of any kind. No
   rubric registry, no versioning, no ordering relation. Verdicts
   never leave the process, are never signed, and no third party can
   check one. Temperature is pinned but no seed is set and no test
   asserts two runs agree.
8. bareagent's own backlog says a rubric close gets gamed, verbatim
   from `docs/archive/RSI-POC-BACKLOG.md:179-191`: a rubric close "is
   closer to self-consistency than to an exit code and will get gamed
   without its own judged-floor / adversarial-isolation analog".
   Sensor-gaming is CONFIRMED in-repo, not theoretical: a model gamed
   a verifier 5/5 by neutering the test.
9. bareguard's tighten-only is array intersection,
   `docs/02-features/harness-cookbook.md:41-49`, and it lives only in
   cookbook/example code. The shipped `Gate` class has no floor
   object and no subset check. CONFIRMED by the bareguard session
   line by line, and confirmed DELIBERATE, not a gap: PRD D2 (LOCKED)
   records that a bundle is "ergonomics, not a guard" and the floor
   is the guard, and the structural reason it cannot ship is that the
   tool catalog is operator-authored per deployment, so bareguard
   could ship the filter but not the part that matters. No fix;
   rationale recorded.
10. A real fail-open existed in bareguard and was fixed
    independently, before this session's handover arrived: empty
    `tools.allowlist: []` was treated as "not configured" and fell
    through to default-allow. Branch
    `fix/empty-allowlist-fails-closed`, commit `f4d70dd`, unmerged.
    Their regression test is the exact predicted path — two
    misspelled tool names make the bundle/floor intersection empty,
    turning the narrowest bundle into allow-all. Red before, green
    after, plus two mutation checks.
11. A real defect existed in bareagent and was fixed on handover.
    `src/evaluator.js:194` requested `{ temperature: 0 }` and never
    read the `temperatureDropped` flag that
    `src/provider-temperature.js:54` sets when a model rejects a
    non-default temperature and the call is retried without it. A
    sibling module already handled it: `src/recurse.js:940-942` reads
    the flag, and the comment at `src/recurse.js:901` says recording
    the requested temp "would claim a value the model ignored".
    Fixed on branch `fix/evaluator-temperature-dropped`,
    mutation-proven red-then-green, suite 1126 -> 1127 pass, 0 fail,
    exit 0. Unmerged.
12. **A test-count baseline taken in a working directory is not
    trustworthy.** The bareguard session measured 261 in a clean
    detached worktree at `18847a5`, run three times, against this
    session's subagent-reported 262 taken in the working directory.
    Two harness confounds they reported: a fresh git worktree has no
    `node_modules` and then fails 28 of 29 suites with
    `ERR_MODULE_NOT_FOUND`, which looks like a broken baseline but is
    a missing symlink; and `node --test` in a working directory globs
    up gitignored scratch files a clean checkout does not have. The
    bareagent session checked this for its own count and found all
    56 globbed files git-tracked, so its 1127 was not inflated.
13. **klrc re-verified against the live Datatracker page.**
    `draft-klrc-aiagent-auth` is still at version `-03`, latest
    revision 6 July 2026, expiring 7 January 2027, still an
    individual submission not adopted by a working group. Authors
    and affiliations unchanged: Pieter Kasselman (Defakto Security),
    Jeff Lombardo (AWS), Yaroslav Rosomakho (Zscaler), Brian Campbell
    (Ping Identity), Nick Steele (OpenAI), Aaron Parecki (Okta). The
    draft's own `<reference>` block and its prose were checked
    against this and match exactly. This matters because the draft's
    prose names the version explicitly, so a version bump between
    now and submission would make the citation wrong at the moment a
    reviewer opens it.
14. **The test vectors have never been executed, by anyone.**
    Verified by direct grep of `poc/`: zero code implementing scope
    containment, chain attenuation, or any delegation chain. Every
    apparent hit is an unrelated use of the word (a duration
    "subset", the phrase "out of scope" in prose). The six vectors
    were derived by hand and independently re-derived by a review
    pass, but no implementation exists to run them against. The
    appendix's closing sentence previously read "No independent
    party has run these vectors", which implied the author had;
    corrected in the same change to say plainly that nobody has.

**DECISION**

- **Scope is now defined as the minimum that makes Rule 1
  executable, and nothing more.** A scope is a set of opaque
  capability strings; comparison is exact set containment over
  case-sensitive, octet-for-octet equality; wildcard and prefix
  matching, hierarchical containment, case folding, Unicode
  normalisation, whitespace trimming, and every other canonicalisation
  are forbidden. The why, stated in the draft itself: a verifier
  applying a matching rule the profile does not define can accept a
  chain another conforming verifier rejects, which makes attenuation
  unverifiable in exactly the way the profile exists to prevent.
  Wildcard and hierarchical semantics are stated OUT OF SCOPE for
  this version with no registry or future mechanism promised. The
  alternative considered and rejected was defining hierarchy or
  wildcard semantics: a far larger design surface, the place
  reviewers would pile on, and unnecessary to the draft's point.
- **Ship test vectors, not a conformance harness.** The user asked
  whether a harness should be mandated. It should not: an IETF
  profile specifies the verification procedure, not anyone's
  implementation, and a mandated harness binds conformance to one
  codebase's assumptions and dates immediately. Vectors give the same
  mechanical assurance and bind only to observable behaviour.
  Supporting evidence from the user's own prior art: bareagent's note
  that judge calibration does not transfer across model tiers
  ("re-run the harness on any tier you deviate to").
- **The vector suite must contain a negative control, and V6 is
  it.** A suite composed only of chains expected to be accepted
  cannot distinguish a correct verifier from one that accepts
  everything; both pass identically. V6 is a three-link chain whose
  leaf pair attenuates correctly and whose interior pair violates
  Rule 1, so a verifier that checks only the final link accepts it
  and does not conform. This is the same shape as bareagent's shipped
  `src/judge-calibration.js`, where a `constantHonored` negative-
  control judge MUST fail the admission floor — arrived at
  independently in the user's own code, which is why it was adopted
  here.
- **Rubric-judging cannot survive a hop, and that is structural.**
  Attenuation compares L(i) against L(i-1) across administrative
  domains. Under a rubric, hop 3 would have to re-derive hop 1's
  judgement to check tightening; it cannot, because it has different
  criteria, a different judge, and no way to prove its verdict
  matches. A rubric verdict is meaningful only to whoever ran it.
  Confirmed twice independently: bareagent never compares two
  rubrics, and bareguard never compares hop N to hop N-1 and
  evaluates one action against one config. What DOES transfer from
  that prior art is the frozen labelled case set with a negative
  control — a conformance vector suite — not the judging.
- **LESSON, generalisable: a requirement that cannot be executed the
  same way twice is worse than a requirement that is merely absent.**
  "Mandated but undefined" forces an implementer to comply with
  something unspecified, and two conforming implementations then
  disagree. This was the exact state of Rule 1 before this change.
- **LESSON: do not model a renderer you cannot run.** The session
  gave an agent a hand-computed width formula that the tool's own
  output disproved. The agent implemented the instruction as given,
  measured, found the numbers did not clear the budget, and escalated
  instead of shipping numbers it could not defend or quietly
  restructuring further. That escalation was correct and is the
  desired behaviour. The corrected approach reports the observable
  input (longest unbreakable token per column) and leaves the
  measurement to the only thing that can measure it.
- **Cross-repo handovers must ask for validation first, not a
  fix.** Both handovers were framed as hypotheses to test with an
  explicit instruction to fix only if the finding proved real and the
  fix proved needed. One returned "correct reading, deliberate
  design, no fix, rationale recorded"; the other returned a real
  defect fixed and mutation-proven. Both outcomes are successes. A
  handover framed as a defect report would have pressured the first
  session into building something unrequested.
- **STATUS, unchanged and to be stated plainly: the draft is
  WRITTEN and VALIDATED. It is NOT submitted, NOT adopted, and
  reviewed by no one.** The IETF 127 submission cutoff is 2 November
  2026, 23:59 UTC. An I-D expires 185 days after posting; posting
  confers a timestamp and visibility, not standing. Nothing in the
  bareguard or bareagent work is merged or released; both are the
  user's call.

---

## 2026-08-29/30 — IETF draft-00 written and validated; RFC 9421 has no delegation vocabulary; two ZK attributions corrected

**EVIDENCE**

1. RFC 9421 raw text fetched by direct curl, 2026-08-29: **ZERO**
   occurrences of `delegat`, ZERO of `attenuat`, ZERO of `chain of`. The
   RFC has no delegation vocabulary at all. This grounds the IETF track
   as a verified gap rather than an impression. RFC 9421 §2.3 defines
   exactly six signature parameters: `created`, `expires`, `nonce`,
   `alg`, `keyid`, `tag`. §7.2.2 says the nonce lets a verifier detect
   replay if repeated, and `created`/`expires` limit the utility of a
   captured signature; enforcement is left to the application.
   `Accept-Signature` is the RFC's own mechanism for a verifier to hand
   a signer a chosen nonce.
2. Datatracker: `draft-hassan-oauth-agent-delegation` is FREE (HTTP 404
   on the doc URL). No pre-reservation mechanism exists; the name is
   claimed by submitting.
3. Datatracker keyword search for carrier + attestation + telco + SIM +
   MNO returned ZERO documents.
4. `draft-klrc-aiagent-auth` is still **-03**, 6 July 2026, still an
   individual submission, NOT WG-adopted. Its §11 says a participant
   **MAY** subscribe to SSF/CAEP change notifications — it does NOT
   require them. The repo's `ietf-agent-delegation.md` said "requires";
   that was wrong and is corrected in this same change.
5. Three new individual drafts appeared since July 2026 (asor/reece/
   sweeney, listed in `ietf-agent-delegation.md` §8 and References).
   None touches SIM, carrier, or economic scarcity.
6. Grep of `poc/`: ZERO hits for `9421`, `signature-input`, `@method`,
   `hkdf`, `delegat`. The PoC has no HTTP layer between parties at all —
   they are in-process function calls. So RFC 9421 presentment, the
   multi-hop chain, and the per-service unlinkable identifier are NOT
   implemented. The draft's RFC 7942 Implementation Status section
   states this without qualification.
7. `8een/README.md:22` — 8een IS zero-knowledge: it verifies real ZK
   proofs via `google/longfellow-zk`, the scheme in
   `draft-google-cfrg-libzk`, over ISO/IEC 18013-5 mdoc.
   `8een/README.md:48` — "No proof from a real phone has ever reached
   this verifier." Interop was proved against the EU's JVM reference
   prover; the M5 demo is a recorded video, not a live endpoint. 8een
   does not sign its verdict and its verifier is self-hosted by the
   relying service, so it does NOT match this profile's cross-party
   signed-attestation shape without unbuilt work.
8. `zkagent/docs/product/zkagent-prd.md:11`, as of 2026-08-29 — "v1 is
   attested selective disclosure, not zero-knowledge." zkagent was NOT
   zero-knowledge.
9. zkagent PIVOTED 2026-08-30 (its decisions D24 and D25, read directly
   in that repo): D1 amended to allow ZK proofs in v1 as a
   validation-grade evidence plug;
   `packages/chiproof/src/plugs/zk-passport.js` ships in M1 tier A
   with the verifier checking a real proof via a pinned Barretenberg
   `bb` binary; Play Integrity turned
   out NOT to be borrowable (decoding is tied to the app developer's
   own Cloud project) so device attestation was demoted from mandatory
   to one optional evidence type among several, including a bare mode
   with no evidence at all.
10. A local `python3 ElementTree.parse` tests WELL-FORMEDNESS ONLY and
    cannot test RFCXML schema VALIDITY. The user's own runs of
    `https://author-tools.ietf.org/` caught three faults the session's
    local checks were structurally unable to see: ten invalid `<b>`
    elements (RFCXML has `<strong>`, not `<b>`; reported two different
    ways but one root cause); `consensus="false"` invalid alongside
    `submissionType="IETF"` + `category="std"`; and a `<reference>`
    whose `<front>` had no `<author>` before its `<date>`, which the
    schema requires.
11. The session put wrong data into three references by writing
    citations from memory: an invented title, a wrong title on klrc,
    and a missing author. The IETF publishes canonical bibliography XML
    at `https://bib.ietf.org/public/rfc/bibxml3/reference.I-D.<name>.xml`.
    Correct data for the one that was wrong: `draft-google-cfrg-libzk`
    is titled "Longfellow ZK", authors Matteo Frigo and abhi shelat
    (both Google; surname lowercase "shelat"), version -02, 22 July
    2026.
12. FINAL STATE, 2026-08-30:
    `docs/product/draft-hassan-oauth-agent-delegation-00.xml`, 1137
    lines, RFCXML v3, 24 sections. Well-formed XML exit 0; zero
    non-ASCII bytes; zero BCP 14 keywords in capitals anywhere after
    `<back>`; zero unresolved xrefs; zero uncited
    references. The user ran author-tools on this exact file and
    reported it CLEAN.

**DECISION**

- The draft is shaped as a **PROFILE**, not a new credential format. It
  invents nothing; it says normatively how existing pieces combine and
  how a verifier checks them. Intended status Standards Track
  (`category="std"`, `consensus="true"`). Note explicitly that
  `consensus="true"` selects a boilerplate sentence and is NOT a claim
  that anyone agreed to the draft.
- Framing is an **abstract Attestation Issuer**. The normative body
  never says SIM, mobile operator, MNO, carrier, or CAMARA; those
  appear only in non-normative Appendix A. Why: the profile must stand
  without the telco instantiation, and a venue-neutral body survives WG
  scrutiny that a carrier-specific one would not.
- Transport is ONE new HTTP header field `Agent-Delegation`, an RFC
  8941 Structured Field List of Byte Sequences, registered with IANA.
  Signature parameters are PROFILED from RFC 9421 rather than
  reinvented: sender MUST include keyid/alg/created/expires/nonce and
  cover the `Agent-Delegation` field, MUST set `tag` to
  `agent-delegation`; verifier MUST reject an expired signature (the
  RFC leaves enforcement to the application, so the profile adds it)
  and SHOULD use `Accept-Signature` for nonce delivery. The RFC 9421
  message nonce and the attestation nonce are two distinct nonces at
  two layers and MUST NOT be conflated.
- The heart of the draft is three attenuation rules, checked on EVERY
  link relative to its parent: scope MUST be a subset; floor MUST be at
  least as tight on every axis; expiry MUST NOT be later. Whole-chain
  verification is a MUST, a configurable maximum depth is a MUST, and a
  verifier that checks only the final link defeats the mechanism —
  stated as the primary security consideration.
- Appendix A describes three instantiation directions by MECHANISM and
  STANDARD only, naming no product. Why: a named product dates the
  draft and imports claims the draft cannot stand behind.
- **Direction 3 was rewritten on 2026-08-30 because zkagent's pivot
  falsified two of its four claims** ("combined with a device-platform
  attestation" and "is NOT a zero-knowledge proof"). It now describes
  only the STABLE part: the chip-signature root under ICAO 9303
  establishes that the document is genuine, and what accompanies it
  varies by deployment — device attestation, a trusted party's
  signature, a zero-knowledge proof, or nothing — with the trust model
  differing by evidence type. The unchanged limit stays in the text:
  passive authentication does NOT bind the presenter to the document,
  so identities are bounded by documents held, never one per human.
- **LESSON, generalisable:** Direction 3 broke because it described a
  COMBINATION as if the combination were the mechanism. Only the
  document root was stable. The draft's normative body already applies
  this discipline through the abstract Attestation Issuer; Appendix A
  had quietly broken it. Describe the stable mechanism, not the
  current combination.
- **LESSON:** never write a citation from memory — fetch the canonical
  bibliography XML from `bib.ietf.org`. Hand-written `<reference>`
  elements were nonetheless kept over `xi:include` deliberately: an
  `xi:include` resolves at render time, so if klrc moves to -04 the
  reference would silently change while the body prose still says -03
  — exactly the orphaned-reference failure no-go 14 exists to prevent.
- **LESSON:** well-formed is not valid. Only
  `https://author-tools.ietf.org/` validates RFCXML, it needs no local
  install, and only the user can run it. Nothing is installed locally:
  no xml2rfc, no kramdown-rfc, no mmark.
- The two ZK attributions were corrected before submission, not after:
  8een IS zero-knowledge and zkagent (as of 2026-08-29) was NOT. The
  session had them backwards, which would have put a false claim in an
  IETF submission. Restate the standing invariant: the subscription
  lane is NEVER described as zero-knowledge; ZK language is reserved
  for holder presentment.
- OPEN, unresolved, recorded as such and NOT as a win:
  `draft-klrc-aiagent-auth-03` §6 wants a STABLE workload identifier
  for audit; this draft wants per-Relying-Service unlinkable ones.
  Appendix B carries this as unresolved.
- STATUS: the draft is WRITTEN and VALIDATED. It is NOT submitted, NOT
  adopted, NOT reviewed by anyone. Submission cutoff for IETF 127 is 2
  November 2026, 23:59 UTC. An I-D expires 185 days after posting, and
  posting confers a timestamp and visibility, not standing.

---

## 2026-08-28 — five orphaned-reference failures in one session; no-go 14 added

**EVIDENCE**

Five separate edits in this session fixed the thing changed but not the
references to it — all observed directly, not reasoned:

1. **v0.6.0 dropped AAIF, re-homed the agent arm to the IETF OAuth WG.**
   The files being changed (`CLAUDE.md`, the two proposal docs) were
   edited, but files that only *referenced* AAIF were not: `README.md`'s
   `tracks: CAMARA + AAIF` badge and opening paragraph, `prd.md` (8
   staleness gaps, including a D3 row still pointing at the superseded
   file), and — worst — `camara-attested-windowed-disclosure.md`'s
   Companion line and §7, which named AAIF as the live companion track
   inside text about to be filed to CAMARA.
2. **The AAIF doc sweep fixed the documents but not the GitHub repo
   description**, which still read "Standards staging for the CAMARA and
   AAIF tracks" — public metadata a reviewer clicking through from the
   filing would land on directly.
3. **The docs reorg removed the two directories it emptied but left three
   pre-existing empty ones** (`docs/00-context`, `docs/03-logs`,
   `docs/04-process`). Git cannot see an empty directory, so no diff,
   status, or PR surfaced them — only listing the tree did.
4. **The §8.1 A2P retraction corrected the section but not the two places
   citing it**: a parenthetical inside normative profile rule 6 ("middle
   layers that can read, eventually monetize") and a `CLAUDE.md` doctrine
   bullet, both still asserting the retracted claim as fact.
5. **A `findings.md` anchor broke silently.** A new 2026-08-28 entry took
   over the `(latest)` marker, which changed the previous heading's slug;
   `prd.md`'s §9 index still linked to the old one.

Common shape, stated once: an edit that fixes the thing but not the
references to the thing.

**DECISION**

Added no-go 14 to `docs/product/prd.md` §5, "No orphaned references": after
any retraction, rename, move, drop, or heading change, sweep the whole
repository for the old term/path and classify every hit — corrected, or
deliberately preserved as dated history, never an oversight. The sweep
surfaces named explicitly so none is skipped by default: markdown, code,
spec files, generated indexes, GitHub repo metadata (description and
topics), directory structure (invisible to git when empty), and internal
anchors (a changed heading changes its slug). The same rule was added to
`CLAUDE.md` under Grounding discipline, compressed for a loading agent
session. This entry's own `(latest)` reassignment was itself checked
against the failure it documents — see verification note below.

**Verification note:** before this entry was added, no `prd.md` §9 row
linked to the prior `(latest)` heading's anchor, so removing that marker
here broke nothing; the full anchor check was re-run after this edit to
confirm.

## 2026-08-28 — adversarial grounding pass on the A2P "why now" thesis: two retractions, four confirmations

**EVIDENCE**

A web-search-only adversarial grounding pass (method note: primary GSMA and
MEF documents 403'd on every fetch attempt; findings below rest on
secondary citations of those reports where noted) was run against the
author's working claim: "aggregators/hubs got more access → sold access to
untrusted partners by proxy → oversharing demographics → spam/rogue actors
→ price hikes → combined with PII scrutiny + EU regulation → the fall of
A2P." Six sub-claims were checked independently:

1. **Grey routes / unauthorised A2P routing — GROUNDED as a mechanism.**
   Unauthorised routing bypassing termination fees is a well-documented,
   GSMA-tracked industry problem (secondary-sourced figures: ~75% of 816
   surveyed operator networks showing partial/full grey routing; more
   recent Mobilesquared-attributed figures show grey-route share *falling*,
   4.3% of business messaging in 2023, forecast <1% by 2027). NOT grounded:
   that aggregators knowingly resold access to untrusted downstream
   partners as a business practice — the literature documents unauthorised
   routing and fraud, not a documented pattern of deliberate reselling of
   trust/access. Sources: Enea, Synaptique, IDT Global (vendor/secondary
   tier) — https://www.enea.com/solutions/messaging-security/a2p-sms-grey-route-fraud-protection/
   , https://www.synaptique.com/understanding-a2p-bypass-fraud/ ,
   https://idtglobal.com/sms-firewall/ ; a Businesswire item citing
   Mobilesquared (paid analyst firm, not a regulator), URL fetch 403'd,
   found via search snippet only:
   https://www.businesswire.com/news/home/20230501005030/en .
2. **AIT (Artificially Inflated Traffic) / SMS pumping — GROUNDED.** A
   formally GSMA-named fraud category, with sustained multi-year trade-body
   attention (MEF calling it a top-3 messaging threat since Jan 2023,
   "the silent predator" by Jan 2025). Specific dollar figures DISAGREE by
   ~2x across sources ($1.16B vs $1.6B vs $2.4B for overlapping periods) —
   never state one as consensus; attribute any figure cited to its source.
   Sources (MEF fetches both 403'd, relying on search-engine summary only):
   https://mobileecosystemforum.com/2025/01/08/ait-in-a2p-messaging-the-silent-predator/
   , https://mobileecosystemforum.com/2023/01/12/artificially-inflated-traffic-the-latest-menace-in-sms/
   ; corroborating vendor tier: Ericsson white paper
   https://www.ericsson.com/en/reports-and-papers/white-papers/ait-the-root-cause-the-solution-and-the-implication-on-rcs-and-network-apis
   , plus Sinch/Infobip/Bandwidth/CybelAngel blogs (weak, directionally
   consistent).
3. **Price rises → migration toward app channels (WhatsApp Business, RCS)
   — GROUNDED.** Analysys Mason (named analyst firm, stronger tier than
   vendor blogs): third-party app A2P traffic share rising 36%→47%
   (2022→2027 forecast); SMS A2P volume still growing 2.6% CAGR vs 14% CAGR
   for app-based A2P over the same period; SMS business *spend* forecast to
   peak ~2026. Sources:
   https://www.analysysmason.com/research/content/regional-forecasts-/a2p-messaging-forecast-rdmv0/
   , https://www.analysysmason.com/research/content/articles/a2p-messaging-migration-rdvs0/
   , https://www.analysysmason.com/research/content/articles/a2p-market-growth-rdmv0/
   , https://www.telemediamagazine.com/world-telemedia-23-a2p-sms-set-to-peak-in-2026-with-whatsapp-ait-and-pricing-undermining-the-business-model/ .
4. **Aggregators oversharing/monetising subscriber PII or demographics —
   UNGROUNDED.** No regulator finding, enforcement action, or documented
   incident exists tying A2P SMS aggregators/messaging hubs to overselling
   or monetising subscriber demographic/PII data. The FTC's Dec 2024
   actions against Gravy Analytics/Venntel and Mobilewalla are real and
   well-documented but concern **location-data brokers in mobile ad-tech/
   RTB exchanges** — a different industry; citing them here would be a
   category error an operator audience would catch instantly. Sources:
   https://epic.org/ftc-takes-action-against-data-brokers-for-selling-sensitive-location-data/
   , https://cyberscoop.com/ftc-data-broker-action-gravy-analytics-venntel-mobilewalla/
   ; closest-adjacent but non-evidentiary (critique/structural writing, not
   an incident report):
   https://daidac.thecjid.org/who-gave-them-my-number-the-consent-gap-behind-africas-unsolicited-sms-pandemic/ .
5. **EU regulation — PARTLY GROUNDED.** GDPR + the ePrivacy Directive
   (2002/58/EC, in force) directly constrain what subscriber data an
   operator (as controller) may disclose without consent — real and
   relevant. NOT established: that eIDAS 2.0 (Regulation (EU) 2024/1183) or
   the EU Data Act (Regulation (EU) 2023/2854) constrain this specific use
   case — no source drew that direct line; treat as parallel context, not a
   constraint. The ePrivacy *Regulation* (as opposed to the in-force 2002/58
   Directive) remains proposed, not law — do not cite it as such.
6. **"The fall of A2P" / "A2P declined" — CONTRADICTED, the single most
   important finding of this pass.** Total A2P messaging spend is
   **growing** (~$75–90B, 4–7% forecast CAGR per Grand View Research and
   others); SMS A2P volume itself still grows ~2.6% CAGR. What is real is a
   **channel-mix shift**: SMS's *share* of business messaging erodes toward
   app channels, and SMS-specific business *spend* is forecast to peak
   around 2026 — never "A2P fell," "decayed," or "collapsed." Sources:
   https://www.grandviewresearch.com/industry-analysis/a2p-messaging-market-report
   , plus the Analysys Mason and Telemedia sources cited under #3.

**DECISION**

Two retractions follow directly from #4 and #6 above, both visible per this
repo's no-go 9 (retract, never silently correct):

- `docs/product/camara-attested-windowed-disclosure.md` §8.1 previously
  opened "A2P SMS decayed because the middle layer could see and arbitrage
  per-message value: grey routes, spam, fake DLRs, SIM farms" and closed
  "history (A2P) shows accumulated middle-layer value gets monetized
  against the ecosystem." Both fail re-verification (decline is
  contradicted by #6; the monetization claim has no incident/regulator
  finding per #4). A dated retraction note now opens §8.1, quoting both
  phrases, and the body is rewritten to the grounded version: A2P
  demonstrates a documented **mechanism** (grey routes + AIT depend on a
  hub that can see per-message value), and the PII-accumulation risk is
  reframed as **prospective/structural** ("carries the option to,"
  never "history shows it did"), not retrospective fact. The aggregator
  mechanics (blind hub, per-query billing, Mode A/Mode B behaviour,
  no-grey-route-surface, "keeps distribution/contracts/DX, loses the
  surveillance option") are design arguments, unaffected by the
  retraction, and were kept as originally written.
- A new §1.1 "Why now" was added to the same document (200–260-word target,
  landed at 266) carrying the grounded argument end to end: the project's
  stance that identity data should not become a tradeable asset; the A2P
  mechanism evidence (#1, #2); the channel-mix fact stated correctly (#3,
  #6); the prospective PII risk (#4, reframed forward-looking); the GDPR/
  ePrivacy legal floor (#5); the win-win-win argument; and the agent-driven
  "why now," over RFC 9421 with the exact floor
  `voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d` (postpaid optional).
- Downstream artifacts updated to carry the same grounded why without
  re-litigating it: the issue-body Description
  (`docs/product/camara-filing-issue.md`, kept under the 1800-char
  budget below the paste marker) and the long filing template's API summary
  and Scope-fit fields (`docs/product/camara-filing-template.md`) now open
  with the tradeable-asset stance and the blind-hub argument before the
  existing horizontal-profile ask and CAMARA precedents, which are
  unchanged.

**Methodological caveat, stated on purpose:** no primary GSMA or MEF
document could be fetched in this pass — every direct attempt returned 403.
The grey-route and AIT findings above therefore rest on secondary citations
(vendor blogs, one paid-analyst-attributed Businesswire item, and
search-engine summaries of MEF pages that could not be opened directly),
not on independently verified primary text. This is recorded as a known gap
in this evidence, not smoothed over.

## 2026-08-25 — OPEN DECISION from the entry below CLOSED: fold-in-versus-distinguish resolved as HYBRID, after a full read of `draft-klrc-aiagent-auth-03` raw text

**DECISION**

The prior entry (immediately
below) left this open pending that read; this entry is that read and
its verdict — see that entry for the AAIF-drop/re-home context, not
restated here.
**Method:** the draft was fetched as raw text
(https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-03.txt, 1624
lines) and verified directly, not via summary.
**Verdict: HYBRID.** Write a short companion Internet-Draft that cites
`draft-klrc-aiagent-auth-03` as the WIMSE/OAuth baseline and defines
only three things: (1) an operator/carrier-attested posture-assessment
input for its §8 credential-provisioning stack — economic scarcity /
sybil resistance; (2) a document-rooted human-principal identity
assertion usable in its §10.6 Identity Assertion JWT Authorization
Grant chaining flow — cryptographic scarcity / one accountable human;
(3) the monotone floor-tightening invariant (tighten-only, closed axis
set, consent-visible widening as a distinct operation), layered onto
its existing Transaction Token mechanism rather than replacing it.
Explicitly out of scope: agent identity, credential formats, the RFC
9421 signing profile, and OAuth grant flows — already specified there;
duplicating them invites rejection.
**Two verified hooks the verdict rests on:**
1. §8 (Agent Credential Provisioning), line 478 of the raw text, names
   "operator assertions" as one of several posture-assessment signals
   and states plainly: "This document does not require any particular
   posture assessment mechanism, evidence format, or verifier
   architecture." That is a named, textually-explicit extension point
   the draft itself never populates — our single strongest piece of
   evidence, and it must be read as an open slot, not as the draft
   endorsing our approach.
2. §10.6 (Cross Domain Access / Identity Assertion JWT Authorization
   Grant) already accepts an external identity assertion (e.g. an
   OpenID Connect ID Token or SAML assertion) as the input exchanged
   for a JWT authorization grant — a second, independent slot for a
   document-rooted principal assertion to plug into.
**Verified absent** (raw-text keyword counts, case-insensitive): sybil
0, farm 0, "rate limit" 0, carrier 0, telco 0, MSISDN 0, eMRTD 0,
passport 0, KYC 0, CAMARA 0. Word-boundary "SIM" = 0 (the six
case-insensitive hits are all "similar"/"simplifies"). The single
"mobile" hit is "mobile device" in an authenticator context (line
947), not telco identity. Their security model is workload attestation
plus short-lived credentials; nothing anywhere asks what it costs to
mint another agent identity.
**Monotone floor — confirmed absent.** Their nearest analog, §10.5
Transaction Tokens, downscopes per-hop ("results in a downscoped token
... bound to a specific transaction and cannot be used ... within the
same transaction with modified transaction details") — anti-replay/
blast-radius hygiene, not a declared, closed-axis, numerically-compared,
consent-visible never-widen invariant. No "MUST NOT widen" text exists
anywhere in the draft.
**Two divergences to reconcile, recorded honestly rather than hidden:**
1. Revocation: they go FURTHER than us, not less — §11 requires
   SSF/CAEP revocation-signal infrastructure ("MUST ensure that
   revoked ... authorization is enforced without undue delay"), where
   our model relies on short expiry with no revocation infrastructure.
2. Identifier stability: their model wants an identifier that is
   stable "for the lifetime of the workload identity" for audit
   purposes; our per-service unlinkable tags want the opposite. Both
   are carried into §7 Honest limits of the IETF proposal doc, not
   silently smoothed over.
**Precision point, stated so it does not drift into a draft:** our
work is a companion to `draft-klrc-aiagent-auth-03`, NOT to RFC 9421.
RFC 9421 is a published, closed Proposed Standard (February 2024);
nothing in it is open. RFC 9421 is the mechanism both drafts use, not
the gap either fills.
**Two-slot structure (the spine of the argument):** the companion
draft defines slots, not implementations — two independent
instantiations of one abstract pattern (a scarcity-attested
principal): an operator-assertion slot (← CAMARA operator APIs,
economic scarcity) and a principal-assertion slot (← zkagent,
cryptographic scarcity). These are separate, non-competing trust
lanes per existing repo doctrine. Because the draft defines slots,
neither implementation needs to exist for the draft to stand — this is
what keeps zkagent a citation, never a dependency.
**Caveat, stated on purpose:** "operator assertions" may be
aspirational filler nobody wires up in practice; the hook is real text
in the draft, not proof anyone intends to use it that way.
Full record and section-by-section edits:
`docs/product/ietf-agent-delegation.md` §2 and new §4 (two-slot
structure), §7.

## 2026-08-25 — submission strategy shift: AAIF dropped, agent arm re-homed to IETF, no-go 12 retired, API family owner decided

**DECISION**

Four
findings, all fetched from live sources this session (§7 carries full
citations and mechanics):
1. **AAIF dropped as a submission target.** AAIF ("Agentic AI
   Foundation", Linux Foundation, since Dec 2025) runs a
   project-DONATION intake, not a standards-proposal track: it demands
   evidence of production deployment in ≥2 organizations, ≥2 core
   maintainers from different organizations plus ≥10 contributors, and a
   signed Contribution Agreement handing project trademarks/accounts to
   the Foundation. This author is a solo independent with a
   single-author PoC — roughly 8 of ~14 required fields cannot be filled
   honestly. The Identity & Trust WG's topic still fits; the door was
   wrong, not the idea. The prior "AAIF grounded 2026-08-15" note (§7)
   is corrected in place, not deleted — it named the right URLs and
   stage mechanics but the wrong kind of process.
2. **Agent/delegation arm re-homed to IETF.** An unaffiliated individual
   can submit an Internet-Draft with no membership, sponsor, or fee —
   exactly the gates that disqualified AAIF do not exist here. Target:
   the OAuth WG's automated-agent-authorization work item. RFC 9421 is
   already published (nothing to submit to; new work cites it).
   `draft-klrc-aiagent-auth-03` is close prior art (WIMSE/SPIFFE + RFC
   9421 + OAuth 2.0 delegation, six industry co-authors) but contains no
   SIM/carrier/telco/passport content — our two differentiators (SIM-
   anchored economic scarcity; document-rooted human principal) survive
   unclaimed. I-D cutoff for IETF 127: 2 Nov 2026 23:59 UTC; Hackathon
   14–15 Nov 2026 (free, non-members welcome); meeting 14–20 Nov 2026,
   San Francisco. Registration fee unverified — left unstated.
3. **No-go 12 retired.** "No APIBacklog PR before supporters" was
   verified FALSE as a CAMARA requirement — the template's own
   Supporters field is filled by the Working Group during evaluation,
   downstream of filing. It was the author's own risk-management
   judgement, not a process fact, and is retracted visibly per no-go 9's
   own rule (§5, item 12). **User decision: file first, network later.**
4. **API family owner = Cairenes Solutions (user decision).** The
   template's "API family owner" field requires "Company submitting the
   API proposal" and no precedent was found for a wholly unaffiliated
   submitter; the user's own company fills that field. Open practical
   item: no email address yet exists at that company's domain, and a
   contact email is required at submission — a personal address is
   workable but a domain address reads better on a first filing. D2 is
   already ~90% complete against the template; the outstanding gaps are
   the proposal-owner declaration confirmation and this now-resolved
   API-family-owner value.
**OPEN DECISION (not settled by this entry):** fold our agent/delegation
work in as an extension of `draft-klrc-aiagent-auth-03` versus write a
distinguishing draft — pending a full read of that draft. **OPEN
ACTION, scoped as a separate job:** `docs/archive/aaif-agent-auth.md`
still targets the AAIF Identity & Trust WG in its text and needs
re-homing onto the IETF track; not touched by this entry. Gate ladder
(§2), no-go list (§5), sequence (§6) and process facts (§7) updated to
match. Full record: this entry; sources cited in §7.

## 2026-08-18 — Full user validation run at `4446517`/`c921508`: BOTH gates MET, first time at the same commit

**EVIDENCE**
The user ran the full validation suite on their own machine at code commit
`4446517` (docs commit `c921508`), log timestamped 08:16. Every suite clean:
zero `FAIL` lines, zero `TypeError`, zero `Error:` lines in the entire log.
Verified by the main session by reading the log directly:

```
m1-check.mjs            RESULT: 20/20
m2-check.mjs            RESULT: 10/10
m3-check.mjs            RESULT: 26/26
m4-check.mjs            RESULT: 40/40
m5-check.mjs            RESULT: 60/60
m6-check.mjs            RESULT: 46/46
demo.mjs (mock)         RESULT: 33/33
demo.mjs --backend orange   RESULT: 33/33   (live, real Orange Playground)
m5-check-live.mjs           RESULT: 19/19   (live, real Orange Playground)
```

Every count above is user-run, not agent-run.

**Consequence: both gates are now MET at `4446517`.** G1 (M1–M4 + M6 all
user-validated) is MET at the current counts (20/10/26/40/46). G2 (M5
user-validated live) is MET on both legs — offline 60/60 and live 19/19.
This is the first time in this project both gates have been met at the same
commit, on a tree that had already been through two `/code-review` rounds
(recorded in the two entries directly below) with every fix
mutation-proven.

**Scope of this record, stated per this repo's own rule:** it covers
`4446517` (code) / `c921508` (docs) and nothing later. A future change to
any file either gate's validation depends on re-opens that gate, the same
way the two rounds below did to the `3276ed0` record.

## 2026-08-18 — Second `/code-review medium --fix` round: cross-requester sealing fixed, m6 45→46 — G1 AND G2 were PENDING, at `4446517`, until the full user run above

**EVIDENCE**
A second code-review round on the round-1 tree (`c15fcc0`) found the
operator sealing EVERY signed refusal AND every answer to a hardcoded
`keys.rpEnc.publicKey`, instead of the envelope key of the issuer that step
3/4 had just authenticated. The trust directory already carried `encPub`
for exactly this purpose and nothing in the repo read it (`grep encPub`
returned 2 hits before this fix, both writes).

**Concrete failure this closes:** with a second directory-listed requester
`rp:demo-agent-02`, B's query passes the operator's own signature check at
step 4, and the operator encrypts the answer under requester A's key
instead — A can decrypt an answer to a query it never made, and B cannot
read its own. Cross-requester disclosure between two fully authenticated
principals. This was invisible in every prior run of this demo purely
because it has only ever had one requester: the hardcoded key and the correct key
were byte-identical with one requester in the world.

**Fix (`poc/demo.mjs`, `createOperator`):** step 3 now resolves
`entry.encPub` off the directory entry for the authenticated issuer and
rejects an issuer with no `encPub` as `unknown issuer` (it cannot be sealed
to, so it is unusable as a correspondent the same way an unlisted issuer
is). The resolved `recipientEnc` is threaded as a new parameter through
`signedReject` and both `seal()` call sites (refusal path and answer path)
— every branch that used to reach `keys.rpEnc.publicKey` directly now reads
the authenticated issuer's own key instead.

**Also fixed (`spec/carrier-attestation.yaml`):** the `Predicate` schema
was the one shape in the sketch still missing `additionalProperties:
false`, while `AttestRequest`, `Floor` and the area object all already
have it, and `evaluatePredicate` genuinely enforces a closed predicate
field set in code (`poc/m4-facts-mock.mjs`, `unexpected predicate fields:
…`). The sketch left open the exact door the code closes.

**New case, mutation-proven: `m6-check.mjs` case 46 CROSS-REQUESTER
SEALING (m6 45 → 46).** `createWorld` only ever mints one requester, so no
existing case could see this defect. A new `twoRpWorld()` helper mints a
second requester B sharing A's operator key pair, with its own
`rpSig`/`rpEnc`/`rpIss`, both A and B listed in the same directory. The
case asserts BOTH directions and BOTH reply kinds, because asserting only
"B can read it" would still pass a fix that seals to a key both A and B
happen to hold: B asks a question that is answered, and opens that answer
with its own key; B asks a question that is refused (below the published
floor — the original defect covered `signedReject` too, not only
answers), and opens that signed refusal with its own key; A attempts to
open both replies with A's own key and gets `reason='undecryptable'` on
both.

Reverting the sealing fix alone, with the new case left in place, was run
and observed directly:

```
FAIL 46 CROSS-REQUESTER SEALING: … answer-for-A=opened, refusal-for-A=opened
RESULT: 45/46
EXIT:1
```

Cases 1–45 are unaffected by the revert, isolating case 46 to exactly this
defect. **The fix shipped with NO test able to catch it until this case
existed** — every one of the six existing suites (m1–m6, demo mock) scored
identically with the fix present or reverted, because a single-requester world
structurally cannot exercise cross-requester sealing. This is the THIRD fix
in this project's history to land with no net at the time it shipped
(after m3-floor's hostile-key bound, closed by m3 case 26, and m5's
`getFacts` re-validation, closed by m5 case 60) — recorded here as a
finding about the suite's own blind spots, not only about the code.

**Skipped, recorded rather than dropped:**

1. `poc/m5-facts-orange.mjs` — `roaming` and `reachability` are STILL read
   unconditionally on every `getFacts` call, so a `numberMatch` or
   `presentIn` query still makes two extra billed live calls about the
   subscriber nobody asked about. Not a regression (both were always
   unconditional), but the same class the SIM/device swap axes were just
   fixed for in round 1, and it works against the proposal's own argument
   that an operator should not hold facts nobody asked for. Conditioning
   them needs a new `factQuery` signal for predicates carrying no query
   value — a design change, recorded as an OPEN item in `prd.md` §9 for
   the user to decide, not as a defect.
2. `poc/demo.mjs`'s `setFrames` array includes `r6b`, produced after the
   story is re-scripted to `DEVICE_FLIPPED_DAYS_AGO = 4`, but scanned
   against `NEEDLES`, which spells the 211-day instant — so that frame's
   device-axis scan structurally cannot red. Not fixable the obvious way:
   single-digit spellings would collide with `exp` on every clean run,
   which is the measured reason 3-digit counts were chosen in the first
   place. Recorded as an honest stated limit.
3. `poc/demo.mjs`'s pre-seal answer-size guard (~line 573) compares
   against the module constant `OAEP_CAPACITY` (446, the RSA-4096 value)
   while `seal()` itself derives capacity from the actual recipient key.
   Correct today because `generateEnvelopeKeys()` is fixed at 4096, but
   more reachable now that the recipient key comes from the directory
   rather than a single fixed pair. Fixing it properly needs a capacity
   helper exported from M2 — M2's call, not this round's. Recorded as a
   stated limit.

Also worth recording honestly: `/security` ran on this exact code earlier
in the session and returned clean — it did NOT catch the cross-requester
sealing defect. A clean security pass is not proof.

**Verified green independently by exit code** on the fixed tree: m1
20/20, m2 10/10, m3 26/26, m4 40/40, m5 60/60, **m6 46/46**, demo(mock)
33/33.

**Consequence for both gates — do not round this up.** This round changed
`poc/demo.mjs` again — one of the exact two files the last user
validation (tip `3276ed0`) was run against. Per this repo's own rule, a
user record covers only the tree it was run on, and the tree has now
moved THREE times since (`9b04854`, `c15fcc0`, and now `4446517`):

- **G1 (M1–M4 + M6 all user-validated) remains PENDING.** It was already
  PENDING before this round.
- **G2 (M5 user-validated live) remains PENDING.** `poc/m5-facts-orange.mjs`
  was not touched this round, but `poc/demo.mjs` was, and G2's own
  definition includes `node poc/demo.mjs --backend orange`.
- m6's count moved again this round (45 → 46, on top of round 1's m3/m5
  moves) — no maintainer record exists for 46 at any tip.

See `CHANGELOG.md` (Unreleased) for the same round in changelog form, and
commit `4446517` for the full diff-level record.

## 2026-08-18 — `/code-review medium --fix` round + `/security`: 6 fixes, 1 user-approved behaviour change, m3 25→26, m5 58→60 — G1 AND G2 BOTH RE-OPENED (PENDING) at `9b04854`

**EVIDENCE**
A code-review round on the six live-touching files (`poc/demo.mjs`,
`poc/m3-check.mjs`, `poc/m3-floor.mjs`, `poc/m5-check.mjs`,
`poc/m5-facts-orange.mjs`, `spec/carrier-attestation.yaml`) found 7 issues
and fixed 6:

1. `m3-floor.mjs` — an unknown floor field name reached the refusal reason
   RAW; a key containing a newline/NUL forged a fake log line. Bounded to 40
   chars printable ASCII (`fieldName()`), same rule as M6's request-field
   check and M4's `describeKey`.
2. `demo.mjs` — the "effective floor is the tightened one" assertion
   recomputed `checkFloor` locally beside the round trip instead of reading
   the operator's own return, so it passed identically for an operator that
   computed the effective floor and discarded it. `handle()` now returns
   `effectiveFloor` (operator-side only, never onto the wire) and the
   assertion reads it off that return.
3. `m5-facts-orange.mjs` — `getFacts` re-validated `thresholdMs` but trusted
   `q.area`/`q.claimedName` verbatim; a caller bypassing `factQuery` could
   push a malformed area or a 50,041-char name straight to a live metered
   operator call. Both are now re-validated on the read path.
4. `demo.mjs` — the requester registered a pending nonce BEFORE `seal()`, leaking
   one permanently-unconsumable store entry per oversize-retry. Seal first,
   register after.
5. `demo.mjs` — `verifyResponse` with `skipNonceStore` and no
   `fallbackPredicate` threw a bare `TypeError` out of a function contracted
   to "untrusted input gets a verdict, never a throw". Now returns the
   verdict.
6. `spec/carrier-attestation.yaml` — documentation only: stated the
   deliberate divergence where `additionalProperties:false` omits `number`
   (the sketch models the 3-legged shape; the PoC's `number` stands in for
   token-derived identity) instead of leaving it as an unstated trap.

**Finding 7, escalated and USER-APPROVED as a behaviour change:**
`m5-facts-orange.mjs` read the SIM-swap axis unconditionally, so a
`reachable`/`roamingIn`/`presentIn`/`numberMatch` question — none of which
carry a SIM threshold — still made a metered `/retrieve-date` call and
pulled a raw SIM-swap date into the operator's fact set for a question
nobody asked. Now conditional, matching the existing device-axis pattern.
Reasoning (the user's stated basis): a reference operator holding a raw
date it was never asked for undercuts the CAMARA proposal's own argument
that `/check` leaves no raw value operator-side to leak in the first place.

That change broke 7 pre-existing pinned cases (m5 10, 11, 12, 14, 15, 27,
49), which had relied on the unconditional SIM read for their setup. They
were REPAIRED, not weakened: an explicit SIM-question fixture (`SIM_Q`)
threads a real SIM question through each so every assertion still exercises
what it did before; case 49's control now asserts zero sim-swap calls when
no threshold is named.

Three new cases, each mutation-proven RED when its fix is reverted:
`m3-check` case 26 (hostile floor key `"a\nFAKE LOG LINE b"`; reverted
renders the raw control char, 25/26), `m5-check` case 59 (non-SIM question
→ 0 sim-swap calls, SIM question → exactly 1; reverted, 57/59), and
`m5-check` case 60 (malformed area + 50,041-char name never reach the wire;
reverted, the suite crashes on an attempted outbound call). Two coverage
gaps this surfaced and closed: before cases 26/60, `m3-check` scored 25/25
and `m5-check` scored 58/58 whether fixes 1 and 3 were present OR
reverted — real fixes with no net under them.

**Counts moved: m3 25 → 26, m5 58 → 60.** Independently re-verified by exit
code, agent-run: m1 20/20, m2 10/10, m3 26/26, m4 40/40, m5 60/60, m6 45/45,
demo(mock) 33/33.

`/security` was re-run across the round for the first time (it had not run
before this): clean. No new findings; fixes 1/3/4/5 above each close a real
class (log-line forging, unbounded outbound request, unbounded store
growth, uncontracted throw). Nothing Critical/High.

**Consequence for both gates — do not round this up.** This round changed
`poc/demo.mjs` and `poc/m5-facts-orange.mjs`, which are exactly the files
the two prior user-run gates (G1, G2) were validated against at tip
`3276ed0`. Per this repo's own rule, a user record covers only the tree it
was run on. This tree is a different tree (`9b04854`), with different code
on the live paths and different counts on m3/m5. So:

- **G1 (M1–M4 + M6 all user-validated) is PENDING again.** It was already
  PENDING at `3276ed0` (M1/M3/M4 offline counts were agent-run there too).
- **G2 (M5 user-validated live) is PENDING again**, even though it was MET
  at `3276ed0` — the tree that met it no longer matches HEAD, because
  `m5-facts-orange.mjs` (the file the live check exercises) changed under
  it.
- The user's `3276ed0` records for M1 (20/20), M2 (10/10), M4 (40/40), M6
  (45/45) — and the demo mock 33/33 — do NOT transfer forward either, even
  where their counts are unchanged, because the tree changed under all of
  them (`poc/demo.mjs` moved; a shared module change can affect a suite that
  imports it even when that suite's own file didn't move). All six modules
  plus the demo need a fresh user run at `9b04854` (or later) to close G1
  and G2.

See `CHANGELOG.md` (Unreleased) for the same round in changelog form, and
the commit `9b04854` for the full diff-level record.

## 2026-08-18 — LIVE-CONFIRMED at `3276ed0`: `demo.mjs --backend orange` 33/33 AND `m5-check-live.mjs` 19/19 — gate G2's M5 leg is USER-VALIDATED again

**EVIDENCE**
The user ran, on their own machine, live against the Orange Playground, at
tip `3276ed0`:

```
node poc/demo.mjs --backend orange
RESULT: 33/33
```

This confirms the fix in the entry directly below: the vacuous leaky-operator
control now reds the leak for real on the live backend, not just in the
offline mutation-proof.

A second live run, timestamped `2026-08-18T00:00:56.098Z` (POSTDATES
`19b2644`, which last touched `poc/m5-check-live.mjs` and
`poc/m5-facts-orange.mjs`):

```
ORANGE_BASIC_AUTH=... node poc/m5-check-live.mjs
RESULT: 19/19
```

All 19 passed, including the quota check (start=1, end=1 of 10, cleanup
DELETE status=204). Because this run postdates `19b2644`, it settles the
question the entry below left open: **gate G2's M5 leg is USER-VALIDATED at
`3276ed0`**, not merely at some earlier, possibly-stale tree. Both counts
above are USER-RUN, not agent-run.

Worth noting on its own — live corroboration, not a new finding — is case 6
of that run, verbatim:

```
PASS 6 LIVE SURFACE CHOICE: /check under the cap, /retrieve-date above it: expected OK, got OK — reason expected 'ok', got 'ok' (match=true); P90D → check maxAge=2160h → true; P365D → retrieve-date maxAge=null → false=true
```

This is exactly the cap boundary the `LEAK_PREDICATE` fix below depends on
(P90D routes to `/check`, which holds no raw date to leak; P365D routes to
`/retrieve-date`, which does), now measured live on the wire rather than
inferred from `m5-facts-orange.mjs`'s recorded cap.

Also this session, the offline suites were re-run at the same tip by exit
code (AGENT-RUN, not user-run, unchanged counts): `m1` 20/20, `m2` 10/10,
`m3` 25/25, `m4` 40/40, `m5` 58/58, `m6` 45/45, `demo --backend mock` 33/33 —
all exit 0.

---

## 2026-08-18 — user ran the FULL validation suite on their own machine against the CURRENT uncommitted tree (the tree the entries below describe): every suite clean, zero `FAIL`, zero `TypeError`, zero `Error:` lines in either log. BOTH GATES MET on this tree

**DECISION**

The main
session verified with `find poc -newer` that no `.mjs` file changed
after the run, so this record covers exactly this tree and nothing
later. Offline (user-run, by exit code, all exit 0): `m1-check.mjs`
20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26, `m4-check.mjs` 42/42,
`m5-check.mjs` 67/67, `m6-check.mjs` 47/47, `demo.mjs` (mock) 35/35.
Live (user-run, real Orange Network APIs Playground, injected clock
`2026-08-18T19:24:42.422Z`, quota 1 of 10 custom slots in use at start
AND at end — no slot leaked, all exit 0): `m5-check-live.mjs` 20/20,
`demo.mjs --backend orange` 35/35 — every count user-run, none
agent-run. G1 (M1–M4 + M6 user-validated) is MET at
20/10/26/42/47 plus `demo.mjs` (mock) 35/35. G2 (M5 user-validated live)
is MET on both legs (offline 67/67, live 20/20). **The headline:**
`m5-check-live.mjs` case 20 — written blind in this session and never
executed until this run — PASSED live with `sim-swap calls=1,
device-roaming-status calls=0, device-reachability-status calls=0`. That
is the FIRST live evidence for the call-count saving that motivated this
whole round; until now the saving was proven only OFFLINE against an
injected transport, recorded at `bb0b52f` as a known open item. **That
open item is now CLOSED by measurement, not by argument.** Of the five
open items recorded at `bb0b52f`: **CLOSED** — the saving proven live
(above); case 42's source-text search replaced by a shape-based regex;
`m6-check.mjs` case 47 pinning conditional reads through the full
composed path; `m5-check.mjs` catching a wrong axes mapping (`ROAM_Q`/
`REACH_Q` built via `factQuery`); the `demo.mjs` pre-seal guard deriving
capacity from the recipient key with its own persisted case; the `r6b`
scan frame now able to genuinely red. **NEW STATED LIMIT, kept visible
on purpose, not softened:** the raw-value leak scan now drops needles
shorter than `PLAIN_MIN_NEEDLE = 2`, so a value whose every spelling is
under 2 characters cannot be leak-tested by this scan at all. **STILL
OPEN:** `poc/m5-check.mjs` case 67 reddens under mutation via an
uncaught 404 escaping to the wire rather than by its own assertion
firing — a genuine red, but a scruffier proof than the others; recorded
as a known weakness, not overstated as clean. Per this repo's own rule,
this record covers this tree ONLY — any later change to a file either
gate covers re-opens the relevant gate, commit or no commit. Full
record: `CHANGELOG.md`, Unreleased (now `0.5.0`).

**Provenance note (2026-08-24 re-verification round):** `poc/demo.mjs`
was edited after this record was made — a retracted-claim wording fix
to one code comment (~line 634) and one printed-output block (~line
1495), no logic change. It re-runs green at 35/35, exit 0, but that
re-run is AGENT-RUN, at this later tree. The user-validated 35/35
record above stands exactly as written, for the tree it was run
against (`d85d3cf` / v0.5.0), and does NOT transfer forward to the
post-2026-08-24 tree. Every other `35/35` figure in this document
(below and at line ~771) describes its own dated tree the same way and
is unaffected by this note.

## 2026-08-18 — `/code-review medium --fix` round on the fix round below (agent-run, NOT user-validated — G1 and G2 stay RE-OPENED/PENDING at the new counts)

**DECISION**

Two DRY consolidations, both
mutation-proved: (1) `poc/m5-facts-orange.mjs`'s six hand-copied axis
re-checks consolidated into one `asked(key)` helper — mutation-proved
(forcing it to always return `true` reds both `m5-check.mjs` and
`m6-check.mjs`; restored → both green); (2) `poc/demo.mjs`'s
byte-identical `plainNeedles`/`opaqueNeedles` filters consolidated into
one `atLeast(min)` factory. Consolidation (2) was NOT independently
pinned by any existing case at review time — nothing reds if `atLeast`'s
comparison flips — so per the coordinator's rule ("if it cannot be broken
into a red, it needs a case too") two coverage gaps were closed with new
cases rather than left unpinned:
**`m5-check.mjs` case 67** — the axis-signal gate must require the
signal to be EXACTLY `true`, not merely truthy. Found missing by
mutation: relaxing `asked` to `hasOwn(q,key)` alone left the whole suite
green (66/66). Case 67 sends `needSim:1`, `needDevice:'yes'`,
`needRoaming:{}`, `needReachability:1`, `needLocation:'yes'`,
`needKyc:{}` against otherwise well-formed values and asserts zero live
calls and an absent axis on all six. **`m5-check.mjs` moves 66 → 67.**
Mutation-proved: reverting `asked` to `hasOwn(q,key)` alone reds it
(exit 1, an uncaught `location-verification` 404 surfaces because the
gate let a non-`true` signal through); restored → 67/67, exit 0,
`m5-facts-orange.mjs` byte-identical (md5) to pre-mutation.
**`demo.mjs` new case** — pins the EXACT set `PLAIN_MIN_NEEDLE` drops
(`droppedPlain = RAW_NEEDLES.filter(n => n.length < PLAIN_MIN_NEEDLE)`
asserted `=== ['4']`, the single documented drop), not merely a count —
a count-only check would pass identically if a different needle had
dropped. **`demo.mjs` moves 34 → 35.** Mutation-proved twice: raising
`PLAIN_MIN_NEEDLE` to 3 reds it (34/35, exit 1; dropped set becomes
`["4","FR","97"]` — the country code and a score needle silently
falling out); restored → green. Separately, this same new case also
proved consolidation (2) load-bearing: flipping `atLeast`'s `>=` to `>`
reds `demo.mjs` (34/35, exit 1) via the same assertion; restored →
green, md5-identical to pre-mutation.
Full offline suite by exit code, before and after this round: m1 20/20,
m2 10/10, m3 26/26, m4 42/42, **m5 66/66 → 67/67**, m6 47/47,
**demo(mock) 34/34 → 35/35** — all exit 0. `m5-check-live.mjs` case 20
stays UNRUN this round too — no credentials, no live Orange legs. No
existing assertion was weakened or deleted; `m6-check.mjs` case 40's
`plain()` guard untouched. Full record: `CHANGELOG.md`, Unreleased.
(SUPERSEDED — see the top entry above: the user's full run on this exact
tree subsequently MET both gates at these counts, including case 20
live.)

## 2026-08-18 — fix round on the five open items recorded at `bb0b52f`, now COMPLETE (agent-run, NOT yet user-validated — G1 and G2 stay RE-OPENED/PENDING)

**DECISION**

All six agreed fixes, in two passes (the
second after a coordinator decision on items 5 and 6):
(1) live call-count proof for the axis-signal reduction — `m5-check-
live.mjs` case 20 added, asserting a `simSwapAge` question calls
`sim-swap` and never roaming/reachability; WRITTEN, NOT RUN (no live
credential this session — stays unrun, per instruction, no live Orange
legs this round);
(2) `m4-check.mjs` case 42's fixture now locates the `reachable` entry and
its `axes` sub-field by SHAPE (regex) instead of the verbatim literal —
proved both ways: reverting the real guard to bare `spec.axes` still reds
(41/42); the behaviourally-identical `Array.isArray` rewrite still stays
green (42/42);
(3) `m6-check.mjs` case 47 added — a `simSwapAge` question through the
FULL composed path (same injected-Orange-transport rig as case 22) never
calls roaming/reachability; proved by forcing the `needRoaming` gate open
(46/47 red, restore → 47/47 green);
(4) `m5-check.mjs`'s `ROAM_Q`/`REACH_Q` now built via `factQuery` on the
real predicates instead of hand-written literals — proved: flipping
`roamingIn`'s `axes` mapping now reds BOTH `m4-check.mjs` (41/42) and
`m5-check.mjs` (61/66), closing the gap where only `m4-check.mjs` caught
it;
(5) `poc/demo.mjs`'s pre-seal capacity guard now derives capacity from the
actual recipient key (`recipientEnc.asymmetricKeyDetails.modulusLength`),
matching what `seal()` in `m2-envelope.mjs` already derives, instead of
comparing against the `OAEP_CAPACITY` demo constant — `m2-envelope.mjs`'s
own crypto needed no change. A PERSISTED regression case was added to
`runDemo()` (RSA-3072 recipient, real cap 318 B, gets a graceful signed
refusal instead of an uncaught throw) — **`demo.mjs` moves 33 → 34 cases:
agent-run only, NOT user-validated at this new count.** Mutation-proved on
the persisted case: guard reverted to the constant → the same scenario
throws uncaught and ABORTS THE RUN (exit 1); restored → 34/34, exit 0. The
throwaway `/tmp` repro script used before the persisted case existed has
been deleted — it did not count as coverage.
(6) `rawNeedles()` gained a `deviceFlippedDaysAgo` parameter so the `r6b`
frame's own re-scripted value has spellings in the scan inventory. Adding
them first reds the suite (`demo.mjs` 29/33, `m6-check.mjs` 45/47) and was
escalated rather than fixed by trimming the needle set. Audited before
being believed a leak: every failing hit was exactly the single character
`"4"` — including the FIRST assertion in `runDemo()`, whose frame is
scanned BEFORE the device-flip scenario runs, making it structurally
impossible to carry that value. Confirmed independently (by the
coordinating session too) as a harness confound, not a leak. **Resolved:
a `PLAIN_MIN_NEEDLE = 2` cutoff (new `plainNeedles()` helper beside the
existing `opaqueNeedles()`/`OPAQUE_MIN_NEEDLE = 8`) drops bare
single-character needles from the plaintext scan while keeping every
2+-character needle already proven safe across this suite's run history
(`FR`, kept deliberately per this file's own comment; `137`/`211`).**
Justified separately from `OPAQUE_MIN_NEEDLE`: 8 is measured against
RANDOM bytes/base64 where even a short needle is rare; this scan runs
against STRUCTURED JSON text where a bare digit is common (an `exp`
timestamp alone makes a 1-character digit needle near-certain to
collide) but a 2+-character token is not. **Honest limit, stated
plainly: a value whose EVERY spelling is shorter than 2 characters
cannot be leak-tested by this scan.** `DEVICE_FLIPPED_DAYS_AGO`'s longer
spellings (`345600000`, its ISO instant, its date) were already in the
inventory and remain fully leak-testable — only its bare `"4"` spelling
is dropped. PROVED the frame can still genuinely fail: temporarily made
`r6b`'s answer carry `facts.deviceSwapAgeMs` (reusing the existing
`leakRaw` control) — scan reds (exit 1, hits include `"345600000"`);
reverted — green again (exit 0). Full offline suite by exit code: BEFORE
this whole round — m1 20/20, m2 10/10, m3 26/26, m4 42/42, m5 66/66,
m6 46/46, demo(mock) 33/33 (all green). AFTER both passes — m1 20/20,
m2 10/10, m3 26/26, m4 42/42, m5 66/66, m6 47/47, demo(mock) 34/34 —
**all exit 0.** No case outside what each fix names was touched; no
existing assertion was weakened or deleted. Full record: `CHANGELOG.md`,
Unreleased.
(SUPERSEDED — see the top entry above: the user's full run on the
current uncommitted tree subsequently MET both gates.)

## 2026-08-18 — user ran the FULL validation suite on their own machine against the CURRENT uncommitted working tree (this record applies to that PRIOR tree at `bb0b52f` only — it does NOT carry forward to the fix round in the entry above, which changed executable code both gates cover): every suite clean, zero `FAIL`, zero `TypeError`, zero `Error:` lines in either log. BOTH gates MET on this tree

**DECISION**

Offline (user-run, by exit code, all exit 0):
`m1-check.mjs` 20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26,
`m4-check.mjs` 42/42, `m5-check.mjs` 66/66, `m6-check.mjs` 46/46,
`demo.mjs` (mock backend) 33/33. Live (user-run, real Orange Network APIs
Playground, injected clock `2026-08-18T16:25:49.263Z`, quota 1 of 10
custom slots in use at start, all exit 0): `m5-check-live.mjs` 19/19,
`demo.mjs --backend orange` 33/33 — every count user-run, none agent-run.
G1 (M1–M4 + M6 user-validated) is MET at 20/10/26/42/46 plus `demo.mjs`
(mock) 33/33. G2 (M5 user-validated live) is MET on both legs (offline
66/66, live 19/19). Notably, `m5-check-live.mjs` had two cases edited
this session and had never been executed until this run — it passed
19/19 on its first ever execution against the real Playground. The first
attempt at the live legs exited 2 (missing `ORANGE_BASIC_AUTH`) and was
correctly NOT a pass — the successful re-run above is the one that
counts. **This record covers the uncommitted working tree it was run
against ONLY**: per this repo's own rule, a user validation covers only
the exact tree it ran at (commit or no commit), and any later change to
a file either gate covers re-opens that gate. Two known open items
surfaced by this round, not yet fixed, recorded not dropped: (1) the
call-count saving that motivated the axis-signal unification (the two
entries below) is proven only OFFLINE (injected transport) — no live
case asserts it; (2) `m6-check.mjs` gives no signal on the
roaming/reachability-gating change — it stayed 46/46 before and after;
only `m4-check.mjs` catches a wrong `axes` mapping (flipping `roamingIn`
to `['reachability']` left `m5-check.mjs` fully green at 63/63, measured
before this round's 66/66 count). Also still open, pre-existing and
unaffected by this round: `poc/m4-check.mjs` case 42 searches the source
for the literal `", axes: ['reachability']"` to build its fixture — same
brittleness class as the guard-text search already removed elsewhere
(see the entry directly below), now aimed at the predicate table
instead; `poc/m2-envelope.mjs:26` hardcodes `OAEP_CAPACITY = 446` rather
than deriving it from the recipient key; and the `r6b` scan frame in
`poc/demo.mjs` structurally cannot red because `rawNeedles` is built
from `DEVICE_SWAPPED_DAYS_AGO` while `r6b` answers about
`DEVICE_FLIPPED_DAYS_AGO`, so the value it could leak is not in the
needle inventory. Full record: `CHANGELOG.md`, Unreleased.

## 2026-08-18 — fixes `m4-check.mjs` case 42 itself: it pinned the guard's SPELLING, not its behaviour (agent-run, not yet user-validated)

**DECISION**


Case 42 (added by the entry directly below) originally searched the real
`m4-facts-mock.mjs` source for the exact literal `'spec.axes ?? []'` and
threw a "fixture assumption broken" error if that string was absent —
which meant the case could only pass under one specific spelling of the
guard. Proven wrong by direct measurement: replacing the guard with the
behaviourally identical `Array.isArray(spec.axes) ? spec.axes : []` (same
fail-closed outcome, same "no axes field never throws" contract) made
`m4-check.mjs` go RED (41/42, exit 1) on a refactor that broke nothing —
the textbook "tests mirror implementation, fails for the wrong reason"
anti-pattern (`.claude/remember/AGENT_RULES.md`). Fixed by keeping the
behavioural half of the case (build a source variant of the real file with
one predicate's `axes` field stripped; assert `factQuery` on that predicate
returns `{}` without throwing) and replacing the verbatim guard-text search
with a shape-based one: the negative-control variant now locates the
`for (const axis of ...) {` loop header by its syntactic shape and replaces
it with the bare, unguarded `spec.axes`, independent of how the guard is
currently spelled. Re-proven, all by exit code: revert the real guard to
bare `spec.axes` → `m4-check.mjs` RED (41/42, exit 1); restore → GREEN
(42/42, exit 0); swap the real guard to the `Array.isArray` spelling →
STAYS GREEN (42/42, exit 0 — the fix's whole point, where the unfixed case
went red); restore the original spelling → GREEN again (42/42, exit 0).
Full offline suite re-verified green by exit code after restoring the
original file: m1 20/20, m2 10/10, m3 26/26, m4 42/42, m5 66/66, m6 46/46,
demo(mock) 33/33. No case other than 42 was touched. **G1 and G2 stay
PENDING** — this changes executable test code covered by both gates and
has not been run by the user at this commit. (SUPERSEDED — see the top
entry above: the user's full run on the uncommitted tree subsequently
MET both gates.)

## 2026-08-18 — FINISHES the axis-signal unification the prior entry started (agent-run, not yet user-validated): all SIX operator axes now gate on `PREDICATES.axes`/`needXxx`, closing the two the prior round left on the old per-axis pattern

**DECISION**

The prior entry moved `roaming`/`reachability` onto
the `needRoaming`/`needReachability` signal but left SIM/device gated on
`hasOwn(q, thresholdKey)` and location/KYC gated on value-presence
(`q.area`/`q.claimedName`) — two live sources of truth for the same
question, which is exactly what `axes` was supposed to remove. Now
`poc/m5-facts-orange.mjs` gates all four on `needSim`/`needDevice`/
`needLocation`/`needKyc === true`, re-checked the same way the other two
already were. `readSwapAxis` gained an explicit fail-closed guard —
`!Number.isSafeInteger(thresholdMs) || thresholdMs <= 0` → no read on
either surface — needed because moving the gate off the threshold key
means the function is now reachable with `needSim: true` and no valid
threshold at all; before this guard a present-but-invalid threshold fell
into the `/retrieve-date` branch (a raw-date read for an unvalidated
window) instead of being refused. Location/KYC keep their existing value
validation ALONGSIDE the new signal check — the signal decides whether to
read, the value still decides what to send. `m5-check.mjs` grew from
63 → 66: every hand-built query literal that exercises SIM/device/
location/KYC now carries the matching `needXxx: true`; new case 64 pins
the threshold fail-closed guard, new case 65 pins the location/KYC
fail-closed outcome on an absent value (case 60 itself updated to carry
the signal so it keeps testing value re-validation rather than going
vacuous under the new gate), and new case 66 is the direct negative for
the unification — a well-formed value with the `needXxx` flag omitted now
makes zero calls on all four axes. Also closes a separate, pre-existing
gap: the earlier round's `spec.axes ?? []` guard had no test able to
detect its own absence (reverting it left every offline suite green,
since no current `PREDICATES` entry lacks `axes`) — new `m4-check.mjs`
case 42 dynamically imports a variant of the real source with one entry's
`axes` field stripped, proving `factQuery` tolerates it, and a second
variant with the guard also stripped, proving that one throws
(`m4-check.mjs` 41 → 42). Every changed/added case mutation-proven
(revert → red, exit 1 → restore → green) against the real files. Verified
green by exit code: m1 20/20, m2 10/10, m3 26/26, **m4 42/42**,
**m5 66/66**, m6 46/46, demo(mock) 33/33 — all agent-run offline;
`m5-check-live.mjs` was NOT run this round (no live credentials in this
session) — it needed no code change, since every query it builds already
goes through `factQuery`, the real seam, rather than a hand-built literal.
**G1 and G2 stay PENDING**: this changes executable code covered by both
gates and has not been run by the user at this commit. Full record:
`CHANGELOG.md`, Unreleased. (SUPERSEDED — see the top entry above: the
user's full run on the uncommitted tree subsequently MET both gates.)

## 2026-08-18 — CLOSES the `roaming`/`reachability` unconditional-read open design item (agent-run, not yet user-validated): both axes are now conditional on `getFacts`, gated on a `factQuery`-carried `needRoaming`/ `needReachability` signal — the same pattern the SIM/device axes already used

**DECISION**

`poc/m4-facts-mock.mjs`'s `PREDICATES` table gains a single `axes`
field per predicate (the one place the predicate → operator-axis mapping
lives); `factQuery` emits the axis as a flat top-level boolean ONLY when the
predicate's own value validated (a malformed/unknown predicate still yields
`{}`, unchanged — case 40's `plain()` guard in `m6-check.mjs` is untouched).
`poc/m5-facts-orange.mjs` gates the two live reads on the signal, re-checked
`=== true` (this file re-validates every query field rather than trusting
the caller). 15 existing `m5-check.mjs` cases were rewired — not weakened —
to declare the axis they exercise, plus 3 new cases (61/62: read-only-when-
asked with a negative control for each axis; 63: the fail-closed chain, no
query → zero live calls → refusal, never a guessed bit) and a new
`m4-check.mjs` case 41 for the "axis signal only when the predicate's own
value validated" guard. Six mutation proofs (revert → red → restore →
green) covered both clusters (the generic auth/redaction cases and the
roaming/reachability behaviour cases) plus the core `factQuery` gating
logic. Verified green by exit code: m1 20/20, m2 10/10, m3 26/26,
**m4 41/41**, **m5 63/63**, m6 46/46, demo(mock) 33/33 — all agent-run
offline; `m5-check-live.mjs` (updated for the new contract, cases 17/18)
and `demo.mjs --backend orange` were NOT run this round (no live
credentials in this session). **G1 and G2 are RE-OPENED (PENDING)**:
executable code covered by both gates changed since the full user run at
`4446517` recorded directly below, and per this repo's own rule that
record covers only its own commit — the user has not run this change.
Full record: `CHANGELOG.md`, Unreleased.

## 2026-08-18 — user ran the FULL validation suite on their own machine at `4446517`/`c921508`, log timestamped 08:16: every suite clean, zero `FAIL`, zero `TypeError`, zero `Error:` lines in the entire log. BOTH gates MET at `4446517`, for the first time at the same commit

**DECISION**


`m1-check.mjs` 20/20, `m2-check.mjs` 10/10, `m3-check.mjs` 26/26,
`m4-check.mjs` 40/40, `m5-check.mjs` 60/60, `m6-check.mjs` 46/46,
`demo.mjs` (mock) 33/33, `demo.mjs --backend orange` (live, real Orange
Playground) 33/33, `m5-check-live.mjs` (live, real Orange Playground)
19/19 — verified directly against the user's log by the main session.
Every count is user-run; none is agent-run. G1 (M1–M4 + M6 all
user-validated) is MET at the current counts (20/10/26/40/46). G2 (M5
user-validated live) is MET on both legs (offline 60/60, live 19/19).
This is the first time both gates have been met at the same commit on a
tree that had already been through two `/code-review` rounds with every
fix mutation-proven — see the two entries directly below for what those
rounds changed. Per this repo's own rule, this record covers `4446517`
(code) / `c921508` (docs) and nothing later; a future change to any
covered file re-opens the relevant gate the same way the two rounds
below did. Full record: `findings.md`, 2026-08-18 (latest).

## 2026-08-18 — second `/code-review medium --fix` round: cross-requester sealing fixed (m6 45 → 46), spec closure — G1 and G2 were PENDING at `4446517` until the full user run above

**DECISION**

The round-1 tree (`c15fcc0`) had the
operator sealing every signed refusal AND every answer to a hardcoded
`keys.rpEnc.publicKey` instead of the envelope key of the issuer step 3/4
had just authenticated — the directory already carried `encPub` for
exactly this and nothing read it. With a second directory-listed
requester, that requester's query passes signature verification and the
operator encrypts the answer under the FIRST requester's key: cross-requester
disclosure between two authenticated principals, invisible with one requester in
the world. Fixed by resolving `entry.encPub` at step 3 and threading it as
`recipientEnc` through every seal call site; an issuer with no `encPub`
now reports `unknown issuer`. Also closed `spec/carrier-attestation.yaml`'s
`Predicate` schema to `additionalProperties: false`, matching what
`evaluatePredicate` already enforces in code. New case m6 46 CROSS-REQUESTER
SEALING (`twoRpWorld()`, both directions/both reply kinds) is
mutation-proven — reverting the fix alone gives 45/46, exit 1 — and is the
THIRD fix in this project's history to ship with no net until its own
case existed. **One item surfaced and deliberately NOT built this round:**
`m5-facts-orange.mjs`'s `roaming`/`reachability` reads are still
unconditional on every `getFacts` call (same class as the SIM/device axes
round 1 already conditioned), which needs a `factQuery`-carrying signal
for predicates with no query value — **OPEN DESIGN ITEM, awaiting the
user's decision**, not a defect. Two further items recorded as stated
limits (the `r6b` scan frame structurally cannot red against `NEEDLES`;
the pre-seal size guard uses the module `OAEP_CAPACITY` constant rather
than a key-derived capacity, an M2-owned fix). `/security` re-run: clean,
did NOT catch the sealing defect — not proof. Verified green by exit
code: m1 20/20, m2 10/10, m3 26/26, m4 40/40, m5 60/60, **m6 46/46**,
demo(mock) 33/33. **Consequence: this round changed `poc/demo.mjs` again
— one of the two files the last user validation (`3276ed0`) covered — so
G1 and G2 remained PENDING at this commit** (SUPERSEDED — see the
2026-08-18 (latest) entry above: the user's full run at `4446517`
subsequently MET both gates), and the tree had moved three times since
that validation (`9b04854`, `c15fcc0`, `4446517`). Full record:
`findings.md`, 2026-08-18 (latest); commit `4446517`.

## 2026-08-18 — `/code-review medium --fix` round + `/security` (6 fixes, 1 user-approved behaviour change): m3 25 → 26, m5 58 → 60; G1 AND G2 BOTH RE-OPENED (PENDING) at `9b04854`

**DECISION**

(SUPERSEDED — see the
2026-08-18 (latest) entry above: the user's full run at `4446517`
subsequently MET both gates.) Reviewed the six live-touching
files (`poc/demo.mjs`, `poc/m3-check.mjs`, `poc/m3-floor.mjs`,
`poc/m5-check.mjs`, `poc/m5-facts-orange.mjs`,
`spec/carrier-attestation.yaml`). Six fixes: an unknown floor field name
reaching a refusal reason RAW (log-line-forging via newline/NUL, bounded
to 40 chars printable ASCII); the "effective floor" assertion recomputing
`checkFloor` locally instead of reading the operator's own return (passed
identically for an operator that discarded the effective floor);
`getFacts` trusting `q.area`/`q.claimedName` verbatim on a path a caller
could reach without going through `factQuery` (now re-validated); the requester
registering a pending nonce BEFORE `seal()` (leaked one unconsumable entry
per oversize retry); `verifyResponse` throwing a bare `TypeError` instead
of returning a verdict under `skipNonceStore`+no-fallback; and a spec-doc
divergence (`additionalProperties:false` omitting `number`) now stated
instead of left as a trap. **Finding 7, escalated and USER-APPROVED as a
behaviour change:** the SIM-swap axis was read UNCONDITIONALLY in
`m5-facts-orange.mjs`, so a `reachable`/`roamingIn`/`presentIn`/
`numberMatch` question — none of which carry a SIM threshold — still made
a metered `/retrieve-date` call and pulled a raw SIM-swap date
operator-side for a question nobody asked; now conditional, matching the
device-axis pattern, on the user's stated reasoning that a reference
operator holding an unrequested raw value undercuts the CAMARA proposal's
own no-raw-value-to-leak argument for `/check`. That change REPAIRED (not
weakened) 7 pinned m5 cases (10, 11, 12, 14, 15, 27, 49) via an explicit
SIM-question fixture threaded through each. Three new mutation-proven
cases (m3 26, m5 59, m5 60) closed two real coverage gaps (m3/m5 scored
25/25 and 58/58 whether fixes 1 and 3 were present or reverted, before
these cases existed). `/security` re-run for the first time across this
round: clean, no new findings. **Consequence: this round changed exactly
the two files (`poc/demo.mjs`, `poc/m5-facts-orange.mjs`) that gates G1
and G2 were user-validated against at tip `3276ed0` — by this repo's own
rule a user record covers only the tree it was run on, so BOTH gates are
PENDING again at `9b04854`, and the `3276ed0` records for M1/M2/M4/M6/demo
do not transfer forward either, even where their counts (20/10/40/45/33)
are unchanged — the tree changed under them.** Full record:
`findings.md`, 2026-08-18 (latest); commit `9b04854`.

## 2026-08-18 — a LIVE Orange run at 32/33 caught a vacuous negative control; fixed, and then RE-RUN LIVE at 33/33 (USER-RUN, tip `3276ed0`)

**DECISION**

Assertion 1's leaky-operator control reused the section's
shared `simSwapAge ≥ P90D` predicate. P90D is 2160 hours, under M5's
measured 2400-hour `/check` cap, so on the orange backend that question
answers via `/check` — a surface that never reads or holds a raw date at
all. `facts.swapAgeMs` was `undefined` on that path, so the control's
asserted condition ("a leaky operator reds the scanner") was structurally
false, not merely unmet: there was no raw age operator-side to leak. The
harness did the right thing — it failed loudly (`hits=[]`, `verdict='ok'`)
instead of passing vacuously. **Fix:** the leaky-operator control now asks
a dedicated `LEAK_PREDICATE` at `P365D` (8760h, above the cap), which
forces `/retrieve-date` on both backends, where a real raw date genuinely
exists to leak. Mutation-proven offline first (an injected-transport
replay reproduced the exact vacuous pass under the old P90D shape and
reds cleanly under the new one), no case count moved (still 33 — this
fixes an existing assertion, not a new one). **Then the user re-ran `node
poc/demo.mjs --backend orange` live and reported 33/33** — the SECOND user
run of `poc/demo.mjs` (M6) against the real Playground and the first CLEAN
one (the first, on 2026-08-17, is the 32/33 run above that surfaced the
vacuous control being fixed here), meeting G2's literal definition ("same
demo, `--backend orange`, against Orange Playground") for the composition.
**The user then also re-ran
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` live at the same tip and
reported 19/19** — the current 6-predicate count, closing the "G2 stays
PENDING" mark the 3 → 6 round's `m5-check-live` grounding-failure entry
(below) had left open. **G2 is therefore MET at `3276ed0`, on both its M5
and its M6 legs; nothing pending.** `m6-check.mjs`'s and the other
modules' own offline counts stay agent-run (m1 20, m2 10, m3 25, m4 40, m5
58, m6 45, demo-mock 33) — these two live runs validate the demo and the
M5 live gate, not the offline module checks. Full mechanism, the accidental
`/check`-narrows-operator-attack-surface finding this bug surfaced, and the
live `/check`-vs-`/retrieve-date` cap-boundary measurement (`P90D` →
`check maxAge=2160h` → `true`; `P365D` → `retrieve-date` → `false`):
`findings.md`, 2026-08-17/18, and the addendum in the CAMARA proposal §3.5.

## 2026-08-17 — a LIVE Orange run at 32/33 caught a vacuous negative control, fixed, and an accidental argument FOR `/check`

**EVIDENCE**
The user ran `node poc/demo.mjs --backend orange` live against the Orange
Playground: 32/33. Everything held except one negative control:

```
negative flip → FAIL: a leaky operator reds the SAME scanner, and M1 rejects the response anyway
  — hits=[]; requester verdict='ok' (closed claim set)
```

`m5-check-live.mjs` passed 19/19 live in the same session, and every offline
suite was green (m1 20, m2 10, m3 25, m4 40, m5 58, m6 45, demo 33/33 on mock)
— so this was not a regression in the profile core, it was the control itself.
(The question of whether this particular 19/19 run carried forward to the
current tip was open as of this entry; it is settled by the entry above.)

### The mechanism

Assertion 1's leaky-operator negative used the section's shared predicate,
`{type:'simSwapAge', operator:'gte', value:'P90D'}`. P90D is 2160 hours, under
M5's measured 2400-hour `/check` cap (see `m5-facts-orange.mjs`,
`m6-check.mjs` case 22) — so on the orange backend this question runs through
`/check`, which answers a bit about the ASKED WINDOW and never reads or holds
a raw date at all. `facts.swapAgeMs` is `undefined` on that path; the
`if (controls.leakRaw) claims.swapAgeMs = facts.swapAgeMs;` line assigns
`undefined`, `JSON.stringify` drops the key, the wire scanner has nothing to
find, and M1 sees a claim set with no extra field to reject. The control's
asserted condition (`leakHits.length > 0 && ... rejected`) was FALSE — not
because the profile leaked, but because a raw age operator-side to leak is
STRUCTURALLY ABSENT on `/check`. The same control passes on mock only because
the mock backend always materializes `swapAgeMs` regardless of what was
asked.

The harness did the right thing: it failed loudly instead of passing
vacuously. A control that cannot fail must never be asserted as though it
did — the bug was in the assertion, not in M1/M2/M3.

### The fix

`poc/demo.mjs`'s leaky-operator control (`q1c`/`r1c`, assertion 1) now asks a
dedicated `LEAK_PREDICATE` at `P365D` instead of reusing the shared P90D
predicate. P365D (8760h) is above the `/check` cap, so it forces
`/retrieve-date` on the orange backend, where a real raw date genuinely
exists in `facts.swapAgeMs` for `leakRaw` to leak. Verified offline (zero
network) with an injected-transport replay mirroring `m6-check.mjs` case 22's
shape: the fixed control REDS the leak (scanner hits, M1 rejects) on BOTH the
mock and the replayed-orange path; replaying the OLD P90D shape against the
same orange transport reproduces the exact live-observed vacuous pass
(`hits=[]`, `verdict='ok'`) offline. `swapAgeAtLeastMs` (the `/check` bit's
own accompanying window value) is the REQUESTER'S OWN THRESHOLD, not a
subscriber value — leaking it would not be a raw-value leak, so it was never
a candidate replacement.

### The accidental finding, worth stating on its own

This is a genuine argument FOR the `/check` surface, discovered by accident
rather than by design: on the profile-conforming `/check` path, there is no
raw age held operator-side to leak in the first place, so a whole CLASS of
operator mistake (accidentally or maliciously attaching the raw date to an
otherwise-correct answer) is structurally unavailable rather than merely
prevented by a downstream check. `/retrieve-date` still needs the M1 closed
claim set as its only defence for that class of mistake; `/check` gets it for
free from the shape of the data it holds. This strengthens (rather than
introduces) `m5-facts-orange.mjs`'s existing "why `/check`, when the proposal
itself lists it as non-conforming" argument — the cap-boundary and
menu-quantisation ordering the module already documents, plus this: `/check`
narrows the operator's own attack surface, not only the requester's exposure.

---

## 2026-08-17 — a LIVE convergence probe settled the Admin `location` write shape (three rounds, three 400s to two) and closed the `kyc`/`deviceSwap` "still untested" labels

**EVIDENCE**
A second live measurement, again the user's — no credentials, no network on the
agent side. Rather than script one field, run live, read the next 400, and
repeat (the pattern the prior entry below left the reader with, one live run
per missing field), a throwaway probe was written to keep RE-SUBMITTING the
same Admin UPDATE against the SAME slot (`+990100000099`) until it converged in
one sitting.

### The measurement — verbatim

The Admin READ of `+990100000099` (before the converging writes) returned:

```
{"data":{
  "location":{"lastLocationTime":"2026-08-11T04:00:16.503Z","available":true,"latitude":48.8566,"longitude":2.3522,"radius":500},
  "reachability":{"reachabilityStatus":"CONNECTED_DATA"},
  "roaming":{"roaming":false},
  "simSwap":{"latestSimChange":"2026-04-19T01:47:40.334Z"},
  "deviceSwap":{"latestDeviceChange":"2026-08-11T04:00:16.516Z"},
  "tenure":{"latestTenureChange":"2026-08-11T04:00:16.516Z","contractType":"PAYM"},
  "kyc":{"name":"Alice Arnaud"}}}
```

The write convergence, verbatim:

```
round 1 → 400 "data.location.available" is required
round 2 → 400 "data.location.radius" is required
round 3 → 200 OK
```

A READ-back after the round-3 write returned the payload intact.

### What this settles

1. **The `location` Admin write shape is `{latitude, longitude,
   lastLocationTime, available, radius}`.** The prior entry (below) had already
   corrected the missing `lastLocationTime`; this run found the store also
   demands `available` and then `radius` before it will accept a position at
   all. The adapter and its fixtures now write and verify all five fields.
2. **`kyc:{name}` moves from ASSUMED to MEASURED-GOOD.** It was in the
   converged 200 payload above and read back verbatim — the same axis this log
   ranked "best-supported of the three" purely on an observed READ shape, and
   then correctly downgraded once the location run showed a READ shape does not
   guarantee a WRITE field set. That downgrade is not reversed by this
   measurement; it is SUPERSEDED by a direct write measurement, which is
   stronger evidence than either prior reading of it.
3. **`deviceSwap:{latestDeviceChange}` likewise moves from ASSUMED to
   MEASURED-GOOD** — same converged write, same verbatim read-back.
4. **`tenure:{latestTenureChange, contractType}` exists operator-side, exactly
   as the 2026-08-17 endpoint sweep (below) already found.** This is a direct
   observation supporting that decision, not a reopening of it: still no CAMARA
   read endpoint for tenure, still out of the wired predicate set.

### The reusable lesson

The prior entry's generalisable lesson stands and gets a corollary: an OBSERVED
READ shape does not tell you the REQUIRED WRITE field set — but a CONVERGING
PROBE (submit, read the ONE field the 400 names, add it, resubmit, repeat)
turns "one missing field per live gate run" into "one missing field per round
of the same run." Three rounds against one slot settled a shape that would
otherwise have taken three separate live-gate cycles to discover one field at a
time — each with its own round-trip back to this log.

### The one design decision made outright: `radius`

`radius` is written `500`, not the probe's own placeholder `0`. Reasoning:
radius is the position's ACCURACY, and the READ above shows `500` already
resident in the slot — writing `0` would claim an infinite-precision fix the
operator never asserted. If a future measurement shows `radius` interacting
with `presentIn`/PARTIAL semantics (the location-verification verdict
depending on the value written here), that is a new open question, not one
this entry closes.

(AGENT-RUN implementation off this finding; the measurement itself is the
user's, as above.)

---

## 2026-08-17 — the USER's LIVE Playground run of the 3 → 6 round: the assumed `location` write shape FAILED LOUD, and it was supposed to

**EVIDENCE**
The first live run of the tree at `81f8da4`. It is the only measurement in this
log that the agent did not and could not make — no credentials, no network — so
everything in this section is the user's observation, quoted.

### The measurement

`admin UPDATE` was refused, verbatim:

```
admin UPDATE failed (status 400): {"code":"BAD_REQUEST","status":400,
"message":"\"data.location.lastLocationTime\" is required"}
```

The adapter wrote `location: {latitude, longitude}` — CAMARA's own spelling for a
point, and the whole justification the code gave for the guess. The Orange Admin
store will not hold a position without an OBSERVATION INSTANT beside it.

### Why this is the design working rather than the design failing

This axis was labelled, in the code and in `poc/README.md`, as the WEAKEST of
three ASSUMED Admin write shapes — the only one whose stored shape had never been
read at all. The stated argument for shipping a guess was that a wrong one would
fail LOUD naming the axis instead of silently scripting a backstory that never
took effect. That is exactly what happened, on the first contact with the real
API, with the missing field named. Nothing was signed against a position that was
never stored.

**The generalisable lesson, which is bigger than this field:** an OBSERVED READ
shape does not tell you the REQUIRED WRITE field set. The `kyc` axis was ranked
"best-supported of the three" precisely because its sub-object and field name had
been observed in a READ body — and that ranking is now known to be weaker
evidence than it read as. Recorded against `kyc` in the code.

### The fix, and its three constraints

`lastLocationTime` is written as `new Date(nowMs).toISOString()`:

1. **Off the INJECTED clock, never `Date.now()`.** Every scripted instant in this
   module is `nowMs` minus an offset; this one is `nowMs` itself. A wall clock
   would make the same demo write different bytes on two runs, which is the one
   property the injected-clock design buys. Mutation-proven: swapping it for
   `Date.now()` reds `m5-check` (exit 1).
2. **It is SCRIPTING, not disclosure.** `getFacts` still never reads a
   `lastLocationTime` — not the one the operator wrote, and not the one
   `location-verification/v1/verify` ships on every response. It is now in the
   demo's wire-byte needle inventory in all three spellings (epoch ms, ISO, ISO
   date) alongside the two swap instants, so a future line that let it out reds.
3. **It rides the same read-after-write loop as every other axis**, as its OWN
   axis `geoAt` rather than a third component of `geo` — a slot that stores the
   position and rewrites the instant must fail naming the instant, because "the
   position did not store" is a different bug with a different fix.

### What this run did NOT settle — the `kyc` write shape

The run **aborted at the location axis**, which sits immediately ahead of `kyc`
in the same Admin payload. So `kyc: {name}` has **never reached the Admin API**
and remains ASSUMED — labelled as such in the code, in `poc/README.md` and here.
It is the next thing the live run will settle, in either direction.

Also still unsettled by this run, for the same reason: `deviceSwap:
{latestDeviceChange}`, and the three assumed REQUEST bodies
(`{phoneNumber, maxAge}` for the two `/check` routes, `{device, area}` for
location-verification, `{phoneNumber, name}` for kyc-match).

---

## 2026-08-17 — the same live run found a GROUNDING failure: `m5-check-live.mjs` was never updated by the 3 → 6 round

**EVIDENCE**
The second defect the user's run surfaced, and the less flattering one. It is
recorded because the mechanism that let it happen is general.

### What was observed

The live gate died before it proved anything:

* **case 1 (the write trap) FAILED.** It asserts a throw NAMING the built-in
  shadowing. It got a throw — `invalid backstory: deviceSwappedDaysAgo must be
  whole non-negative days` — and its `names the shadowing` extra was `false`.
* **case 2 (the negative control) FAILED** for the same reason.
* the script then **CRASHED uncaught at line 190**, so nothing after it ran.

### The mechanism

`git log 8238d02..81f8da4 -- poc/m5-check-live.mjs` is **EMPTY**. The 3 → 6
predicate round widened M5's backstory from three fields to six and updated
`m5-check.mjs`, `m4-check.mjs`, `m6-check.mjs` and `demo.mjs` — every sibling.
All eight `setBackstory` calls in the live check still passed the old
`{swappedDaysAgo, roamingCountry, reachable}`, which M5's closed-field validation
now refuses.

**Why this one file and not the others:** it is the only check in the tree that
cannot be run offline. Every sibling reds on a clean clone the moment a contract
moves; this one can only red at the gate, and the gate needs credentials the
agent does not have. A file that nobody can run drifts silently.

**And the second-order finding, which is the more useful one:** case 1 could
report a throw as evidence a guard fired. `"it threw"` and `"the guard fired"`
are different claims, and only the extra label distinguished them — so the case
went red truthfully, but its own stated reason was never what failed it.

### The fix, and what it costs to keep

1. **A new case 1 pins the story against the adapter's closed field set,
   OFFLINE, before any network call.** The full story must reach a throwing
   transport sentinel (proving it PASSES validation — the leg that would have
   caught this drift), each of the six fields must be REQUIRED, and an unknown
   field must be refused by name. It reds on a clean clone with zero credentials.
2. **The trap case now asserts it failed for its own reason** — the message must
   name the shadowing AND must not be a validation refusal.
3. **The suite went 11 → 19 cases**, covering the three predicates the round
   added on the LIVE path the way `m5-check.mjs` covers them offline:
   `deviceSwapAge` with its negative and axis-independence, `presentIn` both ways
   plus the third-state handling, `numberMatch` both ways plus the gradient
   staying operator-side, and the `/check`-vs-`/retrieve-date` surface choice
   read off the wire through a recording pass-through transport.

### What this section is NOT

Every count above is **AGENT-RUN through an injected-transport REPLAY of the
Playground**, not against Orange. The replay proves control flow, story shape and
the 19-case tally (19/19, exit 0) and reproduces the user's failure exactly when
the old file is put back (exit 1, the trap red for the wrong reason). **It proves
nothing about what the Playground answers today.** Five mutations were killed
through it: the story drifting; the adapter dropping a required field; the
surface preference removed; the device axis reading the SIM field; `PARTIAL`
rounded instead of refused.

---

## 2026-08-17 — the 3 → 6 predicate round, BUILT: `deviceSwapAge`, `presentIn`, `numberMatch` wired; 38 mutations, 2 survivors both real, 1 flake (AGENT-RUN; user validation PENDING)

**EVIDENCE**
Everything below is **AGENT-RUN by exit code on this machine**, offline, no
network in either backend mode. G1 stays **NOT met**. Base commit `fe271df`.

### The scan went red on its first run, and it was right to

The six-predicate wire scan failed immediately with `hits=["FR","FR"]`. Not a
leak: `roamingIn ["FR","BE"]` puts `FR` in the SIGNED CLAIMS by design, because
profile rule 2 requires the answer to name the predicate it answers. A value the
requester put INTO the question is not a disclosure when it comes back out — the
same argument already recorded for the subscriber number.

So each frame is now scanned against the inventory MINUS whatever the question it
answers already carried, and **the size of that exclusion is asserted** (at most
one needle per frame): an exclusion that quietly swallowed the inventory would be
a scanner that cannot red, which is exactly the defect the previous round found.
Mutating the exclusion to drop every needle reds `node poc/demo.mjs`.

**Honest limit, and a real one:** this makes the scan blind to a leak of the SAME
value on the AXIS BEING ASKED ABOUT. If the operator echoed its stored country
into a `roamingIn [FR]` answer, that is byte-identical to the echoed question and
no scanner can separate the two. M1's closed claim set is what actually prevents
it (the leaky-operator control shows that firing); the scan covers every OTHER
value the operator holds. Stated rather than glossed, because the alternative —
dropping `FR` from the inventory — is how the scanner ended up checking one value
five ways last time.

### `/check` is the profile-conforming surface, and it is now the one that runs

`/check` answers `{"swapped":bool}` for a `maxAge` window in HOURS, capped at
2400 (measured, boundary-tested 2400 → 200 / 2401 → 400). That cap is
arithmetic, so the split is not a preference:

```
P30D  =  720h  ->  /check          (operator never reads a date)
P90D  = 2160h  ->  /check
P180D = 4320h  ->  /retrieve-date  (the cap cannot express it)
P365D = 8760h  ->  /retrieve-date
```

There is deliberately no rounding DOWN to a window `/check` can express: that
answers a question nobody asked, signed. `m5-check` case 49 reads which URL went
on the wire per bucket and what `maxAge` rode with it; `m6-check` case 22 pins
that the orange leg of the byte-identity claim really did ask `/check` with
`maxAge=2160` and never touched `/retrieve-date`.

Consequence worth stating: on the `/check` path the operator's own raw fact is a
BOOLEAN, not a timestamp. The profile's argument that windowing is something the
operator does TO a value it holds does not even need to be made there — it never
holds the value.

### A coarse answer is a bit about ONE window, and has to say which

`/check` cannot be compared against an arbitrary threshold, so the fact carries
the window it was computed for (`swapAgeAtLeastMs`) and the compare refuses
unless it EQUALS the threshold asked. Mutating that equality away leaves a module
that can answer "not swapped in 30 days" to a "90 days?" question with a bit that
is signed, verifiable and wrong — killed by m4 case 35.

### `factQuery`, and what it measured

Three of the six predicates need part of the question at the adapter. Handing
`req.predicate` down would put unvalidated wire input into the one module that
builds outbound HTTP — a hostile getter or a revoked Proxy delivered to a network
client instead of being refused. `factQuery` is the chokepoint: never throws,
invokes nothing caller-supplied, returns frozen primitives or `{}`.

Measured while pinning it (m6 case 40): a hostile value on a **menu'd** type never
reaches the adapter at all — the published menu refuses it before any fact is
read. So the shapes that DO reach the seam are the ones on unmenu'd types and the
ones that are not predicates at all; all six arrive as `{}`.

### The Admin write shape for `deviceSwap` is ASSUMED, not measured

What is measured: the Admin READ axis list includes `deviceSwap`, and
`device-swap/v1/retrieve-date` answers `{"latestDeviceChange":…}`. What is NOT:
that an Admin `UPDATE` accepts `deviceSwap:{latestDeviceChange}`. The write
mirrors the one shape that IS verified (`simSwap:{latestSimChange}`), and the
module's read-after-write verification is what makes guessing survivable — a
wrong guess fails LOUD naming the axis rather than scripting a device history
that never took effect. **The live run is what settles it, and nothing here
claims it is settled.** Same for the `{phoneNumber, maxAge}` body shape of the
two `/check` routes, mirrored from sim-swap's measured bare form.

### Mutation table — twelve mutations, twelve killed

| # | Mutation | Red |
|---|---|---|
| 1 | m4: the `/check` window need not equal the threshold | m4 exit 1 |
| 2 | m4: the coarse bit need not be a boolean | m4 exit 1 |
| 3 | m4: `deviceSwapAge` reads the SIM fact | m4, m6, demo all exit 1 |
| 4 | m5: `/check` polarity flipped (`swapped` read as "old enough") | m5, m6 exit 1 |
| 5 | m5: the 2400-hour cap ignored | m5 exit 1 |
| 6 | m5: `swapped` read by truthiness, not as a boolean | m5 exit 1 |
| 7 | m5: the device axis read whether asked or not | m5 exit 1 |
| 8 | m5: the device write not read back | m5 exit 1 |
| 9 | demo: the raw predicate handed to the facts backend | m6 exit 1 |
| 10 | demo: `deviceSwapAge` has no published menu | m6 exit 1 |
| 11 | demo: the wire scan excludes every needle | demo exit 1 |
| 12 | m6-check: the two story day counts made equal | m6 exit 1 |

Every one restored byte-identical afterwards and re-run green.

### A defect in the mutation HARNESS, recorded because it cost a real scare

The harness backs up with `cp` and restores after each mutation — but it had no
restore on INTERRUPT, and a 2-minute command timeout killed it mid-mutation,
leaving mutation 10 applied in the working copy. The next run then reported
`applied=false` (the code was already mutated) with suites red, which reads like
a surviving mutant and is actually a dirty tree. Caught only because the harness
reports whether the mutation applied — the same instrumentation the 2026-08-17
entry below added for the opposite reason. Restored by hand and re-verified.

A separate one-off: immediately after a harness run, `node poc/demo.mjs` and
`node poc/m6-check.mjs` each exited 1 once, then both were green on every
subsequent run. **40 consecutive demo runs and 12 consecutive m6-check runs are
clean**, so it is recorded as unreproduced rather than explained — measured
rather than argued away.

### Part 2 — `presentIn`, and the state that is not an answer

`location-verification/v1/verify` has three measured states, and the third is the
reason this predicate is interesting: `PARTIAL` is the operator saying *I cannot
answer at the resolution you asked for*. Rounding it to `true` or `false` produces
a SIGNED answer that is byte-indistinguishable on the wire from a real one, which
is the missing-fact-as-confident-negative failure with a signature over it.

Four things this half measured rather than assumed:

**The published policy is a FLOOR AXIS, so "tighten-only" is literal.**
`partialPolicy` has exactly one legal value (`refuse`), so a request asking to
have PARTIAL rounded for it is a LOOSENING and is refused by the same M3 gate
that refuses a below-floor window — before any fact is read. No new mechanism, and
no parameter anywhere that turns the rounding on. This moved a user-validated
module: **m3 24 → 25**, AGENT-RUN.

**Canonicalisation by key order was a real bug, found by writing the case.**
`JSON.stringify` serialises an object in INSERTION order, and a parsed request's
insertion order is whatever the requester typed. `{lat,long,radiusM}` and
`{radiusM,long,lat}` are the same circle and produced two different signed
predicate strings — so a requester who spelled it the second way would receive its
own correct answer back and reject it as `predicate mismatch`. A self-inflicted
denial of service that only appears once someone types the keys in another order.
Fixed by rendering object values with SORTED keys; m6 case 43 pins order-freedom
AND injectivity together, since the cheap fix (render nothing but the values)
would re-open the collision M6 exists to close.

**`lastLocationTime` is not filtered — it is never read.** The raw timestamp rides
on every response including the boolean-looking ones, and the adapter has no line
that reads it, so there is nothing to filter and nothing to forget to filter. m5
case 53 scans the whole returned facts object for it. Same shape one layer down:
the mock computes a real great-circle verdict and returns the VERDICT, never the
position — m4 case 37 scans the facts for the subscriber's coordinates.

**A residual this axis ADDS, recorded rather than glossed.** An area is a dial —
centre plus radius — and a requester willing to pay can walk it toward a position
exactly as a duration threshold can be bisected. `presentIn` gets no bucket menu
(the signed decision does not give it one, and there is no natural coarse set of
circles the way there is of durations), so the cap here is the operator's own
resolution — below which the answer is a refusal rather than a finer bit — plus
the rate-limit and per-query-billing backstop. That is WEAKER than the duration
menu and is written down as weaker.

### The second mutation table — 14 mutations, 1 survivor, and the survivor was right

| # | Mutation | Red |
|---|---|---|
| 13 | m4: PARTIAL rounded to `true` instead of refused | m4, m6, demo exit 1 |
| 14 | m4: the lat/long bounds dropped | m4 exit 1 |
| 15 | m4: the radius bound dropped | m4 exit 1 |
| 16 | m4: the mock never produces PARTIAL (resolution ignored) | m4, demo exit 1 |
| 17 | m4: the subscriber position leaked into the facts | m4 exit 1 |
| 18 | m5: an unrecognised verdict guessed instead of left absent | m5 exit 1 |
| 19 | m5: the location endpoint called with no question | m5 exit 1 |
| 20 | m5: `lastLocationTime` read into the facts | m5 exit 1 |
| 21 | m5: the LOCATION write not read back | **SURVIVED — see below** |
| 22 | m3: `partialPolicy` not a closed enum | m3, m6 exit 1 |
| 23 | demo: the area canonicalised in typing order | m6 exit 1 |
| 24 | demo: the published PARTIAL policy dropped from the floor | m6, demo exit 1 |
| 25 | m5: the assumed-shape note dropped from the failure message | m5 exit 1 |
| 26 | m5: a null location verified anyway | m5 exit 1 |

**Survivor 21 was a real gap, not a redundant guard.** Deleting the location axis
from the write-verification loop left `m5-check` green — so the read-after-write
comparison that makes this round's ASSUMED Admin write shapes survivable was
pinned for the device axis and not for the location one, which is the weaker
assumption of the two. Closed by extending case 52 with a shadowed-position leg
and a null-location leg; 21 is red after the fix, and 25/26 were minted against
the fix itself.

Fixing 26 also removed a real piece of dead logic: `got.geo` carried its own
`location === null ? undefined` guard, which made the loop's skip redundant and
therefore unkillable. The `got` side now always reads the stored value, exactly as
the country axis does, and the skip is load-bearing.

### Part 3 — `numberMatch`, where the raw value IS the response

`kyc-match` does not answer a match bit. It answers a similarity SCORE, and the
score moves with how close the guess got — measured 2026-08-17:

```
"Alice Arnaud"  (correct)     -> {"nameMatch":"true"}                       no score
"Bob Wrong"                   -> {"nameMatch":"false","nameMatchScore":53}
"Alice Arnaut"  (ONE letter)  -> {"nameMatch":"false","nameMatchScore":97}
```

Two measured response shapes that a naive implementation gets WRONG, and both are
now guarded and pinned:

- **`nameMatch` is a STRING**, not a boolean — and `"false"` is truthy, so
  `if (body.nameMatch)` reports a NON-match as a match. This is the single most
  consequential coercion in the adapter.
- **An exact match carries NO score at all.** So "compare the score against the
  threshold" alone answers `false` to the strongest possible match; the exact
  branch has to satisfy every threshold without a score.

**The mock's score source reproduces both measured values exactly.** The mock
needed a gradient of its own (a scripted 97 would demonstrate the plumbing while
assuming the phenomenon), so it computes Jaro-Winkler — chosen independently as a
plausible standard string metric. It returns **97** for `Alice Arnaut` and **53**
for `Bob Wrong`: both measured Playground values, exactly. Two agreeing points is
EVIDENCE, not proof, and nothing in the profile depends on which metric an
operator uses. Recorded because a reader reproducing the PoC will see the same
numbers and should know why they match.

```
"Alice Arnaud"       -> nameMatch true, no score
"Alice Arnaut"       -> false, 97      <- matches the measured value
"Bob Wrong"          -> false, 53      <- matches the measured value
"alice arnaud"       -> false, 84
"Alice Marie Arnaud" -> false, 91
```

**A disclosure in the OTHER direction, stated rather than glossed:** the operator
learns what the requester claims. That is inherent to a comparison — both sides
are needed — and it is the one row of the table where profile mode does not narrow
anything for the requester. Mode A retains the query log either way (§3.5).

### The third mutation table — 12 mutations, 1 survivor, same shape as part 2's

| # | Mutation | Red |
|---|---|---|
| 27 | m4: a missing score read as zero instead of unanswerable | m4 exit 1 |
| 28 | m4: an exact match requires a score (perfect match reads false) | m4 exit 1 |
| 29 | m4: the match threshold shape unchecked | m4 exit 1 |
| 30 | m4: `claimed` allowed on every predicate type | m4 exit 1 |
| 31 | m4: the claimed name unbounded/unchecked | m4 exit 1 |
| 32 | m5: `nameMatch` read by truthiness (`"false"` becomes a match) | m5 exit 1 |
| 33 | m5: an out-of-range or non-integer score carried anyway | m5 exit 1 |
| 34 | m5: `kyc-match` called whether a name was claimed or not | m5 exit 1 |
| 35 | m5: the kyc-name write not read back | **SURVIVED — see below** |
| 36 | demo: the claimed name left out of the canonical predicate | m6 exit 1 |
| 37 | demo: `numberMatch` has no published menu | m6, demo exit 1 |
| 38 | m5: a null `registeredName` verified anyway | m5 exit 1 |

**Survivor 35 is the identical gap survivor 21 was, in the identical place** — the
read-after-write comparison for an assumed write shape, pinned for two axes and
not the third. That is the argument for pinning EVERY assumed shape rather than
one representative of them, and it is why the fix added a shadowed-name leg beside
the shadowed-position one rather than a general assertion.

### A real flake, caught by a re-run and fixed rather than retried

Case 44 went red once and green twice. The cause was mine and it is one this log
already records: it scanned the two-character needle `97` against **RSA
ciphertext** (a 2-char string lands in 512 random bytes about one run in eight)
and against an **unblanked random hex nonce** (about one run in sixty). A needle
that reds a clean run asserts nothing. Fixed the way the wire scanner already
handles it — long forms against opaque artifacts, the full set against plaintext
with the nonce blanked — rather than by re-running until it passed.

### Suite state after part 3 — ALL AGENT-RUN, user run PENDING

```
m1 20/20 · m2 10/10 · m3 25/25 · m4 40/40 · m5 56/56 · m6 45/45 · demo 33/33
```

Every one verified by exit code. `spec/carrier-attestation.yaml` re-parsed after
each enum edit (**six** wired types; `Predicate` carries `claimed`, `Floor`
carries `partialPolicy`).

---

## 2026-08-17 — M6 adversarial review: five ways to crash or DoS the operator, a 29%-survival mutation sweep, and four labels that claimed more than they checked (AGENT-RUN; user validation PENDING)

**EVIDENCE**
Everything below is **AGENT-RUN by exit code on this machine**, offline, no
network in either backend mode. G1 (PRD §4.4) stays **NOT met**: no user has run
M6, and this round also moved M1 to 20 and M3 to 24, so those two lose their
user-validated status until re-run. Base commit `8238d02`.

An independent adversarial review of the M6 round filed six defects with a
consolidated repro script. All six reproduced on the first run. Four were real
code defects; one was the wire-scanner's LABEL overstating what it scanned; one
was a narration line. Fixing the first two surfaced a fifth crash the review had
not found.

### The four real defects, and the fifth found while fixing them

**1. The operator could be crashed remotely, two ways.** `handle()`'s contract is
that untrusted wire input produces a verdict and never a throw. Two inputs broke
it, both on a request that fits one envelope, both reachable by anyone holding
the operator's public envelope key:

- an **unbounded echoed NONCE**. `req.nonce` was type-checked and never
  length-checked; `signedReject` puts it in the claims and `seal()`s them. 200
  characters → `seal: payload is 500 bytes, over the 446-byte OAEP capacity`,
  thrown straight out of `handle` and up through `roundTrip` → `runDemo` →
  `main`.
- a **clamp counting UTF-16 code units where `seal` counts BYTES**. A floor value
  of 40 astral characters produced a "clamped" 121-unit reason that was 363
  bytes → the same throw, through the ordinary M3 floor-reason path.

The comment above the clamp claimed the worst wire-reachable reason had been
*measured* to fit. It had not. The bound is now computed and the arithmetic is
written down rather than asserted: frame fixed overhead 136 B (32 + 16 `iss` +
88 base64 signature) → base64 payload budget 310 → 308 usable (multiple of 4) →
claims ≤ 231 B → 39 B fixed → **E + N ≤ 192 B**, split 122 / 70 as the
JSON-ENCODED sizes. Measured, not derived on paper: the empty refusal frame is
196 B with 43 B of claims, which pins the 136 exactly. `clampReason` now bounds
the ENCODED byte length (one control character costs six bytes as `\u00XX`, so a
raw-byte bound would still be wrong) and cuts on a CODE POINT boundary, so no
character is split and no lone surrogate is emitted. 122 keeps every previously
pinned reason byte-identical — a quote-free ASCII reason encodes to length + 2,
so the old 120-character cut point does not move. An over-long nonce is a
TRANSPORT reject, in the clear: a nonce the operator cannot echo is one it
cannot sign a refusal against.

**Case 29 seals the worst refusal the two bounds admit — 68-byte nonce beside a
maximal multibyte reason — and measures it at 444/446 B.** Two bytes of
headroom, which is the point of pinning it: that line reds if `iss` ever grows,
which is the one input the stated arithmetic assumes.

**1c. THE FIFTH, found while fixing the first two and not on the review's list:
a request that fits one envelope does not imply an answer that does.**
`roamingIn` takes a SET, and the canonical predicate string re-escapes every
quote in it, so the answer frame grows faster than the request did. Measured: 18
two-letter country codes fit a 446-byte request and produce a **448-byte answer
frame** — `seal()` threw out of `handle` again, on a perfectly legal question.
The answer frame is now measured before it is sealed and an overflow becomes a
signed refusal (a refusal carries no predicate, so it always fits). Case 30 pins
the boundary with a 14-code control that still answers.

**2. A forged response permanently burned the pending nonce.**
`pending.delete(nonce)` ran BEFORE the verdict was examined, so the untrusted hub
— the party the whole design assumes is hostile — could inject **one** garbage
sealed response and the operator's genuine answer then arrived to `unknown or
already-used nonce`. A one-message denial of service. The in-code comment already
said "CONSUMED on any VERIFIED exchange"; the code consumed on any PRESENTED one.
The contract was right and the code was not. Consumption now happens only on an
accepted answer or a verified signed refusal; case 31 also pins the other
direction, that the genuine answer is still single-use afterwards.

**3. `verifyRefusal` never ran the duplicate-key scan.** Profile rule 2 requires
verifiers to reject duplicate claim keys. `verifyAttestation` does it. M6
exported M1's scanner **this very round** precisely so the request path would not
carry a second copy — and then wrote a second verifier that did not call it. One
signature over `{"error":"below floor","error":"off menu",…}` read as one refusal
to a last-wins parser and another to a first-wins one. Fixed in M1's own order
(signature → parse → scan).

**4. Operator-internal diagnostics were signed and delivered to the untrusted
requester.** The backend's exception message was forwarded verbatim into the
signed refusal. On the Orange path an upstream 500 ships a core-network hostname
or pool name to whoever asked — AGENT_RULES invariant 4, broken in the one place
the operator is most likely to be having a bad day. Now one stable reason
(`no facts available for this subject`), with the full message kept on
`operatorDetail`, which never enters the claims and is never sealed. Case 33
throws a message shaped like a real upstream failure
(`sim-swap-pool-07.core.example.net`, tenant, trace id) and scans the ciphertext,
the claims and the requester's verdict for every fragment.

Two decisions recorded rather than assumed:

- **"Unknown subject" and "temporarily unavailable" are deliberately NOT told
  apart.** Distinguishing them is a subject-existence oracle built out of
  refusals — free enumeration of which numbers the operator serves, without ever
  getting an answer. Same reasoning that makes M2 collapse every decryption
  failure into one `undecryptable`.
- **The requester's own submitted number is not echoed back.** The review asked
  whether naming it is disclosure. It is not — it is data they sent. It is
  dropped because it is not NEEDED (the nonce already binds the refusal to that
  exact request) and because putting unbounded wire text into a sealed reason is
  the class of move that produced the nonce crash above. **Case 12 asserted the
  OPPOSITE** ("names the number") — it was pinning the defect, and now pins the
  fix.

### The mutation sweep: 34 meaningful mutations, 10 survivors, 29% survival

Against a shipped claim of "18 mutations against M6's own guards, all killed".
Both numbers are true and the second is the useful one: the original 18 were
self-selected and happened to hit what the suite already pinned. **The claim has
been corrected in `prd.md` and `CHANGELOG.md` rather than left standing.**

The ten survivors, each now pinned:

| # | Survivor | Pinned by |
|---|---|---|
| 1 | `unpackSigned` → `null` → `transportReject('malformed request')` never reached | m6 case 34 |
| 2 | `typeof req.nonce !== 'string'` → `'missing nonce'` never reached | m6 case 35 |
| 3 | **the floor gate moved AFTER `getFacts` left the suite green** | m6 case 36 |
| 4 | `verifyRefusal`'s closed key set (`error,exp,nonce`) | m6 case 37 |
| 5 | `verifyRefusal`'s nonce binding | m6 case 37 |
| 6 | `verifyRefusal`'s expiry check | m6 case 37 |
| 7 | `unpackSigned`'s `typeof … !== 'string'` guards | m6 case 34 |
| 8 | `unpackSigned`'s `Array.isArray(o)` guard | **not pinned — proved REDUNDANT** |
| 9 | the hub log had no closed field set | m6 case 38 |
| 10 | M3 `render`'s `symbol` / `function` branches | m3 case 24 |

Survivor 3 is the one that mattered. "Refused BEFORE any fact is read" is the
justification for the entire pipeline ORDER — *a computed-then-discarded answer
is still an oracle query* — it was claimed in two case comments and asserted
nowhere. Case 36 now **instruments the backend**: a spying `getFacts` counts
calls, and the below-floor and off-menu paths must both read **0** while the
accepted path reads **1**. Counted, not described.

**Survivor 8 is the one that could not be killed, and the honest reading is that
it is redundant, not that the suite is weak.** `unpackSigned`'s `Array.isArray`
was mutated away and `m6-check` stayed green (exit **0**) even with case 34
sending `[1,2,3]`. Proved rather than argued: only `JSON.parse` output reaches
that line, a parsed array's own keys are always its numeric indices, so an array
can never carry own string-valued `iss`/`payload`/`sig` and always dies on the
`typeof` line below instead — guarded and unguarded agreed on **9 array shapes,
0 divergent**. The guard stays as documented defence in depth ("a list is not a
record", said out loud) and is recorded as a **deliberately-unpinned redundant
guard**, not counted as a kill. Exactly the finding and the resolution M4
already reached for the same call in `plainSnapshot`. **So the sweep closes at 9
of 10 survivors pinned and 1 proved unpinnable** — writing a case to "cover" an
unreachable branch would have been a case that cannot fail.

Survivor 10 is pinned in `m3-check.mjs` and not in `m6-check.mjs` on purpose:
**reverting M3's whole `render` fix leaves `m6-check` green**, because the
composition's envelope is what keeps a symbol or a function off the wire. That
is consistent with the fix belonging to M3 — so its pin belongs there too. Saying
so explicitly rather than leaving it implicit, because "the transport happens to
filter it" is exactly the structural accident M3's own case 23 refuses to treat
as a contract.

### Four labels that claimed more than the code checked

No false PASS in any of them — the assertions were true, they just were not
asserting the headline.

- **case 23's `extra` was the literal `ok: true`.** Now asserts M5's export
  surface is exactly one function and carries no `evaluatePredicate` of its own.
- **"the hub opening a message it just carried gets nothing"** opened RSA
  ciphertext with an unrelated fresh key. That asserts RSA-OAEP works; the hub's
  blindness is STRUCTURAL (it is never handed a key) and has no failing case to
  write. Kept as narration, relabelled to what it exercises, in both `demo.mjs`
  and `m6-check.mjs` (case renamed `14 NON-RECIPIENT KEY OPENS NOTHING`). The
  evidence that CAN fail is the log scan and its chatty control.
- **"the effective floor is visible"** asserted only `accepted === true` — a gate
  returning the operator's own floor verbatim would have passed. The effective
  floor is now read: both tightened axes must be the REQUESTER's values and the
  untouched axis the operator's. Mutating M3's `effective[axis] = r === p ? pub :
  req` to `= pub` reds `node poc/demo.mjs`.
- **case 22's byte-identity headline** ("the strongest form the FR5 claim can
  take") was near-vacuous: the signed claims are backend-independent except for
  the boolean, so the frame stays identical even when the orange replay reports a
  swap age nowhere near the mock's. The MECHANISM is sound — the review confirmed
  the orange leg drives M5's real write-verification — so the claim was rewritten
  to what it proves, and a second leg was added that CAN fail: replay a 5-day-old
  swap through the same injected transport and the same question comes back
  `false` while the mock still says `true`. Without it, an adapter that ignored
  its own responses would pass the identity check perfectly.

### The wire-byte scanner was scanning one value five ways

`rawNeedles` was five long-form spellings of the swap timestamp. Four plausible
leaks scored **ZERO** hits while the printed line read "no raw value in ANY wire
artifact": `{"swapDays":137}`, `{"c":"FR"}` (the roaming COUNTRY VALUE — a raw
value under profile rule 1 as much as the date is), `{"m":"+990100000099"}` and
`{"d":"2026-04-02"}`. M1's closed claim set is the real defence and it works, so
this was an honesty defect, not an open leak.

The inventory is now complete at **nine** needles, and the split that was hidden
inside it is explicit: OPAQUE artifacts (RSA ciphertext, base64-bearing frames)
take the seven long forms; PLAINTEXT artifacts take all nine with the random hex
nonce blanked first. Both halves are measured, not assumed — a 2-character
country code lands inside 512 random bytes about one run in 8 and inside a
308-character base64 payload about one in 13; a 3-digit day count lands inside a
32-character hex nonce about one in 140. That is why those two are scanned only
where a hit is real, and why blanking the nonce is what turns the day count from
a flaky needle into an asserting one. Case 18's control plants all five leaks.

### Red → green evidence

Every fix was mutation-proven by reverting it in the working copy (`cp` from a
scratchpad snapshot — never `git checkout`, which would have wiped the
uncommitted fix under test), confirming the target suite exits **1**, then
restoring and confirming **0**. The reviewer's own `repro.mjs` was used as the
red/green oracle alongside `m6-check`, and goes from **6 defects reproduced** to
**0**.

One honest note on that script: its F5 line is written `R('F5', true, …)` — the
verdict is hardcoded, so it reports a defect regardless of the code. It cannot
reach zero by construction. It reaches **0 defect(s) reproduced** with that one
line corrected to test what its own message describes (does the requester's
reason carry the backend's internal detail?), and the correction is a one-line
diff kept beside the run. Reported rather than worked around.

### Suite state after the round

`m1 20/20 · m2 10/10 · m3 24/24 · m4 33/33 · m5 48/48 · m6 38/38 · demo 22/22`,
every one exit 0. Exit-code contract re-verified: clean mock **0**, mock mid-run
crash **1**, orange-without-credential **2**, bad argument **2**.
`spec/carrier-attestation.yaml` parses.

Docs corrected in the same round: the PRD's "every count above is from a run on
the user's own machine" (false the moment M6/M1/M3 landed above it, and the only
place in the repo claiming user validation for M6), the root README's
count/carve-out, `poc/README.md`'s `conclude()` list, the re-measured
`demo.mjs` line composition (1093 / 452 comment / 90 blank / 551 code — the old
873/282/509 no longer summed), the spec's still-open `AttestRequest` top-level
field set, and the spec's `value` example still showing `"voice+data"` after
`simType` left the enum.

---

## 2026-08-17 — Playground endpoint sweep: the band endpoint does not exist, `kyc-match` leaks a similarity GRADIENT, location has three states (AGENT-RUN; user validation PENDING)

**EVIDENCE**
Two standalone probes against the Orange Network APIs Playground, number
`+990100000099`, importing nothing from this repo (so nothing here is an
artefact of the adapter's own parsing). Every line below is a response that was
received, pasted verbatim. **Nothing in this entry is built yet** — it is the
evidence a build round starts from.

### Which endpoints actually answer

```
sim-swap/v1/retrieve-date        200  {"latestSimChange":"2026-04-19T01:47:40.334Z"}
sim-swap/v1/check                200  {"swapped":false}
sim-swap/v1/retrieve-age-band    400  {"code":"BAD_REQUEST","message":"unhandled path"}
device-swap/v1/retrieve-date     200  {"latestDeviceChange":"2026-08-11T04:00:16.516Z"}
device-swap/v1/check             200  {"swapped":true}
kyc-match/v1/match               200  (see the gradient below)
location-verification/v1/verify  200  (see the three states below)
number-verification/v1/verify    403  "Request must define a phoneNumber"
tenure/v1/retrieve               400  "unhandled path"
sim-tenure/v1/retrieve           400  "unhandled path"
kyc-age-verification/v1/verify   400  "unhandled path"
device-location/v1/retrieve      400  "unhandled path"
```

**`/retrieve-age-band` DOES NOT EXIST on the Playground.** That closes an item
this log recorded one entry down as UNVERIFIED — "never probed, recorded as
untested rather than assumed in either direction." It has now been probed, and
the honest answer is the unflattering one: the surface that *would* fit the
profile is absent, so band → bucket mapping cannot be demonstrated live at all.
It stays mock-only or documented; it does not get claimed. `400 "unhandled
path"` is the Playground's own signal for a route that isn't wired (the same
signal the 2026-08-16 spike used to tell a missing endpoint from a real one
rejecting a bad shape), so this is an absence, not a permissions problem.

**The `/check` boolean surface EXISTS and works** on both sim-swap and
device-swap — which matters, because it is the shape the profile actually
wants, and up to now the PoC only had `/retrieve-date` measured.

**`number-verification/v1/verify` exists** and 403s with *"Request must define a
phoneNumber"* — the 3-legged shape, where the subject comes from the token. Not
a missing endpoint.

**No CAMARA read endpoint was found for tenure**, at either `tenure/v1/retrieve`
or `sim-tenure/v1/retrieve`, even though the operator-side data is there (below).

### `/check` maxAge is in HOURS, capped at 2400 — boundary-tested on both surfaces

```
maxAge=2400  → 200
maxAge=2401  → 400  "maxAge" must be less than or equal to 2400
```

2400 hours ≈ 100 days. Consequence, stated as arithmetic rather than opinion:
`/check` can serve the `P30D` and `P90D` buckets of the published menu and
**cannot express `P180D` or `P365D` at all.** This is the same cap measured
2026-08-14, now boundary-tested (the 2400/2401 pair) and confirmed identical on
device-swap.

### The `kyc-match` score gradient — the most important measurement of the round

`kyc-match` does not return a match bit. It returns a *similarity score*, and
the score moves with how close you got:

```
name = "Alice Arnaud"   (correct)      → {"nameMatch":"true"}                        no score
name = "Bob Wrong"                     → {"nameMatch":"false","nameMatchScore":53}
name = "Alice Arnaut"   (ONE letter)   → {"nameMatch":"false","nameMatchScore":97}
```

That is a **warmer/colder oracle**. A requester that may guess repeatedly can
hill-climb the score to the subscriber's real registered name — which is
strictly worse than binary guessing, because binary guessing has no gradient to
follow. It is the repeated-query oracle again, but arriving through a single
response field instead of a sequence of thresholds.

**This forces a visible retraction.** The CAMARA proposal claims, in two places
(the §3.3 adoption checklist and the §3.3.1 illustrative table), that
`kyc-match` *"conforms as-is — scores are already bands (rule 7)."* That is
measurably wrong. A band is a coarsening: it destroys resolution inside the
bucket. A similarity score is the opposite — it *preserves* the distance to the
answer and hands it to the requester. The retraction is in the proposal, left
visible, with this measurement next to it. The profile's answer: return the
boolean only, never the score, with the threshold declared in the question off a
published coarse menu.

Also measured on this sandbox: `givenName`, `familyName`, `birthdate` and
`address` all answer `not_available` (only `name` is stored); `email` → 400
validation error; an empty request → 400
`KNOW_YOUR_CUSTOMER.INVALID_PARAM_COMBINATION`.

### `location-verification` has THREE states, not two

```
Paris, radius 10km   → {"verificationResult":"TRUE","lastLocationTime":"2026-08-11T04:00:16.503Z"}
Tokyo, radius 10km   → {"verificationResult":"FALSE", …}
Paris, radius 1km    → {"verificationResult":"TRUE",  …}
Paris, radius 100m   → {"verificationResult":"PARTIAL","matchRate":100, …}
```

`PARTIAL` is the endpoint saying *I cannot answer this at the resolution you
asked for.* Rounding it to `TRUE` or `FALSE` is the missing-fact-as-confident-
negative failure the proposal's §3.3.1 row 3 already has teeth about — signed,
and indistinguishable on the wire from a real answer.

And note what rides along on **every** response, including the ones that look
purely boolean: `lastLocationTime`, a raw timestamp. Even a catalog endpoint
whose headline field is a verdict hands back a raw value beside it. That value
is legitimately the operator's; it must never cross the wire to a requester.

### Operator-side data (Admin API), for completeness

READ axes confirmed: `location, reachability, roaming, simSwap, deviceSwap,
tenure, kyc`. `tenure` holds `latestTenureChange` + `contractType:"PAYM"`;
`kyc` holds `name:"Alice Arnaud"`.

So the tenure data **exists operator-side and has no CAMARA read endpoint**.
That is precisely why `tenure` and `simType` stay OUT of the wired predicate set
(PRD §9, dated today): a predicate whose only source is an operator-internal
admin surface is not catalog-backed, and wiring it would prove something about
this sandbox rather than about CAMARA.

### A grounding failure, recorded plainly

Earlier in this session the orchestrator stated there was **"no fact source
known"** for `tenure` / `simType`. That was wrong, and *this file already said
so*: the 2026-08-16 spike entry records the Admin data model carrying seven axes
including `tenure` and `kyc`, with the note "M5 touches three of the seven; the
rest are untouched, not unnoticed." The claim was made without re-reading the
evidence log it was written into. The conclusion happens to survive — tenure
still stays out, but for the *measured* reason above (no CAMARA endpoint), not
the asserted one (no data). Recorded because a right answer reached by not
checking is not evidence, and this log exists so nothing gets re-argued from
memory.

### Suite state at `e28bc0b` — ALL AGENT-RUN, user re-run PENDING

```
m1 20/20 · m2 10/10 · m3 23/23 · m4 33/33 · m5 48/48 · m6 28/28
poc/demo.mjs 22/22
```

Every one verified by exit code by the orchestrator. **No user has run this
tree.** An adversarial review round of M6 (blind fit-to-pass probe, independent
mutation sweep, can-fail audit, leak/honesty audit) was IN FLIGHT while this
entry was written; its findings are not yet known and will be recorded when they
land, not anticipated here.

### The M6 exit-code defect, independently mutation-proved — and one harness confound caught first

The exit-code fix recorded in the entry below was re-proved by the orchestrator
rather than taken from the author agent's report:

```
fix reverted   node poc/m6-check.mjs   FAIL 28 CRASHED MOCK RUN IS 1, NOT 2 …
                                       mock mid-run throw=2 (regression, must be 1)
                                       RESULT: 27/28    exit 1
fix restored   git diff --quiet        clean (byte-identical restore)
```

Worth recording for its own sake: **the orchestrator's FIRST mutation attempt
did not apply.** Its regex anchor did not match the shipped code; the script
printed `mutation applied: False`, and the "green" run that followed proved
exactly nothing — a passing suite against unmutated code. It was caught because
the script reported whether the mutation landed. Standing lesson, the same one
this log has hit before: **debug the degenerate — or the too-convenient —
result before believing it.** A mutation harness must state whether it mutated
anything, or a green run is indistinguishable from a no-op.

---

## 2026-08-17 (later) — Exit 2 was hiding a real regression; six spec deviations recorded (AGENT-RUN; user validation PENDING)

**EVIDENCE**
Every number here is **AGENT-RUN by exit code on this machine.** The earlier
2026-08-17 entry below is left exactly as it was recorded — its `27/27` was true
of the tree it was run on, and this round moved the count to 28.

**The defect, reproduced before it was fixed.** `main()` mapped ANY mid-run
throw to exit 2. Exit 2 is the signed contract for *the chosen backend could not
run* — but `--backend mock` has no prerequisites at all: no credential, no
network, nothing that can be unavailable. So a mock run that STARTED and then
threw could only be a code regression, and it reported itself as a skip.

```
# a genuine regression, injected as a throwing mock setBackstory:
node poc/demo.mjs      exit 2      <- BEFORE (reads as "prerequisite missing")
node poc/demo.mjs      exit 1      <- AFTER  (reads as "a run that failed")
```

A CI gate that treats 2 as skip-on-prerequisite — which is the correct reading
of the contract — would have swallowed that regression in silence. Same family
as the closed-field-set defect below: **the composition owns a boundary no
module owns, and an under-modelled boundary rounds optimistically toward
"fine".** Under `--backend orange` a mid-run throw stays 2, because there an
unreachable live operator genuinely IS a prerequisite failure.

Pinned by new case 28, which drives the REAL `main()` with a backend that starts
clean and throws on first use (the shape a regression has, and not the shape
case 24's could-not-start leg covers), and asserts the clean mock run alongside
so the case cannot pass by making every mock run exit 1.

**Mutation-proved** (revert → red → restore → green), not merely re-run:

```
fix reverted   node poc/m6-check.mjs   FAIL 28 … mock mid-run throw=2   RESULT: 27/28   exit 1
fix restored   node poc/m6-check.mjs   PASS 28 … mock mid-run throw=1   RESULT: 28/28   exit 0
```

**The exit-code contract, observed end to end, not asserted:**

```
clean mock run                                exit 0
--backend orange, credential deleted          exit 2   (+ printed prerequisites)
--oops                                        exit 2   (+ usage)
mock, backend starts then throws mid-run      exit 1   (orange, same throw: 2)
```

### Runs (all AGENT-RUN, exit code checked, never string-matched)

```
node poc/demo.mjs        RESULT: 22/22   exit 0
node poc/m6-check.mjs    RESULT: 28/28   exit 0
node poc/m1-check.mjs 20/20 · m2 10/10 · m3 23/23 · m4 33/33 · m5 48/48   all exit 0
spec/carrier-attestation.yaml parses; Predicate enum still the 3 wired types
```

**Two smaller items closed.** The closed-field-set control passed
`{ operator: {}, skipRequestFields: true }` to `operator.handle`, which reads
FLAT controls — `operator: {}` was dead copy-paste residue from `roundTrip`'s
nested shape, in the one file readers study line by line. And the requester nonce store
only ever GROWS (a request that never receives a response leaves its entry
resident forever); recorded as an honest limit at the store, in the demo's own
notes, and in `poc/README.md`. **Not built** — exercising a TTL would mean faking
elapsed time, and a stated limit beats an untested one.

**Six deviations from the frozen M6 spec, all now recorded, none left silent.**
Four were ALREADY in the decisions log and were not duplicated: the
parse-then-scan ordering of the duplicate-key scan, `findings.md`'s own
creation, the menu covering only ordered thresholds, and M3's reason length
staying unclamped. The 20 → 22 assertion delta was recorded outside §9 and its
entry now carries the count its siblings all carry. The dependency-injection
seams were **unrecorded anywhere** and got a new entry — with the honest note
that guard-disabling is a SEPARATE, deliberately published `controls` seam
(those really are `if` branches in production functions, and that is the point:
a guard never shown disabled has not been proven load-bearing).

**Why the PoC reads a precise SIM-swap date** is now stated where a reader hits
it (M5 source, CAMARA proposal §2.1, PRD §9) rather than left to be noticed as a
contradiction. The invariant governs the WIRE — the operator legitimately holds
the raw value, and the wire-byte scan is what proves only the bit crosses.
`/check` is unusable here for a MEASURED reason, not a preference: its `maxAge`
is in hours capped at 2400 (≈100 days, measured 2026-08-14), which cannot
express the published menu's `P180D` or `P365D` buckets at all. And
`/retrieve-age-band` — the surface that WOULD fit — is provider-optional and
**was never probed on the Playground: recorded as UNTESTED, not assumed
available and not assumed missing.** Probing it is the obvious next spike.
Documentation only this round: which endpoint M5 calls is unchanged.

---

## 2026-08-17 — M6 built: one-command demo + 27-case check, 18/18 mutants killed, and one defect found by probing the finished file (AGENT-RUN; user validation PENDING)

**EVIDENCE**
Every number in this entry is **AGENT-RUN by exit code on this machine**. No
user has run M6, and no network call was made in either backend mode. G1 (PRD
§4.4: `G1 = M1–M4 + M6 all user-validated`) is therefore **NOT met**.

### The spike came first, and it found five things — before a line was written

A throwaway composition spike outside the tree (mock only, zero credentials,
zero network) attacked the ladder's stated toughest assumption for M6: *the
modules compose without weakening any single module's guarantee*. It ran every
negative as a PAIR — guard ON must reject, and the same scenario with that guard
OFF must ACCEPT — so a control that could not accept failed the spike too.
41 cases, exit 0, 13 of its own mutations killed. Five findings shaped the
build:

1. **The repeated-query oracle (the headline, and the only one no module could
   have caught).** Each response is a clean windowed bit; the SEQUENCE is not.
   With a free-choice threshold, **9** signed, nonce-bound, expiring,
   end-to-end-encrypted, fully metered queries binary-searched the subscriber's
   exact swap age — **137 days, recovered exactly**, implied swap date
   `2026-04-02T00:00:00.000Z`. All 9 responses passed the same raw-value scan
   that assertion 1 uses, and all 9 verified. No module is wrong: M3 gates the
   *profile floor*, not the predicate threshold, and profile rule 1 hands the
   threshold to the requester on purpose. → decision #1 (quantised menu) and the
   honest-limit paragraph in CAMARA proposal §3.5.
2. **The hand-rolled request verifier had no duplicate-key defence.** M1's
   scanner was module-private and `verifyAttestation` cannot be reused on a
   request (it demands the closed ANSWER set). The spike signed request bytes
   carrying `floor` TWICE and the operator answered: V8 read `P90D`, a first-wins
   parser reads `P365D` — one signature, two agreements. → decision #2.
3. **`checkFloor` throws on a non-JSON value.** `JSON.stringify` in the
   rejection-message builder throws on a BigInt and runs a caller-supplied
   `toJSON`, so a bare `TypeError` escaped in the rejection path. Recorded by the
   spike as OBSERVED-not-fixed; fixed at the module (M3 22 → 23).
4. **The obvious canonical-predicate mapping is NOT injective.** A mutation
   dropping the threshold from the string left the whole spike GREEN while the
   operator answered `gte P1D` to a `gte P90D` question — both sides derived the
   same lossy string, so M1's "an answer can never answer a different question"
   quietly stopped holding. Separately, `roamingIn in [FR,BE]` rendered
   identically for `['FR','BE']` and the single-element set `['FR,BE']`; M4
   happened to reject the second, which is luck, not a defence.
5. **M3's unclamped, wire-derived reasons can exceed M2's envelope capacity,
   where `seal()` THROWS** — an unclamped refusal crashes the operator instead of
   refusing. Measured honestly at the spike: the worst reason a single 446-byte
   request envelope can actually provoke still FITS, so the clamp is insurance
   rather than a live bug — but that margin is a coincidence of two
   independently chosen constants (M2's cap and M3's reason prefix), not a
   property either module guarantees.

### And then a sixth finding, from probing the finished file

The build was written, green at 20/20 and 25/25, and mutation-clean at 16/16
before this was found — which is the point of recording it. An adversarial probe
sent hostile shapes at the operator's wire path directly (rather than through the
requester, which an attacker would not use) and turned up a **silent widening at the one
layer nobody had closed.**

Every layer underneath was already a closed set, each for the same stated reason:
M1's claims, M3's floor axes, M4's predicate fields. The outermost envelope — the
request object itself — was not, because no module owns it. Reproduced:

```
request : {"number":"+990100000099","predicate":{…},"floors":{"swapAgeMin":"P365D"},"nonce":"typo-1"}
verdict : answer
claims  : {"predicate":"simSwapAge gte \"P90D\"","result":true,…}
enforced: {"simType":"voice+data","tenureMin":"P2Y","swapAgeMin":"P90D"}   <- the OPERATOR floor
demanded: {"swapAgeMin":"P365D"}                                          <- what the requester believed
```

One letter (`floors`), the demanded floor silently dropped, `checkFloor` handed
`undefined`, the operator's own `P90D` applied, and a **signed** answer returned
with no error anywhere — the exact silent-widening-through-a-typo path M3's
closed axis set exists to kill, arriving one level further out where M3 cannot
see it. Fixed by closing the top-level request field set and refusing unknown
fields BY NAME (naming the misspelling is the actionable half; the name is
rendered only while short and printable, so an embedded newline cannot forge a
line in whatever log the reason reaches). Demo 20 → 22 assertions, check 25 → 27
cases, mutants 16 → 18.

Also probed and CLEAN in the same pass, recorded so they are not re-tried: ten
hostile predicate shapes off the wire (`null`, missing, array, string, number,
object `type`, object `value`, `['FR',null]`, `[]`, boolean) — none threw, none
was answered, every reason inside the clamp; a JSON-parsed `__proto__` key does
not pollute `Object.prototype`; a `floor` that is an array is `malformed floor`;
a numeric `nonce` is `missing nonce`. The requester's `buildRequest` DOES throw on a
malformed predicate — that is its own caller's input, so throwing is the M2/M3
rule working as written, and it means a requester's malformed question fails at
its own desk instead of burning a metered query.

**The general lesson, which is why this is in the log rather than only in the
diff: a closed-set discipline is only as good as its outermost layer, and the
composition owns a layer none of the modules do.** M6's POC gate was aimed at
exactly this failure class and the spike still looked one level too low.

### The build

`poc/demo.mjs` (873 lines, 282 comment / 509 code) and `poc/m6-check.mjs`
(27 cases). The spike was read as the composition reference and **rewritten, not
shipped** (AGENT_RULES: never ship the POC). M6 owns exactly four things no
module owns — the transport frame `{iss, payload, sig}`, the injective canonical
predicate string, the single-use nonce store, and the reason clamp — and each is
pinned by a case and killed by a mutation.

Two properties the spike did not have, added during the build:

- **Refusals past authentication are SIGNED and nonce-bound**, so the blind hub
  cannot forge a denial-of-service by inventing rejections. Before
  authentication they are deliberately UNSIGNED and the requester must treat
  them as hearsay: an operator cannot sign a refusal to a party it cannot name.
- **The off-menu refusal and the floor rejection both run BEFORE any fact is
  read.** A computed-then-discarded answer is still an oracle query.

### Runs (all AGENT-RUN, exit code checked, never string-matched)

```
node poc/demo.mjs        RESULT: 22/22   exit 0   (~5.4s; RSA-4096 keygen dominates)
node poc/m6-check.mjs    RESULT: 27/27   exit 0   (~15s)
node poc/demo.mjs --backend orange   (no credential)   exit 2 + prerequisites
node poc/demo.mjs --oops / --backend sqlite            exit 2 + usage
node poc/m1-check.mjs 20/20 · m2 10/10 · m3 23/23 · m4 33/33 · m5 48/48   all exit 0
```

`m5-check-live.mjs` was NOT run — it needs a credential and the network, and
this round made no live calls at all.

### Mutation sweep — 23 mutants, 23 killed, 0 survivors

Working-copy `cp` backups, never `git checkout` (which would have reverted
tracked files to HEAD and silently wiped the uncommitted fix under test).

M6 (18/18, each red on `m6-check.mjs`): dup-key scan off · menu check off ·
floor gate off · request auth off · directory accepts any `iss` · nonce store
off · nonce never consumed · `iss` hint picks the key · canonical string drops
the threshold · canonical string joins arrays with `,` · reason clamp off ·
`getFacts` throw uncaught · unanswerable predicate not refused · refusal
signature unchecked · needles lose `swapAgeMs` · refusals sent unsigned ·
closed request field set off · field name echoed raw.

M1/M3 (5/5): M3 renders with `JSON.stringify` again · M3 `[unrenderable]` guard
removed · M1 scanner blind · M1 compares raw instead of decoded keys · M1
`export` removed (a loud `SyntaxError`, no green tally — which is the correct
failure for a missing export).

### The check is offline in BOTH backend modes, and the seam claim is byte-exact

`--backend orange` runs M5 through an INJECTED transport replaying captured
Playground shapes, the same technique `m5-check.mjs` uses. With the key set and
the nonce held fixed, the two backends produce a **byte-identical signed frame**
— signature included, since Ed25519 is deterministic:

```
{"predicate":"simSwapAge gte \"P90D\"","result":true,"nonce":"a1b2c3…","exp":1786924860000}
```

That is the strongest form FR5's "only the facts source swaps" claim can take
offline. It does not and cannot prove the Playground still answers today — that
is the live `--backend orange` run, and it is the user's.

### One deliberate deviation from the frozen build order

The specified operator pipeline put the duplicate-key scan inside the
signature-verification step, before the parse. It runs **after** the parse
instead, because M1's exported scanner carries a stated precondition — the text
must already have parsed as JSON, or the key slice it takes can itself throw on
malformed bytes. That is M1's own internal order (signature → parse → scan) and
matching it was preferred to hardening a user-validated module further. The
guarantee is unchanged: nothing from the request is acted on until both the
signature and the scan have passed.

### What is NOT claimed

- No user run. No live Orange call. G1 not met.
- Quantisation CAPS the oracle at ≈2 bits; it does not close it, and the
  proposal says so in those words.
- `poc/demo.mjs` is over §4.3's "a few hundred lines" bound if the whole file is
  counted (873 total, 509 code, roughly half of that the reader-facing
  narrative). Recorded rather than trimmed.

---

## 2026-08-17 — G2 RE-CLOSED at the final v0.3.0 state: user re-ran M5 clean at `8e842c3` (48/48 offline + 11/11 live)

**EVIDENCE**
**This closes the post-gate review round's "user re-run pending"** — the last
pending marker the tree was carrying, and the entry immediately below is the
round that opened it. That round's fixes touched all three M5 files, so the
`4ac60e9` run recorded further down no longer covered the code. The gap is
closed by a run, not by assuming it carried over.

The user personally ran M5 on their own machine on the working tree that
became commit `8e842c3` — the v0.3.0 release state, every review-round fix in,
the code shipping unchanged from there — and reported both suites clean:
`node poc/m5-check.mjs` **48/48** and the live
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` **11/11**.

**M5 is therefore user-validated LIVE at the shipped state, and G2 (PRD §4.4:
`G2 = M5 user-validated live`) is MET with no asterisk and nothing pending.**

### The full user-run record for M5, in order

Four user runs exist for this module. They are listed separately rather than
collapsed, because each covers a different tree state and only the last one
covers what ships:

| # | Commit | Offline | Live | What it covers |
|---|---|---|---|---|
| 1 | `2fd62ba` | 44/44 | 10/10 | pre-review state; **undated at the time** — recorded later for completeness |
| 2 | `69b6f2e` | 47/47 | 11/11 | post-adversarial-review; **the first G2 in the project** |
| 3 | `4ac60e9` | 48/48 | 11/11 | post-release-gate; G2 re-established there |
| 4 | `8e842c3` | **48/48** | **11/11** | post-review-round — **the shipped v0.3.0 state** |

Runs 1–3 are history: the same module at earlier tree states, each superseded
by a round of fixes that changed code they had already covered. Run 4 is the
one the release rests on. Nothing about M5 is pending.

### Release-gate corroboration at `8e842c3`

The v0.3.0 release gate re-ran the offline ladder independently at the
committed state. This corroborates the user's run; it does not substitute for
it — the G2 record is run 4 above. The live suite was NOT re-run by the agent
(it costs Playground quota and the user's run was clean).

| Check | Exit | Result |
|---|---|---|
| `node poc/m1-check.mjs` | **0** | 19/19 |
| `node poc/m2-check.mjs` | **0** | 10/10 |
| `node poc/m3-check.mjs` | **0** | 22/22 |
| `node poc/m4-check.mjs` | **0** | 33/33 |
| `node poc/m5-check.mjs` | **0** | 48/48 |
| secret scan of the review-round diff | — | clean; the only matches are the offline suite's declared SYNTHETIC fixture credential and `ORANGE_BASIC_AUTH` env references |

Every count above is by **exit code**, not by reading a printed tally.

### Open items carried into M6 (unchanged by this run)

Nothing about M5 is pending. Two items remain open and are carried honestly
rather than closed by this release: the M3 `describe()`-throw class, and the
spec-sketch predicate types that are not wired to the PoC (M6 wires or trims
them).

## 2026-08-17 — Post-gate code review round: two adapter redaction-order defects reproduced red and fixed green; G2 re-opened, then re-closed by the user run above

**EVIDENCE**
An 8-angle review of the M5 branch diff found and fixed five code defects.
The two adapter defects were **reproduced against the unfixed tree first**
(a scripted repro with an injected transport, exit 1 pre-fix / exit 0
post-fix; the offline suite stayed 48/48 exit 0 throughout):

1. **`joinStored()` clamped before redacting.** A 78-char known secret planted
   in a stored `countryName` echo produced a `write verification FAILED`
   message carrying the secret's first 48 chars verbatim and no `[REDACTED]`
   (observed: `fragment leaked=true, [REDACTED] present=false`). The exact
   clamp-before-redact fragment leak the `show()` comment documents, one step
   upstream of it — structurally invisible to the suite because the fixture
   secret is 44 chars (< BRIEF_MAX 48) and planted in the sim axis, which
   never passes through `joinStored`. Fixed by redacting each string element
   before the clamp; post-fix the same repro prints `[REDACTED]`, no fragment.
2. **`tokenFor()`'s `await res.text()` sat outside the try that redacts.** A
   token stream dying mid-body rejected there and the planted secret printed
   raw (observed: `secret leaked=true`); the identical /security Low was fixed
   in `post()`'s send only. Post-fix: `token response read failed (camara):
   … [REDACTED]`.

Three live-check faults were fixed by inspection (verified by verifier agents
against the code paths, not run live): the raw admin token bootstrap cached
`access_token: undefined` off a 401 JSON body and `undefined === null` never
refetches — every later call sent `Bearer undefined` and case 11 blamed QUOTA
for an AUTH fault (a non-JSON body additionally threw a raw SyntaxError
quoting the wire body); the courtesy re-script between case 11 and
`conclude(11)` was unguarded, so a transient failure there killed an all-green
run before the tally printed; and case 11's `endSlots < QUOTA_CAP` conjunct
made an at-cap account red under a name blaming a cleanup that succeeded
(now a separate warning).

One further adapter defect, from a review candidate adjudicated AFTER the round
above rather than during it, was fixed the same way:

- **`assertNow()` admitted a safe integer past `Date`'s range.** `9e15` cleared
  the safe-integer and `swappedAtMs < 0` checks, then
  `new Date(swappedAtMs).toISOString()` threw a bare `RangeError: Invalid time
  value` at the caller — the same "opaque error replaces the loud one" class as
  the `joinStored`/`show` fixes above. Bounded at `MAX_EPOCH_MS`
  (8640000000000000), which covers both `setBackstory` and `getFacts` from the
  one check. Mutation-proven: repro exit 1 with the bound reverted (bare
  `RangeError`), exit 0 with it restored (`invalid now: 9000000000000000
  (beyond Date's representable range …)`); no suite case added, 48/48 exit 0
  unchanged.

**Consequence: all three M5 files changed, so the `4ac60e9` user run no longer
covered the tree — G2 was re-opened, counts unchanged (48/48 + 11/11
expected), user re-run of the two-line runbook pending. The user re-ran it the
same day and reported both clean, which re-closed G2 at `8e842c3` — see the
entry above.** Docs-honesty fixes in the same
round: the CHANGELOG headline attributed "the first G2" to the `4ac60e9` run
(the run table below says `69b6f2e`); the root README still said "four modules"
with M5 absent at v0.3.0; case 48's comment said "three legs" while the case
asserts four.

## 2026-08-17 — a throwaway LIVE convergence probe (user-run, `+990100000099`) settled the Admin `location` write shape and moved two other axes from ASSUMED to MEASURED-GOOD

**DECISION**

After the location 400 above named
`lastLocationTime`, the user ran a probe that kept re-submitting the Admin
UPDATE, one 400 at a time, until it converged: round 1 → `400
"data.location.available" is required`; round 2 → `400 "data.location.radius"
is required`; round 3 → `200 OK`, read back intact. Recorded:
(1) **The settled field set is `{latitude, longitude, lastLocationTime,
available, radius}`.** The adapter now writes all five; `available: true`
(every scripted position is one the operator can currently place) and
`radius: 500` (the ONE decision made outright rather than copying the probe's
own placeholder `0` — 500 is the value the same READ showed already resident
in that slot, and a zero-radius write would claim a precision the operator
never asserted). Both join the read-after-write loop as their own axes
(`geoAvailable`, `geoRadius`), the same `geoAt` precedent applies for the same
reason: a mismatch folded into `geo` reads as the wrong bug.
(2) **`kyc:{name}` and `deviceSwap:{latestDeviceChange}` are corrected from
ASSUMED to MEASURED-GOOD**, not reopened: the same converged READ returned both
sub-objects verbatim, closing the "still untested" label this log carried for
`kyc` below. The read-after-write guard on both stays wired regardless —
measured once is not guaranteed forever.
(3) **`tenure:{latestTenureChange, contractType}` exists operator-side, with
no CAMARA read endpoint** (both `tenure/v1/retrieve` and
`sim-tenure/v1/retrieve` answer `400 "unhandled path"`) — this CONFIRMS the
existing decision below (2026-08-16 line, M4 spec) that `tenure` stays out of
the wired predicate set; it is not reopened and no predicate is wired from it.
(4) **The generalisable lesson from the prior entry stands, refined rather than
reversed**: an observed READ shape did not tell the write field set for
`location`, but a CONVERGING PROBE — one field named per round rather than one
live run per field — closed the gap in three rounds instead of three separate
live gates. Counts moved: m5 offline 57 → 58. Agent-run; user re-run of the
live gate stays PENDING.

## 2026-08-17 — the same live run exposed a GROUNDING failure: `m5-check-live.mjs` was the one file the 3 → 6 round never touched (11 → 19 cases)

**DECISION**

Recorded:
(1) **The mechanism is general, not a slip.** It is the only check in the tree
that cannot be run offline, so it is the only one whose drift from a moved
contract nobody could observe until the gate. Every sibling reds on a clean
clone; this one needed credentials to red at all.
(2) **"It threw" is not evidence a guard fired.** The write-trap case caught a
backstory-validation throw while asserting it had caught the built-in
shadowing. It now asserts it failed for its OWN reason.
(3) **The fix is a new offline case 1**: the file's single story definition is
pinned against the adapter's closed field set — the full story must PASS
validation (proven by reaching a throwing transport sentinel), every field must
be required, and an unknown field refused by name. Zero credentials, so a
future field addition reds on a clean clone.
(4) **The live path now covers all six predicates**, each with its negative,
including the `/check`-vs-`/retrieve-date` surface choice read off the wire.
Evidence is an injected-transport REPLAY (19/19 exit 0) plus five killed
mutations, and it is labelled as proving control flow only. **G2 stood
PENDING at this round** — nothing here was a live measurement. **Superseded
2026-08-18: the user ran `node poc/m5-check-live.mjs` live at tip `3276ed0`
and reported 19/19, re-meeting G2 at the current 6-predicate count — see the
latest entry above.**

## 2026-08-17 — the FIRST LIVE run of the 3 → 6 tree corrected the Admin `location` write shape (measured by the USER; agent has no credentials)

**DECISION**


`admin UPDATE` answered `400 BAD_REQUEST "\"data.location.lastLocationTime\" is
required"`. The adapter wrote the bare `{latitude, longitude}` pair. Recorded:
(1) **This is the assumed-shape design working, not failing.** The axis was
shipped as an explicit guess on the argument that a wrong one fails LOUD naming
the axis rather than scripting a position that never took effect — and it did,
on first contact, with the missing field named.
(2) **An OBSERVED READ shape does not tell you the REQUIRED WRITE field set.**
This downgrades the reasoning that ranked `kyc` "best-supported of the three"
because its field name had been seen in a READ body. Written into the code
against that axis.
(3) **The instant is derived from the INJECTED clock**, never `Date.now()` —
the same rule every other scripted instant in M5 follows, and the property that
makes the write payload reproducible.
(4) **It never becomes a readable fact.** `getFacts` reads no
`lastLocationTime` from either direction, and the value now sits in the
wire-byte needle inventory in all three spellings so a future leak reds.
(5) **The run ABORTED at location, so the `kyc: {name}` write shape is STILL
UNTESTED** and stays labelled ASSUMED everywhere it appears. Nothing is claimed
about it in either direction.
Counts moved: m5 offline 56 → 57. m6 (45) and demo (33) are unchanged in count
but changed in content — all three are AGENT-RUN with a user re-run PENDING.
Six mutations, six killed.

## 2026-08-17 — `numberMatch` BUILT; the wired predicate set is now the signed SIX (AGENT-RUN, user validation PENDING)

**DECISION**

`simSwapAge`,
`deviceSwapAge`, `roamingIn`, `presentIn`, `numberMatch`, `reachable`. The
threshold rides off the published menu `60 | 70 | 80 | 90`, the operator
compares internally, and the score never crosses the wire in any spelling.
Recorded:
(1) **`claimed` is the only predicate field that is neither a type nor a
window** — the attribute value the REQUESTER wants compared. It is legal only
for the types that declare it (refused by name elsewhere, like any unknown
field) and it is part of the SIGNED predicate string, or an answer about "does
Bob match?" would verify as an answer about "does Alice match?".
(2) **Two measured response shapes that a naive implementation gets wrong.**
`nameMatch` is the STRING `"true"`/`"false"` — and `"false"` is truthy, so an
unguarded read reports a NON-match as a match. And an EXACT match carries no
score at all, so "compare score against threshold" alone answers `false` to the
strongest possible match.
(3) **The operator learns what the requester claims.** Inherent to a comparison
and disclosure in the OTHER direction; recorded rather than glossed. Profile
mode narrows what the OPERATOR discloses and does not make the requester's query
private — Mode A retains the query log either way.
(4) **An incidental measurement:** the mock needed a score source, and
Jaro-Winkler — chosen independently as a plausible standard metric — reproduces
BOTH measured Playground values exactly (97 for the one-letter near miss, 53 for
the unrelated name). Evidence, not proof, and nothing depends on it.
Counts moved: m4 38 → 40, m5 54 → 56, m6 43 → 45, demo 30 → 33. Twelve more
mutations; **one SURVIVED — the kyc-name write-back, the identical gap the
location axis had, in the identical place**, which is the argument for pinning
every assumed write shape rather than one representative of them.
**One real FLAKE was caught and fixed:** a new case scanned the two-character
needle `97` against RSA ciphertext and against an unblanked random hex nonce,
which is a ~1-in-8 and ~1-in-60 false red — the exact trap this repo already
documented for short needles. Split by artifact class, as the wire scanner
already was.

## 2026-08-17 — `presentIn` BUILT; the predicate set is 3 → 5 so far this round (AGENT-RUN, user validation PENDING)

**DECISION**

The third state is the whole
of it: `location-verification/v1/verify` answers `TRUE`, `FALSE` and `PARTIAL`,
and `PARTIAL` produces a signed REFUSAL carrying no bit. Four things recorded:
(1) **The published PARTIAL policy is a FLOOR AXIS**, `partialPolicy`, with one
legal value (`refuse`) — so "the requester may only tighten it, using the
existing rule-5 machinery" is literally what the code does, and a request asking
to have PARTIAL rounded for it dies at the floor gate before any fact is read.
This moved a user-validated module: **M3 24 → 25 cases**, and that count is
AGENT-RUN.
(2) **The AREA is canonicalised by KEY, not by typing order.** `JSON.stringify`
serialises an object in insertion order, which for a parsed request is whatever
the requester typed; two spellings of the same circle would otherwise produce
two signed predicate strings and one requester would get its own correct answer
back as a `predicate mismatch`.
(3) **`lastLocationTime` is not filtered out — it is never read.** There is no
line that reads it, so there is nothing to filter.
(4) **An honest residual, added not removed:** an area is a dial (centre plus
radius) and is walkable toward a position the way a duration threshold is
bisectable. `presentIn` gets no bucket menu — the signed decision does not give
it one, and there is no natural coarse set of circles the way there is of
durations — so the cap here is the operator's own resolution plus the
rate-limit/billing backstop. Weaker than the duration menu, and written down as
weaker.
Counts moved: m3 24 → 25, m4 36 → 38, m5 52 → 54, m6 40 → 43, demo 27 → 30.
Fourteen more mutations, fourteen killed — **one of which (the location
write-back) SURVIVED on the first pass** and exposed a genuinely unpinned guard:
the read-after-write comparison that makes this round's assumed Admin write
shapes survivable was itself covered for the device axis and not for the
location one. Pinned, plus two more mutations against the fix.

## 2026-08-17 — `deviceSwapAge` BUILT; the predicate set is 3 → 4 so far this round (AGENT-RUN, user validation PENDING)

**DECISION**

The signed design above
is now code: same bucket menu as `simSwapAge`, same `gte` compare, its own
fact. Three things the build settled that the design had only asserted, each
recorded because they are the kind of detail a design round cannot reach.
(1) **The reference adapter now prefers the profile-conforming SURFACE.**
`/check` answers a bit about a `maxAge` window in HOURS capped at 2400
(boundary-tested), so `P30D`/`P90D` questions are answered by `/check` — the
operator never reads a date — and only `P180D`/`P365D` fall back to
`/retrieve-date`. There is deliberately NO rounding down to a window `/check`
can express: that would answer a question nobody asked, signed.
(2) **A coarse `/check` answer is a bit about ONE window, so it carries that
window and the compare refuses unless it EQUALS the threshold asked.** Without
the equality an adapter could answer "not swapped in 30 days" to a "90 days?"
question and the bit would look perfect on the wire.
(3) **A new seam, `factQuery`.** Three of the six predicates make the operator
ask its own upstream a question-shaped question, so part of the predicate has
to reach the adapter. It reaches it through one validating chokepoint that
never throws, invokes nothing caller-supplied and returns frozen primitives or
`{}` — never `req.predicate` itself, which would put unvalidated wire objects
into the one module that builds outbound HTTP. Measured while pinning it: a
hostile value on a MENU'D type never reaches the adapter at all, because the
published menu refuses it before any fact is read.
Counts moved: m4 33 → 36, m5 48 → 52, m6 38 → 40, demo 22 → 27. Twelve
mutations against the round's new guards, twelve killed.

## 2026-08-17 (latest) — The wired predicate set goes 3 → 6 (user-signed; DESIGN, not yet built)

**DECISION**

`simSwapAge`, `deviceSwapAge` (NEW — not one of the
original seven), `roamingIn`, `presentIn`, `numberMatch`, `reachable`. Every
one is backed by an endpoint **observed answering live** on the Playground
today (findings, dated entry: sim-swap `/check` + `/retrieve-date`,
device-swap `/check` + `/retrieve-date`, device-roaming-status,
location-verification `/verify`, kyc-match `/match`,
number-verification `/verify`). This is **not a reversal** of the same-day
trim to 3 — it is that decision's PRINCIPLE applied to new evidence: *wire
only what a real fact source answers.* The trim removed four types nothing
could compute; the sweep then found live sources for four of them, and one
more (`deviceSwapAge`) that was never on the list. `tenure` and `simType` stay
OUT: the data genuinely exists operator-side (the Admin dataset carries a
`tenure` axis with `latestTenureChange` + `contractType`), but **no CAMARA
read endpoint was found** at either `tenure/v1/retrieve` or
`sim-tenure/v1/retrieve` — both `400 "unhandled path"`. A predicate whose only
source is an operator-internal admin surface proves something about this
sandbox, not about the catalog.

## 2026-08-17 (latest) — `deviceSwapAge` takes the IDENTICAL shape to `simSwapAge` (user-signed; DESIGN)

**DECISION**

Same coarse bucket menu
`P30D | P90D | P180D | P365D`, `/check` where the bucket fits inside the
measured 2400-hour (≈100-day) cap, the date path above it. Deliberately not a
new shape: two facts that answer the same question about different hardware
should not teach a reader two grammars, and a second shape is a second place
for the window to widen quietly.

## 2026-08-17 (latest) — `numberMatch`: the requester declares its THRESHOLD in the question, off a published menu of 60 / 70 / 80 / 90 and nothing else; the operator compares internally and answers a BOOLEAN; the score never crosses the wire (user-signed; DESIGN)

**DECISION**

Two halves, both load-bearing. *Why a
threshold at all:* requesters genuinely need their own tolerance — real
names vary by accent, middle name, transliteration and typo, and that is
exactly why CAMARA returns a score in the first place. Forcing one operator
threshold on everybody would either reject legitimate matches or accept sloppy
ones. Profile rule 1 already says the window belongs in the question. *Why a
menu and not free choice:* a free-choice threshold is binary-searchable in
precisely the way the M6 spike binary-searched the swap date — same oracle,
same nine queries, same quantisation answer. And the measured `kyc-match`
behaviour is worse than a threshold walk: it returns a similarity **gradient**
(`"Bob Wrong"` → 53, `"Alice Arnaut"` — one letter off — → 97), which lets a
requester hill-climb to the subscriber's real registered name. Boolean out,
score never on the wire, off-menu refused.

## 2026-08-17 (latest) — `presentIn`: boolean out, and `PARTIAL` REFUSES (user-signed; DESIGN)

**DECISION**

`location-verification/v1/verify` has three states,
measured: `TRUE`, `FALSE`, and `PARTIAL` (Paris at a 100 m radius). `PARTIAL`
is the operator saying *I cannot answer at the resolution you asked for*, and
it is **not rounded** to yes or no — it produces a refusal, the same honest
outcome as a straddling band or a missing fact. Rounding it would sign a
confident answer indistinguishable on the wire from a real one. The operator
PUBLISHES its PARTIAL policy (default: refuse) and the requester may only
TIGHTEN it, never loosen — the existing rule-5 floor machinery, no new
mechanism. `lastLocationTime` (a raw timestamp that rides on *every*
location-verification response, including the boolean-looking ones) never
crosses the wire.

## 2026-08-17 (latest) — Five rules apply to all six predicates, no exceptions (user-signed; DESIGN)

**DECISION**

(1) A signed boolean or a refusal — never a value, a
score or a date. (2) An off-menu threshold is refused **loudly** and never
rounded to the nearest bucket. (3) Anything the operator cannot answer
honestly is a refusal. (4) The operator publishes the floor; the requester may
tighten only. (5) Raw values the operator legitimately holds stay
operator-side. Written as one list rather than per-predicate because a rule
that holds for five of six is not a rule.

## 2026-08-17 (latest) — On the probing oracle generally: the residual walk is priced and bounded at the layer ABOVE this profile (user's position, recorded as the project's stance)

**DECISION**

Per-subject rate limits, per-query billing and the
operator's own query log are where a walk is made expensive, throttleable and
auditable. THIS profile's duty is narrower and absolute: **the raw value never
crosses the wire.** Quantisation caps resolution; it is not claimed to close
the oracle, and the claim is not upgraded now that the predicate set is wider.

## 2026-08-17 (latest) — `/retrieve-age-band` DOES NOT EXIST on the Orange Playground; the previous entry's "UNVERIFIED" is now CLOSED, unfavourably

**DECISION**


`400 {"code":"BAD_REQUEST","message":"unhandled path"}` — the Playground's own
signal for an unwired route. The entry below recorded its availability as
untested rather than assumed in either direction; it has now been probed and
the answer is the unflattering one. Consequence: band → bucket mapping
**cannot be demonstrated live** — it stays mock-only or documented, never
claimed. The `/check` boolean surface, by contrast, does exist and answers
(`{"swapped":false}`), and its `maxAge` cap was boundary-tested at 2400 hours
(2400 → 200, 2401 → 400) on both sim-swap and device-swap.

## 2026-08-17 — Exit 2 is reserved for a backend that COULD NOT RUN; a crashed mock run is a FAILURE (M6)

**DECISION**

Not a planned decision — a defect found
by asking what a genuine regression looks like to a CI gate. `main()` mapped
any mid-run throw to 2, but `--backend mock` has no prerequisites at all (no
credential, no network, nothing that can be unavailable), so a backend that
STARTED and then threw can only be a code regression. A gate that correctly
treats 2 as skip-on-prerequisite would therefore have swallowed a real
regression in silence. Reproduced with a throwing `setBackstory`: 2 before, 1
after. Under `--backend orange` a mid-run throw stays 2 — there an unreachable
live operator genuinely IS a prerequisite failure. The in-code comment had the
direction backwards ("reporting it as a failed assertion would be the more
flattering lie"); the flattering lie is the other one. Same family as the
closed-field-set defect below: **the composition owns a boundary no module
owns, and an under-modelled boundary rounds optimistically toward "fine".**
M6: 27 → 28 cases.

## 2026-08-17 — The requester nonce store's unbounded growth is DOCUMENTED, not built (M6)

**DECISION**

The single-use store deletes a nonce when its response is
verified, so a request that never receives one — rejected by the hub, dropped
in transit, answered after the requester gave up — leaves its entry resident
forever. Harmless in a demo issuing a handful of requests against an injected
clock; unbounded memory in anything real. A deployment evicts on EXPIRY (the
answer's validity window is already the natural TTL). NOT built here: the demo
would have to fake elapsed time to exercise it, and **a stated limit beats an
untested one** — the same rule the rest of this repo's honest limits follow.

## 2026-08-17 — Four DEPENDENCY-INJECTION seams, one code path each (M6)

**DECISION**


Recorded because they are a deviation from the frozen shape and would
otherwise read as test scaffolding in production code. `createWorld({keys})`
(RSA-4096 keygen is ~2.7s/key and the check builds a world per case),
`buildRequest({number, nonce})` (a byte-reproducible transcript is how the two
backends are proved to emit IDENTICAL signed claim bytes),
`createBackend(mode, {basicAuth, fetchImpl})` (replays captured Playground
bytes offline; the `mode` branch is FR5, the user-facing `--backend`, not a
test flag), and `main(argv, {createBackendImpl})` (added 2026-08-17 to drive a
started-then-crashing backend through the real entry point). Each is a default
parameter: no `if (test)`, no `NODE_ENV`, no branch that exists only for a
suite. **Stated honestly:** guard-disabling is a SEPARATE seam — the `controls`
flags on `hub.route` / `operator.handle` / `rp.verifyResponse` ARE `if` branches
in production functions, and that is deliberate and published, because a guard
never shown disabled has not been proven load-bearing. A reader running the
demo passes none of them.

## 2026-08-17 — Why the PoC reads a PRECISE SIM-swap date, and what that does and does not say (M5/M6, documentation only)

**DECISION**

The question is fair: the
profile's own argument favours coarse surfaces, and `/retrieve-date` is the
surface the proposal itself lists as NON-conforming. Three things, none of them
a walk-back. (1) The invariant governs the WIRE. The operator legitimately
holds the raw value — it is the operator's own subscriber data, and windowing
is something it does TO that value; what must never happen is the value
reaching the requester, which the wire-byte scan proves by looking for the raw
needles in the sealed payload and finding only the bit. (2) `/check` is not
used for a MEASURED reason, not a preference: its `maxAge` is expressed in
HOURS with a cap of 2400 (≈100 days, measured 2026-08-14), so it cannot
express the published menu's `P180D` or `P365D` buckets at all — it cannot
serve the profile as specified. (3) `/retrieve-age-band` is the surface that
WOULD fit, and it is provider-optional; **its availability on the Orange
Playground is UNVERIFIED — never probed, recorded as untested rather than
assumed either way.** Which endpoint M5 calls is unchanged this round.

## 2026-08-17 — Predicate thresholds are QUANTISED to a published menu (M6 decision #1, user-signed), and the repeated-query oracle is recorded as an honest limit

**DECISION**

The M6 composition spike found the one hole no single module
can see: every individual response is a clean windowed bit, but the SEQUENCE
is not. Because profile rule 1 puts the window in the QUESTION and hands the
threshold to the requester, **nine** legal, signed, sealed, metered queries
binary-searched the subscriber's exact swap age (137 days, recovered exactly)
— with every response passing every check and the raw value nowhere on the
wire. Floors do not reach it: M3 gates the *profile* demanded, not the
threshold asked. The demo operator therefore publishes a coarse menu next to
its floor (`P30D | P90D | P180D | P365D`) and **refuses** anything off it —
refuses, never rounds, because rounding answers a question nobody asked. This
CAPS resolution at the bucket (≈2 bits/year); it does not close the oracle,
and it is written down as a cap. Only ORDERED thresholds get a menu, which
after the enum trim means exactly one type — `simSwapAge`; `roamingIn` takes a
set, which has no ordering to bisect, and `reachable` is already a single bit
at full resolution, so the menu's scope is a statement, not an oversight.
Two further
mitigations: per-subject rate limits + per-query billing are the economic
backstop (ADOPTED — Mode A's commercial rail is also its defence); a monotone
tighten-only repeat rule was CONSIDERED and NOT adopted (it defeats bisection
but leaves a one-directional walk — 137 queries instead of 9, ~15× cost and
still a complete recovery: a constant factor, not a property; and it makes a
second legitimate question depend on the first with no way to scope or expire
that state). Written up in the CAMARA proposal §3.5.

## 2026-08-17 — The top-level REQUEST field set is CLOSED (M6)

**DECISION**

Not a
planned decision — a defect found by an adversarial probe of `poc/demo.mjs`
*after* it was written and green. Every layer under it was already closed (M1's
claims, M3's axes, M4's predicate fields) and the outermost envelope, which no
module owns, was not: a request carrying `floors` — one letter off — had its
floor silently DROPPED, so `checkFloor` saw no requested floor, applied the
operator's own `P90D`, and signed an answer while the requester believed it
had demanded `P365D`. Silent widening arriving through a spelling mistake,
which is M3's closed-axis argument one level further out. Unknown fields are
now refused by name (the misspelling is the actionable half), with the name
rendered only while short and printable so an embedded newline cannot forge a
log line. The lesson generalises: **a closed-set discipline is only as good as
its outermost layer, and the composition owns a layer none of the modules do.**
Demo: 20 → 22 assertions (the guard and its control); check: 25 → 27 cases.

## 2026-08-17 — The subscriber number rides INSIDE the sealed, signed request (M6, user-signed)

**DECISION**

The hub therefore never sees it, which is what FR3
requires. But it IS in the request, and that is a demo stand-in for
token-derived identity, stated in the demo output and here rather than
glossed: a real 3-legged deployment derives the subject from the access token
instead of asking for an identifier — the shape CAMARA's own
`GET /device-phone-number` already takes (no request body at all),
generalised catalog-wide by profile rule 4.
**Correction (2026-08-24 re-verification):** the original wording here —
"NumberVerification already makes that omission normative" — did not
survive. `POST /verify` is 3-legged and REQUIRES an identifier
(`phoneNumber`/`hashedPhoneNumber`; the repo's own live measurement got
`403 "Request must define a phoneNumber"`); there is no CAMARA rule making
identifier omission normative across 3-legged flows generally. Only
`GET /device-phone-number` is structurally identifier-free.

## 2026-08-17 — Spec sketch `Predicate` enum trimmed 7 → 3 (M6, user-signed)

**DECISION**

`spec/carrier-attestation.yaml` now lists only the types the
PoC wires end to end — `simSwapAge`, `roamingIn`, `reachable` (the boolean
`value` branch stays, because `reachable` needs it and the reference module
rejects the string spelling). `tenure`, `simType`, `presentIn` and
`numberMatch` were aspirational: nothing computes them, so a reader could send
a schema-valid request the reference operator refuses — an enum answering for
facts that do not exist, the fabricated-fact class M4 closed, one layer up.
They move to a **future-work note** in the CAMARA proposal §3.3.1 rather than
being deleted; `tenure` and `simType` remain FLOOR axes and are unaffected,
and `tenure` additionally carries the open MNP question (§9.8 of the
proposal), which minting it as a predicate would have shipped as settled. The
normative profile enumerates no predicate types (proposal §3.2), so nothing
normative moved. YAML re-parsed after the edit.

## 2026-08-17 — M1 exports its duplicate-key scanner; duplicate-key REQUESTS are rejected outright (M6 decision #2, user-signed)

**DECISION**

A signed request is
signed bytes too and the equivocation is symmetric — one signature over bytes
carrying `floor` twice lets the operator enforce `P90D` while the requester
believes it demanded `P365D`. `verifyAttestation` cannot be reused for a
request (it demands the closed ANSWER set), so M1 exports
`hasDuplicateTopLevelKey` and M6 borrows it rather than keeping a second,
divergent copy — the copy that would face the wire first. The export states
its precondition (the text must already have parsed as JSON) and M6 calls it
in M1's own order: signature → parse → scan. The requester's remedy is a clean
re-request: **no partial acceptance, and never a pick between the two
values.** M1: 19 → 20 cases.

## 2026-08-17 — M3 fix point closed: `checkFloor` never throws on wire input

**DECISION**

The rejection-message builder used `JSON.stringify` on the offending
value, which throws on a BigInt and runs a caller-supplied `toJSON`; either
way a bare `TypeError` escaped and replaced the module's loud named-input
rejection — in the rejection path itself. The renderer now invokes nothing
caller-supplied (M4's post-release-gate `describe()` shape), with an
`[unrenderable]` floor because `Array.isArray` throws on a revoked Proxy.
Neither shape survives a JSON round trip, so the envelope's transit was what
kept it unreachable — a transport accident, not a contract, which is why it
is fixed at the module rather than documented at the composition. Reason
length stays unclamped here on purpose: the clamp belongs on the side that
knows the envelope capacity, i.e. M6. M3: 22 → 23 cases.

## 2026-08-16 — G2 RE-ESTABLISHED: user re-ran M5 clean at `4ac60e9` (48/48 + 11/11 live)

**EVIDENCE**
> **SUPERSEDED as a statement about what ships, 2026-08-17.** The run below is
> confirmed and stands as the record of that tree state. What it no longer is,
> is the *final* state: the 2026-08-17 post-gate review round changed all three
> M5 files after it, so `4ac60e9` became run 3 of 4 and G2 was re-opened and
> then re-closed by the user's run at `8e842c3`. Read "final release state" in
> this entry as "final state as of 2026-08-16". Nothing else here changed.

**This closed the release-gate round's "M5 user re-run pending"** — the last
pending marker the tree was carrying that day. The entry below records G2 being met at
`69b6f2e` and then deliberately re-opened, because the gate's fixes landed
after that run and touched all three M5 files. That gap is now closed by a
run, not by assuming it carried over.

The user personally ran M5 on their own machine at commit `4ac60e9` — the
final release state, with every gate fix in — and reported both suites clean:
`node poc/m5-check.mjs` **48/48** and the live
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` **11/11**.

**M5 is therefore user-validated LIVE at the final state, and G2 (PRD §4.4:
`G2 = M5 user-validated live`) is MET with no asterisk and nothing pending.**

### The full user-run record for M5, in order

Three user runs existed for this module as of this entry. They are listed
separately rather than collapsed, because each covers a different tree state:

| # | Commit | Offline | Live | What it covers |
|---|---|---|---|---|
| 1 | `2fd62ba` | 44/44 | 10/10 | pre-review state; **undated at the time** — noted here rather than left as an undated memory |
| 2 | `69b6f2e` | 47/47 | 11/11 | post-adversarial-review; **the first G2 in the project** |
| 3 | `4ac60e9` | **48/48** | **11/11** | post-release-gate — the final state *as of 2026-08-16* |

Run 1 was never given a dated record when it happened; it is recorded now for
completeness. It is the same module two review rounds earlier, so it is
history, not a second validation of the current tree. Run 3 was the one the
release rested on when this was written; a fourth run at `8e842c3` supersedes
it (2026-08-17 entry above).

### Release-gate corroboration at `4ac60e9`

The v0.3.0 release gate re-verified the same commit independently. This
corroborates the user's run; it does not substitute for it — the G2 record is
run 3 above.

| Check | Exit | Result |
|---|---|---|
| `node poc/m1-check.mjs` | **0** | 19/19 |
| `node poc/m2-check.mjs` | **0** | 10/10 |
| `node poc/m3-check.mjs` | **0** | 22/22 |
| `node poc/m4-check.mjs` | **0** | 33/33 |
| `node poc/m5-check.mjs` | **0** | 48/48 |
| `node poc/m5-check-live.mjs` (LIVE) | **0** | 11/11, quota restored 1 → 1 of 10 |
| `spec/carrier-attestation.yaml` parses | **0** | OpenAPI 3.0.3, 1 path |
| secret scan of `origin/main...HEAD` | — | clean; the one match is the suite's declared SYNTHETIC fixture credential, commented as such |

Every count above is by **exit code**, not by reading a printed tally. The
first live invocation lost its exit code to a shell mistake (`PIPESTATUS` read
in a later command), so it was re-run capturing the status directly rather
than trusting the `RESULT: 11/11` line — a printed tally is not a pass.

### Open items carried into M6 (unchanged by this run)

Nothing about M5 is pending. Two items remain open and are carried honestly
rather than closed by this release: the M3 `describe()`-throw class, and the
spec-sketch predicate types that are not wired to the PoC (M6 wires or trims
them).

## 2026-08-16 — G2 MET (user ran M5 live), then the v0.3.0 release gate found five more (47 → 48 offline)

**EVIDENCE**
Two things happened in this order, and the order is the point: **the user
validated M5 live and closed gate G2**, and then the release gate for v0.3.0
found five issues in the tree that had just been validated. Both are recorded,
because collapsing them would let the G2 record appear to cover code it never
saw.

### 1. G2 is met — the first G2 validation in the project

The user personally ran M5 on their own machine at commit `69b6f2e` and
reported both suites clean: `node poc/m5-check.mjs` **47/47** and the live
`ORANGE_BASIC_AUTH=… node poc/m5-check-live.mjs` **11/11**.

Gate mapping (PRD §4.4) is `G2 = M5 user-validated live`, so **G2 is MET**.
This is the first time a live-operator module in this repo has been validated
by anyone other than an agent.

For completeness, the user had ALSO run the pre-review state clean at `2fd62ba`
— **44/44 offline and 10/10 live** — a run that never got a dated record at the
time. It is noted here rather than left as an undated memory; it is the same
module one review round earlier, not a second validation of the current tree.

The release gate re-ran the live check twice more at `69b6f2e` and got **11/11,
exit 0** both times, with a leak self-check confirming the credential appeared
in no output line. That corroborates the user's run; it does not substitute for
it.

### 2. The gate then found five issues — two of them real code defects

`/security` returned **0 Critical, 0 High, 0 Medium** (three Lows, below).
`/diff-review` returned no Critical but did NOT return clean: verdict "with
fixes". Every finding below was reproduced against the unfixed tree before
anything was touched.

**(1) The stored country list was COERCED while being joined — the module's
loudest guard replaced by an opaque error.** `Array.prototype.join` calls
`String()` on every element, so a JSON-parsed `{"toString":"x"}` inside the
Admin READ's `countryName` threw a bare `TypeError: Cannot convert object to
primitive value` — and it threw from the line that BUILDS the write-verify
comparison, i.e. before the loud message could run at all. Measured on the
unfixed module:

| Stored `countryName` | Result |
|---|---|
| `[{"toString":"x"}]` | `TypeError`, **40 chars**, no "write verification FAILED" |
| `["Spain"]` (benign control) | correct loud message, **418 chars** |

This is a direct sibling of the defect the previous review round closed 30 lines
below, in the RENDER of the same diagnostic — the render was guarded, the line
feeding it was not. Fixed with `joinStored()`: strings are taken verbatim and
clamped (never `brief()`-rendered, because `brief()` adds JSON quotes and
`"FR"` must still compare equal to `FR`), anything else renders as its KIND and
can therefore never equal a canonical country, and `length` is read ONCE into a
bound of 16 — the time-of-check/time-of-use lesson M4 paid for at v0.2.0.
Pinned by new **case 48**, whose four legs are deliberately joint: hostile
element still fails LOUD and renders `[object]`, benign element still names
`Spain`, a legitimate `["FR"]` still MATCHES (a guard that broke this would be
worse than the bug), and 5000 elements stay bounded.

**(2) The live quota assertion went RED on a clean account, and blamed the wrong
case.** Case 11 asserts `endSlots === startSlots`, but the baseline was taken
before the CUSTOM demo slot existed. On a FRESH account the adapter's
CREATE-if-missing path creates it during case 2 — a legitimate, deliberate,
permanent consumption (the run leaves it scripted on purpose) — so the run ended
one slot up and reported that the trap case had failed to give its slot back.
**Reproduced live**, not argued: the custom slot was deleted to create the
fresh-account condition, and the unfixed check ran `start=0 end=1`, **exit 1,
10/11**, with `cleanup DELETE status=204` printed alongside — the cleanup had in
fact succeeded. Fixed by making the baseline deterministic rather than loosening
the assertion: the CUSTOM slot is brought into existence BEFORE the baseline is
taken, so `===` still holds on a fresh account and a re-run alike, and a genuine
built-in leak still fails. Re-run on the identical freshly-emptied account:
**11/11, exit 0**, printing `(CREATED +990100000099: first run on this app)`.

**(3) The CAMARA proposal's catalog table showed a shape M1 REJECTS, under a
sentence claiming the PoC produced it.** §3.3.1 rendered profile-mode responses
as a flat `{"predicate":…,"result":true,"nonce":"…","exp":"…","sig":"…"}` and
then asserted "the shapes in it are the ones the PoC actually produces, not
sketches". Both halves fail against this repo: M1's claim set is CLOSED to
`{predicate, result, nonce, exp}`, so a `sig` inside `claims` returns
`unexpected fields: sig`, and `spec/carrier-attestation.yaml` requires
`[claims, sig]` as siblings with `exp` an **integer** (Unix ms), not a quoted
string. This is the most consequential finding of the round despite being
docs-only: it is the submission document, and a working-group reviewer
falsifies it with one grep. Rows corrected to the real envelope; the overclaim
replaced with what is actually true (the PoC produces the ENVELOPE; the
predicate spellings are illustrative and the PoC answers three axes, not nine),
with the retraction left visible.

**(4) Two table rows were outside the verified baseline.** The §11 baseline
covers SimSwap v2.1.0, NumberVerification v2.1.0 and KYC r2.2 — not
`device-roaming-status` or `device-reachability-status`, whose shapes came from
the Orange Playground sandbox, not a CAMARA spec surface. Marked `†` with the
provenance stated, since grounding discipline requires the source, not just the
shape.

**(5) The mutant count contradicted itself.** The previous entry's intro called
the sweep "18-mutant" while its own table row 2 recorded **15/16 killed, 1
survived**. The 18 is the POST-fix total (16 plus 2 minted against the new
guards); applying it to the pre-fix sweep made the entry disagree with itself.
Corrected in both this log and PRD §4.4.

**The three `/security` Lows** were all confirmed and all fixed, since each was
trivial and local: `await res.text()` sat OUTSIDE the try that redacts (a stream
dying mid-response rejects there, so its message escaped unredacted); the
client-id pattern's bound of `\S{0,80}` was tighter than the thing it masks, so
an over-long identifier would have had its first 80 characters redacted and the
REMAINDER printed — worse than not matching — now 256, re-checked at 1ms on a
200k-char pathological input to keep the ReDoS property; and operator-side
timestamps in diagnostics were judged NOT a breach and deliberately left (they
are operator-side by construction, never wire-reachable).

### Proofs

Both code fixes are mutation-proven, restores byte-identical by sha256, using
working-copy `cp` backups rather than `git checkout` — the fixes were
uncommitted, and a checkout would have wiped the thing under test.

| Mutation | Suite | Exit | Verdict |
|---|---|---|---|
| revert `joinStored` → raw `.join(',')` | offline | **1** (47/48, case 48 only) | killed |
| restore | offline | **0** (48/48) | green |
| revert quota baseline, fresh account | **live** | **1** (10/11, `start=0 end=1`) | killed |
| restore, same fresh account | **live** | **0** (11/11) | green |

Three guards from the PREVIOUS round were also independently re-proven at this
gate, in an isolated copy so the repo tree was never touched: stripping
`redact()` from the write-verify diagnostic, sharing one token across surfaces,
and clamp-after-serialize each turned the suite red (exit 1) and each restore
went green. Separately, a 110-run flake sweep across all five offline suites
returned **0 non-zero exits**, and the credential was confirmed absent from the
working tree and from all 35 commits of history by literal-value match.

**Honesty marker: the CURRENT counts (48 offline, 11 live) are AGENT-RUN.** G2
was met at `69b6f2e`; these fixes landed after that run and touched
`m5-facts-orange.mjs`, `m5-check.mjs` and `m5-check-live.mjs`. A user re-run is
pending and re-establishes G2 at the final state — the same pattern M4 followed
at v0.2.0, where the release gate's fixes landed after the user's run and the
gap was closed by a re-run rather than by assuming it carried over.

## 2026-08-16 — M5 adversarial review round: 3 confirmed issues (44 → 47 offline, 10 → 11 live)

**EVIDENCE**
A second agent re-attacked M5 against the challenge "what did you gloss over?
what did you not validate but asserted or fit to pass?". Method, in this order:
an INDEPENDENT 30-case check written from the PRD, M4's interface contract and
the module source alone **before either shipped suite was opened**; then an
independent **16**-mutant sweep; then a leak fuzz; then the live legs. Every
verdict below is from something that RAN.

| # | Audit item | Verdict |
|---|---|---|
| 1 | Fit-to-pass probe (independent check, written blind) | **CONFIRMED ISSUE** — 27/30, three failures, all on ONE line |
| 2 | Independent mutation sweep (≥12, incl. 8 named) | **CONFIRMED ISSUE** — 15/16 killed, 1 required mutant SURVIVED |
| 3 | Redaction / leak audit | **CONFIRMED ISSUE** (same line as 1); otherwise clean — 315 combinations, 0 leaks |
| 4 | Live-case can-fail audit | **CLEAN** — all 10 can genuinely fail; no sibling of the build round's vacuous case |
| 5 | Quota / crash hygiene | **CONFIRMED ISSUE** — cleanup unobserved; fixed + new case 11 |
| 6 | Cross-module regression + fixture honesty | **CLEAN** — M1–M4 unchanged by exit code; every fixture traces to a capture |
| 7 | Live confirmation | **DONE** — 11/11, exit 0, quota restored 1 → 1 of 10 |

**Issue 1 — the write-verification diagnostic was the one throw path that
skipped `redact()`, and it clamped AFTER serializing.** Three distinct defects
on one line (`write verification FAILED … stored ${axis} is
${JSON.stringify(String(got[axis])).slice(0, 60)}`), and it is not an obscure
line: it is the message the module's most load-bearing guard produces, the one a
demo run is most likely to print.

- **It bypassed `redact()`.** `got[axis]` comes off the WIRE. Measured: a
  credential half, and an issued bearer token, each planted in an Admin `READ`
  body, rode verbatim into the thrown message. Every other throw in the file
  redacts; this one did not — so module rule 3 ("the credential, every token and
  the client id never reach a string this module can print or throw") was false
  on exactly one path. The offline suite's cases 5–8 all probe `getFacts` error
  paths and none covered this one.
- **It clamped after serializing.** `JSON.stringify(String(v)).slice(0, 60)`
  builds the whole serialization and only then bounds it: measured **2354ms on a
  2e8-char stored value vs 0ms** for the `brief()` ordering, and at V8's max
  string length (536870888) `JSON.stringify` throws `RangeError: Invalid string
  length` — which **destroys the loud, actionable trap message** at exactly the
  moment it is needed. This is the same lesson the offline suite's own case 43
  already states ("clamped BEFORE it is rendered, not after — bounding the OUTPUT
  still serializes the whole input first"); the suite stated the principle and
  never applied it to the one line that broke it.
- **Fixed** by composing the two helpers the file already had, in an order that
  matters: `const show = (v) => (typeof v === 'string' ? brief(redact(v)) :
  brief(v))`. A STRING is redacted FIRST because the known-secret layer is an
  EXACT match — clamping first would leave a 48-char FRAGMENT of a 110-char
  credential unmatched and printed — and `redact()` returns ≤200 chars, which
  `brief()` can then serialize safely. A NON-string goes to `brief()` directly:
  no secret can hide in one, and `redact()`'s `String(v)` coercion would run a
  wire-supplied `toString` (`JSON.parse('{"toString":"x"}')` makes `String(v)`
  throw a bare TypeError — the same "opaque error replaces the loud one" failure
  by another route). Pinned by new cases **45** and **46**.
- **The residual, measured rather than waved away.** `redact()` still makes its
  exact-match passes over the full string before clamping, which cannot be
  reordered without reintroducing the fragment leak above. On a 5e7-char stored
  value that is **318ms for five passes, against 1611ms** for the `JSON.parse`
  of the same body that the module has ALREADY paid before this line is reached
  — 0.20× work already done, not a new unbounded surface, and identical to the
  exposure every other error path in the file already carries. Recorded as a
  known residual rather than traded for a fragment leak.
- **Case 46 asserts the rendered SHAPE, not elapsed time**, and that choice was
  vindicated during the round: the independent probe's own 1000ms timing bound
  flaked at 1176ms under concurrent load while the message stayed correctly
  bounded at 443 chars. A clamp-BEFORE render always emits a closed,
  ellipsis-terminated string (`…"`); a clamp-AFTER regression emits one sliced
  off mid-value with no closing quote. Deterministic, and it kills the mutant
  without racing the CPU.

**Issue 2 — "one token per surface" was unpinned; the mutant survived.** The
module is correct, but a mutant caching one token ACROSS both surfaces left the
44-case suite fully green. The cause was in the CHECK: its replay transport
answered BOTH token endpoints with the same fixture, so a shared cache and a
per-surface cache were indistinguishable. This is a load-bearing invariant — the
two endpoints are measured NOT interchangeable (CAMARA token on Admin → `401
UNAUTHENTICATED`; Admin token on sim-swap → `403 "Request must be authorized"`)
— so a regression would surface as an auth fault far from its cause. Fixed by
giving the Admin endpoint its own fixture token and adding case **47**, which
drives both surfaces from ONE adapter instance and asserts each call carried its
own surface's bearer.

**Issue 5 — the live check's cleanup was unobserved, so quota leaked silently.**
Case 1 CONSUMES one of the app's 10 custom slots (the adapter CREATEs the
built-in before it can discover the write is shadowed) and gave it back with a
DELETE whose **result was discarded**. A run interrupted between those two
points left the slot consumed with nothing on screen saying so; repeated
interrupted runs would walk the quota to its cap and the eventual failure would
name a phone number, not a quota. Fixed three cheap ways, all observable in the
output: the slot is **reclaimed BEFORE it is consumed** (measured: `DELETE` of a
slot not held answers `400 "PhoneNumber Not Found"` = nothing to reclaim, while
`204` means an earlier run really did leak), the count is **printed at both
ends** against the cap, and new case **11** asserts it came back. The count is
the assertion because it is the authoritative observable; the DELETE status is
reported alongside and required only to be a success, not to be exactly `204`.

**What the review round could NOT fault:**

- **The 10 live cases can all genuinely fail.** Each was traced to the
  observable that would flip it. The build round's own catch (a case that
  coerced an `undefined` token to the string `'undefined'`) has no surviving
  sibling. Case 11 was held to the same bar and PROVED able to produce the
  negative rather than assumed: a live probe confirmed the `LIST` count actually
  MOVES (1 → 2 → 1 across a CREATE/DELETE pair, net-zero quota) — without that,
  `endSlots === startSlots` would have been a tautology.
- **Redaction is otherwise airtight.** A fuzz across every throw path × every
  known secret (supplied credential, normalized, decoded pair, each half, each
  issued token) × five embeddings (raw, JSON, URL-encoded, quoted, header-ish)
  ran **315 throwing combinations with 0 leaks**. Its first run reported 62
  leaks — every one a HARNESS artifact: it demanded redaction of a token the
  adapter had never been issued, which is impossible by construction (a token
  enters the known set at mint time). Debugged rather than believed, per the
  standing rule about degenerate numbers. The probe carries a PLANTED-LEAK
  control (47 hits) so a clean result cannot mean a blind probe, and re-run
  against the PRE-fix line it goes red with exactly 10 leaks, all on
  `write-verify mismatch`.
- **Fixture honesty holds.** Every offline fixture traces to a shape recorded in
  the spike entry above — including `countryCode:34`/`["Spain"]` on the built-in
  and `208`/`["FR"]` on a scripted record, which the findings record in prose
  rather than raw JSON. Nothing was edited to fit the code. One over-readable
  claim was tightened rather than left: the `stored()` helper is CONSTRUCTED,
  not captured (its seven-key shape is measured and the three axes M5 reads
  carry captured values, but the filler in the four axes M5 never touches is
  arbitrary), and now says so, so the file header's "captured verbatim" is not
  over-read to cover it.
- **M1–M4 are untouched**, verified by exit code: 19/19, 10/10, 22/22, 33/33.

**Counts after the round: offline 47/47, live 11/11, 18/18 mutants killed, 0
survivors** — 16 in the sweep above plus 2 minted against the guards this round
introduced. (The intro to this entry originally called the sweep itself
"18-mutant", applying the post-fix total to the pre-fix sweep and contradicting
the 15/16 in row 2 of the table. Corrected at the v0.3.0 release gate, which is
where a reader spotted the two numbers disagreeing — recorded rather than
quietly overwritten.) The sweep's own harness gained a per-run timeout after the
unbounded-401 mutant SPUN and wedged the first attempt — a hang must be scored
as a kill, not left pegging a core. Restores were working-copy `cp` with a
sha256 byte-identity assertion, never `git checkout`; one mid-sweep interruption
did leave the module mutated and was caught and restored by that check.

**Honesty marker, unchanged by this round: every M5 count is AGENT-RUN.** That
was true of 44/10 before the review and is true of 47/11 after it. M5 has never
been run by the user, so **G2 is still not met** — the round hardened the module
and grew its evidence, it did not close the gate.

## 2026-08-16 — M5 live spike: the recorded Playground findings re-verified, three CHANGED

**EVIDENCE**
A throwaway spike (6 rounds, scratchpad only) re-ran every recorded Playground
finding against the live API before any M5 code was written, because the
findings were measured on **2026-08-14/15** and a sandbox can move. Raw
responses were captured (secrets redacted at capture time) and are the fixtures
`poc/m5-check.mjs` replays. Verdict per finding:

| Recorded finding (2026-08-14/15) | 2026-08-16 verdict |
|---|---|
| CAMARA token endpoint → `{access_token, expires_in:3600}` | **HOLDS** |
| Two NON-interchangeable token endpoints | **HOLDS** — CAMARA token on Admin = `401 UNAUTHENTICATED` |
| sim-swap `/retrieve-date` → `{latestSimChange}` | **HOLDS** |
| Admin actions `LIST/CREATE/READ/UPDATE/DELETE` | **HOLDS** |
| `DELETE` → `204`, empty `text/html` body | **HOLDS** |
| Custom slot `+990100000099` honours writes | **HOLDS** |
| Quota: 10 custom numbers | **HOLDS** |
| **THE TRAP: built-ins `200/201`-echo writes while ignoring them** | **HOLDS — mechanism refined** (below) |
| **`403 FORBIDDEN` on sim-swap means UNKNOWN NUMBER** | **CHANGED — narrowed** (below) |
| **"That single [sim-swap] call satisfies the whole facts interface"** | **CHANGED — obsolete** (below) |
| `/check` `maxAge` in HOURS, cap 2400 | **NOT RE-TESTED** — the adapter does not use `/check`; recorded as untested rather than assumed |

**1. THE TRAP HOLDS, and the mechanism is sharper than recorded.** The original
finding said a built-in answers `CREATE`/`UPDATE` with `200`/`201` echoing your
payload. Measured today, it splits in two:

- a bare `UPDATE` on a built-in the app has never claimed answers **`400
  BAD_REQUEST "PhoneNumber Not Found"`** — i.e. it now fails LOUD, which the
  recorded finding did not describe; but
- the adapter's own path is CREATE-then-UPDATE, and *that* reproduces the trap
  exactly. Replayed on `+990100000002`: `CREATE` → `201` echoing a **fabricated
  default template**; `UPDATE {"simSwap":{"latestSimChange":"2001-02-03…"}}` →
  **`200` echoing that very date back**; the next `READ` → the built-in's own
  dataset (`2020-03-15T10:00:00.000Z`, `kyc.name "Bernard Blanc"`,
  `countryName:["Spain"]`); sim-swap → `2020-03-15T10:00:00.000Z`, unchanged.
  **Echo carried the write: true. READ carried it: false.** The negative
  control — the identical sequence on the custom slot — had echo, READ and
  sim-swap all agree. So READ-after-write is load-bearing, and the test that
  says so can fail.

**2. `403 FORBIDDEN` no longer means unknown number on its own.** It is the
MESSAGE that discriminates, and two different faults share the status:
`{"code":"FORBIDDEN","message":"+990100000077 does not exist for <client_id>"}`
is an unknown number, while a request carrying the **wrong surface's token**
answers `{"code":"FORBIDDEN","message":"Request must be authorized"}`.
Collapsing the two puts you back in the failure the original finding exists to
prevent — debugging a backstory when the fault is the token — one layer in.
M5 therefore classifies on the message, and the offline suite pins both
directions (a mutation making *every* 403 an unknown number, and one making
*no* 403 an unknown number, are each killed by their own case).

**3. Sim-swap is no longer the whole interface — all three axes are WIRED.**
The recorded claim that one sim-swap call satisfies the facts interface is
obsolete: the app's own token scopes include `device-roaming-status:read` and
`device-reachability-status:read`, and both endpoints answer live at
`.../api/device-roaming-status/v1/retrieve` and
`.../api/device-reachability-status/v1/retrieve`. **Nothing in M5 is faked or
stubbed and no axis is unavailable on this app.** Note the two request shapes:
sim-swap takes a bare `phoneNumber`, the two device-status APIs take a `device`
wrapper — sending the bare form answers `400 INVALID_ARGUMENT "phoneNumber is
not allowed"`, which is how a real-but-differently-shaped endpoint was told
apart from a non-existent one (`400 BAD_REQUEST "unhandled path"`).

**NEW findings the spike produced:**

- **The credential is already scheme-prefixed.** Line 1 of the stored entry —
  the exact value `poc/README.md`'s runbook line yields — is `Basic <base64>`.
  Sending `Basic ${that}` double-prefixes and BOTH token endpoints reject it
  (`400 invalid_request` / `401 "Basic authentication is malformed"`). This
  cost the spike's first round and is now normalized in the adapter and pinned
  by a case that reads the header actually sent.
- **The Admin data model is much wider than "swap date, roaming, reachability"**
  — `location`, `reachability`, `roaming`, `simSwap`, `deviceSwap`, `tenure`,
  `kyc`. M5 touches three of the seven; the rest are untouched, not unnoticed.
- **The `roaming` axis has THREE distinct states, and they are the reason the
  null-vs-absent distinction is not academic.** Measured: `roaming:false` →
  `{"roaming":false}`; `roaming:true` + a country → `{"roaming":true,
  "countryCode":208,"countryName":["FR"]}`; **`roaming:true` with NO country →
  `{"roaming":true}`.** The third is the fail-open: the subscriber IS roaming
  and the country is UNKNOWN, and folding it into "not roaming" answers "not in
  FR" about someone who may be in France.
- **`countryName` is a NAME list, not a code list.** The Playground's own
  built-in records carry `["Spain"]`; an admin-scripted record accepts `["FR"]`
  because that is what was written. So a country is accepted only when it is a
  single canonical ISO-3166-1 alpha-2 code; `["Spain"]` and multi-country
  `["FR","MC"]` (both producible) leave the axis unavailable.
- **`countryCode` is internally inconsistent and therefore unusable.** The
  built-in Spain record carries `34` (the DIALLING code); an admin-scripted
  French record takes `208` (the MCC). M5 reads neither and writes neither —
  `countryName` alone round-trips, verified live.
- **`roaming:false` WITH a stale country is producible** (`{"roaming":false,
  "countryCode":208,"countryName":["FR"]}`). The `roaming` flag is the
  authoritative half; this is "not roaming", not a country.
- **Reachability is a closed enum**: `CONNECTED_DATA | CONNECTED_SMS |
  NOT_CONNECTED`. Anything else is refused by the Admin API with a `400` naming
  the allowed values, and the rejected write does NOT take effect.
- **An Admin `UPDATE` REPLACES a sub-object rather than merging it** — writing
  `{"reachability":{"reachabilityStatus":…}}` drops the `lastStatusTime` that
  was there. M5 writes all three axes in one call for that reason.
- **`READ` on a built-in the app never claimed** answers `400 "PhoneNumber Not
  Found"`, and a claimed one is SHADOWED: it appears in `LIST` while `READ` and
  the CAMARA reads keep serving the built-in dataset.

Nothing in the spike contradicted the M5 adapter shape, so the build proceeded.
Quota was left exactly as found (1 of 10 custom numbers).

## 2026-08-16 — M5 built: live Orange facts adapter, 44 offline + 10 live cases, 32/32 mutants killed

**EVIDENCE**
`poc/m5-facts-orange.mjs` — the same `setBackstory` / `getFacts` interface as
M4's mock with a real operator behind it. **`evaluatePredicate` is not
reimplemented**: M5 exports `createOrangeFacts` and nothing else, and the check
asserts that, because swapping the facts SOURCE must not touch the step where
the profile invariant lives. `setBackstory`/`getFacts` are async here (there is
a network); the clock stays INJECTED, and the relative→absolute conversion M4
only simulates happens at this boundary for real.

**What was measured, not asserted:**

- **Offline suite: 44/44, exit 0, zero credentials, zero network**
  (`node poc/m5-check.mjs`). The transport is injected and replays the spike's
  CAPTURED bytes, so it runs on a clean clone.
- **Live suite: 10/10, exit 0** (`node poc/m5-check-live.mjs`) against the real
  Playground. It proves the FR1 negative live (a 120-day-old SIM answers `true`
  to `simSwapAge ≥ P90D`; the SAME number re-scripted to 1 day answers `false`,
  same code, same predicate), that the write-trap defence fires on a real
  built-in **with the custom-slot control succeeding**, that all three axes
  serve real values, and that an unavailable axis refuses.
- **32 mutations, 32 killed, 0 survivors.** Including the two that matter most:
  removing READ-after-write entirely, and comparing against the ECHO instead of
  the stored state — each turns the suite red on its own case. Backups were
  working-copy `cp`, never `git checkout`.

**Two defects the mutation sweep found in the check itself**, both fixed:

1. **A VACUOUS redaction case.** Case 8 (client id redacted when no client id
   can be derived from a non-base64 credential) used a `403` body — but a body
   containing "does not exist for" routes to the unknown-number branch, whose
   message is built from the NUMBER and never quotes the body. The client id
   could not have leaked however the redactor behaved: the case could not fail.
   Caught because deleting the redactor's pattern layer left the suite green.
   Re-aimed at a `500`, which reaches the branch that does quote the body.
2. **A too-crude assertion.** Case 11 asserted the auth-403 message does not
   contain "unknown number" — but the message legitimately explains that it is
   "not an unknown number". Tightened to the classification itself
   (`/^unknown number:/`), which still catches a branch regression.

**The live redaction case demonstrates its own precondition.** Case 10 fetches
the RAW `403` for the same call and confirms the body genuinely contains the
client id (`true`), THEN asserts the adapter's error does not. Without that
half it would pass against a Playground that had simply stopped echoing it — a
redaction proof with nothing to redact.

**The security pass ran AFTER the build, and found three real defects** (a fix
round is the least-reviewed code there is, and this one was no exception). All
three are the same class M4's release gate found, carried across rather than
re-learned:

1. **Diagnostics invoked caller-supplied conversions.** `assertTestNumber` and
   `assertNow` rendered their argument with `String(value)` / `JSON.stringify(
   String(value))`, which runs a caller's `toString`/`valueOf`. Replaced with a
   `brief()` renderer that invokes nothing caller-supplied and clamps a string
   BEFORE serializing it. **Pre-registered expectation for the guard-off
   control was exit 134** (M4's fatal OOM); **measured exit 1** — `String()` on
   a 3e8-char return allocates fine here, so the case catches the regression
   cleanly instead of the process dying. Recorded as a clean kill, and M4's
   process-fatal claim deliberately NOT carried over: that one came through
   `JSON.stringify`'s JsonStringifier, a different path.
2. **A backstory field carried on the PROTOTYPE was used but never checked.**
   Destructuring reads a prototype-borne `swappedDaysAgo`, while `Object.keys`
   never sees it — so the unknown-field check that catches a typo'd axis passed
   straight over it. M4 measured the mirror image (a prototype-borne axis
   DROPPED and defaults used); either direction is a scripted story that is not
   the story in force. Now refused by an `isPlainData` bound matching M4's.
3. **A live-check assertion could pass with nothing to compare.**
   `msg.includes(tok)` coerces an `undefined` token to the string
   `'undefined'`, so a failed token exchange would have satisfied the redaction
   case. Now gated on the token actually being one.

Fixes took the offline suite 41 → 44 cases and the sweep 29 → 32 mutations,
all killed; the live suite was **re-run after the fix round** (10/10, exit 0)
rather than reusing the pre-fix run. Credential and client id confirmed absent
from the tracked tree AND from all 33 commits of history.

**Honest limits, recorded rather than cleaned up:**

- The live check costs quota: it CREATEs and DELETEs one slot for the trap case.
  Verified restored (`LIST` = 1 of 10) after every run.
- Token caching has NO time-based expiry, deliberately — refresh is driven by
  the server's own `401` (one retry, then loud failure), which keeps this
  module free of any wall-clock read. A revoked-but-unexpired token is handled
  by the same path; a token that expires mid-`getFacts` costs one extra round
  trip, not a failure.
- `/check`'s `maxAge` behaviour was not re-tested (unused by M5), and is
  recorded above as untested rather than carried forward as verified.
- "Unwired axis" could not be demonstrated by an axis being missing — all three
  are wired. It is demonstrated instead by a state the Playground genuinely
  produces and the adapter genuinely cannot answer from (`{"roaming":true}`,
  no country), which is the honest version of the same proof.

## 2026-08-16 — user validation at v0.2.0 (`7c41c83`): all four suites green, M4 at 33/33

**EVIDENCE**
After the v0.2.0 release — main at merge commit `7c41c83`, tag `v0.2.0` — the
user personally ran the full runbook on their own machine and reported all four
suites clean: `node poc/m1-check.mjs` **19/19**, `node poc/m2-check.mjs`
**10/10**, `node poc/m3-check.mjs` **22/22**, `node poc/m4-check.mjs` **33/33**.

**This closes the release-gate round's "M4 user re-run pending"** — the one
marker the tree was still carrying (recorded in the entry below and in PRD
§4.4). M4's 33 cases include the three added by that round, which pin the
TOCTOU `length` re-read, the process-fatal `toJSON` allocation, and the
nested-input bound — so the guards found at the release gate are now
user-validated, not just agent-run and mutation-proven.

Ladder status: **all four modules user-validated at current counts — M1 19/19,
M2 10/10, M3 22/22, M4 33/33 — with no asterisk and no pending re-run.**
M5–M6 not started.

## 2026-08-16 — v0.2.0 release gate: three unbounded-wire-work fail-opens, one of them process-fatal (30 → 33 cases)

**EVIDENCE**
The release gate for 0.2.0 ran `/security` and `/diff-review` over
`origin/main...HEAD` as independent passes. Between them they found **three**
defects, all of one shape — **work reachable from wire input that no cap
actually bounded** — and all three defeating a guard the module explicitly
claimed, in-source and in the entry below. **None of the 30 cases could catch
their regression.** Every one was reproduced against the unfixed file before it
was accepted, and every fix was re-probed after.

**1. The country-set cap was time-of-check/time-of-use — and it reached a
SIGNED answer.** `countrySet()` tested `v.length` against `MAX_COUNTRIES = 300`
and then re-read `v.length` on every loop iteration. `Array.isArray` passes
straight through a Proxy, so a `length` trap could answer honestly for the cap
test and enormously for the walk. Measured against the unfixed module: cap
checked against **2**, loop then walked **5,000,000 indices in 6.5s**, and the
predicate returned **`{answered: true}`** — an answer built from a set the cap
exists to refuse. Fixed by capturing `const n = v.length` once and walking `n`.

**2. `describe()` could kill the process — exit 134.** The renderer tried
`JSON.stringify` → `String` → `Object.prototype.toString` in turn, each wrapped
in a try/catch. **A try/catch bounds a THROW; it cannot bound an ALLOCATION.** A
~40-byte predicate value whose `toJSON` returned `'x'.repeat(3e8)` produced a
**fatal OOM inside V8's `JsonStringifier::Stringify` — SIGABRT, core dumped,
exit 134**, which no `catch` can degrade. This is strictly worse than the throw
the fallback chain was built to prevent: a dead process cannot return
`{answered: false}`, so "wire input never throws" failed in the one way that
leaves nothing behind to report it.

**3. The input bound covered two shapes only.** The same entry below claimed
"the input is bounded first". It bounded a **top-level** long string and an
array's **length** — a long string one level down was still serialized in full.
Measured with a control: a 50MB string **nested** in a one-element array cost
**657ms**, the same string at **top level** (where the bound applied) **83ms**,
and inside a plain object **527ms**.

**The fix is one decision, not three patches: the renderer now invokes NOTHING
caller-supplied.** Primitives render directly; arrays render at most 16 elements
one level deep; an object is described by its **key names** via
`getOwnPropertyNames`, which reads no accessor and calls no hook. There is no
`toJSON`/`toString`/`toStringTag` path left to allocate down. `[unrenderable]`
survives as the floor and is still reachable — by a **revoked Proxy**, where
enumeration itself throws — so case 25 still pins it, via that shape now.

**Two pinned messages changed, deliberately.** A circular object renders
`{self}` instead of `[object Object]`, and case 25's hostile object renders
`{self, toString, valueOf}` instead of `[unrenderable]`. Both old spellings were
*products of the caller-invoking fallbacks that were removed* — the object is no
longer "unrenderable", it is simply described without being asked anything. Both
new spellings are strictly more informative. Post-fix cost: nested 657ms →
**77.7ms**, object 527ms → **2.2ms** (both now at the cost of the harness's own
string allocation, not the renderer's).

**`DESC_MAX_STRING` was moved 64 → 48, below the 60-char output clamp.** At 64
the per-string bound was real but **invisible**: the output clamp always cut
first, so no assertion could distinguish a clamped string from an unclamped one
and the bound could regress silently. Below the output clamp it shows in the
rendered text, which is what makes case 33 able to fail at all.

**Mutation-proven, by exit code — four mutations, each red on exactly its own
case, each restored byte-identical by sha256 → 33/33 exit 0:**

| Mutation | Result |
|---|---|
| `countrySet` re-reads `v.length` per iteration | case 31 red, **walked 100,000** indices; suite exit 1 |
| object branch calls `JSON.stringify` again | case 32 red (`toJSON` invoked 1×), 4 cases red, exit 1 — **and the OOM probe returns to exit 134** |
| array depth cap removed | case 33 red (`[[["deep"]]]` instead of `[[array of 1]]`), exit 1 |
| per-string clamp removed | case 33 red (100000-char string rendered in full), exit 1 |

The second row is the guard-off negative control that matters: **with the
mutation the fatal-OOM probe exits 134, without it exits 0.** Three new cases
carry these — 31 (cap survives a lying `length`), 32 (renderer never calls
caller code), 33 (nested/oversized values bounded) — so the declared count goes
**30 → 33**.

**Deployed risk today was nil and is stated as such:** a predicate arriving
through `JSON.parse` at the real M5/Orange wire cannot carry a Proxy or a
`toJSON`. These are reachable in-process, which is exactly where the PoC's
assertions run — and the artifact was making bounds claims that measurement
falsified, which in a repo whose PoC exists to make the text undeniable is the
defect regardless of deployment reach.

**These three fixes are POST-user-validation.** The user validated the four
suites at `5d5e8aa` (entry immediately below); the release gate then changed
`poc/m4-facts-mock.mjs` and `poc/m4-check.mjs`. So **M4's 33/33 is agent-run and
a user re-run is pending**, on the 0.1.0 precedent where the user closes that
gap after the release. M1/M2/M3 are untouched by this round — no module source,
no check file, and the shared harness is unchanged — so their user-validated
19/19, 10/10 and 22/22 stand.

## 2026-08-16 — user validation at `5d5e8aa`: all four suites green on the post-code-review tree

**EVIDENCE**
The user personally re-ran the runbook on their own machine at commit `5d5e8aa`
— the state produced by the `/code-review medium` round below — and reported all
four suites clean: `node poc/m1-check.mjs` **19/19**, `node poc/m2-check.mjs`
**10/10**, `node poc/m3-check.mjs` **22/22**, `node poc/m4-check.mjs` **30/30**.

**This closed every "user re-run pending" the tree was carrying** — three
separate markers, all settled by this one run: M4 at its post-review-fix state
(the entry below had it user-validated only at the PRE-fix state); the shared
harness and the spec sketch, both touched by that same round; and M1/M2/M3,
whose module sources were never touched but whose check files gained
`conclude(19|10|22)` post-validation on the shared harness.

So at `5d5e8aa` the ladder read, with no asterisk: **M1 19/19, M2 10/10, M3
22/22, M4 30/30 — all four user-validated at that tree state.** The release-gate
round recorded above then moved M4 to 33 cases, which is agent-run.

## 2026-08-16 — `/code-review medium` round on PR #4: 8 findings, all confirmed by execution, all fixed

**EVIDENCE**
A second review pass over the M4 work already on PR #4 — the least-reviewed code
in the repo is the previous round's own fix code. **Nothing was accepted as a
finding on argument: every one was reproduced against the unfixed file by a
probe, and every fix re-probed afterwards.** Agent-run result after the round:
M1 **19/19**, M2 **10/10**, M3 **22/22**, M4 **30/30**, all exit 0; YAML
re-parsed clean (exit 0). Case count stays a declared **30** — the new guards
were folded into existing cases 16/17 rather than appended.

**1. Wire-supplied country-set arrays ran CALLER-CONTROLLED CODE — three ways,
one of them a signed answer.** `plainSnapshot` copies the predicate's TOP level
only, so `p.value` stayed the requester's own array object, and the sibling
`p.value.every(...)` / `p.value.includes(fact)` iterated *their* object:

| Hostile set | Observed against the unfixed module |
|---|---|
| array with a throwing index GETTER | threw straight out of `evaluatePredicate` — "wire input never throws" broken |
| `Proxy(['FR'])` with a throwing `includes` trap | threw AFTER validation passed — i.e. on the answer path, past every gate |
| **sparse `new Array(5)`** | holes are not `undefined` own props, so the empty-set gate saw length 5 and `every` was VACUOUSLY true → **`{answered:true, result:false}`, SIGNED** — an answer to the malformed empty question case 17 exists to refuse |
| `new Array(2 ** 32 - 1)` | the walk ran past a **60s** timeout — an unbounded stall reachable from the wire |

Fixed by `countrySet()`: an index-walked defensive copy inside a `try/catch`
(a hole reads `undefined` and is rejected, a throw is a rejection), a
`MAX_COUNTRIES = 300` length cap (ISO 3166-1 has 249 codes; bigger is a
malformed question, not a question), and the membership test now runs on OUR
copy — `p.value` is never iterated again. A *transparent* Proxy still simply
answers, which is correct: its reads pass through.

**2. `plainSnapshot`'s `Array.isArray` line ran OUTSIDE its own try.** On a
**revoked** Proxy even `Array.isArray` throws, so a revoked-proxy predicate
escaped the "never throws" contract as a raw `TypeError` instead of coming back
`malformed predicate`. The line moved inside the `try`. (Note the interaction
with the settled decision above: that clause stays as documented redundancy for
the *array* case, but its placement was a real defect.)

**3. `describe()` bounded its OUTPUT but not its INPUT.** It clamps to 60
chars — after fully serializing (or walking) whatever it was handed. A 100MB
string or a `2**32`-element array was therefore paid for in full just to print
60 characters. Now the input is bounded first: strings sliced to 64 chars,
arrays over 16 elements rendered as `[array of N]`, both inside a `try` because
`Array.isArray` can throw (finding 2). Post-fix: the 100MB-string reason
returns in **168 ms** at **129 chars**; the `2**32-1` array returns in **0 ms**
as `invalid country set: [array of 4294967295] …`.

> **RETRACTED 2026-08-16 (same day, release gate) — "the input is bounded
> first" was measurably false.** It bounded a top-level long string and an
> array's length, and nothing else: a long string one level down was still
> serialized in full (657ms nested vs 83ms top-level, same 50MB string). Worse,
> guarding the fallbacks with try/catch bounded throws but not allocations — a
> `toJSON` returning `'x'.repeat(3e8)` killed the process outright at exit 134.
> Both are fixed and the whole fallback chain is gone; see the release-gate
> entry at the top of this file. Left in place rather than edited: this log is
> append-only, and a retraction is the record.

**4. Two diagnostics skipped the clamp — both built from requester-chosen
text.** (a) The unknown-backstory-field throw interpolated the caller's key
RAW: a 5000-char key containing a newline rode verbatim into an `Error`
message, which is both unbounded and **log-forgeable** (an embedded newline in
a logged message fabricates a log line). (b) `unexpected predicate fields` did
a bare `extra.join(', ')`: a predicate carrying 50 huge keys produced a
**~100KB** `reason` — on the wire-facing return, not just a log. Fixed with
`describeKey()` (verbatim only for short printable keys, so the common typo
still reads exactly as typed) plus a 60-char clamp on the joined list. Post-fix
the 50-huge-key reason is **90 chars** and the 5000-char-key message **112
chars with no newline**. **Every pinned message in the suites stayed
byte-identical** — the clamp only fires on input no honest caller sends.

**5. The shared harness printed a GREEN line last on a failing run.**
`conclude()` printed `FAIL CASE COUNT` *before* `RESULT: N/N`, so the final line
of a count-failing run — the line the runbook and any `| tail -1` reads — was a
green tally sitting directly below the failure it hid. Order swapped; the red
line is last now. Exit code was always correct; this is the eyeball fail-open
the count argument exists to close, reintroduced one line lower.

**6. The spec sketch contradicted itself — introduced by the immediately
preceding commit.** `reachable` was minted into the `Predicate` type enum, but
`value` had no boolean branch in its `oneOf` (`string` | `array of string`) and
the module rejects the string spelling `"true"`. So **no `reachable` request
could be both schema-valid and answerable.** `- type: boolean` added to the
`oneOf`; YAML re-parses clean.

**7. Test hygiene, in the check file itself.** The `bit()` helper had no
callers (dead code shipped in the previous round) — removed, along with an
unused `number` parameter on `scripted()` and a stray `const p = P90` alias.
More load-bearing: `threws()` discarded the callee's return value, so case 25
re-ran the call by hand to get the verdict it asserted on — two calls, able to
drift. `threws()` now returns `{threw, msg, value}` and case 25 asserts on the
value of **the same call it probed**.

**Mutation-proven, by exit code.** The new guards were folded into cases 16 and
17 (declared count stays 30, so the seatbelt from the previous round still
matches). Each fix reverted one at a time from a working-copy `cp` backup →
suite exits **1**, red on exactly case 16 or case 17 as intended → restored →
byte-identical by sha256 → **30/30 exit 0**.

**SKIPPED, on record as open items rather than papered over:**

1. **M3 carries the same `describe`-throw class, live and unfixed.**
   `checkFloor({swapAgeMin:'P90D'}, {swapAgeMin: 10n})` throws a raw
   `TypeError: Do not know how to serialize a BigInt` out of the UNTRUSTED-side
   path (re-measured 2026-08-16; a circular value with a throwing `toString`
   throws `Converting circular structure to JSON` the same way). This is
   pre-existing, outside this diff, and already on record: the entry below
   records M3's release-gate open item 1 as only PARTIALLY closed — M4 built the
   throw-proof `describe()`, M3 was never retrofitted with it. Fixing it means
   touching a user-validated module, so it waits for M3's next deliberate touch.
2. **The spec sketch still over-promises relative to the code.** Its
   `Predicate` enum lists seven types; the M4 module answers **three**
   (`simSwapAge`, `roamingIn`, `reachable`). And `required: [type]` leaves
   `operator` optional in the schema while the module rejects any predicate
   whose operator does not match its type exactly. The sketch is illustrative,
   not normative, and **M6 is the declared reconcile point** — restated here
   because a schema looser than the reference implementation is exactly the
   silent-widening shape the profile forbids, and it should not be discovered
   fresh at M6.

## 2026-08-16 — user validation: all four modules green at `1f92792`; two decisions settled; declared case counts extended to M1–M3

**EVIDENCE**
The user personally ran the runbook on their own machine at commit `1f92792`
and reported all four suites clean: `node poc/m1-check.mjs` **19/19**,
`node poc/m2-check.mjs` **10/10**, `node poc/m3-check.mjs` **22/22**,
`node poc/m4-check.mjs` **30/30**. This closes the M4 user gate the entry below
left open and re-confirms M1–M3 at their post-release counts.

**Two user decisions on the carried-forward open items:**

1. **The three deliberately-unpinned redundant guards stay, settled.** The
   `Array.isArray` clause in `plainSnapshot`, `durationMs`'s 2^53 reject, and
   the `\d{6,12}` digit bound — each classified redundant by PROBE rather than
   by argument in the entry below — remain as documented defence-in-depth,
   marked in-source as not relied upon rather than deleted or left looking
   load-bearing. Not to be re-litigated at M6.
2. **`reachable` is minted into the spec sketch now, not deferred to M6.** The
   illustrative `Predicate` enum in `spec/carrier-attestation.yaml` becomes
   `[simSwapAge, tenure, simType, roamingIn, presentIn, numberMatch, reachable]`,
   closing the open item the two entries below carry. YAML re-parsed clean
   after the edit (exit 0). A grep of both proposals and `README.md` for a
   predicate-type list found **no normative surface to sync**: the CAMARA
   proposal's normative profile (rules 1–8) enumerates no predicate types at
   all, and its only predicate list is Mode B prose (§5.3 presentment: "device
   reachable within last hour"), which the addition agrees with rather than
   contradicts. The sketch stays illustrative, not normative. The in-source
   note in `m4-facts-mock.mjs` that flagged the type as deliberately un-minted
   was corrected in the same change rather than left stale.

**Declared case counts extended to M1/M2/M3 — and this change is
POST-VALIDATION.** The shared harness's `conclude(expected)` seatbelt (a suite
that silently loses the cases carrying its guarantee must not read green —
measured below) protected only M4. `m1-check.mjs` now declares `conclude(19)`,
`m2-check.mjs` `conclude(10)`, `m3-check.mjs` `conclude(22)`. Each
mutation-proven: one case block removed → suite exits **1** printing
`FAIL CASE COUNT: expected N cases, ran N−1` (18/19, 9/10, 21/22 respectively)
→ restored from a working-copy `cp` backup, byte-identical by sha256 → **19/19,
10/10, 22/22, all exit 0**. **Honesty note: the user validated the MODULES at
these counts; these three check files were edited afterwards, so a user re-run
of M1/M2/M3 is pending.** No module source was touched — one `conclude`
argument and one comment per check file.

## 2026-08-16 — M4 adversarial review round: 1 code defect, 5 unpinned guards, 2 harness fail-opens (24 → 30 cases)

**EVIDENCE**
Independent review of the M4 build below, run against the challenge "did you fit
to pass? what did you gloss over?". Every verdict by EXIT CODE; every mutation
restored from a working-copy `cp` backup and verified byte-identical (sha256).
**Agent-run 30/30 — the user gate is still the next step.**

**Fit-to-pass probe (written BEFORE reading `poc/m4-check.mjs`).** A 19-case
adversarial check was written from the PRD + the four signed-off decisions only,
then run: **18/19**. One failure was the harness's own confound (the probe used
`'ZW'` as both the subscriber's country and a requester-supplied predicate
value, so the requester's echoed input read as a leak — requester-echoed values
are acceptable, subscriber facts are not); corrected, it passed. The other was
real (below). So the shipped suite was **not** shaped around a broken module —
but it did leave guards unpinned, which an independent mutation set found.

**The one code defect — `describe()` could throw, breaking "wire input never
throws" from inside the message written to prevent it.** Three fallbacks, only
two guarded: `Object.prototype.toString` reads a `Symbol.toStringTag` GETTER,
and the last-resort call sat *inside* the previous `catch`, unprotected. With a
wire value that is circular (`JSON.stringify` throws) AND carries a throwing
`toString`/`valueOf`/`Symbol.toPrimitive` (`String` throws) AND a throwing
`toStringTag`, `evaluatePredicate` **threw**. Fixed by guarding each fallback in
turn with a constant floor (`[unrenderable]`); all previously-observed renderings
are byte-identical (BigInt `10`, circular `[object Object]`, `Symbol(s)`, the
60-char clamp). This means M3's release-gate open item 1 was only PARTIALLY
closed by the build below — the correction is recorded rather than the claim
quietly restated. Pinned by case 25.

**Independent mutation sweep: 28 mutants of my own selection, 20 killed, EIGHT
survived** — against the build's reported 27/28. The gap is the answer to "what
did you gloss over": the 24-case suite left seven load-bearing-looking guards
unpinned beyond the one it documented. Each survivor was then classified by
PROBE against the mutated module, never by argument:

| Survivor | Probe result | Verdict |
|---|---|---|
| `hasOwn(PREDICATES, p.type)` → truthiness lookup | `{type:'toString', operator:undefined, value:true}` returned **`{answered:true, result:true}`** — a signed AFFIRMATIVE to a predicate type that does not exist; 5 more `Object.prototype` keys the same | LOAD-BEARING → case 26 |
| `typeof p.type !== 'string'` | a boxed `String`, `['simSwapAge']` and `{toString}` each coerced to a real key and answered **`{answered:true, result:true}`** — the clause is NOT redundant (predicted redundant, measured load-bearing) | LOAD-BEARING → case 27 |
| `fact < 0` on `swapAgeMs` | a negative age answered **`{answered:true, result:false}`** — "not old enough" as a real bit. Unreachable via the mock, but M5 differences an operator-supplied `latestSimChange` against the injected now, where a skewed clock does exactly this | LOAD-BEARING → case 28 |
| `COUNTRY.test(fact)` on `roamingCountry` | fact `'fr'` answered **`{answered:true, result:false}`** — "not roaming in FR" about a subscriber who IS. The spike's own lowercase trap, arriving from the FACT side; case 17 only pinned it on the request side | LOAD-BEARING → case 29 |
| `typeof number !== 'string'` | `TEST_NUMBER.test()` COERCES, so `{toString:()=>'+990…'}` was accepted and keyed by identity: the store answered for the object and threw `unknown number` for the identical string — two subscribers wearing one number | LOAD-BEARING → case 30 |
| `\d{6,12}` digit bound | admits `+990`, `+9901`, 20-digit numbers; but every real-format number (`+33…`, `+1…`, `+86…`) still threw — the no-real-number rule (no-go 13) is carried by the `+990` PREFIX, not the bound | well-formedness only → folded into case 30 |
| `Array.isArray` in `plainSnapshot` | **the build's redundancy claim REPRODUCES** — re-probed over **13** array shapes (the build probed 8; added `arguments`, a typed array, a prototype-rewritten subclass, `new Array(3)`): 0 slipped past the remaining checks, in both the backstory and predicate directions | genuinely redundant, stays unpinned |
| `durationMs` 2^53 reject | cannot produce a wrong answer: any fact large enough to collide with an unsafe threshold fails the fact side's own safe-integer test first, so the too-fresh SIM came back `fact unavailable`, not a false `true` | redundant (defence in depth), stays unpinned |

Re-run after the six new cases: **26 of 28 killed**, the only survivors the two
proven-unreachable clauses above, each new case red on exactly the mutant it was
written for.

**Two harness fail-opens, both proven with a deliberate break** (`poc/check-harness.mjs`,
shared by all four modules):

1. **`extra.ok` was read for truthiness, not truth.** Setting one case's
   `extra.ok` to the string `'truthy-string'` printed **PASS** and the suite
   exited **0** while asserting nothing. Now `extra.ok === true`. Guard-OFF/ON
   negative control: same mistake, guard off → `30/30` exit 0; guard on → exit 1,
   red on the case. (A *typo'd* key already failed safe — that direction was fine.)
2. **A silently shrinking suite read as green.** Truncating `m4-check.mjs` to
   drop its six assertion cases printed `RESULT: 18/18` and exited **0**;
   emptying the tally entirely printed `RESULT: 0/0` and exited **0**. `conclude()`
   now takes an optional declared count and fails the run when it does not match.
   Guard-OFF/ON control with 12 cases cut: off → `18/18` exit 0; on → exit 1,
   `FAIL CASE COUNT`. M4 declares `conclude(30)`; M1/M2/M3 keep the no-argument
   form (unchanged behaviour — deliberately not re-opening modules the user has
   already validated; their next touch is the place to declare a count).

Both harness changes are behaviour-preserving for the already-validated modules,
proven by **exact case-count parity**: M1 19/19, M2 10/10, M3 22/22, all exit 0
before and after.

**Leak audit (profile rule 2) — CLEAN.** A 200,000-round fuzz over
`evaluatePredicate` returns, with subscriber facts drawn from a token alphabet
DISJOINT from every requester-supplied input, found **0** leaks of swap age,
swap timestamp, country or number — including through rejection `reason`
strings. The fuzz was proven able to fail first: injecting `fact=${describe(fact)}`
into one reason made it red within 1,623 rounds.

**Spike-claims replay — all reproduce, no correction needed.** The naive adapter
described in the entry below was rebuilt from scratch and all **13** claims
reproduced exactly: the headline flip (120d→`true`, 1d→`false`), the negative
control (setter stubbed → bit stays `true` from DEFAULTS), determinism
(2020 vs 2099 both 120d), all six traps, and the `JSON.stringify`-renders-NaN-as-null
harness artifact.

**Cross-module regression:** M1 19/19, M2 10/10, M3 22/22, M4 30/30 — all exit 0.

**Nits fixed:** the `reachable`-not-in-the-spec-enum note cross-referenced
"findings 2026-08-15"; the entry carrying that open item is 2026-08-16. A
same-file sweep found no other stale cross-reference (the two `Array.isArray`
notes were already correct). Separately, `m4-check.mjs` case 11's comment claimed
the store keeps a "frozen copy" — it keeps an unfrozen private snapshot (the
snapshot, not the freezing, is the load-bearing property and is what the case
actually tests); wording corrected rather than the code changed.

## 2026-08-16 — M4 mock facts adapter: spike traps, build, 28 mutants (27 killed, 1 provably redundant)

**EVIDENCE**
Agent-run build of module M4. **Not user-validated** — the user gate is the
next step, exactly as the ladder requires.

**The spike (throwaway, aimed at PRD §4.4's M4 assumption: "flipping the
backstory flips the bit; the fixture can show the negative").** Written the
NAIVE way on purpose — spread-merged defaults, coercing arithmetic, a
"debuggable" evaluate return — so the traps would be OBSERVED rather than
argued. The headline held: with the story scripted "swapped 120 days ago" the
windowed answer was `true`, re-scripted to "yesterday" it was `false`. The
negative control matters more than the result: stubbing the setter to a no-op
left the bit at `true`, so the case can genuinely fail. Determinism held at
both extremes — the same relative story evaluated at `now=2020` and `now=2099`
gave 120 days both times.

Then six fail-opens, each MEASURED, each ending in a confident, wrong,
signable answer rather than an error:

| Trap | Observed |
|---|---|
| `{...DEFAULTS, ...backstory}` merge + typo `swapedDaysAgo` | call looks accepted, fact comes from DEFAULTS (365d) — a scripted story silently never in force |
| backstory axis on the PROTOTYPE / as a NON-ENUMERABLE own prop | spread drops it, adapter answers 365d from defaults (M3's lesson, re-measured on a new surface) |
| unknown number via `store.get(n) ?? DEFAULTS` | confident 365-day-old SIM for a subscriber nobody scripted |
| coerced day counts | `'120'` → 120d silently works; `null` → **0 days** (`Number(null)===0`, a confident "swapped today"); `true` → 1d; `'120d'` → NaN, and `NaN >= x` is false, so the bit is decided by a parse failure |
| unknown / typo'd predicate type | naive evaluate answers a clean `false` — a signed "no" to a question never asked; whether "no" reads as safe depends entirely on the question's polarity |
| "debuggable" return `{result, swapAgeMs}` | the raw age survives `JSON.stringify` — i.e. reaches the wire |

One harness artifact worth naming so it is not re-discovered: printing the
coercion probes via `JSON.stringify` rendered `NaN` as `null`. The assertions
tested the real values (`Number.isNaN`), not the printed ones — the display was
misleading, the verdict was not.

**Build.** `poc/m4-facts-mock.mjs` + `poc/m4-check.mjs`, **24 cases, negatives
first, 24/24 exit 0**. Design points the spike forced: no defaults anywhere and
every backstory field REQUIRED with the call REPLACING the story (so a typo is
both an unknown field and a missing one, and cannot be silent); the clock is a
parameter, never read; facts and answers are separate steps — `getFacts` hands
back raw facts, `evaluatePredicate` hands back `{answered, reason, result}` and
nothing else. Case 20 asserts that answer contains **no digit at all** once
serialized: no age, date, country or number can hide in it.

**Mutation proof: 28 guards reverted one at a time, 27 killed.** Working-copy
backups (`cp` to scratch), never `git checkout` — the module is untracked, so a
checkout restore would delete it outright. Every verdict by EXIT CODE. Each
mutant took the suite to exit 1 with the intended case red; each restore
returned the file byte-identical and the suite to 24/24 exit 0. Three mutants
killed two cases at once (the prototype and non-enumerable checks also cover the
predicate path; the coercion ban also covers the overflow case) — collateral,
not confusion.

**The one survivor, deliberately kept.** Removing `Array.isArray(o)` from
`plainSnapshot` left the suite at 24/24 exit 0. This is NOT a coverage gap: a
probe over 8 array shapes — plain, empty, `JSON.parse`d, with named props,
prototype-rewritten to `Object.prototype`, prototype-set to `null`, subclassed,
sparse — showed **0 slipped past the remaining two checks**, because `length` is
a non-enumerable own property, so the own-property-count check catches even an
array wearing `Object.prototype`. The clause is unreachable by construction. It
stays (it says "a list is not a record" out loud, and mirrors M3's shape) and is
marked in-source as redundant and not relied upon, rather than being quietly
left looking load-bearing.

**Carried forward as an open item:** the predicate type `reachable` has no
counterpart in `spec/carrier-attestation.yaml`'s illustrative `Predicate` enum
(`simSwapAge, tenure, simType, roamingIn, presentIn, numberMatch`).
Reachability is a required mock FACT (FR5, mirroring the Playground admin
model), and a fact no predicate can consume is dead weight — so the type is
carried in M4 and flagged here rather than minted silently into the sketch.
The spec sketch is illustrative, not normative; M6 is the point to reconcile.

Also closed here, one module early: M3's release-gate open item 1
(`JSON.stringify` on an untrusted value can throw — BigInt, circular, throwing
`toJSON`). M4 renders every diagnostic through a `describe()` that cannot throw
and clamps at 60 chars; both properties are pinned by case 6 and both mutants
were killed.

## 2026-08-16 — M4 facts-adapter spec signed off (4 user decisions)

**DECISION**


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

## 2026-08-15 — user validation run: all three modules green at post-release counts

**EVIDENCE**
After the v0.1.0 merge, the user personally ran the full runbook on their own
machine and reported all green: `node poc/m1-check.mjs` **19/19**,
`node poc/m2-check.mjs` **10/10**, `node poc/m3-check.mjs` **22/22**. This is
the dated user-run record that was pending for M2 (first ever) and for the
post-review M1 (19-case) and M3 (22-case) states. Ladder status: **M1, M2, M3
all user-validated at current counts.**

## 2026-08-15 — 0.1.0 release gate: three unpinned guards found by mutation, fuzz clean at 500k

**EVIDENCE**
Release-gate sweep before merging the M3 module. The floor logic itself came
through clean; what did **not** was the suite's ability to catch a regression
of fixes the previous two rounds had just made.

**Fuzz (two independent oracles, both written from the rule text, not from
`m3-floor.mjs`):** 200,000 and 300,000 random published/requested pairs
compared against BigInt reference implementations — **0 monotonicity
violations across ~156,000 allow-verdicts**, and for every `allowed:true` the
returned `effective` was ≥ published on every duration axis with no axis
silently dropped. The fuzz can fail: a rejection-disabled mutant produced
**6,200 violations**. Precision past 2^53 verified by reasoning *and* probe —
any true product > 2^53−1 rounds to a double ≥ 2^53, so `isSafeInteger` can
never let a collapsed ordering through.

**Three surviving mutants (the real finding).** Cases 18/19 pinned only one
diagonal of {published,requested} × {prototype,non-enumerable}; removing any
of these three guards left the suite at **19/19 exit 0**:

| Guard removed | Observed fail-open |
|---|---|
| `m3-floor.mjs:63` published prototype | `checkFloor(Object.create({tenureMin:'P3M',swapAgeMin:'P90D'}), {swapAgeMin:'P1D'})` → `{allowed:true}` — the operator's ENTIRE floor unenforced |
| `m3-floor.mjs:95` requested non-enumerable | request demanding `swapAgeMin:'P180D'` non-enumerably → `{allowed:true, effective.swapAgeMin:'P90D'}` — demanded constraint silently dropped |
| `m3-floor.mjs:33` `Number.isSafeInteger` | pub `P9007199254740993D` vs req `P9007199254740992D` (1 day looser) → `{allowed:true}` |

The shipping code was **correct throughout** — every guard was present and
load-bearing (verified by probe: each rejects/throws correctly with the guard
in place). This was a test-coverage gap, not a defect.

**Closed by cases 20/21/22**, each mutation-proven with the guard reverted
then restored from a working-copy backup (`git checkout` stays banned here —
it reverts tracked files to HEAD and would wipe the uncommitted fix under
test): guard removed → that case **alone** red, `21/22 exit 1`; restored →
`22/22 exit 0`, module byte-identical (md5 `dfe8c276`). No collateral: each
mutant killed exactly its own case, so each case pins one guard.

**Docs honesty fix:** `poc/README.md` said M2 was `(user re-run pending)`,
implying a prior user run that `findings.md` and `prd.md` both record as
never having happened — corrected to `(user validation pending)`.

**Open items, deliberately NOT fixed in this release** (recorded so they are
on the books rather than papered over):

1. **`m3-floor.mjs:41,46` — `JSON.stringify(value)` on an untrusted value can
   throw**, breaking the module's own "wire input never throws" line. Observed:
   BigInt → `TypeError: Do not know how to serialize a BigInt`; circular →
   `TypeError: Converting circular structure to JSON`; a throwing `toJSON` →
   the attacker's `Error` escapes verbatim. **Not reachable through the
   current wire path** — `JSON.parse` cannot produce any of the three — and it
   fails *closed*, not open. Matters if a non-JSON codec (CBOR/COSE, the
   natural M2 direction) ever feeds this, or for the in-process M6 caller.
   Fix when that lands: a total `safeStr()` used at both sites, plus extending
   case 19's extra to a throwing `toJSON`.
2. **`m3-floor.mjs:118` — untrusted key echoed unescaped** into
   `unknown floor field: ${k}` (every other interpolation goes through
   `JSON.stringify`). Observed: `JSON.parse('{"a\\nPASS ALLOW":1}')` yields a
   reason containing a literal newline — forged log lines if an operator logs
   rejection reasons.
3. **`m3-floor.mjs:41,46,118` — unbounded echo of untrusted input** into
   `reason`. Measured: a 5 MB value → a 5,000,083-char reason (161 ms). No
   ReDoS (`^P(\d+)(D|Y)$` is linear — 2 MB non-matching input, 77 ms), but a
   rejected request costs a multi-megabyte log write.
4. **Spec/profile do not bound duration magnitude.** `^P\d+(D|Y)$`
   (`spec/carrier-attestation.yaml:78,83`) and rule 5 admit
   `P99999999999999999999D`, which the gate rejects. A third-party
   implementation following only the text, in any IEEE-754 language,
   reintroduces the equality-collapse fail-open. For a standards repo an
   invariant enforced only in the reference PoC is not enforced.
5. **`poc/m3-check.mjs:71,87,114`** compare `effective` to `PUB` via
   `JSON.stringify`, which is key-order sensitive. They coincide today;
   reordering `AXES` — a legal refactor — would red three cases for a non-bug.

**Validation state:** the 22/22 (M3), 19/19 (M1) and 10/10 (M2) counts in this
entry are **agent-run**; user runs are pending. The standing user-validated M3
record is 14/14 on the pre-review build.

---

## 2026-08-15 — M3 review round 2: two in-process fail-opens closed, harness hardened, rule-5 reached the text

**EVIDENCE**
Second adversarial `/code-review` over the M3 module + check + harness: **8
findings, 7 confirmed, 1 plausible**. The two that mattered were both
*fail-opens* — the gate answering when it should have rejected:

1. **Non-enumerable published axis went UNENFORCED.** A published floor
   carrying an axis as a non-enumerable own property passes the plain-object
   prototype check but VANISHES in the `{ ...published }` snapshot, so the
   operator's intended constraint was simply not compared. Closed by
   asserting the plain-object contract on own-property COUNT
   (`getOwnPropertyNames` vs `keys`), not the prototype alone.
2. **Requested prototype-carried axes were silently STRIPPED.** A request
   floor built on a prototype (`Object.create({ swapAgeMin: 'P180D' })`) came
   back `allowed: true` with the demanded constraint dropped — the same class
   as an ignored typo, but arriving off the wire. Closed in the untrusted-side
   mirror, which also catches a THROWING getter and returns `malformed floor`
   rather than letting a raw `TypeError` escape ("wire input never throws").

Mutation evidence (module restored byte-identical from a working-copy backup
after each; `git checkout` is banned here — it reverts tracked files to HEAD
and wipes the fix under test): removing the non-enumerable check → case 18
red (`expected REJECT, got ALLOW — got 'did not throw'`); removing the
prototype check in the requested-side normalizer → case 19 red (`expected
REJECT, got ALLOW — reason 'ok'`, i.e. the pre-fix fail-open reproduced
exactly). 19/19 exit 0 with both restored.

Harness hardened: `check()` now defaults an absent verdict to `{}`. A
regressed module returning `undefined` previously killed the whole suite as a
`TypeError` with **no RESULT line** — proven by mutating one reject path to a
bare `return;`: without the guard the run dies at case 4 (0 FAIL lines, no
tally); with it the run prints FAIL lines and `RESULT: 15/17`, exit 1. The
hand-rolled expect-throw blocks (cases 14/17) folded into a shared
`checkThrows(name, fn, substrings)` so a throw with a useless message still
fails.

Rule-5 sync: the three signed-off M3 rules had never reached the normative
text, breaking the repo's code+text precedent. Proposal rule 5 now states the
closed axis set, the `P<n>D`/`P<n>Y`-only grammar with 1Y = 365D declared and
months rejected as ambiguous, and numeric-not-lexicographic comparison; the
spec's `Floor` schema gained `additionalProperties: false` and a
`^P\d+(D|Y)$` pattern with quoted descriptions (unquoted commas in an inline
YAML flow mapping silently truncate — a previously confirmed bug in this
file). Verified: the spec parses and no key came back null-valued.

Docs honesty: "user-validated" was overclaiming the current state. M3 was
user-run at 14/14 on the pre-review build; the 17→19-case state is agent-run
only. M1 was user-run at 17/17 pre-hardening, 19/19 agent-run. M2 has **no
dated user-run record at all**. PRD ladder status, `poc/README.md` and the
CHANGELOG now say so, with user re-runs marked pending.

---

## 2026-08-15 — M3 floor gate: spike traps, build, mutation proofs (user-validated 14/14)

**EVIDENCE**
Spike (throwaway, scratchpad) attacked the toughest assumption — "no silent
widening path exists" — and confirmed six JS traps a naive gate would ship:

1. **Lexicographic string compare WIDENS silently**: `'P100D' < 'P90D'` is
   true as strings — a naive `requested >= published` compare rejects
   tighter requests and (mirrored) admits looser ones. Parse, never compare
   strings.
2. **`parseInt('3M') === 3`** — a lenient parser reads months as days.
3. **`Number(null) === 0`, `Number('') === 0`** — coercion turns a garbage
   PUBLISHED floor into "0 days", admitting EVERY request. Hence: broken
   published config THROWS (operator's own fault, loud); wire input rejects.
4. Strict grammar `^P(\d+)(D|Y)$` kills `P3M`/`P90d`/`90D`/`PT90H`/
   `P-90D`/compound forms/non-strings in one regex.
5. Precision past 2^53: `Number()` is monotone non-DECREASING, so an
   ordering cannot reverse — but strict-less can COLLAPSE to equal, and the
   gate's strict `<` then admits a marginally looser request. Absurd at
   profile magnitudes (~10^13 years); closed anyway by rejecting
   non-safe-integer day counts (review round).
6. Enum compare is exact-match, case-sensitive.

Build: `poc/m3-floor.mjs` (pure function, no crypto) + `poc/m3-check.mjs`
(14 cases, negatives first). USER ran the check personally: 14/14 exit 0.

Mutation proofs (module restored byte-identical from working-copy backup
after each): (A) below-floor rejection disabled → cases 1+2 red; (B)
unknown axes ignored → cases 4+5 red; (C) numeric compare replaced with
string compare → cases 2, 9, 11 red. Mutant C's FIRST run died as a stack
trace with no RESULT line — the check's own `v.effective.x` derefs were
unguarded, the exact "dead process instead of a FAIL" defect M2's review
caught — fixed with `?.` so a regressed module prints clean FAIL lines to
a RESULT tally.

Review round (opus, adversarial): 200k-iteration differential fuzz vs an
independently-written BigInt oracle — 36,452 allow-verdicts audited, 0
violations on wire-shaped (JSON.parse'd) input; the fuzz's own negative
control (a rejection-disabled mutant) produced 14,725 violations, so it
could fail. 7 warnings, all fixed and re-proven:

1. **Non-plain objects bypassed "throws loud" and failed OPEN** (validation
   iterates OWN keys; the compare read `obj[axis]` through the prototype
   chain, and getters were read twice — validate-once/compare-different
   TOCTOU). Demonstrated: `Object.create({tenureMin:'P3M'})` admitted a
   P1D request. Not wire-reachable (`JSON.parse('{"__proto__":…}')` yields
   an OWN key, caught as unknown field — verified) but M6 hands this
   function in-process objects. Fixed: non-plain-prototype published
   config now THROWS ('not a plain object'); both inputs snapshotted to
   own props before validation so validate and compare see the same data.
2. **`r < null` coerces to `r < 0` = allowed** — explicit null guard added
   to the compare (defense in depth behind validation).
3. `effective` could carry a never-validated value (same root; closed by 1).
4. The null/absent-floor branch guarding "wire never throws" was untested —
   canary case 15 added (null AND absent both inherit, mutation-proven).
5. The declared 1Y=365D constant was unpinned (a 360-day mutant survived
   14/14) — canary case 16 pins it from both sides (P364D rejects, P365D
   allows, tie keeps the operator's 'P1Y' spelling).
6. poc/README still said "M3–M6 not started" beside the M3 run line → M4–M6.
7. This log's own 2^53 claim was worded wrong (see corrected item 5 above);
   non-safe-integer day counts now rejected outright.

Post-fix: 17/17 exit 0 (user-validated build + 3 canaries), m1 19/19,
m2 10/10, five mutants killed total, all restores byte-identical.

## 2026-08-15 — The two v0.0.3 security Mediums closed (duplicate keys + key pinning)

**EVIDENCE**
Closed same-day on user decision ("fix both now"), not parked to M3.

1. **Duplicate-key equivocation — RUN and OBSERVED, then fixed.** A signed
   payload carrying `"result":true … "result":false` passed the full M1
   verifier (V8 last-wins; the closed-set check can't see it — Object.keys
   shows one `result`). With the new byte-level scan removed (mutation),
   both new check cases print `expected REJECT, got ACCEPT — got 'ok'`;
   with it, 19/19. The scan compares keys AFTER JSON escape decoding —
   case 18 proves `\u0072esult` cannot impersonate a fresh key. Normative:
   rule 2 sentence added (README copy synced, spec YAML description synced).
2. **Key pinning — text-only today.** Rule 3 now requires the verifier to
   pin the expected operator key BEFORE verification; unsigned `iss` is a
   lookup hint only. The reference verifier already takes a caller-pinned
   key, so no code change exists to test; the enforceable surface arrives
   with the trust directory at M6.

Regression: m1-check 19/19 exit 0 (2 new cases), m2-check 10/10 exit 0
(E2E composes through the patched verifier), spec YAML parses with zero
null-valued keys, mutated module restored byte-identical from backup.

## 2026-08-15 — Whole-branch release gates (code-review 8/8 fixed; security + diff-review)

**EVIDENCE**
First review of the branch as a unit (each module had only per-build
reviews). `/code-review medium`: 8 confirmed findings, all fixed and re-run
green (m1 17/17 byte-identical output, m2 10/10) — headline items: README
advertised a `demo.mjs` that doesn't exist yet (M6 target); two docs still
said ECDH+AES-GCM after the RSA-OAEP decision; the spec sketch and the
reference verifier were mutually unimplementable (iat/iss inside claims,
ISO-string exp); 6 of 8 hub-blind key attempts crashed on key-type before
any crypto (attack theater — reduced to the decryption-capable set);
`.gitignore`'s `.*/` silently ignored `.github/`. **Supersedes M2 finding 6
below:** the check-harness duplication WAS extracted
(`poc/check-harness.mjs`) once the whole-branch view made it a third-copy
risk; proven behavior-preserving by byte-identical m1 output.

Release-gate round on top (fresh agents, read-only, mutation-proving):
diff-review found the spec's unquoted inline YAML descriptions silently
truncating (the epoch-ms `exp` detail — the parity fix's own point — was
being dropped by any YAML parser), and that case 8's reason string had
become derived-from-verdict (tautology) rather than observed — both fixed,
observation restored. Security: nothing Critical/High; two Mediums are
normative-text gaps (duplicate-JSON-key ambiguity under sign-what-you-ship;
no rule pinning WHICH operator key a verifier expects) — WG-facing, held
as open decisions for the submission round, not merge blockers.

M2 built (`poc/m2-envelope.mjs` seal/open + `poc/m2-check.mjs`, 10 cases,
10/10 exit 0; M1 regression-checked at 17/17). The review's orchestrator
died on a session limit, so the finders' raw candidates were validated
manually before fixing (a dead reviewer's silence is never a clean bill).

1. **seal()'s capacity guard was hard-coded to the RSA-4096 value (446).**
   Proven live: a 300-byte payload sealed to an RSA-2048 key passed the
   guard and died inside OpenSSL as raw `data too large for key size` —
   the exact unhelpful failure the guard exists to replace; a larger key
   would falsely reject legal payloads. Fixed: capacity DERIVED from the
   recipient key's modulus (`bits/8 − 66`); non-RSA/PEM-string recipients
   get a clear "must be an RSA KeyObject" throw. Mutation-proven: restoring
   the hard-coded guard turns the new RSA-2048 case red. Lesson: a
   constant that is a property of a KEY must be derived from the key.
2. **A hardcoded `ok: true` extra assertion** (TAMPER case) printed as if
   verified while asserting nothing. Dropped — a decorative always-true
   assertion is worse than none.
3. **HUB BLIND redundancy/mislabeling** — the extra duplicated the verdict
   condition, and a catastrophic recovery would have printed as a
   taxonomy note ('mixed reasons') instead of the actual event. Fixed:
   reason now says 'recovered' when the hub reads plaintext.
4. **Triple hand-synced copies of one predicate** (SIZE CONSTANT) — now
   computed once.
5. **Unguarded parses after open() in the E2E** — a regression would have
   died as a stack trace with NO RESULT line instead of a FAIL. Fixed with
   ok-gated steps; negative control run both ways (gated → clean
   `RESULT: 9/10` exit 1; ungated shape → dead process, no RESULT).
6. **Documented, NOT fixed: the check-harness duplication** between
   m1-check and m2-check (~20 lines). Deliberate: each module's check must
   run standalone, and refactoring would touch the already-user-validated
   M1 files. Accepted drift risk, revisit only if a third copy appears
   with an actual harness bug to sync.

Post-build honesty audit (user challenge, answered item-by-item):
- **The hub is a ROLE in the check, not code** — the routing/metering hub
  actor is M6's to build; M2 delivered the envelope primitives + the
  blindness proof.
- **Requests are encrypted but NOT authenticated** — the response carries
  M1's signature, the request carries none; nothing cryptographically ties
  a request to a requester, and no ladder module owns sender authentication yet.
  OPEN ITEM — assign at M6 spec time (options: requester signature over the
  request, or accept hub-level API auth as the demo answer, stated).
- **Envelope-level replay**: a captured request ciphertext re-sent to the
  operator burns a query (billing nuisance); the requester still rejects the
  stale answer via nonce. Stateless, same story as M1 — now stated.
- **No forward secrecy**: a stolen private key decrypts recorded past
  traffic; subsumed under "demo transport, production = TLS/HPKE" but
  named here explicitly.
- **512 B constancy assumes uniform RSA-4096** (pinned by
  generateEnvelopeKeys); mixed key sizes would fingerprint key size.
- Validation split, stated: green paths re-run by the orchestrator
  directly (exit codes); mutation proofs and the live RSA-2048 probe
  validated from agents' verbatim captured output, not re-executed.

## 2026-08-15 — M2 throwaway spike (blind envelope, scratchpad)

**EVIDENCE**
RSA-4096 OAEP-SHA256 (`crypto.publicEncrypt`/`privateDecrypt`, one vetted
stdlib primitive, zero deps, no hand-composed crypto), keys exchanged via
the trust directory — never inside payloads. 8 checks, exit 0.

- **Fit is real but not roomy.** OAEP capacity is 446 bytes. Measured:
  request 148 B (33% of cap), response 270 B (60% of cap, 176 B headroom).
  Overflow control proved the cap genuinely refuses (966 B →
  `DATA_TOO_LARGE_FOR_KEY_SIZE`) — the fit tests could fail. **Constraint
  for later modules: one added claim field or a bigger payload (Mode B,
  multi-attestation) blows the envelope — that would require a vetted AEAD
  hybrid scheme as an explicit new decision, not glue.**
- **Hub blindness proven structurally, and falsifiably.** The hub tried
  all 3 directory public keys AND its own private key against both
  ciphertexts: 8 attempts, 0 recoveries, 0 plaintext substrings.
  Mutation-verified: handing the hub the true recipient's private key
  flips the blindness checks red. Positive control: operator read the
  request exactly; requester verified the M1 signature end-to-end.
- **Size side channel: does NOT exist at this layer.** All content
  variants (3 predicates, both result values, plaintexts 141–274 B)
  produced EXACTLY 512-byte ciphertexts — RSA is fixed-width, so the
  hub's byte-metering log records a constant. The rule-6 padding worry is
  answered for the demo envelope. **Honest remainder: message COUNT,
  TIMING, and the requester↔operator PAIRING stay visible to the hub — that is
  the real metadata surface, and the docs must say so.**
- **Tamper = reject, not crash**: one flipped ciphertext bit →
  `OAEP_DECODING_ERROR`, caught — the hub cannot mutate an in-flight
  answer undetected, on top of the Ed25519 signature underneath.
- Implementation note: `privateDecrypt` THROWS on every failure mode
  (wrong key, public key, tamper) — a real hub/recipient must catch
  per-attempt or die on its own probe.

## 2026-08-15 — M1 round-2 review (8 findings on the fix round + doc sweep)

**EVIDENCE**
A second review of the FIXED M1 (a fix round is the least-reviewed code)
found the fixes themselves sound but surfaced a deeper invariant hole and a
doc-drift class: **a design change (predicate-in-the-signature) must be
swept across EVERY doc surface in the same round** — spec sketch, normative
profile rules, README diagram, and PRD ladder all still described the old
shape.

1. **Raw-value smuggling through a valid signature.** A validly signed
   payload carrying `swapTimestamp` alongside the boolean VERIFIED CLEAN
   and handed the raw value to the caller — the repo's one invariant, open
   at its requester-side enforcement point. Fixed: closed claim set — any
   field beyond `{predicate, result, nonce, exp}` rejects.
2. **Incomplete response shape gate.** Only `signature === undefined` was
   caught; `null`/number/string signatures — and even a broken TRUSTED KEY
   (caller's own config) — misreported as the attack-shaped 'bad signature
   (malformed)'. Fixed: `Buffer.isBuffer` on the signature in the shape
   gate; the try/catch stays as a defensive backstop for broken caller keys
   (measured: a non-key makes `crypto.verify` throw).
3. **The check harness never asserted rejection REASONS** — collapsing
   'malformed response' into 'bad signature' (the exact regression case 1
   exists to catch) stayed green. Fixed: expected-reason assertions folded
   into pass/fail; happy-path fidelity folded into one verdict (no more
   possible PASS-then-FAIL double line).
4. **Spec sketch described a different signing mechanism than the PoC** —
   a field-tuple signature `(predicate, result, nonce, iat, exp, iss)` with
   optional members and no canonicalization is unimplementable as written.
   Fixed: sig restated as a detached signature over the exact payload bytes
   (sign-what-you-ship).
5. **The NORMATIVE profile (rule 2) never required the predicate echo** —
   the illustrative artifacts were stricter than the document that carries
   the rules; an implementer building to §3.2 alone stayed vulnerable to
   answer-substitution. Fixed: rule 2 now requires predicate echo + names
   the stateless-verification limit (single-use nonces are requester-side).
6. **README architecture diagram** still showed `signed {result, nonce,
   exp}` — the exact wire shape the check suite rejects as an attack. Fixed.
7. **PRD §4.4 M1 row** still claimed "replay … genuinely REJECT" for a
   deliberately stateless verifier. Fixed: row reworded to binding-only;
   the single-use-nonce obligation explicitly assigned to M6's requester side.
8. **`Predicate.value` was typed `string`** while its own example is the
   array `["FR","BE"]` — the schema couldn't express its documented
   set-membership case. Fixed: `oneOf` string | string-array.

Follow-up: the one flagged coverage gap (`unparseable payload` had no test,
since `attest()` can only produce valid JSON) was closed by signing
genuinely non-JSON bytes directly with `crypto.sign` — a valid signature
over garbage, proving the parse failure alone causes the rejection.
Mutation-proven to pin the exact branch: a mutant that still REJECTS but
with the sibling reason (`malformed claims`) turns only that case red —
a verdict-only assertion would have passed it. Final: 17/17, exit 0.

## 2026-08-15 — M1 review round (8 findings on the first M1 build)

**EVIDENCE**
A medium code-review of the freshly built `poc/m1-attestation.mjs` +
`poc/m1-check.mjs` surfaced 8 execution-verified findings. The lesson
class: **a verifier must type-gate every field of the signed claims — each
unguarded field was a real accept-what-should-reject hole.**

1. **`result` was never validated.** A validly signed payload with `result`
   missing, or `result: "false"` (a string), was ACCEPTED. A requester
   branching on the claim reads `undefined` (falsy) or a truthy string —
   the opposite of what was attested. Fixed: `result` must be a boolean
   (matches the repo invariant: the answer IS a signed boolean).
2. **Nonce check failed open.** `claims.nonce !== expected.nonce` passes
   when BOTH are `undefined` — a caller that forgot to generate a nonce
   silently lost all replay binding. Fixed with a string type-gate.
3. **Verifier could throw on validly-signed weird payloads.** `attest(key,
   null)` signs the 4-byte payload `null`; the verifier then crashed on
   `claims.predicate` instead of rejecting. Broke the stated
   "reject, never throw, on untrusted input" invariant. Fixed with a
   non-null-object gate after parse.
4. **Wrong factual comment about `crypto.verify`** (see spike finding below
   — the module comment stated the unmeasured claim).
5. **The try/catch around `crypto.verify` had zero test coverage.** The
   "garbage signature Buffer" case exercises the ordinary `false` path, not
   the catch. The case that actually throws: a signature that is NOT a
   Buffer at all — e.g. a base64 string straight off a JSON wire. Covered
   now with its own case.
6. **PoC vs `spec/carrier-attestation.yaml` divergence.** The sketch's
   signed set was `(result, nonce, iat, exp, iss)` — NO predicate — so
   under the sketch, a signed answer to a DIFFERENT question verifies.
   Fixed: `predicate` added to the sketch's response + signed set.
   Deliberately NOT changed: the sketch's `exp` stays RFC3339 (WG-friendly,
   illustrative) while the demo uses unix-ms (deterministic tests); the
   divergence is format-only and recorded here on purpose.
7. **Caller/config errors were attack-shaped.** A broken trusted key
   (undefined, wrong type) rejected as "bad signature (malformed)" —
   pointing debugging at a nonexistent forger. Fixed: malformed responses
   get a distinct reason before the crypto call.
8. **The "REPLAY" test overclaimed.** It proves a response bound to nonce A
   does not verify against nonce B — nothing more. The verifier is
   STATELESS: re-presenting the same response against the SAME expected
   nonce within `exp` verifies again. Single-use, per-request nonces are
   the requester's job. Test renamed/reworded to what it proves; no
   nonce-consumption state added in M1 (honest limit, stated).

## 2026-08-15 — M1 throwaway spike (scratchpad, user-validated)

**EVIDENCE**
Ed25519 attestation core spike: 5 cases (tamper / replay-nonce / expired /
wrong key / happy), 3 guard-off negative controls, 1 sabotage run.

- **All 4 negatives genuinely reject, and each guard is load-bearing**:
  disabling each guard flips exactly its own case to wrongly-ACCEPT and
  nothing else. Sabotaged always-accept verifier → harness goes red, exit 1
  (the test can fail).
- **Measured (Node 22): `crypto.verify` returns `false` on a malformed
  signature *Buffer*** (7-byte, 64-byte random, empty). It THROWS
  (`ERR_INVALID_ARG_TYPE`) only when the signature is not a Buffer at all
  (string/number/null/object). The prior assumption ("throws on malformed
  buffer") was wrong — worth knowing because a base64 string off the wire
  is the realistic throwing input.
- **Sign-the-exact-bytes works with zero canonicalization**: serialize
  once, sign those bytes, ship those bytes, verify before parse. No JSON
  key-order problem exists in this shape.
- **Gap found by the spike's own tamper case**: with signatures disabled, a
  one-bit flip inside the KEY `"predicate"` still parsed as valid JSON with
  the right nonce/exp — i.e. a verifier that only checks sig/nonce/exp will
  accept an answer whose predicate field is renamed or missing. This drove
  the predicate-match check into the real M1 (and then finding 6 above
  drove it into the spec sketch).

## 2026-08-15 — G0 rollback (process, not code)

**EVIDENCE**
**What didn't work: building G1+G2 as a monolith, integrate-then-show.**
Modules chained without user validation between them; orchestrator-only
checks. Result: full rollback to G0, code archived out of the repo, the
M1–M6 ladder made binding (POC → user-approved spec → build → works alone
→ user validates via runbook → next). Measured Orange facts survived in
`poc/README.md` — knowledge is cheap to keep; unvalidated code is not.

## 2026-08-15 — Versioning scheme corrected (user-decided)

**DECISION**

Module
releases are features, not patches: this M3 release ships as **0.1.0**
(not 0.0.5); each subsequent module bumps MINOR (M4→0.2.0 … M6→0.4.0);
PATCH is for fixes; **1.0.0 = PoC complete + proposals submission-ready**.
Existing 0.0.x tags stay untouched (history is not rewritten).

## 2026-08-15 — M3 floor-gate spec signed off (3 user decisions)

**DECISION**


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

## 2026-08-15 — Both v0.0.3 security Mediums closed now (user-decided: "fix both now")

**DECISION**

(1) Duplicate claim keys are a rejection — normative in
profile rule 2, implemented in the M1 verifier (byte-level scan, keys
compared after escape decoding; mutation-proven: guard off, one signed
blob reading true-to-last-wins/false-to-first-wins parsers is ACCEPTED;
guard on, 19/19). (2) Key pinning — normative in profile rule 3: the
verifier pins the expected operator key before verification; unsigned
`iss` is a lookup hint and must never select the trusted key (the
reference verifier already had this shape — text-only; code lands with
the trust directory at M6).

## 2026-08-15 — Decisions round after the M2 gate (all user-decided)

**DECISION**


(1) Profile rule 6 gains the size line: envelopes MUST NOT expose payload
size to the aggregator (fixed-length or padded) — backed by the M2
measurement that a length-tracking transport turns the billing log into a
side channel. (2) Request authenticity assigned to M6: the requester signs
requests, the operator verifies via the trust directory before answering
(closes the M2 audit open item). (3) Envelope replay to the operator =
documented honest limit (billing noise only; production API auth, rate
limits and billing reconciliation cover it) — no stateful nonce memory in
the demo. (4) Guardrails pre-tool hook wired locally (`.claude/`,
gitignored): denies secret-file writes and destructive shell, asks on
auth/CI/settings — armed before M5 touches Orange credentials. (5) Author
placeholders filled: Amr Hassan. (6) AAIF submission process grounded
(§7) from the aaif/project-proposals repo.

## 2026-08-15 — M2 envelope shape settled

**DECISION**

One vetted stdlib primitive:
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

## 2026-08-15 — M1 built under the ladder; verifier shape settled

**DECISION**


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

## 2026-08-15 — `findings.md` created (user-ordered)

**DECISION**

Dated evidence log
at `docs/logs/findings.md`: experiments and dead ends, complementing
this PRD. Not a design side-doc — design still folds into the 3 docs.

## 2026-08-15 — PoC build ROLLED BACK to G0; module ladder made binding (§4.4)

**DECISION**

The first build went monolith-then-integrate with orchestrator-only
checks — violating AGENT_RULES build-incrementally and keeping the user out
of validation. Code archived out of the repo; grounded spike findings
(Playground token endpoints, maxAge in HOURS capped 2400, built-in
write-shadowing, 403=unknown-number) are KEPT as dated evidence in
`poc/README.md` — knowledge survives, code restarts. Every module: POC →
build → user validates → only then the next.

## 2026-08-14/15 — Orange Network Playground (live, measured)

**EVIDENCE**
Full dated facts live in `poc/README.md` (kept as evidence through the
rollback). Headlines: two NON-interchangeable token endpoints (CAMARA vs
Admin); sim-swap `/check` `maxAge` is in HOURS (cap 2400 ≈ 100 days,
proven with a discriminating 20-day backstory); `403 FORBIDDEN` means
UNKNOWN NUMBER, not bad auth; built-in numbers `200/201`-echo Admin writes
while IGNORING them — only a READ after the write proves persistence
(READ-verify is load-bearing); `DELETE` returns `204` with an empty
non-JSON body.

## 2026-08-14 — Consolidation (this PRD)

**DECISION**

3-doc inventory (PRD + CAMARA +
AAIF proposals); `carrier-attestation-proposal.md`, `camara-plan.md`,
`aaif-plan.md`, and `docs/02-features/attested-windowed-disclosure.md`
folded and deleted. PoC = Node zero-dep, mock backend default + swappable
Orange adapter, one command, four assertions with negatives. No-go list
made a first-class PRD section.

## 2026-08-14 — Template re-grounded

**DECISION**

APIBacklog template gained a scope-
alignment section (northbound type, charter fit, overlap declaration) —
folded into D2's pre-filled mapping.

## 2026-08-14 (earlier) — Core standard = attested windowed disclosure

**DECISION**


Signed, nonce-bound, expiring booleans under monotone floors; never raw
values.

## 2026-08-14 (earlier) — Two modes; Mode A ships first

**DECISION**

Mode A preserves
per-query billing + aggregator revenue share (the adoption wedge); Mode B
(holder presentment, true ZK) is roadmap. A2P lesson → the hub is
structurally blind, not contractually trusted.

## 2026-08-14 (earlier) — Horizontal profile, not a new vertical API

**DECISION**


CAMARA precedent (`/retrieve-age-band`, `GET /device-phone-number`'s
no-body shape, `kyc-age-verification`) makes "finish what you started,
catalog-wide" the ask; CarrierAttestation new-case only for agent floors +
Mode B.
**Correction (2026-08-24 re-verification):** the premise as originally
worded here — "identifier-free 3-legged flows" — did not survive.
`POST /verify` is 3-legged and REQUIRES an identifier
(`phoneNumber`/`hashedPhoneNumber`); there is no CAMARA rule making
identifier omission normative across 3-legged flows generally. Only
`GET /device-phone-number` is structurally identifier-free (no request
body; subject derived from the 3-legged token). The decision above stands;
only the cited precedent is narrowed to that one endpoint.

## 2026-08-14 (earlier) — Two tracks, one seam

**DECISION**

CAMARA = operator side,
AAIF = agent side; they meet at the RFC 9421 header; neither depends on the
other's approval.

## 2026-08-14 (earlier) — Agent-grade floor

**DECISION**

Consumer:
`voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d (∧ postpaid optional)`, monotone.
Machine-agent profile is separate and embraces M2M. Economic scarcity,
explicitly not uniqueness.

## 2026-08-14 (earlier) — Name: justabit; repo-first, not npm-first

**DECISION**

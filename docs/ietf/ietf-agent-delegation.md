# SIM-Anchored Agent Delegation — a position paper for the IETF

### the agent/delegation side of attested windowed disclosure, targeting the
### OAuth Working Group

**Author:** Amr Hassan, independent telecom consultant (10 yrs wholesale roaming / signaling / SoR)
**Status:** Draft v0.1 — position document, not an Internet-Draft. Re-homed
2026-08-25 from the AAIF Identity & Trust WG after AAIF's
`project-proposals` intake was verified to be an open-source-project
donation gate, not a standards-proposal track (see
`docs/archive/aaif-agent-auth.md`, marked superseded, and PRD §9
decisions log, 2026-08-25 entry).
**Date:** 2026-08-25
**Companion:** the operator/attestation side is proposed separately to
CAMARA (`camara-attested-windowed-disclosure.md`). The two tracks meet at
the RFC 9421 HTTP Message Signatures header; **neither depends on the
other's approval.**

---

## 1. Summary

Autonomous agents increasingly act as network principals — MWC26
demonstrated agents invoking network APIs directly (QoD on Orange via Open
Gateway, Mplify LSO on Colt, Number Verification via Google Firebase). This
raises a delegated-authorization problem squarely inside the IETF's remit,
not a telco-specific one:

1. **Agent identity is farmable.** Anything rooted in a bare identifier
   (API key, phone number, prepaid SIM at ~$1) is bannable-in-name-only:
   reset cost is near zero.
2. **Agent authorization doesn't flow safely.** Permissions delegated to an
   agent — and re-delegated agent-to-agent, potentially across
   administrative domains — need a wire format where scope can only
   shrink, never grow, and where the delegation chain is verifiable
   offline.

This is precisely the shape of problem the OAuth Working Group's current
charter names (§6). This document proposes a deployable trust tier that
composes with that work rather than competing with it:

- **Agent identifier** = a per-service tag derived from a SIM credential —
  never IMSI/MSISDN; nothing linkable across services.
- **Floor-gated carrier attestations**: the agent's line must satisfy a
  monotone floor of operator-attested predicates; reference consumer
  floor: `simType = voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d (∧ postpaid
  optional)`. Floors may be tightened by any party downstream — the
  relying service, or each hop of a delegation chain — never loosened.
- **Scoped, expiring delegations** from the holder's phone to cloud
  agents. This is an architectural requirement, not a preference: **cloud
  agents cannot silent-auth — the SIM is in the human's pocket; agents run
  in datacenters.** The SIM-holding device is the delegation root.
- **Presentment via RFC 9421** HTTP Message Signatures: the agent signs
  its requests with the delegated key; the credential chain (carrier
  attestation → holder → agent, floors intact) travels as a header the
  relying service verifies offline.

## 2. Relationship to existing work

This section is placed early deliberately: fair positioning against prior
art has to come before the pitch, not after it.

**RFC 9421 (HTTP Message Signatures)** is the published mechanism this
proposal builds on. It is Proposed Standard, published February 2024, out
of the HTTPBIS Working Group. It is not in progress and there is nothing
to submit to for it — new work cites it, it does not amend it. HTTPBIS's
own charter excludes new domain-specific extension semantics, which is why
delegation semantics belong in a different venue (§6).

**`draft-klrc-aiagent-auth-03`** is the closest prior art found to date.
Verified facts: submitted 6 July 2026, expires 7 January 2027
(https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/). Authors:
Pieter Kasselman (Defakto Security), Jean-François Lombardo (AWS),
Yaroslav Rosomakho (Zscaler), Brian Campbell (Ping Identity), Nick Steele
(OpenAI), Aaron Parecki (Okta). It composes WIMSE/SPIFFE agent identity,
RFC 9421 message signatures, and OAuth 2.0 delegation into an
agent-authorization architecture. It is an **individual submission, not
WG-adopted**.

What it already covers, stated plainly rather than minimized: agent
identity issuance and verification, RFC 9421 presentment, and OAuth 2.0
delegation flow — the same three primitives this proposal reaches for.

What it does **not** cover — verified by direct fetch of the draft text,
not inferred: no reference to SIM cards, mobile network operators, carrier
attestation, telco APIs, or physical identity documents (ICAO/eMRTD
travel documents). This is our gap to argue, not merely assert:

- WIMSE/SPIFFE-style workload identity roots an agent's identity in
  infrastructure the agent runs on (a workload, a service mesh, a cloud
  account) — nothing in that root prices out a farm of freshly-provisioned
  workloads. It answers "which workload is this" cheaply and repeatably;
  it does not answer "how expensive would it be to make another one."
- Nothing in the draft roots a delegation chain in a human principal at
  all. It authorizes agents to act on behalf of an OAuth resource owner,
  but says nothing about anchoring that owner to a document-rooted,
  farming-resistant human identity.

Both gaps are exactly where SIM-anchored economic scarcity (§3) and a
document-rooted principal layer (§3, Honest limits below) sit. Following
a full read of the draft's complete raw text (fetched from
https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-03.txt, 1624
lines; PRD decisions log, 2026-08-25 entry), the fold-in-versus-
distinguish question is now **settled: HYBRID.**

**The verdict.** This proposal will be written as a short companion
Internet-Draft that cites `draft-klrc-aiagent-auth-03` as the WIMSE/OAuth
baseline and defines only three things:

1. An operator/carrier-attested posture-assessment input for its §8
   credential-provisioning stack — economic scarcity / sybil resistance.
2. A document-rooted human-principal identity assertion usable in its
   §10.6 Identity Assertion JWT Authorization Grant chaining flow —
   cryptographic scarcity / one accountable human.
3. The monotone floor-tightening invariant (tighten-only, closed axis
   set, consent-visible widening as a distinct operation), layered onto
   its existing Transaction Token mechanism rather than replacing it.

**Explicitly out of scope**, because `draft-klrc-aiagent-auth-03` already
specifies it and duplicating it invites rejection: agent identity,
credential formats, the RFC 9421 signing profile, and OAuth grant flows.

**The hook.** §8 (Agent Credential Provisioning) of the draft, line 478
of the raw text, names "operator assertions" as one of several posture-
assessment signals: "Posture assessment mechanisms are deployment and
risk specific. They may include hardware-backed evidence, trusted
execution environment (TEE) evidence, software integrity measurements,
supply-chain provenance, platform or orchestration-layer metadata,
workload placement information, configuration state, operator
assertions, or other environment-specific signals." The same section
states plainly: "This document does not require any particular posture
assessment mechanism, evidence format, or verifier architecture." That
is a named, textually-explicit extension point the draft itself never
populates — our single strongest piece of evidence that the sybil/cost-
of-identity question is unclaimed there. Read honestly, not as an
endorsement: "operator assertions" may be aspirational filler nobody
wires up in practice; see Honest limits, below.

**A second hook.** §10.6 (Cross Domain Access / Identity Assertion JWT
Authorization Grant) already accepts an external identity assertion
(e.g. an OpenID Connect ID Token or SAML assertion) as the input
exchanged for a JWT authorization grant — a second, independent slot a
document-rooted principal assertion can plug into.

**Verified absent**, by raw-text keyword count (case-insensitive): sybil
0, farm 0, "rate limit" 0, carrier 0, telco 0, MSISDN 0, eMRTD 0,
passport 0, KYC 0, CAMARA 0. Word-boundary "SIM" = 0 (the six
case-insensitive hits are all "similar"/"simplifies"). The single
"mobile" hit is "mobile device" in an authenticator context (line 947),
not telco identity. Their security model is workload attestation plus
short-lived credentials; nothing anywhere asks what it costs to mint
another agent identity.

Positioning this proposal as a competitor to `draft-klrc-aiagent-auth-03`
would still be wrong — it is a citation and a baseline, not a rival.

## 3. The layering model

```
┌─────────────────────────────────────────────────────────────┐
│ Principal layer (out of scope here): document-rooted human   │
│ scarcity — "one accountable human", ICAO/eMRTD travel-       │
│ document-rooted, k-bounded                                   │
├─────────────────────────────────────────────────────────────┤
│ THIS PROPOSAL: carrier tier — floor-gated SIM attestations   │
│ (economic scarcity) + scoped monotone delegations to agents  │
├─────────────────────────────────────────────────────────────┤
│ Operator/attestation side (CAMARA track): what the operator  │
│ attests and how it travels — attested windowed disclosure    │
└─────────────────────────────────────────────────────────────┘
        one presentment header: RFC 9421 HTTP Message Signatures
```

Each layer is independently adoptable; a relying service chooses which
floors it demands. These are complementary trust roots, not competing
ones, and the two scarcity mechanisms must not be conflated:

- **Economic scarcity** (this proposal's carrier tier) — SIM-anchored
  predicates are near-free for a real subscriber and expensive at farm
  scale. Cost-bounded, not identity-bounded.
- **Cryptographic scarcity** (the principal layer above) — a
  document-rooted human root, k-bounded. One existing implementation of
  that layer is the authors' own prior work (referred to elsewhere in
  this repo as zkagent/8een); it does not exist yet as shipped software,
  and this proposal is standards-neutral and does not depend on it. A SIM
  is **not** a principal root — it is farmable — and this document never
  claims otherwise.

## 4. Delegation semantics

- **Root:** the SIM-holding device (holder). Issuance of the carrier
  attestation to the holder uses network authentication on the live
  cellular session (the operator-side mechanism; CAMARA track).
- **Delegation credential:** names the agent key, carries the inherited
  floor (possibly tightened), a scope (what the agent may do), and an
  expiry. Re-delegation repeats the pattern; every hop may tighten floor
  and scope, no hop may widen either. A verifier checks the whole chain
  offline.
- **Revocation = expiry.** Delegations are short-lived by default;
  re-issuance is cheap (the holder's device is online); no revocation
  infrastructure to stand up in v1.
- **Per-service tags:** the agent presents a different derived tag to
  each relying service; a ban sticks per service (tag-keyed reputation),
  while cross-service correlation stays impossible.
- **Why floors only tighten:** a delegation chain that could widen a
  floor downstream would let the weakest hop set the ceiling for every
  hop above it — the same silent-widening failure mode the CAMARA-side
  profile forbids at the query level (see that document's rule 5). The
  discipline is identical on both sides of the seam for the same reason.

## 5. The seam with CAMARA (scope discipline)

CAMARA standardizes what the operator attests and how it travels — the
attested-windowed-disclosure profile, the blind-hub rail, the attestation
formats. **This proposal deliberately does not touch any of that.** This
side standardizes what the agent carries and how permissions flow:
delegation protocol, floor semantics down a chain, agent-to-agent
permission flow, and the RFC 9421 presentment profile.

Each side cites the other as its counterpart; either stands alone (a
relying service can verify floor-gated delegations against any attestation
issuer; an operator can issue windowed attestations no agent ever
carries).

## 6. Venue analysis

**Best first target: the OAuth Working Group.** Its charter
(datatracker.ietf.org/doc/charter-ietf-oauth/, updated 2026-06-04) carries
a work item developing "new mechanisms or/and extensions for authorization
of automated agents working on behalf of users, including addressing
scenarios where automated agents act across multiple administrative
domains." That is this proposal's problem statement, verbatim in scope.

**Why not HTTPBIS.** RFC 9421 already lives there, published. HTTPBIS's
charter excludes new domain-specific extension semantics — delegation
chains and floor semantics are exactly that kind of extension, so they
belong downstream of HTTPBIS, not inside it.

**WIMSE — partial fit at best.** WIMSE standardizes workload identity, and
`draft-klrc-aiagent-auth-03` already builds on it. But WIMSE's charter
explicitly **excludes personal identities**, which cuts directly against a
human-rooted principal layer. WIMSE can carry the agent-workload identity
piece; it cannot be the venue for the document-rooted human root this
proposal's layering model depends on.

**SPICE** — credential-format work only; a possible venue for the
attestation credential's format, not for delegation semantics or the
principal layer.

**CATALIST** — a coordination/routing venue, not a drafting WG; useful as
a place to float the idea and get routed to the right WG, not a place to
land the work itself.

**I-D mechanics.** Format: RFCXML (xml2rfc v3). Naming convention:
`draft-<lastname>-<wg>-<topic>-00`. An Internet-Draft expires 185 days
after posting unless refreshed. An unaffiliated individual may submit an
I-D with no membership, no sponsor, and no fee (sources:
authors.ietf.org/submitting-your-internet-draft,
datatracker.ietf.org/submit/tool-instructions/).

**Key dates.** I-D submission cutoff for IETF 127: 2 November 2026, 23:59
UTC. IETF 127 Hackathon: 14–15 November 2026 (free, open to non-members,
requires only a free Datatracker account). IETF 127 meeting: 14–20
November 2026, San Francisco. Main-meeting registration fee could not be
verified and is not stated here.

## 7. The two-slot structure

The HYBRID verdict (§2) rests on a specific shape, not just a citation.
This proposal's companion draft defines **slots, not implementations** —
two independent instantiations of one abstract pattern (a
scarcity-attested principal), each plugging into a hook already named in
`draft-klrc-aiagent-auth-03`:

- **Operator-assertion slot** (← its §8 credential-provisioning stack) —
  filled by CAMARA operator APIs. **Economic scarcity**: costs money to
  farm.
- **Principal-assertion slot** (← its §10.6 Identity Assertion JWT
  Authorization Grant) — filled by zkagent. **Cryptographic scarcity**:
  document-rooted.

Economic and cryptographic scarcity are separate, non-competing trust
lanes — existing repo doctrine (§3), restated here because it is the
reason the two slots stay distinct rather than merging into one.

Because the companion draft defines slots and not implementations,
**neither implementation needs to exist for the draft to stand.** A
relying service can adopt the slot structure with no CAMARA API live and
no zkagent build shipped; it is the vacancy that is standardized, not the
occupant. This is precisely what keeps zkagent a citation in this
proposal, never a dependency (§3).

## 8. Honest limits

Carried forward from the AAIF-framed draft, plus limits specific to this
re-homing:

- Floors price identity resets; they **do not create uniqueness**. One
  subscription can back many agents — rate limits and reputation key to
  the per-service tag, and "one accountable human" requires a
  document-rooted principal layer *above* this tier, a different and
  complementary lever this proposal does not implement.
- A SIM is **not** a principal root. This tier prices out farms; it never
  claims to identify the human.
- Number portability breaks naive tenure (an honest porter resets to
  zero); porting-aware continuity attestation is an open design question
  tracked on the CAMARA side.
- **Machine agents are a separate profile.** Fleets and vehicles have no
  human to document; their profile deliberately embraces M2M SIMs (fleet
  contract tenure, account standing, mobility-pattern organicity). The
  consumer-agent floor's `voice+data` exclusion filters farms; it is not
  a statement that M2M SIMs are illegitimate. The two profiles must not
  be conflated.
- **Prior-art crowding.** `draft-klrc-aiagent-auth-03` already occupies
  much of this problem space with six industry co-authors from Defakto
  Security, AWS, Zscaler, Ping Identity, OpenAI, and Okta. A solo
  independent draft entering the same charter work item competes for WG
  attention against an already-visible, multi-organization submission.
  The differentiators (§2) are real but narrow; the HYBRID verdict (§2)
  keeps this draft short and citing rather than standalone-competing,
  which mitigates but does not remove the crowding risk. The space
  has since gotten more crowded still:
  `draft-asor-wimse-agent-delegation-chain-00`,
  `draft-reece-wimse-cross-org-delegation-01`, and
  `draft-sweeney-wimse-credential-delegation-00` are three further
  individual drafts in adjacent territory (verified 2026-08-28/29 on
  the IETF Datatracker). None of the three touches SIM, carrier, or
  economic scarcity, so the differentiator against them holds — but
  this is recorded as a worsening limit, not a win.
- **Two divergences with `draft-klrc-aiagent-auth-03`, recorded honestly
  rather than smoothed over.** (1) Revocation: they offer *more* than
  this proposal, not less — their §11 says a participant MAY subscribe
  to SSF/CAEP change notifications as an optional revocation-signal
  channel, where this proposal relies on short expiry with no
  revocation infrastructure to stand up. (2) Identifier stability:
  their model wants an identifier that stays stable for the lifetime of
  the workload identity, for audit; this proposal's per-service
  unlinkable tags want the opposite. Neither is resolved here — both are
  flagged as open reconciliation items for whoever drafts the companion
  I-D, not swept into the differentiators list as though they were free
  wins.
- **"Operator assertions" may be aspirational filler.** §8 of
  `draft-klrc-aiagent-auth-03` names the extension point this proposal's
  operator-assertion slot fills, but naming a slot is not the same as
  anyone having wired it up. The hook is real text in the draft; it is
  not proof that the draft's authors or any implementer intend to use it
  the way this proposal proposes.
- **An individual draft confers visibility and a timestamp, not
  standing.** Filing an I-D is not adoption, and adoption is not
  publication. The actual work is sustained mailing-list participation
  and meeting presence over multiple IETF cycles — filing is the easy
  part.
- **The PoC is single-author with no external adoption.** The companion
  repository's proof of concept (`poc/`) demonstrates the mechanism
  end-to-end but has not been run, reviewed, or adopted by any party
  outside this project. It is evidence that the idea works, not evidence
  that anyone else wants it.
- **Author bandwidth.** Solo contributor, no member-company affiliation,
  and IETF drafts live or die on sustained multi-cycle presence — the same
  risk already logged on the CAMARA side, restated here because it applies
  independently to this track.

## References

- RFC 9421, HTTP Message Signatures, Proposed Standard, February 2024,
  HTTPBIS WG: https://www.rfc-editor.org/rfc/rfc9421
- `draft-klrc-aiagent-auth-03`, 6 July 2026, expires 7 January 2027:
  https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/ · raw text
  (1624 lines), verified directly for §2 and §7's findings:
  https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-03.txt
- `draft-asor-wimse-agent-delegation-chain-00`, R. Asor, Attenu, 27
  August 2026: https://datatracker.ietf.org/doc/draft-asor-wimse-agent-delegation-chain/
- `draft-reece-wimse-cross-org-delegation-01`, M. Reece, TowerGuardian
  Consulting, 30 July 2026:
  https://datatracker.ietf.org/doc/draft-reece-wimse-cross-org-delegation/
- `draft-sweeney-wimse-credential-delegation-00`, K. Sweeney, no
  affiliation, 27 July 2026:
  https://datatracker.ietf.org/doc/draft-sweeney-wimse-credential-delegation/
- OAuth WG charter (updated 2026-06-04):
  https://datatracker.ietf.org/doc/charter-ietf-oauth/
- WIMSE WG charter: https://datatracker.ietf.org/wg/wimse/about/
- Submitting an Internet-Draft (unaffiliated individual, no fee):
  https://authors.ietf.org/submitting-your-internet-draft ·
  https://datatracker.ietf.org/submit/tool-instructions/
- IETF 127 meeting page: https://www.ietf.org/how/meetings/127/
- MWC26 agentic demo (Mplify, Colt, Orange, Google Cloud, GSMA Open
  Gateway):
  https://www.mwcbarcelona.com/articles/mplify-colt-orange-google-cloud-and-gsma-open-gateway-demonstrate-agentic-connected-experiences-at-mwc26-barcelona
- Companion CAMARA proposal (v1, as filed):
  `docs/camara/v1/camara-attested-windowed-disclosure.md`
- Superseded prior draft of this document, retained as a dated record:
  `docs/archive/aaif-agent-auth.md`
- PRD process facts and decisions log:
  `docs/product/prd.md` §7, §9 (2026-08-25 entry)

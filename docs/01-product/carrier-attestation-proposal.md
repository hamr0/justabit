# CAMARA API Proposal — CarrierAttestation

### Privacy-preserving network attestations: a holder-based presentment mode for CAMARA anti-fraud and status APIs

**Author:** [name], independent telecom consultant (10 yrs wholesale roaming / signaling / SoR)
**Status:** Draft v0.1 — pre-submission (not yet filed to APIBacklog)
**Date:** 2026-08-14
**Basis:** proof architecture adapted from the 8een Agent Auth design (issuer → holder → verifier, ZK presentment, scope binding, metadata uniformity) — see `8een-agent-auth-PRD.md`

---

## 1. Executive summary

CAMARA APIs today follow a **lookup model**: a relying party (RP) sends a subscriber identifier (MSISDN) to an operator and receives a fact back ("SIM not swapped", "number verified", "device roaming in FR"). The answer is minimal; the **query path is not**. Every check ships an identifier, creates a carrier-side log of *which RP asked about which subscriber and when*, and returns an answer linkable across RPs and across time.

This proposal adds an **attestation model** as an *additive consumption mode* — no change to existing APIs:

1. **Issue**: the operator issues a short-lived, signed attestation of a network fact *to the subscriber's device* (holder), via an Open Gateway endpoint.
2. **Present**: the subscriber (or their app/agent) presents a **zero-knowledge or selective-disclosure proof** of a predicate over that attestation to the RP ("SIM unswapped ≥ 90 days", "device currently roaming in an EU country").
3. **Verify**: the RP verifies the proof offline against the operator's published keys. It learns the predicate — not the MSISDN, not the raw value, and nothing linkable across services.

Same trust root (the operator), same commercial model (issuance is billable exactly like a lookup), zero new surveillance byproduct.

## 2. Problem statement

| Leak | Lookup model today | Consequence |
|---|---|---|
| Identifier travels | RP → aggregator → operator, carrying MSISDN | RP must hold/process the number even when it only needs a boolean; GDPR minimization tension |
| Query log | Operator/aggregator logs (RP, subscriber, time, API) | A new cross-industry metadata stream: who banks where, who registered on which platform, when |
| Linkability | Responses keyed to the same identifier everywhere | Any two RPs (or one RP over time) can correlate a subscriber's checks |
| Consent opacity | Consent gathered out-of-band, subscriber never sees the flow | Weak Art. 6/7 GDPR story; ePrivacy exposure |

Fraud-prevention APIs are CAMARA's top commercial use case (GSMA Open Gateway, MWC 2026: 300+ commercial launches, 65 markets). Scaling the lookup model scales the metadata stream with it. Data-minimization regulation (GDPR Art. 5(1)(c), eIDAS 2.0 wallet principles, sectoral fraud-liability rules pushing banks toward these APIs) lands on the **buyers** of these APIs — they need the fact without the identifier. The lookup model cannot deliver that; a presentment model can.

### 2.1 How CAMARA answers this today (state of the art)

The catalog already splits into two shapes — proof that the predicate instinct exists, and that it stopped halfway:

| API | Predicate-shaped ("verify") | Raw-value-shaped ("retrieve") |
|---|---|---|
| SIM Swap (v2.1.0, r3.3) | `POST /check` → boolean `swapped` vs maxAge; `POST /retrieve-age-band` → coarsened recency band (1–17, provider-optional) | `POST /retrieve-date` → `latestSimChange` actual timestamp (RFC 3339) |
| Number Verification (v2.1.0, r3.2) | `POST /verify` → boolean `devicePhoneNumberVerified` | `GET /device-phone-number` → **actual `devicePhoneNumber`** off the network-auth token |
| Device Swap | check → boolean | retrieve-date → actual timestamp |
| Device Roaming Status | — | `/retrieve` → flag + actual country; subscription mode **pushes country changes** |
| Location | Verification → yes/no/partial vs radius | Retrieval → actual area |
| KYC (r2.2, split into 3 repos post-Spring25) | `kyc-match` → per-field match scores; **`kyc-age-verification` → boolean age-threshold predicate** | **`kyc-fill-in` → returns name/address/birthdate from operator KYC records** |

*Verified against spec YAMLs and repos 2026-08-14 (all Incubating stage since Feb 2025). Two verified precedents strengthen this proposal's framing:* **(a) `/retrieve-age-band` is already a windowing move** — CAMARA itself ships a precision-coarsened response variant, conceding that raw timestamps over-disclose; **(b) in 3-legged flows the spec MANDATES identifier-free requests** — `phoneNumber` "MUST NOT be included" when derivable from the access token. Both are the WG's own precedents; this proposal completes their trajectory (bands → booleans with floors; token-scoped identifier omission → blinded subjects). Also verified: `kyc-age-verification` means an age-predicate API already exists — the predicate pattern is accepted; only the query-path and retention discipline are missing.

Privacy is currently handled procedurally: (a) ICM's OIDC consent profile — a `purpose` parameter (W3C DPV) on the query, 3-legged/CIBA where market law requires; (b) aggregator DPAs — the middleman still sees every query; (c) the "responses are minimal" argument — true only for check-variants, silent about the inbound identifier and the query log in all variants. **Consent today is a string logged next to the query; in presentment, consent is the fact that a query never existed.** The verify/retrieve split is the internal precedent this proposal completes: verify-shaped answers deserve presentment-shaped queries.

## 3. Proposed solution

### 3.0 Two consumption modes

**Mode A — attested query response (primary; the adoption wedge).** The existing rail, commercially unchanged: RP → aggregator → operator, per-query billing and revenue share as today. What changes is payload discipline:
- the request carries the RP's predicate + floor (§5.1.3) + a fresh nonce;
- the operator answers with a signed, **windowed boolean bound to that nonce, valid for the duration of the query** — never a raw value, date, country, or number;
- request and response are end-to-end encrypted RP↔operator: the aggregator **fulfills and bills but cannot read** (blind hub, §6.1).

Claims discipline (zkagent rule: the name may be aspirational, the claims may not): Mode A is **attested windowed disclosure**, not zero-knowledge, and must never be described as ZK. Residual: the operator's query log (RP asked about subscriber S) remains — acceptable here because in these use cases (KYC, fraud) the RP already holds the number its customer gave it; Mode A removes over-disclosure, middle-layer visibility, and response retainability.

**Mode B — holder presentment (extension; agentic and no-identifier cases).** Attestations issued to the subscriber's device; the holder/agent presents proofs (§3.3). Removes the inbound identifier and the operator query log entirely; requires holder-side software; ZK proper enters here. **Mode A is the wedge; Mode B is the roadmap.**

### 3.1 Roles

- **Issuer** — the operator (exposed through Open Gateway / aggregators), signing attestations of network facts it already computes for existing CAMARA APIs.
- **Holder** — the subscriber's device (SIM-bound app, OS wallet, or EUDI wallet), receiving and storing attestations; generates proofs.
- **Verifier / RP** — any service; verifies proofs against operator public keys (published, e.g., JWKS per PLMN). No API subscription needed to *verify* — verification is offline math.

### 3.2 Attestation (issued object)

Short-lived signed credential containing, e.g.:

```
{
  "iss": "opengateway.operator.example (PLMN 26201)",
  "sub": <blinded subscriber commitment — NOT the MSISDN>,
  "fact": { "type": "simSwap", "lastSwapAge": ">90d" } | { "type": "roamingStatus", "roaming": true, "country": "FR" } | ...,
  "iat" / "exp": minutes-to-hours validity,
  "cnf": holder key binding (proof-of-possession)
}
```

Format candidates (decide in WG): **SD-JWT VC** (selective disclosure, simplest operator on-ramp), **BBS+ signatures** (unlinkable multi-show), **zk-SNARK over a signed statement** (full predicate flexibility — the 8een approach). Recommendation: profile SD-JWT VC for v1 (aligns with eIDAS 2.0 / OpenID4VCI+VP tooling operators will need anyway), keep the proof layer pluggable so BBS+/SNARK presentments can be added without re-issuing.

### 3.3 Presentment

- Proof of a **predicate**, not the raw fact: "swap age > N days", "roaming ∈ EU", "number prefix ∈ +49", "device reachable within last hour".
- **Scope binding** (from 8een §3.7): the proof is cryptographically bound to the verifier's domain and a session nonce — replay-useless elsewhere, and two RPs cannot correlate presentments.
- **Metadata uniformity** (8een risk #10): fixed proof sizes/versions so the presentment itself cannot fingerprint the holder.
- Transport-agnostic: HTTPS, OpenID4VP, QR/optical presentment for in-person or air-gapped flows.

### 3.4 Identifier model — no MSISDN/IMSI on the wire

- CAMARA today identifies the device by `phoneNumber` (MSISDN), `networkAccessIdentifier`, or device IP/port; IMSI never leaves the operator domain. Swapping MSISDN for IMSI would not reduce linkability — both are long-lived tracking keys. This proposal removes the identifier from the RP-facing wire entirely.
- **Issuance leg** (subscriber ↔ operator): no identifier is sent — network authentication on the live cellular session ("silent auth", the existing `number-verification` mechanism) tells the operator which SIM is asking. The operator resolves MSISDN/IMSI internally, where it is already known.
- **Attestation subject**: a blinded commitment, with per-RP scope and time-window epoch: `tag = HASH(subscriber_secret, rp_scope, epoch)`. The RP sees a predicate proof bound to this tag + its session nonce — nothing longitudinal, nothing cross-RP.
- **Windowing note**: unlike principal-auth systems that need stable per-service tags to make bans stick (8een), fraud predicates need *freshness*, not continuity — the epoch window deliberately prevents even a single RP from building a profile over time. Stability vs. windowing is a per-attestation-type knob, not an architectural fork.
- **Precedent argument**: 5G already conceals the permanent identifier on the air interface (SUPI → one-time SUCI). CAMARA also already supports identifier-free implicit identification (IP/session-based). This proposal extends an accepted principle — long-lived identifiers must not travel — from the radio and session layers to the API layer.

### 3.5 What this is NOT

- Not a replacement or breaking change to any existing CAMARA API — the lookup model remains for server-to-server cases with consent.
- Not an identity system — attests network facts only; deliberately composable with (not competing with) EUDI wallet PID.
- Not a new consent framework — it *is* consent made structural: nothing moves without the holder presenting.

### 3.6 Design principles

1. **Attest facts, never identities** — operators sign predicates; RPs consume booleans.
2. **No long-lived identifier leaves the operator** — MSISDN/IMSI resolved internally at issuance (silent auth); the wire carries `HASH(sim_secret, rp_scope, epoch)`.
3. **Holder-mediated: consent is structural** — nothing flows operator→RP directly; no presentment, no data, no log.
4. **Nonce'd + expiring** — replay-dead, retention-hostile; what an RP stores is correlation-worthless.
5. **Disclosure window, narrow by default, monotone tightening** (per zkagent's "attested windowed disclosure"): the requestor receives exactly the predicate it asked for — one bit by default; widening the window requires an explicit, holder-visible request, and policy floors can only be *tightened* downstream (a delegation or intermediary may demand stricter predicates, never looser).
6. **Time window as a per-type knob** — fraud predicates get epoch-windowed tags (no longitudinal profile); bannable-identity cases get stable per-RP tags (consequence sticks). Same derivation, different epoch policy.
7. **Policy at the edge, facts at the core** — operator = issuer of attested facts and published profiles; RP = chooses required predicates; neither sees the other's counterparty.
8. **Additive and standards-riding** — no changes to existing APIs; SD-JWT VC / OpenID4VP / RFC 9421.

## 4. Phase plan (proposal scope ladder)

| Phase | API predicate family | Backing CAMARA API | Flagship use case |
|---|---|---|---|
| 1 | **SIM swap age** | `sim-swap` | Bank authorizes transfer on "unswapped ≥ N days" proof — never receives/queries the MSISDN |
| 2 | **Number verification** | `number-verification` | Sign-up proves control + carrier verification of a number without exposing it until/unless needed |
| 3 | **Roaming & presence predicates** | `device-roaming-status`, `location-verification` | See §5 — the multi-case expansion |
| 4 | **Device/tenure/KYC predicates** | `device-status`, `kyc-match` | "Account tenure > 2y", "postpaid", KYC match as boolean proof |

Each phase = one attestation type + one predicate circuit/profile + one reference RP verifier. Phase 1 alone is a complete, demoable, sellable story.

### 4.1 Submission shape: horizontal profile first, new API second

Verified precedent (§2.1) shows CAMARA is already converging on this independently — `/retrieve-age-band` (coarsened responses), identifier-free 3-legged requests, `kyc-age-verification` (boolean predicate API). Therefore the primary deliverable is **not** a narrow new API but a **horizontal profile** — "attested windowed disclosure" — submitted where cross-API rules live:

- **Commonalities** (owns catalog-wide API design guidelines): windowed/boolean response discipline, nonce binding, query-lifetime validity, monotone floors, hub-blind encryption — as a design-guideline profile any API can adopt.
- **ICM** (owns consent/auth profiles): the consent-is-structural argument and the auth-flow hooks.
- **Per-API adoption PRs** to existing sub-projects (sim-swap, roaming-status, location) — small diffs, since half the machinery (bands, token-derived identifiers) is already in their specs. Existing APIs become the *examples/attestations* of the profile.
- **CarrierAttestation as the new-case repo** only for what no existing API covers: the agent-grade floor (§5.1.3), profile bundles, Mode B presentment.

Politically this inverts the ask from "approve my API" to "finish what you started, catalog-wide" — and it makes the standard apply to *all* use cases rather than a narrow suite.

### 4.2 Second avenue (goal): AAIF project proposal

[AAIF](https://aaif.io/) ("operationalizing agentic AI for enterprise scale") hosts community projects and runs an **Identity & Trust working group** — "portable identity and dynamic trust for autonomous agents: delegation protocols, cross-domain identity, and how permissions flow across agent-to-agent interactions." That is the §5.1 agent stack verbatim (floor-gated SIM attestation → scoped monotone delegations → RFC 9421 presentment). **Goal: submit the agent-auth layer as an AAIF project proposal in parallel with the CAMARA track** — CAMARA standardizes the operator/attestation side; AAIF standardizes the agent/delegation side; the two meet at the RFC 9421 header. Next action: ground AAIF's submission process from their project pages and draft the companion proposal.

## 5. The roaming expansion (why this generalizes)

`Device Roaming Status` already exists in CAMARA (real-time roaming state + country, incl. subscription/webhook mode). In lookup mode it is a **tracking API** — RPs learn where subscribers are, continuously. The same facts as holder-presented predicates:

| Use case | Predicate proven | What the RP does NOT learn |
|---|---|---|
| Bank fraud rules | "device is (not) roaming" / "device in country of card transaction" | which country, travel history, MSISDN |
| Content licensing | "device in licensed region R" | exact country, identity |
| Travel insurance activation | "roaming outside home country since date D" | destination |
| Regulatory / sanctions gating | "device NOT in embargoed region" | actual location |
| Duty-of-care / workforce | "employee's device reached destination country" | carrier, number |
| Roaming-aware pricing/offers | "currently roaming on partner PLMN" | subscriber identity until opt-in |

One issuance rail + pluggable predicates ⇒ every new CAMARA status API becomes a new attestation type for free. That is the robustness argument to put in front of the WG: **this is not one API, it is a consumption mode the whole catalog inherits.**

### 5.1 Agentic AI — the "why now"

MWC26 demonstrated agents autonomously invoking network APIs (QoD on Orange via Open Gateway, Mplify LSO on Colt, Number Verification via Google Firebase) — agents observing, deciding, and acting as network principals ([MWC26 demo](https://www.mwcbarcelona.com/articles/mplify-colt-orange-google-cloud-and-gsma-open-gateway-demonstrate-agentic-connected-experiences-at-mwc26-barcelona)). Two consequences:

1. **The query-log problem scales to machine speed.** Agentic consumption means high-frequency, automated API calls; in the lookup model every one of them ships an identifier and lands in a log. The metadata stream of §2 grows by orders of magnitude precisely as agents mainstream. Presentment caps it at zero regardless of volume.
2. **Carrier predicates as SIM-farm resistance for agent auth.** A SIM cannot be an agent's *principal root* — prepaid SIMs are ~$1 and farmable at industrial scale, so MSISDN-rooted agent identity is bannable-in-name-only. But subscription-quality predicates are near-free for real subscribers and expensive at farm scale. Presented as ZK proofs, they raise the fraud cost floor without identifying anyone. Layering: a human-scarcity principal proof (e.g., document-rooted, k-bounded) proves the accountable human; a delegation credential names the agent; **CarrierAttestation prices out the farm**. Complementary trust roots, one wire format (W3C VC + RFC 9421).

3. **The agent-grade floor (profile sketch).** The attestation is a set of variables the subscriber can self-issue via their operator; the requestor sets a minimum floor, and floors are monotone — they can only be tightened (by the RP over time, or down a delegation chain), never loosened (principle §3.6-5). Reference consumer-agent floor:

   ```
   simType   = voice+data          # excludes data-only IoT/M2M SIMs — the farm's cheap input;
                                   # consumer voice+data SIMs are KYC'd in most markets and costlier
   tenure    ≥ 2 years             # aged subscriptions are slow/expensive to mass-produce
   swapAge   ≥ 90 days             # kills swap-and-reset
   class     = postpaid            # optional tightening
   ```

   Failing the floor after a tag ban means starting over with a fresh SIM that fails `tenure` on day one — **identity reset becomes expensive**: economic scarcity (cost-bounded) versus a document root's cryptographic scarcity (k-bounded). Weaker guarantee, but deployable today, no new hardware, and it covers what no document root can: **machine agents with no human to document** (vehicles, IoT fleets) — which get a *separate* machine-agent profile that deliberately embraces M2M SIMs (fleet contract tenure, account standing, mobility-pattern organicity) rather than excluding them. The two profiles must not be conflated: `voice+data` exclusion is a *consumer-agent* floor filtering farms, not a statement that M2M SIMs are illegitimate.

   Honest limit: floors raise the cost of an agent identity; they do not create uniqueness. One subscription can back many agents — rate/reputation keys to the tag, and "one accountable human" still requires the document-rooted layer above.

## 6. Stakeholder value

- **Operators**: keep attestation revenue (issuance is metered like lookups); shed the query-log liability (less retained PII, cleaner GDPR/ePrivacy posture); differentiated "privacy-grade" tier to sell where raw APIs face procurement resistance.
- **Aggregators (Vonage/Infobip/Aduna/hyperscalers)**: a premium product tier; verification-side network effects (any RP can verify without integration).
- **Relying parties**: data-minimization compliance by construction; no PII custody for facts they only need as booleans; offline verification (no per-check API latency in the hot path).
- **Subscribers**: facts about their network life move only through their hands; unlinkable across services.
- **CAMARA/GSMA**: an answer to the "telco surveillance API" criticism before regulators write it for them; direct alignment with eIDAS 2.0 timelines.

### 6.1 The A2P lesson: the aggregator as blind hub

A2P SMS decayed because the middle layer could see and arbitrage per-message value: grey routes, spam, fake DLRs, SIM farms, rogue operators. The trust model was "the aggregator promises not to" — and it always eventually did. This proposal fixes that structurally, not contractually:

- **Aggregator role = dumb connection hub utilizing existing operator connections.** One signup → every connected network; the hub *fulfills and bills*, nothing more.
- **Mode A: per-query billing continues, blind** — request/response are end-to-end encrypted RP↔operator; the hub sees metering envelopes (count, route, bill) but never numbers, predicates, or answers. Existing revenue-share commercials with operators continue unchanged.
- **Mode B: presentment never touches the hub** — issuance passes through as ciphertext to the holder; verification is against operator keys.
- **No grey-route surface**: arbitrage needs *visible* per-message value; a hub that can count but not read has nothing to arbitrage, and billing reconciles independently from operator-side and RP-side counts.

The aggregator keeps distribution, contracts, and developer experience — the revenue role — and loses only the surveillance option and the arbitrage surface. This is a design goal, stated explicitly: **the middle layer must not be able to accumulate value beyond carriage, because history (A2P) shows accumulated middle-layer value gets monetized against the ecosystem.**

## 7. How CAMARA participation actually works (grounded)

- CAMARA is a **Linux Foundation open-source project**: participation in working groups, mailing lists, GitHub issues/PRs, and meetings is **open — no membership fee or company affiliation required to contribute**. Membership tiers exist for funding/governance seats, not for contribution rights.
- New APIs enter through the **API Backlog Working Group** (`github.com/camaraproject/APIBacklog`):
  1. Fill the **API proposal template** (`documentation/` in that repo; see filled examples under `documentation/SupportingDocuments/API proposals/`).
  2. Submit as a **pull request** to the APIBacklog repo.
  3. Proposal is discussed in Backlog WG meetings; it needs **supporters** among WG participants (historically operators/vendors — see §8).
  4. TSC review → approval → a **Sandbox API repository** is created for incubation; graduation follows CAMARA's lifecycle.
  5. Anti-staleness rules: proposals are frozen if no GitHub activity for 6+ weeks or the owner misses 3 consecutive WG meetings — **sustained presence is part of the job**.
- **Future changes/expansion** (your ongoing lever): once a Sandbox repo exists, evolution happens by ordinary GitHub issues/PRs + sub-project meetings; scope extensions of existing sub-projects also route through the Backlog WG. Nothing about later phases requires re-entering from zero.
- Natural allies inside CAMARA: the **Identity & Consent Management (ICM) working group** (owns the OIDC/consent profiles — a privacy presentment mode is squarely their agenda), and operator delegates already active on `sim-swap` / `device-roaming-status` sub-projects.

## 8. Independent-contributor strategy (no company behind you)

Realities: proposals historically come from member companies; an independent needs supporters more than credentials. Sequence:

1. **Land the document first** — circulate this proposal as a GitHub Discussion / ICM mailing-list post *before* the formal Backlog PR; collect reactions, adjust, and identify 2–3 sympathetic operator delegates (privacy-forward research arms: DT, Orange, Telefónica have been the usual suspects in ICM).
2. **Bring the demo, not just the doc** — a sandbox prototype (Orange/Telefónica/Vonage sandboxes expose `sim-swap` and `device-roaming-status` today): RP verifies a SIM-swap proof; never sees the number. A working demo converts a WG discussion from "interesting" to "assignable".
3. **File the Backlog PR with named supporters** listed in the template.
4. **Attend the cadence** — Backlog WG + ICM calls; the 6-week/3-meeting staleness rules mean showing up *is* the moat, and it is one an independent can afford where a certification never was.
5. Expect the credit to be shared and the timeline to be telecom-speed (quarters). The independent's payoff: named author of the privacy profile the ecosystem adopts — positioning that converts to consulting/roles/partnerships regardless of which operators productize it.

### 8.1 PoC plan (Orange sandboxes — no real numbers needed)

**Tier 1 — Network APIs Playground (mocked, free, instant):** free developer account; 15 built-in test numbers (+990 country code) plus up to 10 user-defined; an Admin API assigns each number a scriptable backstory (swap date, roaming country, reachability) — the full predicate matrix becomes testable ("swapped yesterday" → proof fails; "swapped 120d ago" → `swapAge ≥ 90d` passes). All OAuth flows incl. a simplified 2-legged Playground mode.
**Tier 2 — CAMARA Sandbox, Orange lab (real lab implementation):** Orange Developer Console app → OAuth via `api.orange.com/oauth/v3/token` → lab endpoints (e.g. device-roaming-status v0.6; dedicated lab numbers +40789103050–59). Lab APIs may change without notice — demo material, not a dependency.

**PoC scope: Mode A** — windowing + nonce + blind hub, on the Playground:

```
[RP demo "bank"] ──(predicate + floor + nonce, encrypted)──▶ [blind hub sim] ──▶ [operator shim]
                                                              meters & "bills";     wraps Playground
                                                              sees ciphertext only  sim-swap / roaming
[RP demo] ◀──(signed {predicate: true/false, nonce, exp}, encrypted)────────────────┘
```

Four assertions the demo proves:
1. **Windowing** — never a raw value on the wire: `swapAge ≥ 90d → true` even though the Playground knows the exact date; roaming → "in FR: yes/no", never the country list.
2. **Nonce + validity** — replaying a captured response fails; responses expire with the query.
3. **Blind hub** — the hub's own log shown on screen: metering records only, no numbers, no predicates, no answers.
4. **Monotone floor** — RP tightens `tenure` floor live; looser queries are rejected, never silently widened.

Playground admin backstory flips ("swapped yesterday" ↔ "swapped 120d ago") flip the boolean live. Stated caveat: the operator shim simulates operator-side predicate computation and signing; consent/legal-basis legs are out of scope. Mode B (holder presentment) is a later PoC. Second sources for a "multi-operator" slide: Telefónica Open Gateway sandbox, Vonage.

## 9. Risks / open questions

1. **"SD-JWT is enough, why ZK?"** — expected WG pushback. Answer: selective disclosure hides *fields*; it does not give unlinkability across presentments or predicate proofs over values ("age > 90d" without the date). Keep v1 SD-JWT for adoption, keep the proof layer pluggable — this is the compromise built into §3.2.
2. **Holder availability** — attestation needs a device-side holder; OS wallets (EUDI) are arriving on the right timeline, but v1 may need a reference holder app/SDK.
3. **Issuance authentication** — how the operator knows it's issuing to the right SIM: network authentication (silent auth on cellular data path) is the natural mechanism and is already how `number-verification` works.
4. **Operator incentive asymmetry** — the query log has value to operators; expect quiet resistance. Counter: regulatory posture + new billable issuance tier + the criticism CAMARA already attracts on surveillance grounds.
5. **Aduna/aggregator capture** — an aggregator could implement presentment proprietarily. Standardizing in CAMARA first is precisely the defense.
6. **Author bandwidth** — solo + staleness rules; mitigate by recruiting a co-owner from a member company early (also strengthens the proposal politically).
7. **Billing** — resolved for Mode A by design: per-query billing and aggregator revenue share continue unchanged (blind metering at the hub). The metered-issuance question applies only to Mode B and is deferred with it.
8. **MNP vs tenure** — number porting resets the operator relationship, so `tenure ≥ 2y` punishes honest porters, not farms. Options: porting-aware continuity attestation (old operator attests tenure at port time), or "combined tenure across ports". Open design question — and a domain detail most proposers would miss.
9. **Trust directory** — verifiers need operator public keys per PLMN: a PKD-analog. GSMA RAEX/IR.21-style distribution is the natural rail; who governs it is the proposal's one unavoidable centralization point.
10. **Cloud agents cannot silent-auth** — the SIM is in the human's pocket; agents run in datacenters. Issuance lands on the holder's phone; agents carry scoped, expiring, monotonically-tightened delegations from it (the zkagent delegation model). Architectural requirement, not an option.
11. **Residual issuance metadata** — the operator inevitably knows it issued attestation type T to subscriber S at time t (never to whom it was presented). State this honestly; batched/scheduled issuance blurs timing correlation with RP-side events.

## 10. References

- CAMARA API Backlog process & template: https://github.com/camaraproject/APIBacklog (documentation/APIbacklog.md; template + filled examples under documentation/SupportingDocuments/)
- CAMARA governance/structure: https://camaraproject.org/structure/ · https://github.com/camaraproject/Governance/blob/main/ProjectStructureAndRoles.md
- Device Roaming Status API: https://camaraproject.org/device-roaming-status/ · Orange sandbox: https://developer.orange.com/apis/camara-device-roaming-status
- GSMA Open Gateway status (MWC 2026: 86 groups / 300+ networks / 80% of connections / 300+ launches / 65 markets): https://www.gsma.com/newsroom/article/from-ambition-to-execution-how-open-gateway-is-scaling-the-global-api-economy/
- Open Gateway 1Q26 update: https://camaraproject.org/wp-content/uploads/sites/12/2026/02/Open-Gateway-1Q26-Update.pdf
- Spec verification (2026-08-14): SimSwap v2.1.0 (`/check`, `/retrieve-date`, `/retrieve-age-band`): https://github.com/camaraproject/SimSwap · NumberVerification v2.1.0 (`/verify`, `/device-phone-number`; TS.43 or OIDC `prompt=none`, 3-legged, AMR-validated): https://github.com/camaraproject/NumberVerification · KnowYourCustomer r2.2 (`kyc-match`, `kyc-fill-in`, `kyc-age-verification`): https://github.com/camaraproject/KnowYourCustomer
- SD-JWT VC (IETF OAuth WG), OpenID4VCI / OpenID4VP, W3C Verifiable Credentials 2.0, BBS+ (W3C/DIF) — format layer candidates
- eIDAS 2.0 / EUDI Wallet ARF — holder-wallet convergence timeline
- 8een Agent Auth PRD (proof architecture, scope binding §3.7, metadata uniformity risk #10, optical presentment §13): `~/my_plans/8een-agent-auth-PRD.md`

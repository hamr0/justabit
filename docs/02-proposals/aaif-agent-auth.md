# SIM-Anchored Agent Identity with Floor-Gated Attestations

### Project proposal draft for the AAIF Identity & Trust Working Group — the agent/delegation side of attested windowed disclosure

**Author:** Amr Hassan, independent telecom consultant (10 yrs wholesale roaming / signaling / SoR)
**Status:** Draft v0.2 — pending AAIF process grounding (their submission
process is not yet published on aaif.io; this draft is kept modular so it can
be reshaped to whatever template the process requires)
**Date:** 2026-08-14
**Companion:** the operator/attestation side is proposed separately to CAMARA
(`camara-attested-windowed-disclosure.md`). The two tracks meet at the
RFC 9421 HTTP Message Signatures header; **neither depends on the other's
approval.**

---

## 1. Summary

Autonomous agents increasingly act as network principals — MWC26 demonstrated
agents invoking network APIs directly (QoD on Orange via Open Gateway, Mplify
LSO on Colt, Number Verification via Google Firebase). Two problems follow:

1. **Agent identity is farmable.** Anything rooted in a bare identifier
   (API key, phone number, prepaid SIM at ~$1) is bannable-in-name-only:
   reset cost is near zero.
2. **Agent authorization doesn't flow.** Permissions delegated to an agent —
   and re-delegated agent-to-agent — need a wire format where scope can only
   shrink, never grow, and where the delegation chain is verifiable offline.

This proposal contributes a deployable-today trust tier to the Identity &
Trust WG's mandate (portable identity, delegation protocols, cross-domain
permission flow):

- **Agent identifier** = a per-service tag derived from the SIM credential —
  never IMSI/MSISDN; nothing linkable across services.
- **Floor-gated carrier attestations**: the agent's line must satisfy a
  monotone floor of operator-attested predicates; reference consumer floor:
  `simType = voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d (∧ postpaid optional)`.
  Floors may be tightened by any party downstream — the relying service, or
  each hop of a delegation chain — never loosened.
- **Scoped, expiring delegations** from the holder's phone to cloud agents.
  This is an architectural requirement, not a preference: **cloud agents
  cannot silent-auth — the SIM is in the human's pocket; agents run in
  datacenters.** The SIM-holding device is the delegation root.
- **Presentment via RFC 9421** HTTP Message Signatures: the agent signs its
  requests with the delegated key; the credential chain (carrier attestation
  → holder → agent, floors intact) travels as a header the relying service
  verifies offline.

## 2. Why a SIM tier at all (and its honest limits)

**The economics.** Subscription-quality predicates are near-free for real
subscribers and expensive at farm scale. A consumer voice+data SIM is KYC'd
in most markets; two years of tenure cannot be mass-produced quickly; a
90-day swap-age floor kills swap-and-reset. Failing the floor after a ban
means starting over with a SIM that fails `tenure` on day one — **identity
reset becomes expensive**. This is *economic scarcity* (cost-bounded).

**The limits, stated plainly:**

- Floors price identity resets; they **do not create uniqueness**. One
  subscription can back many agents — rate limits and reputation key to the
  per-service tag, and "one accountable human" requires a document-rooted
  principal layer *above* this tier (cryptographic, k-bounded scarcity —
  a different and complementary lever; one existing implementation is the
  authors' prior work, but this proposal is standards-neutral and does not
  depend on it).
- A SIM is **not** a principal root. This tier prices out farms; it never
  claims to identify the human.
- Number portability breaks naive tenure (an honest porter resets to zero);
  porting-aware continuity attestation is an open design question tracked on
  the CAMARA side.

**Machine agents are a separate profile.** Fleets and vehicles have no human
to document; their profile deliberately *embraces* M2M SIMs (fleet contract
tenure, account standing, mobility-pattern organicity). The consumer-agent
floor's `voice+data` exclusion filters farms; it is not a statement that M2M
SIMs are illegitimate. The two profiles must not be conflated.

## 3. The layering model

```
┌─────────────────────────────────────────────────────────────┐
│ Principal layer (out of scope here): document-rooted human   │
│ scarcity — "one accountable human", k-bounded                │
├─────────────────────────────────────────────────────────────┤
│ THIS PROPOSAL: carrier tier — floor-gated SIM attestations   │
│ (economic scarcity) + scoped monotone delegations to agents  │
├─────────────────────────────────────────────────────────────┤
│ Operator/attestation side (CAMARA track): what the operator  │
│ attests and how it travels — attested windowed disclosure    │
└─────────────────────────────────────────────────────────────┘
        one wire format: W3C VC + RFC 9421 HTTP Message Signatures
```

Each layer is independently adoptable; a relying service chooses which floors
it demands. Complementary trust roots, one presentment header.

## 4. Delegation semantics

- **Root:** the SIM-holding device (holder). Issuance of the carrier
  attestation to the holder uses network authentication on the live cellular
  session (the operator-side mechanism; CAMARA track).
- **Delegation credential:** names the agent key, carries the inherited floor
  (possibly tightened), a scope (what the agent may do), and an expiry.
  Re-delegation repeats the pattern; every hop may tighten floor and scope,
  no hop may widen either. A verifier checks the whole chain offline.
- **Revocation = expiry.** Delegations are short-lived by default;
  re-issuance is cheap (the holder's device is online); no revocation
  infrastructure to stand up in v1.
- **Per-service tags:** the agent presents a different derived tag to each
  relying service; a ban sticks per service (tag-keyed reputation), while
  cross-service correlation stays impossible.

## 5. The seam with CAMARA (scope discipline)

CAMARA standardizes what the operator attests and how it travels — the
attested-windowed-disclosure profile, the blind-hub rail, the attestation
formats. **This proposal deliberately does not touch any of that.** AAIF
standardizes what the agent carries and how permissions flow: delegation
protocol, floor semantics down a chain, agent-to-agent permission flow, the
RFC 9421 presentment profile.

Each proposal cites the other as its counterpart; either stands alone (a
relying service can verify floor-gated delegations against any attestation
issuer; an operator can issue windowed attestations no agent ever carries).

## 6. Proof of concept

The companion repo ships a Mode A demo (`poc/` — Node, zero dependencies, one
command, runnable without credentials against a mock operator; swappable to
the Orange Network APIs Playground). The AAIF-side extension adds: an agent
presenting a floor-gated credential chain over RFC 9421 to a demo relying
service, with a live demonstration that a downstream delegation attempting to
*loosen* the floor is rejected.

## 7. Open items

- [ ] Ground AAIF's actual project-submission process (homepage doesn't
      expose it; check /about, WG pages, GitHub org) — gates everything else.
- [ ] Identify whether the Identity & Trust WG has existing delegation drafts
      to align with — attach the SIM-anchor tier to incumbent drafts rather
      than competing with them.
- [ ] Reshape this draft to the WG's template once known; content is modular
      (§1 summary / §2–4 substance / §5 seam / §6 PoC survive any format).

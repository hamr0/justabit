# AAIF track — deliverables & scope

**Body:** [AAIF](https://aaif.io/) — "operationalizing agentic AI for
enterprise scale"; hosts community projects; runs an **Identity & Trust WG**
("portable identity and dynamic trust for autonomous agents — delegation
protocols, cross-domain identity, how permissions flow across agent-to-agent
interactions").

## What we deliver to AAIF (and only this)

**The agent/delegation side** — not the operator/attestation side (that is
CAMARA's):

1. **Agent-auth project proposal**: SIM-anchored agent identity with
   floor-gated attestations —
   - agent identifier = per-service tag derived from the SIM credential
     (never IMSI/MSISDN);
   - floors (`voice+data ∧ tenure ≥ 2y ∧ swapAge ≥ 90d`), monotone tightening
     down delegation chains;
   - scoped, expiring delegations from the holder's phone to cloud agents
     (agents cannot silent-auth; the SIM is in the human's pocket);
   - presentment via RFC 9421 HTTP Message Signatures.
2. **The layering statement**: economic scarcity (SIM floors, this work) vs
   cryptographic scarcity (document-rooted principal, zkagent's lane) —
   complementary tiers, one wire format (W3C VC + RFC 9421).
3. **PoC extension**: the Mode A demo plus an agent presenting a floor-gated
   credential to an RP.

## The seam between the two tracks

CAMARA standardizes what the operator attests and how it travels
(attested windowed disclosure). AAIF standardizes what the agent carries and
how permissions flow (delegation, floors, A2A). **They meet at the RFC 9421
header.** Each proposal cites the other as its counterpart, neither depends on
the other's approval.

## Open items

- [ ] Ground AAIF's actual project-submission process (homepage doesn't expose
      it; check /about, working-group pages, GitHub org).
- [ ] Identify whether Identity & Trust WG has existing delegation drafts to
      align with (don't fight incumbent drafts — attach the SIM-anchor tier
      to them).
- [ ] Draft the proposal document once process is grounded.

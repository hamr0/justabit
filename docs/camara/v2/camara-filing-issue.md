> **v2 WORKING COPY** — copied unchanged from v1 on 2026-08-31 to be
> reshaped per the 2026-08-31 APIBacklog feedback
> (`../v1/feedback-2026-08-31.md`). NOT filed. Until the rescoping
> decisions recorded in `docs/logs/findings.md` (2026-08-31) land, the
> text below is still the v1 text.

> **This is the text to paste into a new GitHub issue** at
> `camaraproject/APIBacklog`, using that repo's own `💡 API Proposal`
> issue template (four fields: Description, Use cases, Related to,
> Supporting material). Exact title to use:
> `[API Proposal] CarrierAttestation`. Label: `API Proposal`.
>
> This is step 1 of a two-step CAMARA intake. Step 2 is a follow-up pull
> request adding the long template as
> `documentation/API proposals/APIProposal_CarrierAttestation.md` — that
> file is `docs/camara/v1/camara-filing-template.md` in this repo, already
> prepared. Do not paste that long file into the issue; the issue is this
> short body only.
>
> **Filed:** Filed as issue #330 on 2026-08-28 —
> https://github.com/camaraproject/APIBacklog/issues/330. Open, awaiting
> Working Group evaluation; nothing has been approved. Follow-up PR #331
> (adding the filled template) is `docs/camara/v1/camara-filing-template.md`
> in this repo — see that file for its own filed record.
>
> **This file is now a FROZEN record of what was filed.** The text below
> the paste marker must not change — amend
> `camara-attested-windowed-disclosure.md` instead and, if the issue itself
> needs a correction, file it as a follow-up comment/PR against CAMARA, not
> as an edit here.
>
> Everything above this line (through the marker below) is repo bookkeeping
> for whoever is filing this — it must NOT be pasted into the GitHub issue.
>
> Feedback received 2026-08-31 — see `feedback-2026-08-31.md`; v2 in `../v2/`.

<!-- ==== EVERYTHING BELOW THIS LINE IS THE ISSUE BODY — PASTE FROM HERE ==== -->

**Description**

Identity data should not become a tradeable asset — that is this proposal's
stance. The operator answers a boolean and keeps custody of the underlying
fact; an aggregator carrying the query meters and bills but never reads
identifiers, predicates, or answers. Concretely: CarrierAttestation proposes
a horizontal profile — "attested windowed disclosure" — not a new
free-standing API. A predicate answer becomes a signed, nonce-bound, expiring
boolean, never the raw value. CAMARA already has the precedent: `POST
/retrieve-age-band` (SimSwap v2.1.0) coarsens a timestamp; `GET
/device-phone-number` (NumberVerification v2.1.0) takes no request body,
deriving the line from the token; `kyc-age-verification` ships a boolean age
predicate. The ask is to finish what those three started, catalog-wide.
`CarrierAttestation` is filed only for the residual no existing API covers:
agent-grade floor bundles and holder presentment.

**Use cases**

1. A bank authorizes a transfer on "unswapped ≥ 90d" without a timestamp.
2. An AI agent presents a floor-gated credential ("voice+data ∧ tenure ≥
   2y ∧ swapAge ≥ 90d") without the verifier learning the MSISDN.

**Related to**

None yet. Pull request to follow, adding the filled long template.

**Supporting material**

Author's own Apache 2.0 staging ground, not a CAMARA deliverable.
Repo: https://github.com/hamr0/justabit — proposal doc:
https://github.com/hamr0/justabit/blob/main/docs/product/camara-attested-windowed-disclosure.md
— PoC: https://github.com/hamr0/justabit/tree/main/poc — OpenAPI sketch:
https://github.com/hamr0/justabit/blob/main/spec/carrier-attestation.yaml

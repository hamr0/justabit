> POSTED 2026-11-26T08:11:48Z.
> URL: https://github.com/camaraproject/Governance/issues/220
> Title: Signed answers for CAMARA yes/no APIs — a first case on Tenure and SimSwap /check
> Posted by the main session with `gh issue create`, on the user's instruction ("go for next steps", 2026-11-26, after "post3 all good, do all"), from the user's GitHub account, after PR #43 was merged (`7017604`) and both linked files returned HTTP 200 on `main`.
> Filed as the Governance route that rartych set out on Commonalities#705 (response signing is a Governance/TSC decision). Template: issue_enhancement_template.md (four headings, unchanged). No `enhancement` label: an outside author cannot set labels.
> Read-back verification: the body was fetched back with `gh api repos/camaraproject/Governance/issues/220 --jq .body` and compared with the sent file by `cmp` (trailing newlines ignored): exit 0, identical. Wrapped draft lines were joined into paragraphs before posting; a word-by-word check against the draft was True.
> Verbatim record — do not edit.

**Problem description**

CAMARA APIs such as Tenure `/check-tenure` and SimSwap `/check` already answer a question with yes or no, without returning the raw data. That answer is protected by TLS only. Only the direct caller can rely on it, and only at the time of the call. A party that did not make the call (a service that deals with an AI agent, or an auditor) cannot check it without calling the operator again.

Contracts already govern how operators and aggregators behave. This does not replace them. It adds something for a party outside those contracts.

The Commonalities codeowner noted on Commonalities#705 that response signing is a Governance/TSC decision. So I bring it here, as a narrow case.

**Possible evolution**

A first case that needs no new API and no change to any answer:

- The request gets one optional field, `nonce`, issued by the party that will rely on the answer.
- The response carries the existing answer plus `attestation`: a JWS (RFC 7515) over the answer, the `nonce`, an expiry, and the question asked (for example "no SIM swap in 90 days"). It never carries the swap date, the subscription date or any other raw value.
- A request without `nonce` gets today's response, unchanged.

It builds on what the Sync26 releases already do: operator limits refused with `400 OUT_OF_RANGE`, yes/no answers, and single-use tokens.

A working proof of concept and an illustrative OpenAPI sketch are here:
- Readout: https://github.com/hamr0/justabit/blob/main/camara/v3/README.md
- Spec: https://github.com/hamr0/justabit/blob/main/docs/product/camara-v3-spec.md

What I ask the TSC:
1. Is signing yes/no answers a direction CAMARA wants to explore?
2. If yes, where should it live: a Commonalities guideline, or the Security and Interoperability Profile?
3. Is Tenure plus SimSwap `/check` a good first case?

**Alternative solution**

Keep today's model: the direct caller relies on TLS, and other parties rely on contracts. This works between contract parties, but not for a party outside them.

**Additional context**

- Earlier discussion: camaraproject/Commonalities#705 and camaraproject/APIBacklog#331.
- What it does not claim: it is not zero-knowledge; an aggregator in the path can still read the identifier and the answer; the operator keeps its own query log; a SIM is not a person.
- No aggregator has reviewed the design yet.
- I am happy to present it at a TSC meeting.


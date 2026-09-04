> RECEIVED 2026-09-03, direct email. No exact timestamp was captured.
> From: Iman Schrock, EMILIA Protocol, Inc. — author of both
> `draft-schrock-ep-authorization-receipts` and
> `draft-schrock-action-evidence-boundary` (AEB).
> Subject: correction to HAMR -01 §4's description of EP Authorization
> Receipts, plus a request to add an informative AEB reference.
> The user's reply is `emilia-layering-reply-sent-2026-09-04.md` (this
> same directory).
> Verbatim record — do not edit.

Amr,

Your discussion with Jijie and Sangam makes the placement test
clearer, especially the two-path case. Could we make one correction to
§4 of HAMR -01 so readers do not place all EMILIA work after
execution?

The cited authorization-receipts draft does not establish that an
action occurred. It includes pre-execution approval evidence and
terminal consumption evidence, and explicitly disclaims proof of
execution. AEB is the separate executor-side processing model.

Suggested wording:

"EP Authorization Receipts provide exact-action approval evidence,
including a pre-execution bundle and terminal consumption evidence;
they do not by themselves prove execution. AEB specifies native
verification, exact-action matching, local authorization, atomic
consumption or reservation before invocation, and outcome
reconciliation. These complement this document's attenuated chain and
floors without changing its scope."

Could you add an informative AEB reference alongside the receipt
citation? AEB -05 §§5.7–5.11 cover that lifecycle; §8.6 and §9 address
the mediated and bypass paths. This would preserve the credit for your
current placement discussion while making the relationship to the
existing work explicit, not making AEB a HAMR dependency.

Receipts -12:
https://www.ietf.org/archive/id/draft-schrock-ep-authorization-receipts-12.txt

AEB -05:
https://www.ietf.org/archive/id/draft-schrock-action-evidence-boundary-05.txt

Best,
Iman

---

**Response recorded here for the file record; the correction was already
acted on in commits predating this file.**

- `1e40e9a` corrected the receipts description at four sites and added
  the AEB reference, fetched from `bib.ietf.org`, placed in the
  informative references at `-05`.
- `68163d0` corrected two further defects the note exposed but did not
  raise: layer (c) was relabelled from "What happened, once" to "What
  was approved and consumed, once", and Appendix A's mapping of a
  post-result detector onto layer (c) was removed.
- The substance of the suggested wording was adopted; the paragraph was
  not pasted verbatim, and two clauses of it ("native verification",
  "exact-action matching") were not carried, because the AEB sentence
  was cut to the length its neighbours get.

> SENT 2026-09-04, direct email, confirmed sent by the user.
> To: Iman Schrock, EMILIA Protocol, Inc.
> Subject: reply to the layering correction on HAMR -01 §4 — see
> `emilia-layering-correction-received-2026-09-03.md` (this same
> directory) for the inbound message this one answers.
> Verbatim record of the user's own text — do not edit.

Iman,

Both points were right, and both are in. Thank you for the precision.

The correction goes into -02, not -01. -01 is posted and cannot be edited; -02 is drafted now and I am targeting the week of 8 September.

The layering paragraph now reads:

"[receipts] addresses layer (c) with a pre-execution approval bundle and terminal consumption evidence, without itself establishing that the action occurred. [AEB] complements it with an executor-side model for local authorization, atomic consumption, and outcome reconciliation at invocation, including a requirement to enumerate every path that bypasses it."

I took your substance rather than your paragraph, to keep the sentence the same length its neighbours get. Two clauses of your wording did not survive that cut: "native verification" and "exact-action matching". If either is load-bearing for how AEB should be described, say so and I will make room.

The AEB reference is added as informative, pulled from bib.ietf.org rather than hand-built, cited at -05. It is a neighbour, not a dependency — the draft says so, and nothing in HAMR requires it.

Your note also caught two errors you did not raise. The layer itself was still labelled "What happened, once", which contradicted the corrected sentence; it now reads "What was approved and consumed, once". And Appendix A mapped a post-result detector onto that layer; -02 now states plainly that the detector fits none of the three layers.

One convergence worth naming. AEB §8.6 requires a deployment to enumerate every path that bypasses it. Independently, and out of the thread with Jijie and Sangam, -02's Verifier Placement now carries a system-wide closure invariant checked by a bypass test. -02 states the relationship explicitly: AEB's asks one executor to enumerate what bypasses its own local enforcement; this document's governs the complete set of admission paths to a protected effect. No equivalence claimed, and no priority.

Would you like the correction acknowledged by name in -02? I am glad to, and equally glad not to.

I will send you the final layering text before I post, so you can object while it is still changeable.

Amr

---

**Open items left by this reply:**

1. Whether Iman wants the correction acknowledged by name in `-02`. Asked,
   unanswered.
2. A commitment made: the final layering text is to be sent to him before
   `-02` is posted.

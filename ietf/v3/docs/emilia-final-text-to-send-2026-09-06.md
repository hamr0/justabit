> DRAFT — NOT SENT. Written 2026-09-06 for the user to review and send.
> To: Iman Schrock, EMILIA Protocol, Inc.
> Subject: final layering text for -02, as promised — see
> `emilia-layering-reply-received-2026-09-05.md` (this same directory)
> for the message this one answers.
> This is a draft. No message has gone out yet. Do not treat this file
> as a record of something sent.

Iman,

As promised, here is the final layering text before -02 goes out.

Exact-action matching is in. The AEB sentence in §4 now reads:

"[AEB] complements it with an executor-side model for exact-action
matching, local authorization, atomic consumption, and outcome
reconciliation at invocation, including a requirement to enumerate
every path that bypasses it."

That is your load-bearing clause, restored to the sentence, not just
the reference.

The "Changes since -01" appendix description was updated to match, so
the document does not state the clause two ways. It now reads:

"Added an informative reference to [AEB], which complements the
receipts draft with an executor-side model for exact-action matching,
local authorization, atomic consumption, and outcome reconciliation at
invocation, and placed it in the layering alongside [RFC9396], [Das
agentic tool binding], and [receipts]."

The acknowledgment is in, in the narrow form you asked for. There is a
new Acknowledgments section, and it holds exactly one entry: "Iman
Schrock for clarifying the receipts/AEB execution boundary and bypass
relationship." Nothing broader.

The local-versus-system-wide bypass posture you confirmed in your
reply is what the draft carries: no equivalence between AEB's
single-executor bypass enumeration and this document's system-wide
closure invariant, and no priority between the two.

-02 has not been posted yet. You are seeing this before submission, as
promised.

Amr

---

**Notes for the user, not part of the message:**

- This draft is unstaged and untouched otherwise; nothing has been
  committed or sent.
- No posting date is promised in the draft text, since none is set.

> RECEIVED on or before 2026-10-25 (date the user pasted it into the session; exact receipt time not given), direct email.
> From: Tania, Alygn (taniaalygn@gmail.com), ops and outreach for EAGF.
> Subject: reply to `eagf-outreach-reply-sent-2026-10-25.md` (this same directory): the mapping of -03 layers (a) and (c) to draft-luna-eagf-agent-delegation-semantics-00 requirements.
> Verbatim record — do not edit.

Hi Amr,

Thank you, that is a clear answer. Here is the short mapping, read against -03 and draft-luna-eagf-agent-delegation-semantics-00. It is input only and commits neither draft.

Layer (a), who may act on whose behalf:
- The scope carried by each link corresponds to EAGF REQ-1 (Bounded Authority Scope). Your narrowing-only rule fits it directly.
- The accountable person behind L(0) corresponds to REQ-6 (Accountable Owner). EAGF asks that this owner be identifiable for the organization and not inferred only from the credential.
- Why the principal granted L(0) is the gap you describe. In EAGF that is the Decision that REQ-2 (Decision Reference) points to. Nothing has to be added to the chain for this: the Decision record can point to the root link, so an auditor can go from the decision to the chain without changing your format.
- Your point that a verifier does not inherit trust from upstream matches REQ-7 (No Automatic Trust or Confidence Transfer).

Layer (c), what was approved and consumed, once:
- Each consumed action corresponds to an EAGF Action record carrying a Decision reference (REQ-2).
- The receipt or evidence for it corresponds to REQ-5 (Evidence Kind), which separates agent self-report, platform/runtime records and externally verifiable evidence.
- Later linkage to what actually happened is REQ-4 (Outcome Reference), kept separate from the Action itself.
- Keeping those records unaltered over time is REQ-8 (Historical Integrity).

So the two drafts seem to meet at the root link and at the receipt: your chain says the authority was valid, and the EAGF records say which decision granted it, who answers for it, and what evidence shows it was used. If you see a mismatch in any of these, I would like to know.

Disclosure as before: I work at Alygn; David Luna is the EAGF author. EAGF is an open candidate specification under public review, not a standard and not endorsed by the IETF.

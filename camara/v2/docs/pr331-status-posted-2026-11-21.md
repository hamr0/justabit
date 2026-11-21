> POSTED 2026-11-21T16:30:35Z.
> URL: https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-7065699165
> Comment id: 7065699165.
> Posted by the main session with `gh pr comment`, on the user's instruction ("post both", 2026-11-21), from the user's GitHub account.
> Follows up the TSC relay in `camara/v2/docs/pr331-tsc-comment-received-2026-09-03.md` and the reply in `camara/v2/docs/pr331-tsc-reply-posted-2026-09-03.md`; points to `camara/v2/docs/commonalities-705-status-posted-2026-11-21.md`.
> Read-back verification: the posted body was fetched back with `gh pr view --json comments` and diffed against the local draft. Result: content IDENTICAL; the only difference is one trailing newline added by the read-back. Local draft 651 bytes; posted body via the API 652 bytes (`jq` output, one trailing newline).
> Verbatim record — do not edit.

Status note: as agreed on 2026-09-01, the active step is the Scope Enhancement in camaraproject/Commonalities#705. I have posted the supporting materials (proposal v2, OpenAPI sketch, proof of concept) there today and asked for a Commonalities Working Group agenda slot.

@albertoramosmonagas, could you confirm whether the replies above of 2026-09-03 answer the TSC's three points, or whether the TSC wants more on any of them? Point 2 has one open gap: no aggregator operator has reviewed the design yet. Input from any aggregator would be welcome.

I would like to keep this PR open until #705 has an outcome, and then update or close it to match.

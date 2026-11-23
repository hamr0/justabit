> RECEIVED 2026-11-23T11:51:29Z, from `rartych` (Commonalities codeowner).
> URL: https://github.com/camaraproject/Commonalities/issues/705#issuecomment-7100177380
> Comment id: 7100177380.
> Replies to `camara/v2/docs/commonalities-705-status-posted-2026-11-21.md`.
> Body fetched 2026-11-23 with `gh api repos/camaraproject/Commonalities/issues/comments/7100177380 --jq .body` and copied unchanged below.
> Verbatim record — do not edit.

Thank you for the detailed proposal and the additional material. We can shortly discuss  it during the Commonalities upcoming meeting.

A few points that are important to clarify:

- **Response signing:** The approach for response signing in CAMARA APIs has not been decided yet. This is a broader governance question, and the final direction will need to be agreed by [Governance](https://github.com/camaraproject/Governance) and the TSC rather than being established through this individual Commonalities issue. I assume that now, potential misbehavior by aggregators is addressed through contractual obligations and restrictions rather than technical mechanisms such as response signing.

- **Alignment with Sync26:** There have been changes in the latest Sync26 API releases compared with the versions referenced in the proposal. For example, the age-band functionality has been moved to a separate API Sandbox: [SimSwapTimeFrame](https://github.com/camaraproject/SimSwapTimeFrame) - feel free to contribute to it. The latest API definitions should therefore be used as the basis for any further discussion.

- **AI-generated contributions:**  Fully AI-generated contributions can require significant additional effort from maintainers and Working Group members to verify technical accuracy, consistency with existing specifications, and alignment with CAMARA processes. We therefore appreciate contributions that demonstrate clear human involvement, technical understanding, and ownership of the proposed changes.

- The topic of **windowed disclosure** is also worth discussing (the experience from SimSwapTimeFrame API can be a good starting point) , but it would be better to first align on the overall direction through the appropriate Governance/TSC process and then assess the concrete Commonalities implications/guidelines.



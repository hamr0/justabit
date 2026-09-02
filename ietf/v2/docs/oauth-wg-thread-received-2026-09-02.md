> RECEIVED 2026-09-02, public thread. Cross-posted to wimse@ietf.org and
> oauth@ietf.org.
> Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls to specific
> tool-call arguments in agentic/MCP flows.
> Four messages, in the order the user pasted them: Jijie Wei's opening
> message (AIC — X.509 agent certificates carrying capability
> declarations, enforcement at an AIC-aware gateway, fail-closed;
> running implementation at
> https://github.com/varwof/aic-capability-demo); Sangam Das's first
> reply (Wed 2 Sept 2026 13:33); Jijie Wei's second reply (Wed 2 Sept
> 2026 11:10, containing the std/mcp-v1 test-vector proposal); and
> Sangam Das's most recent reply (mapping the std/mcp-v1 vectors and
> naming two predicates not yet exercised: argument subset within an
> allowlisted tool, and enforcement placement).
> This is a public mailing-list thread, so it is recorded VERBATIM as
> pasted by the user, unlike the private EMILIA pre-flight thread
> elsewhere in this directory, whose convention strips quoted
> third-party email. The user's reply to this thread is
> `oauth-wg-reply-sent-2026-09-02.md` (this same directory).

VERBATIM as pasted by the user, 2026-09-02. Cross-posted to wimse@ietf.org
and oauth@ietf.org. Subject: Re: [WIMSE] Re: Binding OAuth-authorized calls
to specific tool-call arguments in agentic/MCP flows

--- Sangam Das, most recent ---

Hi Jijie,

Thank you. I will treat those payloads as the normative std/mcp-v1 vectors for this thread.

Certificate parameters:

{"tools":["read_file","list_dir"]}

JSON-RPC decision    Result
tools/call read_file    ALLOW (200)
tools/call list_dir    ALLOW (200)
tools/call bash    DENY (403)
tools/call delete_file    DENY (403)
initialize / ping / tools/list    No tools/call decision (200)

This correctly exercises the first predicate: tool identity is bound by the AIC rather than by the model emission itself. bash is therefore not authorized simply because the model emits it; it falls outside the principal-signed allowlist. Fail-closed enforcement at gateway-http is the appropriate sink behaviour whenever the AIC-JWT is presented.

Two additional predicates are not yet exercised by the current matrix and, in my view, should remain explicit.

    Argument subset within an allowlisted tool.
    Under the current std/mcp-v1 vectors, read_file with path=/etc/shadow would still satisfy the tool-name predicate because the certificate constrains the tool name, not its arguments. The wallet and database examples in the same repository already demonstrate field-level restrictions such as recipient, table, and limit. If MCP later binds path prefixes or other argument fields in the same way, the enforcement model remains unchanged; only the set of certificate-bound fields expands. Until then, the tool allowlist is effectively a class grant for the named tool.
    Enforcement placement.
    The same matcher can be applied earlier in the execution path, for example at host invoke(name, args) before dispatch reaches gateway-http. This is not a separate policy model: the certificate, bounds, and comparison semantics remain the same; only the first enforcement point moves earlier.

I have not yet run scenario-demo.py --scenario mcp on this host. I will report only if the observed behaviour diverges from the specified 200/403 matrix.

For the write-up, I suggest keeping the four-row decision table together with these two predicates so that tool-identity denial is not conflated with argument-subset denial.

Best,

Sangam

--- Jijie Wei, Wed 2 Sept 2026 11:10 ---

    Sangam,

    Thank you for the precise read -- and for framing the in-process path as
    a placement question rather than a defect. I agree: gateway-http enforces
    every call that crosses it; a host wrap that invokes the same bound-check
    before dispatch is the natural extension for local function tables, and it
    reuses the same certificate and bounds.

    On the mapping offer -- yes, please. A concrete test vector against
    std/mcp-v1:

    Allowlist (from the AIC certificate parameters):
    {"tools":["read_file","list_dir"]}

    Expected ALLOW:
    {"jsonrpc":"2.0","id":1,"method":"tools/call",
     "params":{"name":"read_file","arguments":{"path":"/tmp/a.txt"}}}

    Expected DENY (fail-closed, tool not allowlisted):
    {"jsonrpc":"2.0","id":2,"method":"tools/call",
     "params":{"name":"bash","arguments":{"cmd":"rm -rf /"}}}

    Protocol methods (initialize/ping/tools/list) pass without a tools/call
    decision. The repo's scenario-demo.py --scenario mcp runs these against
    the live gateway and reports the matrix (read_file 200, bash 403,
    list_dir 200, initialize 200, delete_file 403).

    If you run it and your result differs, that is exactly the kind of
    divergence worth pinning down. Happy to align on whatever format you
    prefer.

    Best,
    Jijie Wei

--- Sangam Das, Wed 2 Sept 2026 13:33 ---

    Dear Jijie,

    Thank you for the pointer to the demo repo, and for stating the boundary so clearly.

    Your three points match what I see in aic-capability-demo:

        Bounds come from the principal (and role intersection at the CA), not from the model's emitted arguments.
        The HTTP/MCP gateway checks the concrete parameters against those bounds per request and fails closed.
        That enforcement is at the gateway / MCP endpoint, not inside the host's first local dispatch.

    That is a real answer for every call that actually crosses gateway-http. The wallet / database / deploy / MCP matrices in the README are the right kind of evidence for this thread.

    I agree AIC composes with RAR and mission-bound authorization rather than replacing them: the certificate is the offline-verifiable assertion; an online decision can still narrow it.

    The remaining case is the one you already named -- the in-process function table (or any other path that never presents the AIC-JWT to the gateway). On that path the host would need to invoke the same bound-check before invoke(), or it is an alternate route around the sink you implemented.

    I do not read that as a defect in AIC. It is a placement question: gateway for networked MCP/HTTP, host wrap for local dispatch.

    I will look through the repo in more detail. Happy to map a single MCP tools/call against your std/mcp-v1 allowlist if that is useful.

    Thanks again,

    Sangam

--- Jijie Wei, opening message ---

        Sangam, you asked whether this gap is already solved somewhere. We have
        implemented an answer in the AIC work and it is running; details and test
        matrices are in the public demo repo below.

        The pattern, in the vocabulary this thread has converged on:

        1. The policy assertion is certificate-bound and independent of the model
           output. A principal signs a DelegationAuthorization carrying capability
           declarations with precise parameters (database: tables, columns,
           row_filter, limit; wallet: assets, per-transaction amount, recipient
           allowlist; MCP: tool allowlist). These are encoded in an X.509 agent
           certificate and its JWT carrier. The authorized bounds come from the
           principal (optionally intersected with the operator role's policy at
           issuance) -- never from the model's emitted arguments.

        2. Enforcement happens at the sink boundary. An AIC-aware gateway verifies
           the presented credential, then checks per request that the concrete
           operation parameters fall within the certificate's declared bounds
           before forwarding. For MCP, a tools/call must reference an allowlisted
           tool; the structured operation (table, amount, recipient, environment,
           tool) is matched against the bound parameters. Unknown or out-of-bounds
           operations are denied (fail-closed).

        3. One boundary I want to state explicitly: this enforces at the network
           gateway / MCP endpoint, not inside the host process's first dispatch
           (the function table). In-process enforcement would require the host to
           invoke the same verifier at that earlier point; that is a different
           layer.

        The credential is transport-identity anchored (X.509 presented over mTLS,
        or a short-lived JWT issued from the same CA). This composes with, rather
        than replaces, RAR / mission-bound dynamic authorization: the certificate
        supplies offline-verifiable bounds, and an online policy decision can
        further narrow them.

        Running implementation (capability schemes, gateway plugins, test
        matrices): https://github.com/varwof/aic-capability-demo

        Happy to map the details if useful.

        Best,
        Jijie Wei
        --
        WIMSE mailing list -- wimse@ietf.org
        To unsubscribe send an email to wimse-leave@ietf.org

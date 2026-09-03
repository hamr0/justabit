> RECEIVED 2026-09-03T13:42:42Z.
> URL: https://github.com/camaraproject/APIBacklog/pull/331#issuecomment-5526707740
> Comment id: 5526707740.
> Posted by @albertoramosmonagas (author_association CONTRIBUTOR).
> Relays three points from the CAMARA Technical Steering Committee (TSC)
> discussion of 2026-09-03, linking the TSC minutes page on the CAMARA
> Atlassian wiki (2026-09-03 TSC Minutes).
> Verbatim record — do not edit.

Hi @hamr0 

Three points from today's Technical Steering Committee TSC [discussion](https://lf-camaraproject.atlassian.net/wiki/spaces/CAM/pages/1087307787/2026-09-03+TSC+Minutes):

1) GSMA OPG e2e encryption context. There is parallel discussion in GSMA OPG on end-to-end encryption of responses. CarrierAttestation addresses signing, not encryption, but the two may need to coexist (e.g., signed, then encrypted through an aggregator). Is there a coordination path with OPG on response-layer mechanisms?
2) Impact on aggregators. The operator-published threshold menu and nonce binding change the aggregator's role — they meter and bill without reading the predicate or answer. Has the design been validated with aggregator operators? Will this require aggregator contract or capability changes?
3) Path to Security profile. This may eventually belong in CAMARA's Security and Interoperability Profile (potentially under ICM scope) rather than remaining a Commonalities pattern. Should the Scope Enhancement anticipate that trajectory, or is Commonalities the terminal home?

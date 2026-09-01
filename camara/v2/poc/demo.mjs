// PoC M6 — the one-command demo. Run: node camara/v2/poc/demo.mjs [--backend mock|orange]
//
// This is the surface a CAMARA/IETF reader sees, so it explains itself as it
// goes. It composes M1 (attestation core), M2 (blind envelope), M3 (floor gate)
// and M4/M5 (facts) into the four assertions of PRD §4.1 — each one followed by
// its NEGATIVE FLIP, because an assertion that cannot fail proves nothing.
//
// Exit 0 = everything held. Exit 1 = something failed. Exit 2 = the chosen
// backend could not run (e.g. `--backend orange` with no credential): a
// prerequisite failure is not a test result, and it is never a silent fallback
// to the mock. Under `--backend mock` there are no prerequisites, so 2 is
// reachable only from a bad argument — a mid-run throw there is a code
// regression and exits 1, never 2. A gate that skips on 2 must not be able to
// swallow a regression.
//
// M6 owns five things no module owns, and each one is load-bearing:
//   1. the transport frame `{iss, payload, sig}` (M1 emits Buffers, M2 carries
//      one Buffer, nothing in between named the encoding);
//   2. the CANONICAL PREDICATE STRING both sides must derive byte-identically
//      (M1 signs a string id, M4 evaluates an object — a lossy mapping here
//      silently re-opens "an answer can never answer a different question");
//   3. the single-use NONCE STORE (M1's nonce check is stateless BINDING; replay
//      rejection is the requester's job, by M1's own documented limit);
//   4. THE REFUSAL BUDGET (M3 builds rejection reasons from wire input and does
//      not bound them; M2's seal() THROWS above the envelope capacity — so an
//      unbounded refusal crashes the operator instead of refusing). The
//      2026-08-17 adversarial review found this owned in name only: the clamp
//      counted UTF-16 code units where seal counts BYTES, and the echoed NONCE
//      was never bounded at all. Both are now computed from one stated
//      arithmetic, and the answer frame is measured before it is sealed too;
//   5. the CLOSED TOP-LEVEL REQUEST FIELD SET. The fifth was not in the plan —
//      it was found by probing this file after it was written, green and
//      mutation-clean, and it is the most useful thing here: every layer
//      underneath was already a closed set (M1's claims, M3's axes, M4's
//      predicate fields) and the OUTERMOST envelope was not, because no module
//      owns it. A request carrying `floors` — one letter off — had its floor
//      silently dropped and got a SIGNED answer under the operator's own P90D
//      while the requester believed it demanded P365D. A closed-set discipline
//      is only as good as its outermost layer. See step 7 of the operator.
//
// Claims discipline (repo invariant): Mode A is ATTESTED WINDOWED DISCLOSURE.
// Nothing here is zero-knowledge and nothing here says it is.
import { randomBytes, generateKeyPairSync, sign as edSign, verify as edVerify } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { attest, verifyAttestation, hasDuplicateTopLevelKey } from './m1-attestation.mjs';
import { generateEnvelopeKeys, seal, open, OAEP_CAPACITY } from './m2-envelope.mjs';
import { checkFloor } from './m3-floor.mjs';
import { createMockFacts, evaluatePredicate, factQuery } from './m4-facts-mock.mjs';
import { createOrangeFacts } from './m5-facts-orange.mjs';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const DAY_MS = 86400000;

// ─────────────────────────────── the one clock ───────────────────────────────
// ONE injected instant for the whole run: the operator's facts, the answer's
// expiry, and every requester-side check read this same value. Two clocks would
// make the expiry assertion a race, and a wall clock would make the printed
// evidence unreproducible — the same reason M4 stores backstories as "N days
// ago" and M5 differences Orange's absolute date back against an injected now.
export const NOW = Date.UTC(2026, 7, 17);
export const VALIDITY_MS = 60_000;

// The Orange Playground CUSTOM slot (built-ins silently shadow writes — M5's
// measured trap). Same number either backend, so the backend really is the only
// thing that differs.
export const DEMO_NUMBER = '+990100000099';
const SWAPPED_DAYS_AGO = 137;   // deliberately not a round number
const FLIPPED_DAYS_AGO = 3;
// The DEVICE swap is a DIFFERENT instant from the SIM swap, and deliberately so:
// one story where both axes shared a day count would let a mapping that reads the
// wrong axis pass every assertion. Three digits, so it is a needle that can be
// scanned against plaintext without landing by chance.
const DEVICE_SWAPPED_DAYS_AGO = 211;
const DEVICE_FLIPPED_DAYS_AGO = 4;
// One backstory, built in one place: six fields, all required, no defaults (M4's
// rule — a typo must be both an unknown field and a missing one).
// Where the subscriber actually is, and — deliberately DIFFERENT — where the
// requester asks about. Same city, different coordinates, so no assertion can
// pass by the two rendering as the same string, and the subscriber's own position
// stays a scannable needle even while the requester's area rides in the claims.
export const SUBSCRIBER_AT = Object.freeze({ lat: 48.8566, long: 2.3522 });
const ASK_AREA = Object.freeze({ lat: 48.86, long: 2.35, radiusM: 10000 });
// Finer than the demo operator's published 2000 m resolution: the question it
// cannot answer honestly, which is the whole point of the third state.
const TOO_FINE_AREA = Object.freeze({ lat: 48.86, long: 2.35, radiusM: 100 });
// The operator's own record, and the requester's CLAIM about it — one letter
// apart, which is the measured near-miss that scores 97. The registered name is a
// scannable needle; the claimed one rides in the signed claims legitimately,
// because it is the question.
export const REGISTERED_NAME = 'Alice Arnaud';
const CLAIMED_NAME = 'Alice Arnaut';
const WRONG_NAME = 'Bob Wrong';
const story = (over = {}) => ({
  swappedDaysAgo: SWAPPED_DAYS_AGO,
  deviceSwappedDaysAgo: DEVICE_SWAPPED_DAYS_AGO,
  roamingCountry: 'FR',
  reachable: true,
  location: SUBSCRIBER_AT,
  registeredName: REGISTERED_NAME,
  ...over,
});

// ─────────────────── what the operator publishes, in one place ───────────────
// The consumer-agent reference floor (proposal §3.4). A request may TIGHTEN
// every axis and may never loosen one (profile rule 5 / FR4).
// `partialPolicy` joined on 2026-08-17 with `presentIn`: `location-verification`
// has a measured THIRD state, and the operator publishes what it does with it.
// `refuse` is the only value M3 admits, so a request asking to have PARTIAL
// rounded for it is a LOOSENING and is rejected by the existing gate — no new
// mechanism, and no parameter anywhere that turns the rounding on.
export const PUBLISHED_FLOOR = Object.freeze({ simType: 'voice+data', tenureMin: 'P2Y', swapAgeMin: 'P90D', partialPolicy: 'refuse' });

// DECISION #1 (2026-08-17, user-signed): PREDICATE THRESHOLDS ARE QUANTISED.
//
// Every individual response in this demo is a windowed bit and leaks nothing.
// The SEQUENCE is a different matter, and the M6 composition spike measured it:
// with a free-choice threshold, 9 perfectly legal, signed, sealed, metered
// queries binary-searched the subscriber's exact swap age (137 days, recovered
// exactly) — the raw value the one invariant exists to protect, reassembled out
// of bits that were each individually clean. No module is wrong: M3 gates
// FLOORS, not predicate thresholds, and profile rule 1 hands the threshold to
// the requester on purpose ("the window is in the QUESTION").
//
// So the window the requester may choose from is PUBLISHED and COARSE. Off-menu
// is refused loudly, never quietly rounded to the nearest bucket — rounding
// would answer a question nobody asked, and silently widen or tighten it.
// Quantisation does not stop the oracle, it CAPS ITS RESOLUTION at the bucket:
// the walk still reveals which of four buckets the subscriber sits in (2 bits),
// and never the day. The residual walk is priced by the other two mitigations —
// see the honest-limit paragraph in the CAMARA proposal §3.5.
//
// Only ordered thresholds get a menu, and the absence of one is a statement,
// not an oversight: `roamingIn` takes a SET, which has no ordering to bisect (an
// exhaustive walk of ~249 countries costs 249 metered queries to learn the one
// country — i.e. the answer itself, which the rate limit and the per-query bill
// are the correct defence against), and `reachable` is already a single bit at
// full resolution, so there is nothing left to quantise.
//
// WIDENED 2026-08-17 with the 3 → 6 predicate round (PRD §9, user-signed):
// `deviceSwapAge` takes the IDENTICAL bucket menu to `simSwapAge`. Not a new
// shape on purpose — two facts answering the same question about different
// hardware must not teach a reader two grammars, and a second shape is a second
// place for the window to widen quietly. `roamingIn` and `reachable` still have
// no menu for the reasons stated above.
export const PUBLISHED_THRESHOLD_MENU = Object.freeze({
  simSwapAge: Object.freeze(['P30D', 'P90D', 'P180D', 'P365D']),
  deviceSwapAge: Object.freeze(['P30D', 'P90D', 'P180D', 'P365D']),
  // The THIRD ordered threshold, and the one with measured urgency. VERIFIED
  // 2026-08-31 against kyc-match's own spec: the PRIMARY response is discrete
  // tri-state indicators (`nameMatch`, `addressMatch`, `idDocumentMatch`, ...),
  // each `'true' | 'false' | 'not_available'` — kyc-match does NOT return a
  // similarity score by default. An OPTIONAL `MatchScoreResult` (0-100,
  // Jaro-Winkler) exists, operator-capability-dependent, and per its spec
  // description is returned ONLY when the corresponding match field is
  // `false`. That conditioning is what makes it hill-climbable, not weaker:
  // the score surfaces exactly when the requester guessed wrong, which is the
  // feedback a hill-climber needs. Measured 2026-08-17 (still valid evidence
  // about the optional score): a wrong name scored 53 and the registered name
  // with ONE letter changed scored 97. A free-choice threshold against that
  // gradient is not merely bisectable — it is a warmer/colder oracle a
  // requester can HILL-CLIMB toward the subscriber's real registered name,
  // which is strictly worse than binary guessing, because binary guessing has
  // no gradient to follow. Four buckets, and the score itself never crosses
  // the wire in any spelling. OPEN ITEM: kyc-match has no request-side
  // threshold field today (unlike simSwapAge/deviceSwapAge's `maxAge`), so a
  // `numberMatch` menu would ADD a field to the request — whether and how to
  // profile kyc-match at all is not resolved; this menu is a design sketch,
  // not a settled shape.
  numberMatch: Object.freeze([60, 70, 80, 90]),
});

// ─────────────────────────── M6-owned: the transport frame ───────────────────
// M1 emits/consumes Buffers; M2 carries exactly one Buffer. Nothing owns the
// {payloadBytes, signature, iss} encoding, so M6 mints one. `iss` rides OUTSIDE
// the signature on purpose: it is a key-resolution HINT (profile rule 3), and
// the response side below never lets it choose a key.
export function packSigned({ payloadBytes, signature }, iss) {
  return Buffer.from(JSON.stringify({
    iss,
    payload: payloadBytes.toString('base64'),
    sig: signature.toString('base64'),
  }), 'utf8');
}

// Untrusted wire input: a verdict (`null`), never a throw.
export function unpackSigned(bytes) {
  let o;
  try { o = JSON.parse(bytes.toString('utf8')); } catch { return null; }
  // `Array.isArray` is DELIBERATELY REDUNDANT and known to be so — the same call
  // and the same finding as M4's `plainSnapshot`. An independent mutation sweep
  // (2026-08-17) deleted it with every suite still green, and rather than write
  // a case that cannot fail, the redundancy was PROVED: only `JSON.parse` output
  // reaches here, a parsed array's own keys are always the numeric indices, so
  // it can never carry own string-valued `iss`/`payload`/`sig` and always dies
  // on the line below. Guarded and unguarded agreed on 9 array shapes.
  //
  // It stays because "a list is not a record" is worth saying out loud at the
  // top, and it is NOT relied upon. Recorded as a deliberately-unpinned
  // defence-in-depth guard rather than counted as a killed mutant — the honest
  // reading of an unkillable mutation is that the guard is redundant, not that
  // the suite is weak.
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
  if (typeof o.iss !== 'string' || typeof o.payload !== 'string' || typeof o.sig !== 'string') return null;
  // Buffer.from(x,'base64') is LENIENT — garbage decodes to garbage and surfaces
  // one step later as 'bad signature'. Honest limit, stated rather than hidden:
  // a transport typo is therefore reported as a forgery, the exact conflation
  // M1's own step 1 avoids for the shape it owns.
  return {
    iss: o.iss,
    signed: { payloadBytes: Buffer.from(o.payload, 'base64'), signature: Buffer.from(o.sig, 'base64') },
  };
}

// ───────────────────── M6-owned: the canonical predicate string ──────────────
// M1 signs a predicate STRING; M4 evaluates a predicate OBJECT. Both sides must
// derive byte-identical strings or a correct answer is rejected as 'predicate
// mismatch' — and, far worse, a LOSSY mapping makes two different questions
// render the same, so an answer to one reads as an answer to the other with a
// valid signature over it. The spike proved both halves: dropping the threshold
// left every test green while the operator answered `gte P1D` to a `gte P90D`
// question, and the obvious `[FR,BE]` spelling collided with the single-element
// set `['FR,BE']`.
//
// So the mapping is INJECTIVE by construction: `JSON.stringify` of the validated
// value distinguishes `["FR","BE"]` from `["FR,BE"]`, and the threshold is
// always part of the string. Called only AFTER `evaluatePredicate` has answered,
// so `type`/`operator` are known literals and `value` is a validated string,
// boolean, or array of two-letter codes — nothing here can run caller code.
//
// EXTENDED 2026-08-17: `presentIn`'s value is an OBJECT (an area), and
// `JSON.stringify` on an object serialises its keys in insertion order — which
// for a parsed request is whatever order the requester typed them in. Two
// requesters asking about the same circle would then derive two different signed
// predicate strings, and one of them would get its own correct answer back as a
// `predicate mismatch`. So an object value is rendered with SORTED keys. It stays
// injective: a string value renders `"…"`, an array `[…]`, an object `{…}`, and
// within the object the key set is fixed by validation, so no two distinct areas
// can render the same. (`areaOf` already rebuilds in a fixed order — this is the
// second bound, on the side that owns the canonical string, because the property
// this string needs is not the property that function exists for.)
export function canonicalPredicate(p) {
  // `claimed` (the attribute value the requester asked to have compared) is part
  // of the QUESTION, so it is part of the signed string. Leaving it out would let
  // an answer about "does 'Bob' match?" verify as an answer about "does 'Alice'
  // match?" — the injectivity failure this function exists to prevent, arriving
  // through the one field that is not the threshold. It is JSON-quoted, so a
  // space or a quote inside a name cannot forge the separator.
  const head = `${p.type} ${p.operator} ${canonValue(p.value)}`;
  return p.claimed === undefined ? head : `${head} ${JSON.stringify(p.claimed)}`;
}

// Called only AFTER `evaluatePredicate` has validated, so the value is a string,
// a boolean, an array of two-letter codes, or a plain object of primitives.
function canonValue(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return JSON.stringify(v);
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(v[k])}`).join(',')}}`;
}

// ────────────────────────── M6-owned: the reason clamp ───────────────────────
// A refusal crosses the wire too. M3 builds its reasons from WIRE input and does
// not bound them (deliberately — the clamp belongs on the side that knows the
// envelope capacity), and M2's seal() THROWS above that capacity. Unclamped, a
// long enough floor value makes the operator CRASH instead of refuse.
//
// The 2026-08-17 ADVERSARIAL REVIEW found BOTH halves of the previous version
// wrong, and the comment that used to sit here ("measured at the spike: the
// worst reason one request envelope can provoke still fits a signed refusal")
// was simply false. Two independent ways to make `handle()` throw:
//   * the clamp counted UTF-16 CODE UNITS while seal() counts BYTES, so a floor
//     value of 40 astral characters produced a "clamped" 121-unit reason that
//     was 363 bytes; and
//   * the echoed NONCE was never bounded at all, so a 200-character nonce on an
//     otherwise minimal request blew the refusal envelope on its own.
// Neither is exotic: both arrive through the ordinary path, on a request that
// fits one envelope, from anyone holding the operator's public envelope key.
//
// So the bound is COMPUTED, in BYTES, and the arithmetic is stated rather than
// asserted (measured 2026-08-17, see docs/logs/findings.md):
//
//   frame    {"iss":"<iss>","payload":"<b64>","sig":"<b64>"}
//            32 fixed + iss 16 + sig 88 (64 raw Ed25519 bytes, base64)  = 136 B
//   so the base64 payload gets OAEP_CAPACITY 446 - 136                  = 310 B
//   base64 runs in multiples of 4 → 308 usable → claims 308 / 4 * 3     = 231 B
//   claims   {"error":<E>,"nonce":<N>,"exp":<13 digits>}
//            39 fixed + E + N, where E and N are the JSON-ENCODED sizes
//   so                                                          E + N  <= 192 B
//
// Split 122 / 70. E = 122 leaves every reason pinned before this round
// BYTE-IDENTICAL (a quote-free ASCII reason encodes to its length + 2, so the
// old 120-character cut point does not move), and N = 70 admits a 68-byte nonce
// against the demo's own 32 hex characters — a nonce longer than that cannot be
// echoed inside one envelope at all, so the operator cannot sign a refusal bound
// to it and says so in the clear instead (step 7 of the operator).
//
// 13 exp digits covers every millisecond timestamp until the year 5138. A longer
// `iss` than the demo's would eat into E — which is why case 29 SEALS the worst
// case rather than trusting this comment.
export const WIRE_REASON_JSON_MAX = 122;
export const NONCE_JSON_MAX = 70;

// The size a string occupies once JSON puts it inside the claims: its own UTF-8
// bytes, plus the two quotes, plus whatever escaping costs. Measuring the
// ENCODED size is the whole point — a raw-byte bound would still be wrong,
// because one control character costs six bytes as \u00XX and one quote costs
// two.
const jsonBytes = (s) => Buffer.byteLength(JSON.stringify(s), 'utf8');

export function clampReason(r) {
  if (typeof r !== 'string') return 'rejected';
  if (jsonBytes(r) <= WIRE_REASON_JSON_MAX) return r;
  // Cut on a CODE POINT boundary. `for...of` yields whole code points, so an
  // astral character is never split into a lone surrogate and a multi-byte UTF-8
  // sequence is never cut mid-way — the two ways a naive byte slice produces
  // bytes that are not valid UTF-8. Budget: 2 bytes of quotes + 3 for the `…`.
  let kept = '';
  let used = 2 + 3;
  for (const ch of r) {
    const w = jsonBytes(ch) - 2;        // this code point's own encoded cost
    if (used + w > WIRE_REASON_JSON_MAX) break;
    used += w;
    kept += ch;
  }
  return `${kept}…`;
}

// ──────────────────────── M6-owned: the closed request set ───────────────────
// The outermost envelope, closed for the reason every layer under it is closed:
// an IGNORED field is a constraint the requester believes is enforced and is
// not. See the long note at step 7 of the operator for the exact widening this
// found.
export const REQUEST_FIELDS = Object.freeze(['number', 'predicate', 'floor', 'nonce']);

// The ONE reason the requester gets when the operator cannot produce facts —
// stable, carrying no operator-internal detail, and deliberately not telling
// "unknown subject" apart from "temporarily unavailable". See decision #3 at
// step 10 of the operator.
export const FACTS_UNAVAILABLE = 'no facts available for this subject';

// A field NAME is requester-chosen text. Rendered verbatim while it is short and
// printable, so the common typo reads exactly as typed — naming the misspelling
// is the actionable half (M4's lesson) — and replaced otherwise, so an embedded
// newline cannot forge a line in whatever log this reason lands in. `clampReason`
// bounds the assembled reason before it is sealed either way.
const fieldName = (k) => (/^[\x20-\x7e]{1,40}$/.test(k) ? k : '(unprintable field name)');

// ══════════════════════════════ the three actors ═════════════════════════════

// ── the blind hub ────────────────────────────────────────────────────────────
// It routes, meters and bills. It holds no key that opens anything it carries.
export function createHub() {
  const log = [];
  let seq = 0;
  return {
    log,
    // `controls.chatty` is the negative control for assertion 3 and nothing else:
    // a hub operator adding a "helpful" debug field. It is the whole point that
    // this is a POLICY choice on their side, and that the same scanner catches it.
    route(from, to, ciphertext, controls = {}) {
      const entry = { seq: ++seq, from, to, bytes: ciphertext.length, bill: 'EUR 0.002' };
      if (controls.chatty) entry.debug = controls.chatty;
      log.push(entry);
      return ciphertext;
    },
  };
}

// ── the operator ─────────────────────────────────────────────────────────────
// The pipeline order is the design. Nothing from the request is trusted, parsed
// or acted on before the signature over the exact bytes holds, and no FACT is
// touched before the floor and the menu have both passed — an answer computed
// and then discarded is still an answer the operator produced.
export function createOperator({ keys, directory, backend, floor = PUBLISHED_FLOOR, menu = PUBLISHED_THRESHOLD_MENU }) {
  // Not sealed: there is no identified requester yet, so there is nobody to seal
  // to and no nonce to bind to. An operator cannot sign a refusal to a party it
  // cannot name — so these come back in the clear, and the requester must treat
  // them as untrusted hearsay (the hub could have made them up).
  const transportReject = (reason) => ({ kind: 'reject', stage: 'transport', reason, sealed: null });

  // Sealed and SIGNED: past this point the requester is authenticated and the
  // nonce is known. Signing refusals matters — otherwise the blind hub could
  // forge a denial-of-service by inventing rejections, and the requester could
  // not tell that from an operator that genuinely refused.
  //
  // `recipientEnc` is the ENVELOPE key of the issuer that step 4 just
  // authenticated, read out of the directory — never a fixed one. Sealing to a
  // hardcoded `keys.rpEnc.publicKey` is byte-identical in a one-requester demo
  // and wrong the moment there are two: the answer to requester B would be
  // encrypted under requester A's key, so A could read a query it never made and
  // B could not read its own. The directory already carried `encPub` for exactly
  // this and nothing read it.
  const signedReject = (reason, nonce, recipientEnc) => {
    const claims = { error: clampReason(reason), nonce, exp: NOW + VALIDITY_MS };
    const bytes = packSigned(attest(keys.opSig.privateKey, claims), keys.opIss);
    return { kind: 'reject', stage: 'operator', reason: claims.error, claims, plain: bytes, sealed: seal(recipientEnc, bytes) };
  };

  // `controls` exists so each negative can be shown FAILING as well as holding:
  // a guard that is never disabled has not been proven load-bearing. A reader
  // running the demo passes none of them.
  async function handle(sealedRequest, controls = {}) {
    // 1. M2 — open the envelope. Untrusted: a verdict, never a throw.
    const opened = open(keys.opEnc.privateKey, sealedRequest);
    if (!opened.ok) return transportReject(opened.reason);

    // 2. M6 — unpack the transport frame.
    const unpacked = unpackSigned(opened.payloadBytes);
    if (unpacked === null) return transportReject('malformed request');

    // 3. Directory lookup BY `iss`. This is the request side, where looking up
    //    an issuer is exactly right: the operator is deciding whether it knows
    //    this requester at all. (The RESPONSE side must never do this — see the
    //    pinning comment in createRP.)
    //    An issuer with no envelope key is not usable as a correspondent: every
    //    reply past this point is sealed TO it, so "listed but unsealable" is
    //    unknown for this purpose, and it is reported the same way rather than
    //    as a distinct reason a prober could learn something from.
    const entry = hasOwn(directory, unpacked.iss) ? directory[unpacked.iss] : null;
    if (entry === null || entry.encPub === undefined) return transportReject('unknown issuer');
    const recipientEnc = entry.encPub;

    // 4. Request authenticity, over the exact bytes, before anything is parsed.
    //    This is the seam that closes M2's audit open item: without it, anyone
    //    who can reach the operator's public envelope key can pose as any RP.
    if (!controls.skipRequestAuth) {
      let sigOk = false;
      try {
        sigOk = edVerify(null, unpacked.signed.payloadBytes, entry.sigPub, unpacked.signed.signature);
      } catch { return transportReject('bad request signature (malformed)'); }
      if (!sigOk) return transportReject('bad request signature');
    }

    // 5. Parse — first moment any content is read.
    const text = unpacked.signed.payloadBytes.toString('utf8');
    let req;
    try { req = JSON.parse(text); } catch { return transportReject('unparseable request'); }
    if (typeof req !== 'object' || req === null || Array.isArray(req)) return transportReject('malformed request claims');

    // 6. DECISION #2 (2026-08-17, user-signed) — duplicate top-level keys, using
    //    M1's own exported scanner over the exact signed bytes, in M1's own order
    //    (signature → parse → scan; the scanner's stated precondition is that the
    //    text already parsed). One signature over bytes carrying `floor` twice
    //    reads as P90D to a last-wins parser and P365D to a first-wins one: the
    //    operator enforces one, the requester believes the other, and both hold a
    //    valid signature. The remedy is a clean re-request with a fresh nonce —
    //    never a partial acceptance, and NEVER a pick between the two values.
    if (!controls.skipDupKeyScan && hasDuplicateTopLevelKey(text)) {
      return transportReject('duplicate top-level key in request (ambiguous bytes — re-request cleanly)');
    }

    // 7. Shape. A nonce is required before any refusal can be signed and bound —
    //    a refusal the requester cannot authenticate is one the hub could have
    //    written, so everything past this line is signed.
    if (typeof req.nonce !== 'string') return transportReject('missing nonce');

    //    ...and it has to be short enough to ECHO. Every signed refusal below
    //    carries the nonce back inside the claims, so a nonce that does not fit
    //    one envelope is a nonce the operator cannot sign a refusal against —
    //    and a refusal it cannot sign is one the blind hub could have written.
    //    There is nothing to sign, so this is a TRANSPORT reject, in the clear,
    //    like every other frame-level fault. Found by the 2026-08-17 adversarial
    //    review: unbounded, a 200-character nonce on an otherwise minimal
    //    request made seal() THROW straight out of handle(), which is a remote
    //    crash on an input anyone can send. See the clamp arithmetic above.
    if (Buffer.byteLength(JSON.stringify(req.nonce), 'utf8') > NONCE_JSON_MAX) {
      return transportReject('nonce too long to echo in a signed refusal');
    }

    //    ...and the top-level request field set is CLOSED, for the same reason
    //    M1 closes its claims, M3 its axes and M4 its predicate fields: an
    //    IGNORED field is a constraint the requester believes is enforced and
    //    is not. This was the OUTERMOST layer and the last one left open —
    //    found by an adversarial probe of this file after it was first written,
    //    not reasoned about in advance. A request carrying `floors` (one letter
    //    off) had its floor silently DROPPED: `checkFloor` saw no requested
    //    floor, applied the operator's own P90D, and signed an answer while the
    //    requester believed it had demanded P365D. That is silent widening
    //    arriving through a spelling mistake — precisely the path M3's closed
    //    axis set exists to kill, one level further out, and invisible to every
    //    module because no module owns this envelope.
    const unknown = Object.keys(req).filter((k) => !REQUEST_FIELDS.includes(k));
    if (!controls.skipRequestFields && unknown.length > 0) {
      return signedReject(`unexpected request fields: ${unknown.map(fieldName).join(', ')}`, req.nonce, recipientEnc);
    }

    if (typeof req.number !== 'string') return signedReject('missing subscriber', req.nonce, recipientEnc);

    // 8. M3 — the monotone floor gate, BEFORE any fact is touched.
    //    The gate's `effective` floor — per axis the tighter of published and
    //    requested — is carried out on the operator's own return, NEVER into the
    //    claims and never into the envelope: it is operator-side evidence, like
    //    `operatorDetail`, and the wire still carries only the bit. It is
    //    returned rather than discarded because a caller (or a case) asserting
    //    "the tightened floor is the one that was enforced" has to be able to
    //    read what THIS operator enforced; recomputing `checkFloor` beside it
    //    asserts M3 in isolation and would hold identically for an operator that
    //    threw the verdict away.
    let effectiveFloor;
    if (!controls.skipFloorGate) {
      const verdict = checkFloor(floor, req.floor);
      if (!verdict.allowed) return { ...signedReject(verdict.reason, req.nonce, recipientEnc), floorRejected: true };
      effectiveFloor = verdict.effective;
    }

    // 9. The published threshold menu (decision #1), also before any fact is
    //    touched: a computed-then-discarded answer is still an oracle query.
    //    Nothing wire-supplied enters this diagnostic — the type is checked to be
    //    one of the menu's own keys and the value is never echoed — so there is
    //    nothing here to clamp and nothing to run.
    if (!controls.skipMenu) {
      const type = typeof req.predicate?.type === 'string' ? req.predicate.type : null;
      if (type !== null && hasOwn(menu, type) && !menu[type].includes(req.predicate.value)) {
        return { ...signedReject(`threshold not on the published menu for ${type} (allowed: ${menu[type].join(', ')})`, req.nonce, recipientEnc), menuRejected: true };
      }
    }

    // Control for the injective-canonicalisation negative, applied HERE and not
    // earlier on purpose: the attack it models is an operator that accepts a
    // perfectly legitimate question — passing the floor gate and the menu — and
    // then answers a DIFFERENT one. Substituting before those gates would model
    // a requester asking the other question instead, which they would simply be
    // refused for, and the case would assert the wrong guard entirely.
    if (controls.answerPredicate) req.predicate = controls.answerPredicate;

    // 10. Facts — operator-internal, never wire-bound. Both adapters THROW on an
    //     unscripted number (M4's decision 4: a fabricated fact is worse than no
    //     answer, because it gets signed), and the number came off the wire, so
    //     the throw is caught here and answered as a loud refusal. `await` covers
    //     both backends: M4 is synchronous, M5 is not, and that is the only shape
    //     difference between them.
    //     `factQuery` (M4, added with the 3 → 6 round) is what lets a predicate
    //     that needs an UPSTREAM question — a `/check` window in hours, an area,
    //     a claimed name — reach the adapter WITHOUT the adapter ever holding
    //     wire input. It validates with the same parsers `evaluatePredicate`
    //     applies, never throws, and returns frozen primitives or `{}`; an
    //     unvalidatable question yields an empty query, which yields an absent
    //     fact, which is refused below. Handing `req.predicate` straight to the
    //     backend instead would put unvalidated wire objects into the one module
    //     that builds outbound HTTP — the same mistake as canonicalising before
    //     evaluating, aimed at the network.
    let facts;
    try {
      facts = await backend.getFacts(req.number, NOW, factQuery(req.predicate));
    } catch (e) {
      // DECISION #3 (2026-08-17, adversarial review) — THE REQUESTER GETS A
      // STABLE REASON; THE DIAGNOSTIC STAYS OPERATOR-SIDE. This used to forward
      // the backend's exception message verbatim into a SIGNED refusal, so on
      // the Orange path an upstream 500 would ship a core-network hostname or
      // pool name to whoever asked — AGENT_RULES invariant 4, internal detail
      // never reaches the client, broken in the one place the operator is most
      // likely to be having a bad day.
      //
      // "Unknown subject" and "temporarily unavailable" are deliberately NOT
      // told apart either. Distinguishing them is a subject-existence oracle
      // built out of refusals: anyone holding the operator's public envelope key
      // could enumerate which numbers it serves, for free, without ever getting
      // an answer. Same reasoning that makes M2 collapse every decryption
      // failure into one 'undecryptable'.
      //
      // The requester's own submitted number is NOT echoed back either. That is
      // not a disclosure question — it is data they sent, and echoing it would
      // reveal nothing they do not already hold. It is dropped because it is not
      // NEEDED (the nonce already binds this refusal to that exact request) and
      // because putting unbounded wire text into a sealed reason is the class of
      // move that produced the nonce crash above. The operator keeps the full
      // message locally on `operatorDetail`, which never enters the claims and
      // is never sealed.
      const detail = e instanceof Error ? e.message : String(e);
      return { ...signedReject(FACTS_UNAVAILABLE, req.nonce, recipientEnc), operatorDetail: detail };
    }

    // 11. M4 — facts + predicate → the BIT. Never throws; an unanswerable
    //     predicate comes back refused, never as a defaulted `false`.
    const ev = evaluatePredicate(facts, req.predicate);
    if (!ev.answered) return signedReject(ev.reason, req.nonce, recipientEnc);

    // 12. Canonicalise AFTER M4 has validated — canonicalising first would run
    //     caller-supplied code (Array.prototype.join over a wire array) on
    //     unvalidated input, which the spike watched happen.
    const claims = {
      predicate: canonicalPredicate(req.predicate),
      result: ev.result,
      nonce: req.nonce,
      exp: NOW + VALIDITY_MS,
    };
    // The leaky-operator control for assertion 1: ship the age alongside the bit.
    if (controls.leakRaw) claims.swapAgeMs = facts.swapAgeMs;

    // 13. M1 signs, M6 packs, M2 seals — and the frame is MEASURED before it is
    //     sealed. A request that fits one envelope does not guarantee an answer
    //     that does: `roamingIn` takes a SET, and the canonical predicate string
    //     re-escapes every quote in it, so the answer frame grows faster than the
    //     request did. Measured 2026-08-17 (found while fixing the two crashes
    //     above, not filed by the review): 18 two-letter codes fit a 446-byte
    //     request and produce a 448-byte answer frame, and seal() threw straight
    //     out of handle(). A refusal carries no predicate, so it always fits —
    //     which is what makes "refuse instead of crash" available here at all.
    const plain = packSigned(attest(keys.opSig.privateKey, claims), keys.opIss);
    // Capacity DERIVED from the actual recipient key here too (2026-08-18 fix
    // round), not the module constant `OAEP_CAPACITY` (446, the RSA-4096 demo
    // value): `seal()` in m2-envelope.mjs already derives the real capacity
    // from `recipientEnc` (`modulusBits / 8 - 66`), so against a non-4096
    // recipient this guard and `seal()`'s own check used to disagree — turning
    // this intended graceful `signedReject` into `seal()` throwing straight out
    // of `handle()`. Falls back to `OAEP_CAPACITY` only if the key shape is not
    // a recognisable RSA KeyObject, in which case `seal()` below throws its own
    // clear error exactly as it did before this fix — unchanged behaviour for
    // that edge case, and unchanged behaviour for RSA-4096 either way.
    const recipientCapacity = typeof recipientEnc?.asymmetricKeyDetails?.modulusLength === 'number'
      ? recipientEnc.asymmetricKeyDetails.modulusLength / 8 - 66
      : OAEP_CAPACITY;
    if (plain.length > recipientCapacity) {
      return signedReject('answer does not fit one envelope', req.nonce, recipientEnc);
    }
    return { kind: 'answer', claims, effectiveFloor, plain, sealed: seal(recipientEnc, plain) };
  }

  return { handle };
}

// ── the requester (RP) ───────────────────────────────────────────────────────
export function createRP({ keys, directory }) {
  // M6-owned: the single-use nonce store. M1's nonce check is stateless BINDING
  // and says so in its own comments — the same response re-presented against the
  // same expected nonce verifies again, forever, until it expires. Replay
  // rejection therefore lives entirely here, which is why the negative below
  // disables THIS and not anything in M1.
  //
  // HONEST LIMIT: this store only ever GROWS. A nonce is deleted when its
  // response is verified, so a request that never gets one — rejected by the
  // hub, dropped in transit, or answered after the requester gave up — leaves
  // its entry resident forever. Harmless in a demo that issues a handful of
  // requests against an injected clock; unbounded memory in anything real. A
  // deployment evicts on EXPIRY (the answer's validity window is already the
  // natural TTL), which is deliberately not built here — the demo would have to
  // fake elapsed time to exercise it, and a stated limit beats an untested one.
  const pending = new Map();

  // `nonce` is injectable for the same reason M4's clock is: a caller that
  // supplies one gets a byte-reproducible transcript, which is how the M6 check
  // proves the two backends produce IDENTICAL signed claim bytes. Left alone it
  // is 16 fresh random bytes per request, which is the only behaviour the demo
  // itself ever uses.
  function buildRequest(predicate, floorDemanded, { number = DEMO_NUMBER, nonce = randomBytes(16).toString('hex') } = {}) {
    // The subscriber number rides INSIDE the sealed, signed request, so the hub
    // never sees it (note 1 in the demo output). It stands in for token-derived
    // identity: a real 3-legged deployment derives the subject from the access
    // token instead of asking for an identifier — the shape CAMARA's own
    // `GET /device-phone-number` already takes (no request body at all). v1
    // generalised this as profile rule 4 (camara/v1/docs/camara-attested-
    // windowed-disclosure.md, frozen as filed); v2 DROPPED that rule — the
    // spec now REQUIRES phoneNumber instead (see the "v1 -> v2" section of
    // camara/v2/docs/camara-attested-windowed-disclosure.md).
    const req = { number, predicate, floor: floorDemanded, nonce };
    const want = { predicate: canonicalPredicate(predicate) };
    const plain = packSigned(attest(keys.rpSig.privateKey, req), keys.rpIss);
    // seal() THROWS if the RP's own request will not fit one envelope — the
    // sender's own fault per M2, loud here, never a truncated half-request.
    // The store is written AFTER it, and deliberately: the nonce is only pending
    // once a request actually exists to be answered. Registering first left an
    // entry that nothing could ever verify or consume in a store the comment
    // above already admits only GROWS — a caller retrying an oversize request in
    // a loop leaks one entry per attempt.
    const sealed = seal(keys.opEnc.publicKey, plain);
    pending.set(nonce, want);
    return { nonce, plain, sealed };
  }

  // A signed operator REFUSAL. Deliberately a separate function from
  // verifyAttestation and deliberately incapable of returning an accepted
  // answer: a refusal has no `result`, and no code path here mints one.
  function verifyRefusal(pinnedKey, signed, nonce, nowMs) {
    let ok = false;
    try { ok = edVerify(null, signed.payloadBytes, pinnedKey, signed.signature); } catch { return null; }
    if (!ok) return null;
    const text = signed.payloadBytes.toString('utf8');
    let claims;
    try { claims = JSON.parse(text); } catch { return null; }
    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null;
    // Profile rule 2's duplicate-key scan, in M1's own order (signature → parse
    // → scan, which is that scanner's stated precondition) with M1's own
    // exported scanner. Found by the 2026-08-17 adversarial review, and it is
    // the embarrassing kind: M6 exported this scanner FROM M1 this very round so
    // that the request path would not carry a second copy — and then wrote a
    // second verifier that did not call it. `verifyAttestation` scans; this did
    // not. One signature over `{"error":"below floor","error":"off menu",…}`
    // therefore read as one refusal to a last-wins parser and a different one to
    // a first-wins parser, with the operator's real signature over both.
    if (hasDuplicateTopLevelKey(text)) return null;
    const keys_ = Object.keys(claims).sort().join(',');
    if (keys_ !== 'error,exp,nonce') return null;
    if (typeof claims.error !== 'string' || claims.nonce !== nonce) return null;
    if (!(typeof claims.exp === 'number' && claims.exp > nowMs)) return null;
    return claims.error;
  }

  function verifyResponse(sealedResponse, nonce, nowMs, controls = {}) {
    const opened = open(keys.rpEnc.privateKey, sealedResponse);
    if (!opened.ok) return { accepted: false, reason: opened.reason };
    const unpacked = unpackSigned(opened.payloadBytes);
    if (unpacked === null) return { accepted: false, reason: 'malformed response' };

    // Single-use nonce FIRST: a replay must die before any crypto is spent on it.
    const expected = pending.get(nonce);
    if (expected === undefined && !controls.skipNonceStore) {
      return { accepted: false, reason: 'unknown or already-used nonce' };
    }

    // KEY PINNING (profile rule 3). The RP pins the operator key it expects for
    // this PLMN; `iss` off the wire is a hint and never selects the key. The
    // signature authenticates iss→key, NOT that this issuer was entitled to
    // answer — so letting `iss` pick the key lets ANY directory-listed party,
    // routed by an untrusted aggregator, answer a query addressed to someone
    // else. `controls.trustIssHint` exists only to show exactly that.
    const pinned = controls.trustIssHint && hasOwn(directory, unpacked.iss)
      ? directory[unpacked.iss].sigPub
      : directory[keys.opIss].sigPub;

    // With the store bypassed there is no remembered question, so the caller has
    // to supply one. Without it there is nothing to compare against, and
    // canonicalising `undefined` used to throw a bare TypeError straight out of a
    // function whose whole contract is "untrusted input gets a verdict, never a
    // throw" — the control knob crashing the verifier it exists to instrument.
    if (expected === undefined && controls.fallbackPredicate === undefined) {
      return { accepted: false, reason: 'unknown or already-used nonce' };
    }
    const want = expected ?? { predicate: canonicalPredicate(controls.fallbackPredicate) };
    const v = verifyAttestation(pinned, unpacked.signed, { predicate: want.predicate, nonce, nowMs });

    // CONSUMED on a VERIFIED exchange — an accepted answer or a verified signed
    // refusal — and NEVER on a merely PRESENTED one. One nonce, one exchange;
    // the remedy for a refusal is still a fresh request with a fresh nonce.
    //
    // The delete used to run HERE, before the verdict below was read, and the
    // 2026-08-17 adversarial review turned that into a one-message denial of
    // service by exactly the party this design assumes is hostile: the untrusted
    // hub injects a single garbage sealed response, the store burns the pending
    // nonce, and the operator's genuine answer then arrives to 'unknown or
    // already-used nonce'. The comment already said "consumed on any VERIFIED
    // exchange" while the code consumed on any presented one — the contract was
    // right and the code was not.
    const consume = () => { if (!controls.skipNonceStore) pending.delete(nonce); };

    if (v.accepted) { consume(); return v; }

    const refusal = verifyRefusal(pinned, unpacked.signed, nonce, nowMs);
    if (refusal !== null) {
      consume();
      return { accepted: false, refused: true, reason: `operator refused: ${refusal}` };
    }
    // Neither verified: the nonce stays PENDING, so the genuine response can
    // still land. That is the fix — an unverifiable message is not an exchange.
    return v;
  }

  return { pending, buildRequest, verifyResponse };
}

// ══════════════════════════ the backend seam (FR5) ═══════════════════════════
// The ONLY difference between `--backend mock` and `--backend orange`. Both
// adapters expose the same two operations over the same injected clock, and
// `evaluatePredicate` is M4's in BOTH cases — M5 deliberately does not
// reimplement it, which is what makes the swap a swap rather than a second code
// path. `fetchImpl`/`basicAuth` are dependency injection so the M6 check can
// replay captured Orange bytes offline: one code path, no test-only branch.
export async function createBackend(mode, { basicAuth, fetchImpl } = {}) {
  if (mode === 'mock') {
    const facts = createMockFacts();
    return {
      label: 'mock — zero credentials, zero network, deterministic',
      // M4's setBackstory takes no clock (its backstories are already relative);
      // M5's takes one, because it converts to an absolute date for Orange. The
      // uniform 3-argument shape here is the whole adapter difference.
      setBackstory: async (number, backstory) => facts.setBackstory(number, backstory),
      getFacts: async (number, nowMs, query) => facts.getFacts(number, nowMs, query),
    };
  }
  if (mode === 'orange') {
    const facts = createOrangeFacts({ basicAuth, fetchImpl });
    return {
      label: 'orange — live Orange Network APIs Playground',
      setBackstory: (number, backstory, nowMs) => facts.setBackstory(number, backstory, nowMs),
      getFacts: (number, nowMs, query) => facts.getFacts(number, nowMs, query),
    };
  }
  throw new Error(`unknown backend: ${JSON.stringify(mode)} (use mock or orange)`);
}

// A whole world: keys, directory, hub, operator, RP. Keys are exchanged OUT OF
// BAND and never ride inside a payload (M2 decision, 2026-08-15). Two key types
// per actor, because signing and confidentiality are different jobs: Ed25519 for
// M1 signatures, RSA-4096 for M2 envelopes.
export function generateKeys() {
  return {
    opSig: generateKeyPairSync('ed25519'),
    rpSig: generateKeyPairSync('ed25519'),
    opEnc: generateEnvelopeKeys(),
    rpEnc: generateEnvelopeKeys(),
    opIss: 'op:demo-plmn-001',
    rpIss: 'rp:demo-agent-01',
  };
}

// `keys` is injectable because RSA-4096 generation costs ~2.7s per key on the
// machine this was measured on, and the M6 check builds a fresh world per case
// (fresh nonce store, fresh hub log — the state that can make a case pass for
// the wrong reason). Sharing one key set across those worlds takes the suite
// from minutes to seconds and changes nothing it asserts; the cases that
// genuinely turn on key identity mint their own keys anyway.
export function createWorld({ backend, floor, menu, keys = generateKeys() }) {
  const directory = Object.freeze({
    [keys.opIss]: { sigPub: keys.opSig.publicKey, encPub: keys.opEnc.publicKey },
    [keys.rpIss]: { sigPub: keys.rpSig.publicKey, encPub: keys.rpEnc.publicKey },
  });
  return {
    keys,
    directory,
    hub: createHub(),
    operator: createOperator({ keys, directory, backend, floor, menu }),
    rp: createRP({ keys, directory }),
  };
}

// A full round trip through the hub, both legs, for one request. Exported
// because it is the shape every assertion below uses and the M6 check drives it
// directly for the backend-seam comparison.
export async function roundTrip(world, request, { operator: opControls = {}, rp: rpControls = {}, hub: hubControls = {}, nowMs = NOW + 1_000 } = {}) {
  const atOperator = world.hub.route(world.keys.rpIss, world.keys.opIss, request.sealed, hubControls);
  const out = await world.operator.handle(atOperator, opControls);
  if (out.sealed === null) return { out, verdict: { accepted: false, reason: out.reason } };
  const atRp = world.hub.route(world.keys.opIss, world.keys.rpIss, out.sealed, hubControls);
  return { out, atRp, verdict: world.rp.verifyResponse(atRp, request.nonce, nowMs, rpControls) };
}

// ═══════════════════════════ the wire-byte scanner ═══════════════════════════
// THE INVENTORY of raw values the operator holds and must never ship. The
// 2026-08-17 adversarial review found this set was five long-form spellings of
// the swap timestamp and nothing else, so four perfectly plausible leaks —
// `{"swapDays":137}`, `{"c":"FR"}` (the roaming COUNTRY VALUE, a raw value under
// profile rule 1 every bit as much as the date is), `{"m":"+990100000099"}` and
// `{"d":"2026-04-02"}` — all scored ZERO hits while the demo printed "no raw
// value in ANY wire artifact" over the result. The label was ahead of the check.
//
// So the inventory is now complete, and the SPLIT that used to be hidden inside
// it is explicit below instead: some of these values are too short to scan
// against opaque bytes without flaking, which is a property of the ARTIFACT, not
// a reason to leave the value out of the inventory.
// The measured near-miss score, and the one the mock reproduces: `Alice Arnaut`
// against `Alice Arnaud`. Named so the scanner and the narrative cannot drift.
export const NEAR_MISS_SCORE = 97;

// Every spelling of an ABSOLUTE instant the operator holds. Split out of
// `spellings` below because an instant that is not expressed as "N days ago" has
// no age and no day count to spell — and inventing a `0` for one would put a
// one-character needle in the set, which cannot assert anything.
export const instantSpellings = (atMs) => {
  const iso = new Date(atMs).toISOString();
  return [String(atMs), iso, iso.slice(0, 10)];
};

export function rawNeedles(daysAgo, { country = 'FR', number = DEMO_NUMBER, deviceDaysAgo = null, deviceFlippedDaysAgo = null } = {}) {
  const spellings = (d) => {
    const ageMs = d * DAY_MS;
    const atMs = NOW - ageMs;
    return [String(ageMs), ...instantSpellings(atMs), String(d)];
  };
  // WIDENED 2026-08-17 with the 3 → 6 predicate round: every fact the operator
  // now holds gets its own spellings, because the review's lesson was that an
  // inventory covering one value five ways reads as complete and is not. The
  // DEVICE swap instant is a second raw timestamp, as disclosive as the first.
  //
  // WIDENED AGAIN 2026-08-18 (fix round): `deviceFlippedDaysAgo` covers the
  // device axis's RE-SCRIPTED instant (the r6b negative re-scripts ONLY the
  // device axis to a different day count before asking the same question).
  // Without its own spellings here, the frame that answers about that
  // re-scripted instant is scanned against needles for a value the subscriber
  // was never re-scripted to at that point — a scan that could not have found
  // that value even if it had leaked.
  return [
    ...spellings(daysAgo),
    ...(deviceDaysAgo === null ? [] : spellings(deviceDaysAgo)),
    ...(deviceFlippedDaysAgo === null ? [] : spellings(deviceFlippedDaysAgo)),
    'swapAgeMs', 'deviceSwapAgeMs', 'roamingCountry', country, number,
    // The OBSERVATION INSTANT that rides with the position — added 2026-08-17,
    // when the user's live Playground run measured that the Admin store REQUIRES
    // one to hold a position at all (`400 "data.location.lastLocationTime is
    // required"`). It is a raw timestamp about the subscriber, exactly like the
    // two swap instants above and exactly as disclosive, so it is inventoried the
    // same way rather than treated as plumbing. The operator writes it off the
    // injected clock, so its spellings are `NOW`'s — and none of them can appear
    // in an artifact by chance: `exp` is a NUMBER, and `NOW + VALIDITY_MS` is not
    // a substring of `NOW`.
    ...instantSpellings(NOW), 'lastLocationTime',
    // The subscriber's own POSITION and the operator's own verdict vocabulary.
    // `PARTIAL` is a needle in its own right: it is the operator admitting it
    // cannot resolve the subscriber, which is a fact about the subscriber, and
    // a refusal carries no predicate so it can never be the echoed question.
    String(SUBSCRIBER_AT.lat), String(SUBSCRIBER_AT.long), 'presentVerdict', 'PARTIAL',
    // The operator's own KYC record and the similarity gradient it computes.
    // The requester's CLAIMED name is deliberately NOT here: it is the question,
    // and it comes back inside the signed predicate by design.
    REGISTERED_NAME, 'nameMatchScore', String(NEAR_MISS_SCORE),
  ];
}

// The subset that is safe to scan against OPAQUE bytes — RSA ciphertext read as
// latin1, and frames whose payload is base64. Measured, not guessed: a 2-char
// country code lands inside 512 random bytes about once every 8 runs and inside
// a 308-character base64 payload about once every 13; a 3-digit day count lands
// inside a 32-character hex nonce about once every 140. A needle that reds a
// clean run asserts nothing, so those two are scanned only where a hit is real.
// Both cutoffs below are the SAME operation at two calibrations, so the filter
// itself is written once: only the threshold differs, and each threshold's own
// justification stays with its constant.
const atLeast = (min) => (all) => all.filter((n) => n.length >= min);

const OPAQUE_MIN_NEEDLE = 8;
export const opaqueNeedles = atLeast(OPAQUE_MIN_NEEDLE);

// The plaintext counterpart, added 2026-08-18 (fix round) after the widened
// device-flip inventory (`DEVICE_FLIPPED_DAYS_AGO` below) exposed the same
// class of problem OPAQUE_MIN_NEEDLE already guards against, one size class
// down: `String(4)` is a ONE-CHARACTER needle, and a single decimal digit is
// all but guaranteed to appear somewhere in a claim frame that carries several
// numeric fields (`exp`, thresholds, day counts) even with the nonce blanked —
// measured directly: it reds every plaintext scan in this file, including the
// very first one, whose frame predates the device-flip scenario entirely and
// so cannot possibly carry that value. That is not 8 (OPAQUE_MIN_NEEDLE is
// calibrated against RANDOM bytes/base64, where even a short needle is
// genuinely rare); this scan runs against STRUCTURED, low-entropy JSON text,
// where the needles already proven not to false-positive across this suite's
// whole run history are two- and three-character (`FR`, the 2-letter country
// code kept deliberately per the note below; `137`/`211`, the day counts) —
// so the cutoff is set at the shortest of those, 2, dropping ONLY a bare
// single-character spelling. A day count short enough that even its "N days"
// form is one character (as `DEVICE_FLIPPED_DAYS_AGO` is) cannot be
// leak-tested by this scan via that spelling — an honest limit, not silently
// smoothed over: the value's LONGER spellings (its millisecond age, its ISO
// instant, its date) are unaffected and stay fully leak-testable.
const PLAIN_MIN_NEEDLE = 2;
export const plainNeedles = atLeast(PLAIN_MIN_NEEDLE);

// ...and the counterpart that makes the SHORT needles usable on plaintext: the
// nonce is 32 random hex characters, so it is the one place in a claim frame
// where "137" can appear by chance. Blanking it is what turns the day count from
// a flaky needle into an asserting one — the value is still scanned, in every
// artifact byte the operator actually authored.
export const withoutNonce = (text, nonce) => (nonce ? text.split(nonce).join('') : text);

// ...and the counterpart the 3 → 6 round forced, which is worth stating plainly
// because it looks like an excuse and is not.
//
// The signed claims ECHO THE QUESTION (profile rule 2 — an answer must name the
// predicate it answers, or a signed bit can be read as answering a different
// one). So for `roamingIn ["FR","BE"]` the string `FR` is IN the answer by
// design: it is the requester's own set, coming back to the requester, exactly
// like the nonce. Measured the moment the six-predicate scan first ran — it went
// red on `["FR","FR"]` from the two roaming frames, which is the scan working,
// not a leak.
//
// A value the requester put INTO the question is not a disclosure when it comes
// back out. So each frame is scanned against the inventory MINUS whatever the
// question it answers already carried, and the excluded set is asserted (an
// exclusion that quietly swallowed the whole inventory would be a scanner that
// cannot red).
//
// HONEST LIMIT, and it is a real one: this makes the scan blind to a leak of the
// SAME value on the AXIS BEING ASKED ABOUT. If the operator echoed its stored
// country into a `roamingIn [FR]` answer, that is byte-identical to the echoed
// question and no scanner can separate them. M1's closed claim set is what
// actually prevents it (any field beyond {predicate,result,nonce,exp} is
// rejected — the leaky-operator control shows that firing); the scan covers every
// OTHER value the operator holds. Stated rather than glossed, because the
// alternative — dropping `FR` from the inventory entirely — is how the previous
// version of this scanner ended up checking one value five ways.
export const withoutAsked = (needles, canonical) =>
  needles.filter((n) => !String(canonical).includes(n));

export function scan(buf, needles) {
  const s = Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf);
  return needles.filter((n) => s.includes(n));
}
// ════════════════════════════════ the report ═════════════════════════════════
const results = [];
const out = (s = '') => console.log(s);
const section = (title) => out(`\n══ ${title}\n`);
const step = (s) => out(`   · ${s}`);
const note = (s) => out(`     ${s}`);
function qa(question, backstory, answer) {
  out('');
  out(`   Q: ${question}`);
  out(`      (backstory: ${backstory})`);
  out(`   A: ${answer}`);
  out('');
}
function assert(label, ok, evidence) {
  results.push(ok === true);
  out(`   ${ok === true ? 'PASS' : 'FAIL'} ${label}${evidence ? ` — ${evidence}` : ''}`);
}
function flip(label, ok, evidence) {
  results.push(ok === true);
  out(`   negative flip → ${ok === true ? 'PASS' : 'FAIL'}: ${label}${evidence ? ` — ${evidence}` : ''}`);
}

// ════════════════════════════════ the demo ═══════════════════════════════════
export async function runDemo(backend) {
  results.length = 0;   // so a second call in one process reports its own tally
  const world = createWorld({ backend });
  const { hub, rp, keys } = world;
  // RAW carries every spelling, including any too-short-to-assert ones (see
  // PLAIN_MIN_NEEDLE above); NEEDLES is the plaintext-usable subset actually
  // scanned below, and OPAQUE (a stricter subset again) is derived from RAW
  // rather than NEEDLES so a future plaintext cutoff change cannot silently
  // narrow the opaque scan too.
  const RAW_NEEDLES = rawNeedles(SWAPPED_DAYS_AGO, { deviceDaysAgo: DEVICE_SWAPPED_DAYS_AGO, deviceFlippedDaysAgo: DEVICE_FLIPPED_DAYS_AGO });
  const NEEDLES = plainNeedles(RAW_NEEDLES);
  const OPAQUE = opaqueNeedles(RAW_NEEDLES);

  // PLAIN_MIN_NEEDLE's own drop, pinned on the SET it drops, not merely the
  // count — a count-only check would pass identically if a DIFFERENT needle
  // had dropped instead. Hardcoded to the one spelling this inventory is
  // documented to drop (`String(DEVICE_FLIPPED_DAYS_AGO)`, the single-digit
  // day count), so a future change that widens the drop (the cutoff moving,
  // or a new short spelling entering RAW_NEEDLES) reds here instead of
  // silently leaving the leak scan with one fewer needle than the docs claim.
  const droppedPlain = RAW_NEEDLES.filter((n) => n.length < PLAIN_MIN_NEEDLE);
  assert('PLAIN_MIN_NEEDLE drops exactly the needle set it is documented to drop, nothing else',
    JSON.stringify(droppedPlain) === JSON.stringify(['4']) && NEEDLES.length === RAW_NEEDLES.length - 1,
    `raw=${RAW_NEEDLES.length} -> plain=${NEEDLES.length}; dropped=${JSON.stringify(droppedPlain)}`);

  const SWAP_ISO = new Date(NOW - SWAPPED_DAYS_AGO * DAY_MS).toISOString();

  await backend.setBackstory(DEMO_NUMBER, story(), NOW);

  out('justabit — Mode A, attested windowed disclosure (never "zero-knowledge")');
  out('');
  out(`   backend      ${backend.label}`);
  out(`   clock        ${new Date(NOW).toISOString()} — injected everywhere, so this run`);
  out('                prints the same bytes today and in 2099');
  out(`   subscriber   ${DEMO_NUMBER} (Orange +990 test range; never a real number)`);
  out(`   floor        published: ${JSON.stringify(PUBLISHED_FLOOR)}`);
  out(`   thresholds   published menu: ${JSON.stringify(PUBLISHED_THRESHOLD_MENU.simSwapAge)} — see note 2`);
  out('   actors       RP "demo bank"  →  blind hub (meters + bills)  →  operator');

  // ───────────────────────────────────────────────────────────── assertion 1
  section('1. Attestation core — the answer is a signed bit, and the raw value never leaves');
  step('the requester picks a threshold off the published menu, seals the question for');
  step('the operator, and hands the envelope to the hub, which cannot open it.');

  const PREDICATE = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };
  const q1 = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });   // tightening: legal
  const r1 = await roundTrip(world, q1);

  step(`operator: floor OK → threshold on menu → reads its own records → signs one bit.`);
  qa('has the SIM behind this number been in place for at least 90 days?',
    `the SIM was swapped ${SWAPPED_DAYS_AGO} days ago, on ${SWAP_ISO}`,
    `${r1.out.claims?.result} — and that is the entire disclosure`);

  assert('answer verified: signature, predicate, nonce, expiry',
    r1.verdict.accepted === true && r1.out.claims.result === true,
    `reason='${r1.verdict.reason}', request ${q1.plain.length} B / response ${r1.out.plain.length} B plaintext (envelope cap ${OAEP_CAPACITY} B)`);
  assert('the signed claim set is closed — exactly {predicate, result, nonce, exp}',
    JSON.stringify(Object.keys(r1.verdict.claims ?? {})) === '["predicate","result","nonce","exp"]',
    `keys=${JSON.stringify(Object.keys(r1.verdict.claims ?? {}))}`);
  note(`signed bytes, verbatim: ${unpackSigned(r1.out.plain).signed.payloadBytes.toString('utf8')}`);

  // Two scans, because one needle set cannot honestly cover both artifact
  // classes. The OPAQUE artifacts (ciphertext, and the base64-bearing frame) get
  // the long-form subset, which cannot land by chance; the PLAINTEXT artifacts
  // get the FULL inventory — day count, country code and subscriber number
  // included — with the random hex nonce blanked out first, which is what makes
  // a 3-digit needle assert instead of flake.
  const opaque1 = { ciphertext: r1.atRp, frame: r1.out.plain };
  const plain1 = {
    claimBytes: withoutNonce(unpackSigned(r1.out.plain).signed.payloadBytes.toString('utf8'), q1.nonce),
    hubLog: withoutNonce(JSON.stringify(hub.log), q1.nonce),
  };
  const hits1 = [
    ...Object.values(opaque1).flatMap((a) => scan(a, OPAQUE)),
    ...Object.values(plain1).flatMap((a) => scan(a, NEEDLES)),
  ];
  assert('no raw value on the wire — every value the operator holds, not just the long spellings',
    hits1.length === 0,
    `${Object.keys(opaque1).join(', ')} vs the ${OPAQUE.length} long forms; `
    + `${Object.keys(plain1).join(', ')} (nonce blanked) vs all ${NEEDLES.length}: [${NEEDLES.join(', ')}] → hits=${JSON.stringify(hits1)}`);

  step('and the bit is real, not decoration: re-script the backstory and re-ask.');
  await backend.setBackstory(DEMO_NUMBER, story({ swappedDaysAgo: FLIPPED_DAYS_AGO }), NOW);
  const q1b = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r1b = await roundTrip(world, q1b);
  qa('same question, same wire shape, different subscriber history',
    `the SIM was swapped ${FLIPPED_DAYS_AGO} days ago`,
    `${r1b.out.claims?.result}`);
  assert('the bit flips and the ciphertext length does not move',
    r1b.out.claims.result === false && r1b.verdict.accepted === true && r1b.out.sealed.length === r1.out.sealed.length,
    `${r1.out.sealed.length} B both times — RSA-OAEP ciphertext is fixed-length, so the billing record carries no content signal`);
  await backend.setBackstory(DEMO_NUMBER, story(), NOW);

  // NEGATIVE: an operator that ships the age alongside the bit. Two independent
  // defences must both fire, or the scanner above was asserting nothing.
  //
  // FIXED 2026-08-17 (live Orange run, 32/33): this control used to reuse the
  // shared P90D `PREDICATE`. 2160 hours is under M5's measured 2400-hour
  // `/check` cap (see m5-facts-orange.mjs and m6-check.mjs case 22), so on the
  // orange backend this question runs through `/check` — which answers a bit
  // about the asked window and never holds a raw date at all. With no
  // `facts.swapAgeMs` to leak, `claims.swapAgeMs` came back `undefined`,
  // `JSON.stringify` dropped the key, the scanner had nothing to find, and the
  // control asserted a leak it could not produce on that path — a control that
  // cannot fail must never be asserted as though it did. P365D is above the cap
  // (`/retrieve-date` is the only surface that can answer it), so a raw date
  // genuinely exists on both backends for `leakRaw` to leak, and both
  // defences — the wire scanner and M1's closed claim set — fire on both. See
  // docs/logs/findings.md, 2026-08-17, for the mechanism and the
  // structural argument for `/check` this accidentally surfaced.
  const LEAK_PREDICATE = { type: 'simSwapAge', operator: 'gte', value: 'P365D' };
  const q1c = rp.buildRequest(LEAK_PREDICATE, { swapAgeMin: 'P180D' });
  const r1c = await roundTrip(world, q1c, { operator: { leakRaw: true } });
  const leakHits = scan(withoutNonce(unpackSigned(r1c.out.plain).signed.payloadBytes.toString('utf8'), q1c.nonce), NEEDLES);
  flip('a leaky operator reds the SAME scanner, and M1 rejects the response anyway',
    leakHits.length > 0 && r1c.verdict.accepted === false && r1c.verdict.reason === 'unexpected fields: swapAgeMs',
    `hits=${JSON.stringify(leakHits)}; requester verdict='${r1c.verdict.reason}' (closed claim set)`);

  // ───────────────────────────────────────────────────────────── assertion 2
  section('2. Nonce + validity — one question, one answer, and it goes stale');
  step('every request carries a fresh single-use nonce; the operator echoes it INSIDE');
  step('the signature, and the requester spends it on first use.');

  const q2 = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r2 = await roundTrip(world, q2);
  qa('is this answer the one I asked for, right now?',
    `nonce ${q2.nonce.slice(0, 12)}…, valid for ${VALIDITY_MS / 1000}s from ${new Date(NOW).toISOString()}`,
    `${r2.out.claims?.result} — accepted once`);

  const replay = world.rp.verifyResponse(r2.atRp, q2.nonce, NOW + 2_000);
  assert('replaying the operator\'s own sealed answer is REJECTED',
    replay.accepted === false && replay.reason === 'unknown or already-used nonce', `reason='${replay.reason}'`);

  // Checked on FIRST presentation, at a clock past the expiry — not on a second
  // one, or the single-use store would reject it as a replay before the expiry
  // check was ever reached and the case would assert the wrong guard.
  const q2b = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r2b = await roundTrip(world, q2b, { nowMs: NOW + 2 * VALIDITY_MS });
  assert('a still-valid signature past its expiry is REJECTED',
    r2b.verdict.accepted === false && r2b.verdict.reason === 'expired',
    `exp=${r2b.out.claims.exp}, checked at ${NOW + 2 * VALIDITY_MS} — the signature is fine; the window is not`);

  // NEGATIVE: replay rejection lives 100% in M6's nonce store — M1 is stateless
  // by design and says so. Turn the store off and the SAME replay sails through.
  const q2c = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r2c = await roundTrip(world, q2c);
  const replayOk = world.rp.verifyResponse(r2c.atRp, q2c.nonce, NOW + 2_000,
    { skipNonceStore: true, fallbackPredicate: PREDICATE });
  flip('with the single-use store disabled, the SAME replay is ACCEPTED',
    replayOk.accepted === true,
    `M1's nonce check is stateless BINDING, not replay protection — the store is the whole defence, so this is where it had to be disabled to prove it`);

  // ───────────────────────────────────────────────────────────── assertion 3
  section('3. Blind hub — it meters and bills, and it cannot read a thing');
  step('both legs are end-to-end encrypted between requester and operator. The hub');
  step('holds no key that opens them, so blindness is structural, not a promise.');

  // NARRATION, labelled as what it is. The hub's blindness is STRUCTURAL — it
  // is never handed a key that opens either leg — and a structural property is
  // not something an assertion can fail. What this line actually exercises is
  // RSA-OAEP: a key that is not the recipient's does not open the ciphertext.
  // The 2026-08-17 review flagged the old label ("the hub opening a message it
  // just carried gets nothing") for claiming the first while checking the
  // second. The real evidence for blindness is the log scan below, which CAN
  // fail, and the chatty control that shows it failing.
  const hubKeys = generateEnvelopeKeys();
  const hubTry = open(hubKeys.privateKey, r1.atRp);
  assert('a key that is not the recipient\'s does not open the ciphertext (RSA-OAEP, not a blindness proof)',
    hubTry.ok === false, `hub open → '${hubTry.reason}' — blindness itself is structural: the hub is never given a key`);

  out('');
  out('   the hub\'s own log, printed verbatim:');
  for (const e of hub.log.slice(0, 4)) out(`     ${JSON.stringify(e)}`);
  out(`     … ${hub.log.length} entries total, all of this shape`);
  out('');

  // The hub log is the operator's own plaintext, so the FULL inventory applies —
  // plus the question itself, which rule 6 removes from the metering record just
  // as firmly as it removes the answer.
  const LOG_NEEDLES = [...NEEDLES, 'simSwapAge', 'P90D', 'P180D'];
  const logHits = scan(JSON.stringify(hub.log), LOG_NEEDLES);
  assert('the log carries metering only: count, route, size, bill',
    logHits.length === 0, `scanned for [${LOG_NEEDLES.join(', ')}] → hits=${JSON.stringify(logHits)}`);
  note('honest limit, unchanged by composition: message COUNT, TIMING and the RP↔operator');
  note('PAIRING stay visible — that is exactly what metering needs. Rule 6 removes content,');
  note('not the fact of the query. Sizes are fixed-length here, so they carry no signal.');

  // NEGATIVE: a hub operator adds one "helpful" debug field.
  const chattyHub = createHub();
  chattyHub.route(keys.rpIss, keys.opIss, r1.atRp,
    { chatty: `${DEMO_NUMBER} asked simSwapAge P90D → true (swapAgeMs ${SWAPPED_DAYS_AGO * DAY_MS})` });
  const chattyHits = scan(JSON.stringify(chattyHub.log), LOG_NEEDLES);
  flip('one "helpful" hub debug field reds the SAME scanner',
    chattyHits.length > 0, `hits=${JSON.stringify(chattyHits)}`);

  // ───────────────────────────────────────────────────────────── assertion 4
  section('4. Monotone floor — a looser window is refused, never quietly widened');
  step(`the operator publishes ${JSON.stringify(PUBLISHED_FLOOR)}. A requester may tighten`);
  step('any axis and may loosen none; an unknown or misspelled axis is a rejection too,');
  step('because an ignored typo drops a constraint the requester believes is enforced.');

  const q4 = rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' });   // below the published P90D
  const r4 = await roundTrip(world, q4);
  qa('may I have this answer under a WEAKER 30-day profile floor?',
    'the operator publishes a 90-day floor; the request demands 30',
    'no answer at all — a signed refusal, and no attestation was ever produced');
  assert('below-floor request refused, and NO bit was computed',
    r4.out.kind === 'reject' && r4.out.floorRejected === true && r4.verdict.refused === true,
    `requester saw: '${r4.verdict.reason}'`);

  const q4b = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D', class: 'postpaid' });
  const r4b = await roundTrip(world, q4b);
  // The 2026-08-17 review flagged the old version of this line: it said "the
  // effective floor is visible" and asserted only `accepted === true`, so a gate
  // that returned the operator's own floor verbatim would have passed it. The
  // effective floor is now READ: both tightened axes must be the REQUESTER's
  // values, and the untouched axis must still be the operator's.
  // ...and it is read off THE OPERATOR'S OWN return, not recomputed here.
  // Recomputing `checkFloor` beside the round trip was the second half of the
  // same defect: it asserts M3 in isolation (which m3-check already does) and
  // holds byte-identically for an operator that computes the effective floor and
  // throws it away — which is exactly what this one used to do.
  const eff4b = r4b.out.effectiveFloor ?? {};
  assert('tightening two axes is accepted, and the effective floor really is the tightened one',
    r4b.verdict.accepted === true
      && eff4b.swapAgeMin === 'P180D' && eff4b.class === 'postpaid' && eff4b.tenureMin === PUBLISHED_FLOOR.tenureMin,
    `effective floor = ${JSON.stringify(eff4b)} — two axes from the request, ${PUBLISHED_FLOOR.tenureMin} inherited from the operator`);

  // NEGATIVE: the gate off. The SAME below-floor request now gets a signed answer
  // under a floor the operator never agreed to — silent widening, in one line.
  const q4c = rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' });
  const r4c = await roundTrip(world, q4c, { operator: { skipFloorGate: true } });
  flip('with the gate disabled, the SAME below-floor request is ANSWERED',
    r4c.out.kind === 'answer' && r4c.verdict.accepted === true,
    `signed claims=${JSON.stringify(r4c.out.claims)} — that is the silent widening, and it is one missing call away`);

  out('');
  step('and the same widening has a quieter door: a MISSPELLED field. The request');
  step('field set is CLOSED, so `floors` is refused rather than ignored — an ignored');
  step('field is a constraint the requester believes is enforced and is not.');
  const typo = { number: DEMO_NUMBER, predicate: PREDICATE, floors: { swapAgeMin: 'P365D' }, nonce: 'typo-nonce-01' };
  const typoBytes = Buffer.from(JSON.stringify(typo), 'utf8');
  const typoSealed = seal(keys.opEnc.publicKey,
    packSigned({ payloadBytes: typoBytes, signature: edSign(null, typoBytes, keys.rpSig.privateKey) }, keys.rpIss));
  const typoOut = await world.operator.handle(hub.route(keys.rpIss, keys.opIss, typoSealed));
  assert('a misspelled request field is refused, not ignored',
    typoOut.kind === 'reject' && typoOut.reason === 'unexpected request fields: floors',
    `reason='${typoOut.reason}'`);
  const typoCtrl = await world.operator.handle(hub.route(keys.rpIss, keys.opIss, typoSealed), { skipRequestFields: true });
  flip('with the set left open, the typo silently DROPS the demanded floor',
    typoCtrl.kind === 'answer',
    `answered under the operator's own ${PUBLISHED_FLOOR.swapAgeMin} while the requester believed it demanded ${typo.floors.swapAgeMin} — no error anywhere`);

  // ────────────────────────────────────── the wired predicate set (3 → 6)
  section('The wired predicate set — one envelope, several questions');
  step('every predicate below is backed by an endpoint that was OBSERVED ANSWERING on');
  step('the Orange Playground (2026-08-17). Nothing is wired that no fact source answers —');
  step('which is why `tenure` and `simType` are NOT here: the data exists operator-side,');
  step('and no CAMARA read endpoint for it does (both probes: 400 "unhandled path").');

  // deviceSwapAge — the same grammar as simSwapAge, deliberately. A second shape
  // would be a second place for the window to widen quietly.
  const DEVICE_P90 = { type: 'deviceSwapAge', operator: 'gte', value: 'P90D' };
  const q6a = rp.buildRequest(DEVICE_P90, { swapAgeMin: 'P180D' });
  const r6a = await roundTrip(world, q6a);
  qa('has the DEVICE behind this number been in place for at least 90 days?',
    `the device was swapped ${DEVICE_SWAPPED_DAYS_AGO} days ago; the SIM ${SWAPPED_DAYS_AGO} — two different instants`,
    `${r6a.out.claims?.result} — off the same published bucket menu as simSwapAge`);
  assert('deviceSwapAge answers off the SAME menu, and the two axes are independent',
    r6a.verdict.accepted === true && r6a.out.claims.result === true
      && JSON.stringify(PUBLISHED_THRESHOLD_MENU.deviceSwapAge) === JSON.stringify(PUBLISHED_THRESHOLD_MENU.simSwapAge),
    `signed '${r6a.out.claims.predicate}'; menu ${JSON.stringify(PUBLISHED_THRESHOLD_MENU.deviceSwapAge)}`);

  // NEGATIVE: re-script ONLY the device axis. If the mapping read the SIM axis by
  // mistake, this bit would not move — which is the whole reason the two day
  // counts differ.
  await backend.setBackstory(DEMO_NUMBER, story({ deviceSwappedDaysAgo: DEVICE_FLIPPED_DAYS_AGO }), NOW);
  const q6b = rp.buildRequest(DEVICE_P90, { swapAgeMin: 'P180D' });
  const r6b = await roundTrip(world, q6b);
  const q6c = rp.buildRequest(PREDICATE, { swapAgeMin: 'P180D' });
  const r6c = await roundTrip(world, q6c);
  flip('re-scripting ONLY the device swap flips ONLY the device bit',
    r6b.out.claims?.result === false && r6b.verdict.accepted === true && r6c.out.claims?.result === true,
    `device ${DEVICE_FLIPPED_DAYS_AGO}d → ${r6b.out.claims?.result}; the SIM is untouched at ${SWAPPED_DAYS_AGO}d → ${r6c.out.claims?.result}`);
  await backend.setBackstory(DEMO_NUMBER, story(), NOW);

  // roamingIn — a SET, not an ordered threshold, so no menu (nothing to bisect).
  const q6d = rp.buildRequest({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }, { swapAgeMin: 'P180D' });
  const r6d = await roundTrip(world, q6d);
  await backend.setBackstory(DEMO_NUMBER, story({ roamingCountry: null }), NOW);
  const q6e = rp.buildRequest({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }, { swapAgeMin: 'P180D' });
  const r6e = await roundTrip(world, q6e);
  await backend.setBackstory(DEMO_NUMBER, story(), NOW);
  qa('is the device in FR or BE?', 'the subscriber is roaming in FR', `${r6d.out.claims?.result} — and the country never comes back`);
  assert('roamingIn answers a set membership, and NOT roaming answers an honest false',
    r6d.verdict.accepted === true && r6d.out.claims.result === true
      && r6e.verdict.accepted === true && r6e.out.claims.result === false,
    'no menu for this one on purpose: a set has no ordering to bisect');

  // presentIn — the one predicate whose UPSTREAM is itself predicate-shaped, and
  // the one with a third state. Measured 2026-08-17: `location-verification/v1/
  // verify` answers TRUE, FALSE and PARTIAL, and ships a `lastLocationTime`
  // timestamp beside every one of them.
  const q6h = rp.buildRequest({ type: 'presentIn', operator: 'in', value: ASK_AREA }, { swapAgeMin: 'P180D' });
  const r6h = await roundTrip(world, q6h);
  qa(`is the device inside a ${ASK_AREA.radiusM / 1000} km circle around ${ASK_AREA.lat}, ${ASK_AREA.long}?`,
    `the subscriber is at ${SUBSCRIBER_AT.lat}, ${SUBSCRIBER_AT.long} — which never crosses the wire, and neither does the raw timestamp the catalog endpoint ships beside its verdict`,
    `${r6h.out.claims?.result} — the area is the QUESTION; the position is not the answer`);
  // ...and the same question 200 km away, so the bit is answered rather than
  // assumed. Same shape, same wire, different place.
  const q6i = rp.buildRequest({ type: 'presentIn', operator: 'in', value: { lat: 50.85, long: 4.35, radiusM: 10000 } }, { swapAgeMin: 'P180D' });
  const r6i = await roundTrip(world, q6i);
  assert('presentIn answers a boolean about an area, both ways',
    r6h.verdict.accepted === true && r6h.out.claims.result === true
      && r6i.verdict.accepted === true && r6i.out.claims.result === false,
    `Paris → ${r6h.out.claims?.result}, Brussels → ${r6i.out.claims?.result}; the signed question is '${r6h.out.claims.predicate}'`);

  // NEGATIVE: the third state. A radius finer than the operator can resolve is a
  // question it CANNOT answer honestly, and this profile refuses it rather than
  // rounding it to yes or no — a rounded answer would be signed and, on the wire,
  // indistinguishable from a real one.
  const q6j = rp.buildRequest({ type: 'presentIn', operator: 'in', value: TOO_FINE_AREA }, { swapAgeMin: 'P180D' });
  const r6j = await roundTrip(world, q6j);
  // The last clause is not decoration and it is not a label: the refusal is
  // SCANNED. `PARTIAL` is the operator's own word for "I cannot resolve this
  // subscriber", which is a fact ABOUT the subscriber, so shipping it would be a
  // narrower leak than the verdict but a leak all the same — and a refusal
  // carries no predicate, so unlike the country it can never be the echoed
  // question.
  const partialHits = scan(withoutNonce(unpackSigned(r6j.out.plain).signed.payloadBytes.toString('utf8'), q6j.nonce), NEEDLES);
  flip(`a ${TOO_FINE_AREA.radiusM} m radius is REFUSED, not rounded — and the word PARTIAL never reaches the wire`,
    r6j.out.kind === 'reject' && r6j.verdict.refused === true && r6j.out.claims.result === undefined
      && partialHits.length === 0,
    `requester saw: '${r6j.verdict.reason}' — a signed refusal carrying no bit; scanned the refusal frame against all ${NEEDLES.length} needles → hits=${JSON.stringify(partialHits)}`);

  // ...and the policy is PUBLISHED and tighten-only, not hardcoded silently: a
  // request asking to have PARTIAL rounded for it is a LOOSENING, refused by the
  // same M3 gate that refuses a below-floor window. No parameter turns it on.
  const q6k = rp.buildRequest({ type: 'presentIn', operator: 'in', value: TOO_FINE_AREA }, { swapAgeMin: 'P180D', partialPolicy: 'round' });
  const r6k = await roundTrip(world, q6k);
  assert('asking the operator to ROUND its PARTIAL is refused by the floor gate',
    r6k.out.kind === 'reject' && r6k.out.floorRejected === true && r6k.verdict.refused === true
      && PUBLISHED_FLOOR.partialPolicy === 'refuse',
    `published policy '${PUBLISHED_FLOOR.partialPolicy}'; requester saw: '${r6k.verdict.reason}'`);

  // reachable — already one bit at full resolution, so nothing to quantise.
  const q6f = rp.buildRequest({ type: 'reachable', operator: 'eq', value: true }, { swapAgeMin: 'P180D' });
  const r6f = await roundTrip(world, q6f);
  await backend.setBackstory(DEMO_NUMBER, story({ reachable: false }), NOW);
  const q6g = rp.buildRequest({ type: 'reachable', operator: 'eq', value: true }, { swapAgeMin: 'P180D' });
  const r6g = await roundTrip(world, q6g);
  await backend.setBackstory(DEMO_NUMBER, story(), NOW);
  assert('reachable answers a flag, both ways',
    r6f.verdict.accepted === true && r6f.out.claims.result === true
      && r6g.verdict.accepted === true && r6g.out.claims.result === false,
    'CONNECTED_DATA/CONNECTED_SMS → true, NOT_CONNECTED → false; the status string stays operator-side');

  // numberMatch — the one predicate where the RAW VALUE the profile protects is
  // not a date or a place but a SCORE, and where the catalog's own response is
  // the thing that has to be withheld.
  const askMatch = (claimed, value) => rp.buildRequest({ type: 'numberMatch', operator: 'gte', value, claimed }, { swapAgeMin: 'P180D' });
  const q6l = askMatch(CLAIMED_NAME, 90);
  const r6l = await roundTrip(world, q6l);
  qa(`does the name I hold — "${CLAIMED_NAME}" — match this subscriber's registered name to at least 90?`,
    `the operator has "${REGISTERED_NAME}" on file; one letter apart, and its own similarity metric scores that ${NEAR_MISS_SCORE}`,
    `${r6l.out.claims?.result} — the requester learns that its tolerance is met, and NOT the score, and NOT the name`);
  const q6m = askMatch(WRONG_NAME, 90);
  const r6m = await roundTrip(world, q6m);
  const matchFrames = [[q6l, r6l], [q6m, r6m]];
  const scoreHits = matchFrames.flatMap(([q, r]) => scan(
    withoutNonce(unpackSigned(r.out.plain).signed.payloadBytes.toString('utf8'), q.nonce),
    [REGISTERED_NAME, String(NEAR_MISS_SCORE), 'nameMatchScore']));
  assert('numberMatch: threshold in, boolean out — the score and the registered name never cross',
    r6l.verdict.accepted === true && r6l.out.claims.result === true
      && r6m.verdict.accepted === true && r6m.out.claims.result === false
      && scoreHits.length === 0,
    `"${CLAIMED_NAME}" ≥90 → ${r6l.out.claims.result}, "${WRONG_NAME}" ≥90 → ${r6m.out.claims.result}; `
    + `both answer frames scanned for the score, the score's field name and the registered name → hits=${JSON.stringify(scoreHits)}`);

  // NEGATIVE: the free-choice threshold. This is the measured attack, not a
  // hypothetical one — against a GRADIENT a threshold walk does not merely
  // bracket a number, it tells the requester which guess was WARMER, and that
  // hill-climbs to the registered name itself.
  const q6n = askMatch(CLAIMED_NAME, 96);
  const r6n = await roundTrip(world, q6n);
  const q6o = askMatch(CLAIMED_NAME, 96);
  const r6o = await roundTrip(world, q6o, { operator: { skipMenu: true } });
  flip('an off-menu match threshold is refused; with the menu off, the same rung is ANSWERED',
    r6n.out.kind === 'reject' && r6n.out.menuRejected === true && r6n.verdict.refused === true
      && r6o.out.kind === 'answer' && r6o.verdict.accepted === true,
    `requester saw: '${r6n.verdict.reason}'. With the menu disabled it answers "${r6o.out.claims?.result}" to the ≥96 question — `
    + `one rung of a walk that ends at the subscriber's real registered name, because the operator's score is a gradient (${NEAR_MISS_SCORE} for one letter off, 53 for a wrong name) and not a band`);

  // ...and ONE scan across every answer this section produced, against the WIDENED
  // inventory. The needle set now carries the device instant's own spellings too,
  // because the review's lesson was that an inventory covering one value five ways
  // reads as complete and is not.
  const setFrames = [[q6a, r6a], [q6b, r6b], [q6d, r6d], [q6e, r6e], [q6f, r6f], [q6g, r6g],
    [q6h, r6h], [q6i, r6i], [q6j, r6j], [q6k, r6k], [q6l, r6l], [q6m, r6m], [q6n, r6n]];
  const setHits = [];
  const excluded = [];
  for (const [q, r] of setFrames) {
    const text = withoutNonce(unpackSigned(r.out.plain).signed.payloadBytes.toString('utf8'), q.nonce);
    const asked = r.out.claims.predicate;
    const useful = withoutAsked(NEEDLES, asked);
    excluded.push(NEEDLES.length - useful.length);
    setHits.push(...scan(text, useful));
  }
  assert('no raw value in ANY of these answers — the whole widened inventory, minus what the question itself asked',
    setHits.length === 0 && excluded.every((n) => n <= 1),
    `${setFrames.length} answer frames vs all ${NEEDLES.length} needles; per-frame needles excluded as requester-supplied = `
    + `${JSON.stringify(excluded)} (only the country set can exclude one) → hits=${JSON.stringify(setHits)}`);

  // ...and the set itself, counted rather than described. The headline of this
  // round is "3 → 6", and a reader is entitled to see the six answered in one
  // place — and to see that a SEVENTH is refused, because "wire only what a real
  // fact source answers" is the rule that produced this set and an enum that
  // answered for `tenure` would break it in the one direction that matters.
  const answered = [r1, r6a, r6d, r6f, r6h, r6l].map((r) => r.out.claims?.predicate?.split(' ')[0]);
  const q6p = rp.buildRequest({ type: 'tenure', operator: 'gte', value: 'P2Y' }, { swapAgeMin: 'P180D' });
  const r6p = await roundTrip(world, q6p);
  assert('six predicates answered, and a seventh nobody can compute is REFUSED',
    new Set(answered).size === 6 && answered.every((t) => typeof t === 'string')
      && r6p.out.kind === 'reject' && r6p.verdict.refused === true && r6p.out.claims.result === undefined,
    `answered: ${answered.join(', ')} — and tenure: '${r6p.verdict.reason}' (the data exists operator-side; no CAMARA read endpoint does)`);

  // ─────────────────────────────────────────── guards on the request path
  section('Guards on the request path (the two M6 decisions, 2026-08-17)');

  step('THRESHOLD MENU. Each response above is windowed and clean. A SEQUENCE of them');
  step('is not: the composition spike binary-searched this subscriber\'s exact swap age');
  step(`(${SWAPPED_DAYS_AGO} days, recovered exactly) in 9 legal, signed, metered queries. So the`);
  step('operator publishes a coarse menu and refuses anything off it — never rounding to');
  step('the nearest bucket, which would answer a question nobody asked.');
  const q5 = rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P137D' }, { swapAgeMin: 'P180D' });
  const r5 = await roundTrip(world, q5);
  qa('has the SIM been in place for at least 137 days? (a threshold of my own choosing)',
    'the exact question the oracle walk needs, and the reason the menu exists',
    'refused — off-menu, and the walk is capped at the bucket');
  assert('off-menu threshold refused, loudly, before any fact is read',
    r5.out.kind === 'reject' && r5.out.menuRejected === true && r5.verdict.refused === true,
    `requester saw: '${r5.verdict.reason}'`);
  const q5b = rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P365D' }, { swapAgeMin: 'P180D' });
  const r5b = await roundTrip(world, q5b);
  const q5c = rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P137D' }, { swapAgeMin: 'P180D' });
  const r5c = await roundTrip(world, q5c, { operator: { skipMenu: true } });
  flip('with the menu disabled, the SAME off-menu threshold is ANSWERED (the oracle re-opens)',
    r5c.out.kind === 'answer' && r5c.verdict.accepted === true,
    `it answers "${r5c.out.claims?.result}" to the 137-day question — one rung of the walk. On-menu questions are unaffected: P365D → ${r5b.out.claims?.result}`);
  note('honest limit: quantisation CAPS the oracle at ~2 bits, it does not close it. Per-subject');
  note('rate limits and per-query billing price the residual walk; a tighten-only repeat rule was');
  note('considered and NOT adopted (it slows the walk ~15x and does not stop it). CAMARA proposal §3.5.');

  out('');
  step('DUPLICATE KEYS. A request is signed bytes too. Bytes carrying `floor` twice read');
  step('as P90D to a last-wins parser and P365D to a first-wins one — one signature, two');
  step('readings, and each side believes a different floor was agreed.');
  const dupText = JSON.stringify({ number: DEMO_NUMBER, predicate: PREDICATE, floor: { swapAgeMin: 'P365D' }, nonce: 'dup-nonce-01' })
    .replace('"nonce"', '"floor":{"swapAgeMin":"P90D"},"nonce"');
  const dupBytes = Buffer.from(dupText, 'utf8');
  const dupSealed = seal(keys.opEnc.publicKey, packSigned({ payloadBytes: dupBytes, signature: edSign(null, dupBytes, keys.rpSig.privateKey) }, keys.rpIss));
  const dupOut = await world.operator.handle(hub.route(keys.rpIss, keys.opIss, dupSealed));
  assert('duplicate-key request refused outright — no partial acceptance, no picking a value',
    dupOut.kind === 'reject' && dupOut.reason.startsWith('duplicate top-level key'),
    `reason='${dupOut.reason}'; the remedy is a clean re-request with a fresh nonce`);
  const dupCtrl = await world.operator.handle(hub.route(keys.rpIss, keys.opIss, dupSealed), { skipDupKeyScan: true });
  flip('with the scan disabled, the SAME ambiguous bytes get a signed answer',
    dupCtrl.kind === 'answer',
    `V8 read the LAST floor (${JSON.parse(dupText).floor.swapAgeMin}); a first-wins parser reads P365D — same signature, different agreement`);

  out('');
  step('KEY PINNING. `iss` travels outside the signature, so it is a lookup hint only.');
  const side = { predicate: canonicalPredicate(PREDICATE), result: true, nonce: 'side-nonce', exp: NOW + VALIDITY_MS };
  const sideSealed = seal(keys.rpEnc.publicKey, packSigned(attest(keys.rpSig.privateKey, side), keys.rpIss));
  rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  const sidePinned = rp.verifyResponse(sideSealed, 'side-nonce', NOW + 1_000);
  assert('an answer from a DIFFERENT directory-listed party is rejected',
    sidePinned.accepted === false && sidePinned.reason === 'bad signature', `reason='${sidePinned.reason}'`);
  rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  flip('letting the unsigned `iss` pick the key ACCEPTS that same answer',
    rp.verifyResponse(sideSealed, 'side-nonce', NOW + 1_000, { trustIssHint: true }).accepted === true,
    'profile rule 3\'s exact attack, live in the composition: any listed operator could answer for any other');

  out('');
  step('ENVELOPE CAPACITY IS THE RECIPIENT\'S, NOT A CONSTANT (2026-08-18 fix round).');
  step('`OAEP_CAPACITY` (446 B) is only correct for an RSA-4096 recipient; the pre-seal');
  step('guard above derives the real cap from `recipientEnc` itself, exactly as `seal()`');
  step('does — so a smaller-key requester gets a graceful, signed refusal, never a crash.');
  const smallKeys = generateKeys();
  smallKeys.rpEnc = generateKeyPairSync('rsa', { modulusLength: 3072 });   // real cap 318 B, under the 446 B constant
  const smallWorld = createWorld({ backend, keys: smallKeys });
  const q7 = smallWorld.rp.buildRequest(
    { type: 'roamingIn', operator: 'in', value: ['AB', 'BC', 'CD', 'DE', 'EF'] },
    { swapAgeMin: 'P180D' },
  );
  const r7 = await roundTrip(smallWorld, q7);
  assert('a recipient with a SMALLER-than-4096 envelope key gets a graceful refusal, not a thrown exception',
    r7.out.kind === 'reject' && r7.verdict.refused === true && r7.out.reason === 'answer does not fit one envelope',
    `RSA-3072 real cap 318 B < the RSA-4096 OAEP_CAPACITY constant (446 B); requester saw: '${r7.verdict.reason}'`);

  // ───────────────────────────────────────────────────────────── the notes
  section('Notes the reader is owed');
  out('   1. THE SUBSCRIBER NUMBER. It rides INSIDE the sealed, signed request, so the hub');
  out('      never sees it — but it IS in the request. That is a demo stand-in for');
  out('      token-derived identity: a real 3-legged deployment derives the subject from');
  out('      the access token instead of asking for an identifier — the shape CAMARA\'s');
  out('      own `GET /device-phone-number` already takes (no request body at all),');
  out('      generalised by v1\'s now-dropped profile rule 4 — v2 REQUIRES phoneNumber instead.');
  out('   2. THE THRESHOLD MENU is this profile\'s answer to the oracle above, not a CAMARA');
  out('      requirement — the normative profile enumerates no predicate types or thresholds.');
  out('   3. THE NONCE STORE ONLY GROWS. A request that never receives a response leaves');
  out('      its nonce resident forever; a real deployment evicts on expiry (the answer\'s');
  out('      validity window is already the TTL). Stated, not built — see createRP.');
  out('   4. TWO RESIDUALS THIS PREDICATE SET ADDS, stated rather than closed. An AREA is a');
  out('      dial (centre plus radius) and is walkable toward a position the way a duration');
  out('      threshold is bisectable; presentIn gets no bucket menu, so the cap is the');
  out('      operator\'s own resolution plus rate limits and per-query billing — weaker than');
  out('      the duration menu, and said to be weaker. And numberMatch discloses in the OTHER');
  out('      direction: the operator learns the name the requester claims. That is inherent');
  out('      to a comparison, and profile mode does not narrow it.');
  out('   5. WHAT THIS IS NOT. The operator shim simulates operator-side computation and');
  out('      signing; consent and legal-basis legs are out of scope. Mode A keeps the');
  out('      operator-side query log — the operator always knows who asked about whom.');
  out('      And this is attested windowed disclosure, NOT zero-knowledge: the operator');
  out('      knows the answer it signed. ZK language is reserved for Mode B.');

  const passed = results.filter(Boolean).length;
  out('');
  out(`RESULT: ${passed}/${results.length}`);
  return passed === results.length ? 0 : 1;
}

// ═══════════════════════════════ entry point ═════════════════════════════════
export function parseArgs(argv) {
  let backend = 'mock';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') { backend = argv[++i]; continue; }
    if (a.startsWith('--backend=')) { backend = a.slice('--backend='.length); continue; }
    return { error: `unknown argument: ${JSON.stringify(a)}` };
  }
  if (backend !== 'mock' && backend !== 'orange') {
    return { error: `unknown backend: ${JSON.stringify(backend)} (use mock or orange)` };
  }
  return { backend };
}

const PREREQS = [
  'PREREQUISITES for --backend orange (nothing was answered, and nothing fell back):',
  '  1. A free Orange developer account with a Network APIs Playground app',
  '     (developer.orange.com → My Apps → Add an API → Network APIs Playground).',
  '  2. The app\'s Basic Auth string in the ENVIRONMENT, never in the tree:',
  '       ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node camara/v2/poc/demo.mjs --backend orange',
  '  3. Network reachability to api.orange.com.',
  '  4. A free custom-number slot (the demo scripts ' + DEMO_NUMBER + '; the app allows 10).',
  '',
  'There is deliberately no silent fallback to the mock backend: a demo that',
  '"worked" without credentials would make the live run prove nothing.',
];

// `createBackendImpl` is dependency injection for the same reason `fetchImpl`
// is, and it is the same shape: ONE code path, no test-only branch. The M6
// check needs a backend that STARTS and then throws mid-run, because that is the
// only way to exercise the exit-code contract below end-to-end — and the whole
// point of that contract is that a started-then-failed mock run is a code
// regression. A mapping table asserted in isolation would pin the arithmetic
// while leaving the propagation untested.
export async function main(argv = process.argv.slice(2), { createBackendImpl = createBackend } = {}) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(`${args.error}\nusage: node camara/v2/poc/demo.mjs [--backend mock|orange]`);
    return 2;
  }
  let backend;
  try {
    backend = await createBackendImpl(args.backend, { basicAuth: process.env.ORANGE_BASIC_AUTH });
  } catch (e) {
    console.error(`backend '${args.backend}' could not start: ${e instanceof Error ? e.message : String(e)}\n`);
    if (args.backend === 'orange') console.error(PREREQS.join('\n'));
    return 2;
  }
  try {
    return await runDemo(backend);
  } catch (e) {
    // Exit 2 means THE CHOSEN BACKEND COULD NOT RUN, and it is reserved for the
    // case where that is actually true. Under --backend orange a mid-run throw
    // is a prerequisite failure: the live operator went unreachable, and the run
    // proves nothing about the code. Under --backend mock there are NO
    // prerequisites — no credential, no network, nothing to be unavailable — so
    // the only thing a mid-run throw can be is a code regression, and that is a
    // failed run: exit 1. Reporting it as 2 would be the flattering lie, because
    // a gate that skips on 2 would silently swallow the regression.
    console.error(`\nrun aborted: ${e instanceof Error ? e.message : String(e)}`);
    if (args.backend === 'orange') {
      console.error(`\n${PREREQS.join('\n')}`);
      return 2;
    }
    return 1;
  }
}

// Only when RUN, never when imported — camara/v2/poc/m6-check.mjs imports the seams above
// and drives them itself.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}

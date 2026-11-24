// PoC module V3-M1 (built on the V2-M1 core) — JWS (RFC 7515, EdDSA) attestation core. NEW module, built
// alongside the raw-Ed25519 `m1-attestation.mjs` (untouched, still what M2/M6/
// demo run on). Caller migration to this module is V3-M4 (user decision
// 2026-11-23; it was V2-M3, never run).
//
// V3-M1 (this copy, camara/v3/poc): an answer schema now carries a fixed `api`
// value (SIM_SWAP_CHECK, TENURE_CHECK, both on Sync26); attestAnswer writes it
// into the payload, verifyAnswer rejects a payload whose `api` differs or is
// absent (API_MISMATCH). `api` is NOT in the shared base set, so the refusal
// profile is unchanged. `attachAttestation` is the caller-level rule: it BUILDS
// the signed response (answer + `attestation` only) and, with no nonce, returns
// today's response unchanged.
//
// V3-M2: refusals are now API-bound. attestRefusal takes the API and writes an
// `api` claim; verifyRefusal takes `expectedApi` and rejects a mismatch or an
// absent claim (API_MISMATCH), as verifyAnswer does. The refusal reason
// OFF_MENU_THRESHOLD is renamed OUT_OF_RANGE (Sync26's code); UNAVAILABLE
// stays. Each answer schema carries a signed `entry` claim (a duration such as
// P90D): the published-menu entry the question was answered against. It is the
// ONLY signed question claim; the Sync26 request field is not signed.
// This module checks the TYPE of the question and of `entry` only; whether
// the question is on the operator's menu is enforced by menu.mjs, before any
// backend read.
//
// Two layers:
//   Layer 1 — signJws/verifyJws: a generic, payload-agnostic JWS compact
//     primitive. It knows nothing about attestation claims.
//   Layer 2 — attestAnswer/verifyAnswer and attestRefusal/verifyRefusal: two
//     closed-claim-set profiles built on layer 1, matching
//     `camara/v2/docs/camara-attested-windowed-disclosure.md` §4.
//
// Zero dependencies: node:crypto and vanilla JS only.
import { sign, verify } from 'node:crypto';
import { hasDuplicateTopLevelKey } from './m1-attestation.mjs';

// ---------------------------------------------------------------------------
// Typed reasons. Classified by `instanceof`, never by message text.
// ---------------------------------------------------------------------------

// Every layer-1 failure — malformed token, wrong alg, unknown kid, bad
// signature, unparseable/duplicate-keyed payload — collapses to ONE reason,
// same message, same class. Mirrors M2's `open()`: telling failure modes
// apart in the reason text would build an oracle for an attacker probing
// which check failed first.
export class JwsRejected extends Error {
  constructor() {
    super('invalid JWS');
    this.name = 'JwsRejected';
  }
}

// Layer-2 claim-shape/claim-value failures. Unlike JwsRejected these MAY
// carry distinct machine-readable `code`s (closed-set violations, iss/aud
// mismatch, expiry, nonce reuse) — callers branch on `.code`, never on
// `reason.message`.
export class ClaimRejected extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ClaimRejected';
    this.code = code;
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype;
}

// D1 FIX: own-key membership only, never the `in` operator. `in` walks the
// prototype chain, so on a plain object literal a key named after any
// Object.prototype member (`constructor`, `toString`, `__proto__`, ...)
// reads as present even when never actually set — that bypassed the
// EXTRA_CLAIM closed-set check below and let an operator-signed token carry
// an unbounded raw claim under a prototype-member name straight through
// verifyAnswer. Used at every membership test keyed by an external
// (payload) or schema-controlled (extraFields/BASE_FIELDS) string.
function hasOwn(obj, k) {
  return Object.prototype.hasOwnProperty.call(obj, k);
}

// D1 FIX, defense in depth: copies out ONLY the claims named in
// `allowedFields`, never the raw decoded payload object. Even if
// checkClosedPayload's EXTRA_CLAIM guard were ever bypassed or weakened by
// a future edit, a caller could never observe a claim outside the declared
// set through the object verifyAnswer/verifyRefusal hand back.
function projectClaims(payload, allowedFields) {
  const out = {};
  for (const k of Object.keys(allowedFields)) {
    if (hasOwn(payload, k)) {
      // `out[k] = payload[k]` would, for k === '__proto__', invoke the
      // exotic Object.prototype.__proto__ SETTER instead of creating a data
      // property — the claim would silently fail to round-trip. Same
      // prototype-chain hazard this whole fix closes, one call deeper.
      // defineProperty always creates an own data property regardless of
      // key name.
      Object.defineProperty(out, k, { value: payload[k], enumerable: true, writable: true, configurable: true });
    }
  }
  return out;
}

function jwsReject() {
  return { ok: false, reason: new JwsRejected() };
}

// ---------------------------------------------------------------------------
// Layer 1 — generic JWS compact primitive.
// ---------------------------------------------------------------------------

// Sender side. `payload` is the sender's OWN data — an invalid shape is a
// caller bug, so it is a typed refusal object, never a throw (the caller
// checks `typeof result === 'string'` for success, exactly like M2's
// seal/open split between "my own data" throwing and "wire data" refusing —
// except here BOTH directions refuse, since a bad kid/payload is caught
// before anything touches the network).
/**
 * @returns {string|{ok: false, reason: JwsRejected}} On success, the compact
 *   JWS string `header.payload.signature` (base64url, dot-joined). On
 *   failure, `{ok: false, reason}` where `reason` is always a `JwsRejected`
 *   instance. The two shapes never overlap — a `string` is always success,
 *   an object is always failure. FAILS CLOSED: discriminate with
 *   `typeof result === 'string'` for success (as this function's own
 *   callers below do) — never index into the result expecting a token
 *   without that check, or a `{ok:false,...}` refusal object gets treated
 *   as signed data.
 */
export function signJws(privateKey, kid, payload) {
  if (typeof kid !== 'string' || kid.length === 0) {
    return jwsReject();
  }
  if (!isPlainObject(payload)) {
    return jwsReject();
  }
  let payloadText;
  try {
    payloadText = JSON.stringify(payload);
  } catch {
    return jwsReject();
  }
  if (typeof payloadText !== 'string') {
    return jwsReject();
  }
  // Structurally near-unreachable for a JS object literal (JS collapses
  // duplicate keys before this function ever sees them) — kept anyway so
  // signing and verifying share the exact same scanner and neither can
  // silently drift from the other.
  if (hasDuplicateTopLevelKey(payloadText)) {
    return jwsReject();
  }
  const header = { alg: 'EdDSA', kid };
  const h = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const p = Buffer.from(payloadText, 'utf8').toString('base64url');
  const signingInput = `${h}.${p}`;
  let signature;
  try {
    signature = sign(null, Buffer.from(signingInput, 'ascii'), privateKey);
  } catch {
    return jwsReject();
  }
  return `${signingInput}.${signature.toString('base64url')}`;
}

// Recipient side. `token` is UNTRUSTED WIRE INPUT — never throws, on any
// input, including garbage strings. `resolveKey(kid)` is caller-supplied and
// is the ONLY place a public key comes from: the trust directory stays
// outside the token, so a token can never select its own verification key.
export function verifyJws(token, resolveKey) {
  try {
    if (typeof token !== 'string') return jwsReject();
    const parts = token.split('.');
    if (parts.length !== 3) return jwsReject();
    const [h, p, s] = parts;
    if (h.length === 0 || p.length === 0 || s.length === 0) return jwsReject();

    let header;
    try {
      header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    } catch {
      return jwsReject();
    }
    if (!isPlainObject(header)) return jwsReject();
    const headerKeys = Object.keys(header);
    if (headerKeys.length !== 2 || !('alg' in header) || !('kid' in header)) {
      return jwsReject();
    }
    if (header.alg !== 'EdDSA') return jwsReject();
    if (typeof header.kid !== 'string' || header.kid.length === 0) return jwsReject();

    let key = null;
    try {
      key = resolveKey(header.kid);
    } catch {
      key = null;
    }
    if (!key) return jwsReject();

    let sigBuf;
    try {
      sigBuf = Buffer.from(s, 'base64url');
    } catch {
      return jwsReject();
    }
    const signingInput = Buffer.from(`${h}.${p}`, 'ascii');
    let sigOk = false;
    try {
      sigOk = verify(null, signingInput, key, sigBuf);
    } catch {
      return jwsReject();
    }
    if (!sigOk) return jwsReject();

    let payloadText;
    try {
      payloadText = Buffer.from(p, 'base64url').toString('utf8');
    } catch {
      return jwsReject();
    }
    // Same ambiguity M1 closed: JSON.parse is last-wins, other parsers
    // first-wins, so a signature-valid duplicate-keyed payload could read
    // differently to two verifiers — reject at the byte level, before parse.
    if (hasDuplicateTopLevelKey(payloadText)) return jwsReject();

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      return jwsReject();
    }
    if (!isPlainObject(payload)) return jwsReject();

    return { ok: true, header, payload };
  } catch {
    // Backstop only — every path above already returns rather than throws.
    return jwsReject();
  }
}

export function compactSize(token) {
  return Buffer.byteLength(token, 'utf8');
}

// ---------------------------------------------------------------------------
// Layer 2 — answer and refusal profiles.
// ---------------------------------------------------------------------------

const BASE_FIELDS = { iss: 'string', aud: 'string', nonce: 'string', iat: 'integer', exp: 'integer' };

// The refusal profile's one extra claim, hoisted to a single named constant
// (was four separate inline `{ error: 'string' }` literals, one at each
// call site below). `checkNoReservedCollision`/`checkClosedPayload` guard
// this constant against colliding with `BASE_FIELDS`, exactly as they guard
// an answer schema's `params`/`answer` fields. Honest note: with the
// current single-key value, that guard is structurally unreachable —
// `error` never collides with any `BASE_FIELDS` name — so it cannot fire
// today. It stays wired so that if a future edit ever adds a colliding key
// to REFUSAL_FIELDS, the guard catches it instead of silently clobbering a
// base claim, the same failure class the reserved-claim clobber fix above
// closed for the answer profile.
const REFUSAL_FIELDS = Object.freeze({ error: 'string' });
// V3-M2: a refusal also names its API. `api` is NOT a caller-suppliable base
// claim (same rule as answers): it comes from attestRefusal's `api` argument.
const REFUSAL_WIRE_FIELDS = Object.freeze({ api: 'string', ...REFUSAL_FIELDS });

// V3-M1: 'date' = YYYY-MM-DD that is a real calendar date (round-trips through
// Date.UTC fields), nothing else: no time part, no short forms, no 02-30.
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), d = Number(value.slice(8, 10));
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// 'duration' = a published-menu entry, P<n>D or P<n>Y (1Y = 365D, the repo's
// duration grammar), n in 0..2^53-1 with no leading zero. Returns the days, or
// null. P0D parses to 0: callers (typeOk here, menu.mjs) reject it. The one
// duration parser (menu.mjs imports it).
export function parseDuration(s) {
  if (typeof s !== 'string') return null;
  const m = /^P(0|[1-9][0-9]{0,15})([DY])$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n)) return null;
  const days = m[2] === 'Y' ? n * 365 : n;
  return Number.isSafeInteger(days) ? days : null;
}

function typeOk(type, value) {
  if (type === 'string') return typeof value === 'string' && value.length > 0;
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'date') return isCalendarDate(value);
  if (type === 'duration') { const d = parseDuration(value); return d !== null && d > 0; }
  return false;
}

// Shared by BOTH construction (attestAnswer/attestRefusal, before signing)
// and verification (verifyAnswer/verifyRefusal, after decoding) — one
// definition of "closed" that both sides run, so they cannot drift apart.
// `extraFields` = the profile's own claims on top of the five base ones
// (schema.params ∪ schema.answer for an answer, {error:'string'} for a
// refusal), each mapped to its required type.
function checkClosedPayload(payload, extraFields) {
  if (!isPlainObject(payload)) {
    return new ClaimRejected('MALFORMED_PAYLOAD', 'payload must be a plain object');
  }
  const allowed = { ...BASE_FIELDS, ...extraFields };
  const allowedKeys = Object.keys(allowed);
  const payloadKeys = Object.keys(payload);
  for (const k of allowedKeys) {
    if (!hasOwn(payload, k)) return new ClaimRejected('MISSING_CLAIM', `missing claim: ${k}`);
  }
  for (const k of payloadKeys) {
    if (!hasOwn(allowed, k)) return new ClaimRejected('EXTRA_CLAIM', `unexpected claim: ${k}`);
  }
  for (const k of allowedKeys) {
    if (!typeOk(allowed[k], payload[k])) return new ClaimRejected('WRONG_TYPE', `wrong type for claim: ${k}`);
  }
  if (!(payload.exp > payload.iat)) {
    return new ClaimRejected('EXP_NOT_AFTER_IAT', 'exp must be strictly after iat');
  }
  return null;
}

// Fails closed on a schema field that would clobber a base claim's NAME and
// VALUE at merge time (`{...base, ...params, ...answer}`/`{...BASE_FIELDS,
// ...extraFields}` are both last-key-wins). PROVEN exploit: schema
// `{params:{iat:'boolean'}}` with `params={iat:true}` signed a payload
// carrying `"iat":true`, which coerces truthy and defeated the `exp > iat`
// sanity guard. Checked from this one shared definition at BOTH construction
// (attestAnswer/attestRefusal, before the payload is built) and verification
// (verifyAnswer/verifyRefusal, before checkClosedPayload runs), so the two
// sides cannot drift apart.
function checkNoReservedCollision(extraFields) {
  for (const k of Object.keys(extraFields)) {
    if (hasOwn(BASE_FIELDS, k)) {
      return new ClaimRejected('RESERVED_CLAIM', `schema claim collides with a reserved base claim: ${k}`);
    }
  }
  return null;
}

// Fails closed on an answer schema whose OWN two halves collide with each
// other. `checkNoReservedCollision` cannot see this: it receives
// `extraFields = {...schema.params, ...schema.answer}`, which is ALREADY
// merged, so a name present in both halves has already lost the collision
// information before that check ever runs. PROVEN: schema
// `{params:{swapped:'integer'}, answer:{swapped:'boolean'}}` with
// `params={swapped:5}` signed a payload carrying `"swapped":true` —
// `{...base, ...params, ...answer}` is last-key-wins, so the caller's
// `params.swapped:5` silently vanished with no error. Checked from this one
// definition at BOTH construction (attestAnswer, before the payload is
// built) and verification (verifyAnswer), so the two sides cannot drift
// apart, exactly as `checkNoReservedCollision` is.
function checkNoSelfCollision(paramsFields, answerFields) {
  for (const k of Object.keys(paramsFields)) {
    if (hasOwn(answerFields, k)) {
      return new ClaimRejected('SCHEMA_SELF_COLLISION', `schema params/answer both name claim: ${k}`);
    }
  }
  return null;
}

// Fails closed on an answer schema whose `answer` half declares ZERO own
// keys. The trap: a literal `__proto__:` key in an object initializer sets
// the object's PROTOTYPE rather than creating a property — a developer
// writing `answer: { __proto__: 'boolean' }` where they meant a computed
// key (`{ [name]: 'boolean' }`) gets a schema.answer that silently has no
// own fields at all, with no error at schema-definition time. The mistake
// then surfaces later, if at all, as a confusing MISSING_CLAIM far from the
// actual cause. `schema.params` MAY legitimately be empty (roaming/
// reachability predicates have no query value), so this checks only the
// answer half, never params. Checked from this one definition at BOTH
// construction (attestAnswer, before the payload is built) and
// verification (verifyAnswer), so the two sides cannot drift apart, exactly
// as checkNoReservedCollision/checkNoSelfCollision already are.
function checkAnswerNotEmpty(answerFields) {
  if (Object.keys(answerFields).length === 0) {
    return new ClaimRejected('EMPTY_ANSWER_SCHEMA', 'schema.answer must declare at least one field');
  }
  return null;
}

function verifyRequesterChecks(payload, { expectedIss, expectedAud, nonceStore, now }) {
  if (payload.iss !== expectedIss) return new ClaimRejected('ISS_MISMATCH', 'iss mismatch');
  if (payload.aud !== expectedAud) return new ClaimRejected('AUD_MISMATCH', 'aud mismatch');
  if (!(typeof now === 'number' && payload.exp > now)) return new ClaimRejected('EXPIRED', 'expired');
  let consumed = false;
  try {
    consumed = nonceStore.consume(payload.nonce) === true;
  } catch {
    consumed = false;
  }
  if (!consumed) return new ClaimRejected('NONCE_REJECTED', 'nonce unknown or already used');
  return null;
}

// The named schema. V3-M2 (user decision 2026-11-23, "sign entry only"): a
// signed answer carries the five base claims, the fixed `api` claim, the
// menu `entry` (a duration such as P90D) and the answer key: seven claims.
// The Sync26 request field (`maxAge`, `tenureDate`) is NOT signed: the
// operator maps it to the entry (menu.mjs) before any read, so no hours value
// and no date appears in any signed answer. Each answer schema carries its
// fixed `api` value (the CAMARA URL path segment); a caller can never supply
// its own.
// The signer checks the entry's type only (a positive duration). attestAnswer and
// attachAttestation do NOT check the menu or the per-API cap (SimSwap <= 2400 h):
// an operator MUST call answerWithMenu (menu.mjs) first and sign only the entry it
// returns. V3-M4 (caller migration) joins the two. The requester's `expectedEntry`
// check (verifyAnswer) closes the requester side.
export const SIM_SWAP_CHECK = Object.freeze({
  api: 'sim-swap/v2/check',
  params: Object.freeze({ entry: 'duration' }),
  answer: Object.freeze({ swapped: 'boolean' }),
});

// V3-M1: Tenure on Sync26 (kyc-tenure v0.3, POST /check-tenure). Today's
// response also carries `contractType`; a signed response leaves it out
// (attachAttestation builds the response from the answer keys only).
export const TENURE_CHECK = Object.freeze({
  api: 'kyc-tenure/v0.3/check-tenure',
  params: Object.freeze({ entry: 'duration' }),
  answer: Object.freeze({ tenureDateCheck: 'boolean' }),
});

// The closed set of API names a refusal may carry (attestRefusal / verifyRefusal).
// A new answer schema must add its `api` here, or it can sign answers but not
// refusals. Kept as a literal list on purpose: a refusal's `api` must never be
// a value the caller chose.
export const KNOWN_APIS = Object.freeze([SIM_SWAP_CHECK.api, TENURE_CHECK.api]);

// Fails closed on a caller who tries to supply `api` (in base, params or
// answer) or on a schema whose params/answer name `api`: the value comes
// from the schema only. Closest existing typed code: RESERVED_CLAIM.
// `attestation` is reserved the same way: it is the response member that
// carries the token, so no signed claim may share its name.
function checkApiNotCallerSupplied(...objs) {
  for (const o of objs) {
    if (hasOwn(o, 'api')) return new ClaimRejected('RESERVED_CLAIM', 'api is set by the schema, never by the caller');
    if (hasOwn(o, 'attestation')) return new ClaimRejected('RESERVED_CLAIM', 'attestation is a reserved claim name');
  }
  return null;
}

// A schema must carry its own fixed `api` value (fail closed if absent).
function checkSchemaApi(schema) {
  if (!hasOwn(schema, 'api') || typeof schema.api !== 'string' || schema.api.length === 0) {
    return new ClaimRejected('MALFORMED_INPUT', 'answer schema must carry a non-empty api');
  }
  return null;
}

// Caller-level rule, spec V3-M1 §2: no requester nonce -> no attestation.
// `attachAttestation(body, nonce, opts)` with opts = { privateKey, kid, base,
// schema, params } BUILDS the signed response; it never filters `body`.
//  - body not a plain object (or the check itself throws, e.g. a Proxy trap):
//    TypeError. Otherwise this function throws ONLY AttestationFailed (any
//    other throw, e.g. a throwing getter or a null `opts`, is wrapped with
//    `cause`).
//  - nonce `undefined`: return a plain shallow copy of `body`, unchanged
//    (today's Sync26 response, not profile mode). Nothing else is checked.
//  - nonce not a non-empty string: AttestationFailed.
//  - schema api/params/answer are read ONCE into snapshots; each answer value
//    is read ONCE from `body` (the key must be an own key of `body`, else
//    AttestationFailed); `base` must be a plain object without its own nonce.
//  - attestAnswer fails (returns a non-string): AttestationFailed, cause =
//    the refusal reason. The unsigned body is never returned.
//  - success: a NEW object made ONLY of the answer keys (the snapshot values
//    that were signed) and then `attestation`. Nothing else from `body` is
//    copied, so no raw field, extra field or forged `attestation` can ride
//    beside the signature.
// Scope: this module checks the type of `entry` only; whether the question is
// on the operator's menu is menu.mjs (V3-M2).
export class AttestationFailed extends Error {
  constructor(message, options) {
    super(message || 'attestation failed', options);
    this.name = 'AttestationFailed';
  }
}

function defineOwn(o, k, v) {
  Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
}

// One read of a flat plain-object map (schema.answer / schema.params).
function snapshotMap(raw) {
  if (!isPlainObject(raw)) return raw;
  const snap = {};
  for (const k of Object.keys(raw)) defineOwn(snap, k, raw[k]);
  return snap;
}

export function attachAttestation(body, nonce, opts) {
  let bodyOk;
  try {
    bodyOk = isPlainObject(body);
  } catch {
    throw new TypeError('body must be a plain object');
  }
  if (!bodyOk) throw new TypeError('body must be a plain object');
  try {
    if (nonce === undefined) return { ...body };
    if (typeof nonce !== 'string' || nonce.length === 0) {
      throw new AttestationFailed('nonce must be a non-empty string');
    }
    const { privateKey, kid, base, schema, params } = opts;
    if (!isPlainObject(schema)) throw new AttestationFailed('schema must be a plain object');
    const rawAnswer = schema.answer;
    const rawParams = schema.params;
    if (!isPlainObject(rawAnswer)) throw new AttestationFailed('schema.answer must be a plain object');
    const answerSnap = snapshotMap(rawAnswer);
    const schemaSnap = {};
    if (hasOwn(schema, 'api')) defineOwn(schemaSnap, 'api', schema.api);
    defineOwn(schemaSnap, 'params', snapshotMap(rawParams));
    defineOwn(schemaSnap, 'answer', answerSnap);
    const answer = {};
    for (const k of Object.keys(answerSnap)) {
      if (!hasOwn(body, k)) throw new AttestationFailed('body is missing an answer key');
      defineOwn(answer, k, body[k]);
    }
    if (!isPlainObject(base) || hasOwn(base, 'nonce')) {
      throw new AttestationFailed('base must be a plain object without its own nonce');
    }
    const token = attestAnswer(privateKey, kid, { ...base, nonce }, schemaSnap, params, answer);
    if (typeof token !== 'string') {
      throw new AttestationFailed('attestation could not be signed', { cause: token && token.reason });
    }
    const out = {};
    for (const k of Object.keys(answerSnap)) defineOwn(out, k, answer[k]);
    defineOwn(out, 'attestation', token);
    return out;
  } catch (e) {
    if (e instanceof AttestationFailed) throw e;
    throw new AttestationFailed('attestation failed', { cause: e });
  }
}

// Closed refusal-reason enum. A refusal is signed too — a signed excuse is
// still an attestation, so its `error` value must come from a fixed menu,
// not free text an operator could smuggle a raw value into.
export const OUT_OF_RANGE = 'OUT_OF_RANGE';
export const UNAVAILABLE = 'UNAVAILABLE';
export const REFUSAL_REASONS = Object.freeze([OUT_OF_RANGE, UNAVAILABLE]);

// `base` = { iss, aud, nonce, iat, exp } — the five claims shared by both
// profiles. `schema` = { api, params: {name:type}, answer: {name:type} }.
// Key order: the payload is `{...base, api, ...params, ...answer}`. Order is
// not load-bearing for verification (object equality doesn't care). With a
// base of {iss,aud,nonce,iat,exp}, attestAnswer signs
// iss,aud,nonce,iat,exp,api,...; attachAttestation passes `{...base, nonce}`
// and so signs iss,aud,iat,exp,nonce,api,....
/**
 * @returns {string|{ok: false, reason: ClaimRejected|JwsRejected}} Returns
 *   exactly what `signJws` returns — this function has no success shape of
 *   its own. On success, the compact JWS string. On failure, `{ok: false,
 *   reason}` where `reason` is a `ClaimRejected` (schema/self-collision/
 *   empty-answer/closed-payload check failing before signing is ever
 *   attempted) or a `JwsRejected` (propagated unchanged from `signJws`,
 *   e.g. a malformed kid). FAILS CLOSED: discriminate with
 *   `typeof result === 'string'` for success, exactly as `signJws` callers
 *   must — never read the result as a token without that check.
 */
export function attestAnswer(privateKey, kid, base, schema, params, answer) {
  // D2 FIX backstop: base/schema.params/schema.answer/params/answer are
  // caller-supplied objects that may carry a throwing getter or a Proxy
  // trap; every check below this line reads their properties, so any such
  // throw is caught here and collapsed to the same typed rejection the
  // shape guard already returns, rather than escaping as an uncaught
  // TypeError/Error. Must not swallow a MORE SPECIFIC typed rejection —
  // every branch below still returns its own code before this catch could
  // ever see it; only a genuine throw reaches here.
  try {
    if (!isPlainObject(base) || !isPlainObject(schema) ||
        !isPlainObject(schema.params) || !isPlainObject(schema.answer) ||
        !isPlainObject(params) || !isPlainObject(answer)) {
      return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base/schema/params/answer must be plain objects') };
    }
    const schemaApiErr = checkSchemaApi(schema);
    if (schemaApiErr) return { ok: false, reason: schemaApiErr };
    const apiSuppliedErr = checkApiNotCallerSupplied(base, params, answer, schema.params, schema.answer);
    if (apiSuppliedErr) return { ok: false, reason: apiSuppliedErr };
    const answerEmptyErr = checkAnswerNotEmpty(schema.answer);
    if (answerEmptyErr) return { ok: false, reason: answerEmptyErr };
    const extraFields = { ...schema.params, ...schema.answer };
    const collisionErr = checkNoReservedCollision(extraFields);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const selfCollisionErr = checkNoSelfCollision(schema.params, schema.answer);
    if (selfCollisionErr) return { ok: false, reason: selfCollisionErr };
    const payload = { ...base, api: schema.api, ...params, ...answer };
    const err = checkClosedPayload(payload, { api: 'string', ...extraFields });
    if (err) return { ok: false, reason: err };
    return signJws(privateKey, kid, payload);
  } catch {
    return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base/schema/params/answer must be plain objects') };
  }
}

/**
 * @returns {{ok: true, claims: object}|{ok: false, reason: JwsRejected|ClaimRejected}}
 *   On success, `{ok: true, claims}` where `claims` is the schema-projected
 *   claim set only (base ∪ api ∪ schema.params ∪ schema.answer — never the raw
 *   decoded payload; see `projectClaims`). On failure, `{ok: false, reason}`
 *   where `reason` is a `JwsRejected` (propagated from `verifyJws` —
 *   malformed token, bad signature, unknown kid) or a `ClaimRejected`
 *   (schema/closed-set/type/requester check failing, carrying a
 *   machine-readable `.code`). FAILS CLOSED: both branches are plain
 *   objects, so `typeof` cannot distinguish them — discriminate with
 *   `.ok === true` / `.ok === false` only; never read `.claims` without
 *   checking `.ok` first, since a failure object simply has no `claims`
 *   key and would read back as `undefined` rather than throw.
 */
export function verifyAnswer(token, resolveKey, schema, { expectedIss, expectedAud, expectedEntry, nonceStore, now }) {
  const r = verifyJws(token, resolveKey);
  if (!r.ok) return r;
  // `attestAnswer` guards schema/schema.params/schema.answer before ever
  // touching them; this side did not, so `checkNoSelfCollision`'s
  // `Object.keys(paramsFields)` threw on a malformed schema instead of
  // rejecting cleanly (schema={} or schema missing `params`/`answer` ->
  // TypeError: Cannot convert undefined or null to object). Mirrors
  // attestAnswer's own guard so the two sides cannot drift apart.
  // D2 FIX backstop: `schema` is caller-supplied and may carry a throwing
  // getter or Proxy trap on `params`/`answer` (or their own keys) — every
  // check below reads it, so wrap in try/catch and collapse to the same
  // typed rejection the shape guard already returns. Every branch below
  // still returns its own specific code before this catch could see it.
  try {
    if (!isPlainObject(schema) || !isPlainObject(schema.params) || !isPlainObject(schema.answer)) {
      return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'schema must be a plain object with params/answer') };
    }
    const schemaApiErr = checkSchemaApi(schema);
    if (schemaApiErr) return { ok: false, reason: schemaApiErr };
    const apiSuppliedErr = checkApiNotCallerSupplied(schema.params, schema.answer);
    if (apiSuppliedErr) return { ok: false, reason: apiSuppliedErr };
    const answerEmptyErr = checkAnswerNotEmpty(schema.answer);
    if (answerEmptyErr) return { ok: false, reason: answerEmptyErr };
    const extraFields = { ...schema.params, ...schema.answer };
    const collisionErr = checkNoReservedCollision(extraFields);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const selfCollisionErr = checkNoSelfCollision(schema.params, schema.answer);
    if (selfCollisionErr) return { ok: false, reason: selfCollisionErr };
    // V3-M1: the token must name THIS schema's API. Absent `api` fails closed
    // with the same code; checked before the closed set so it holds on its own
    // (two schemas of identical shape are told apart by `api` alone).
    if (!hasOwn(r.payload, 'api') || r.payload.api !== schema.api) {
      return { ok: false, reason: new ClaimRejected('API_MISMATCH', 'api claim missing or not this schema\'s api') };
    }
    // V3-M2: when the schema signs an `entry`, the requester must say which entry
    // it asked for (entryFor in menu.mjs) and the signed one must equal it.
    if (hasOwn(schema.params, 'entry') &&
        (typeof expectedEntry !== 'string' || !hasOwn(r.payload, 'entry') || r.payload.entry !== expectedEntry)) {
      return { ok: false, reason: new ClaimRejected('ENTRY_MISMATCH', 'entry claim missing or not the expected entry') };
    }
    const answerFields = { api: 'string', ...extraFields };
    const closedErr = checkClosedPayload(r.payload, answerFields);
    if (closedErr) return { ok: false, reason: closedErr };
    const reqErr = verifyRequesterChecks(r.payload, { expectedIss, expectedAud, nonceStore, now });
    if (reqErr) return { ok: false, reason: reqErr };
    // D1 FIX: hand back only the schema-declared claims (base ∪ api ∪ extraFields),
    // never the raw decoded payload — see projectClaims above.
    return { ok: true, claims: projectClaims(r.payload, { ...BASE_FIELDS, ...answerFields }) };
  } catch {
    return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'schema must be a plain object with params/answer') };
  }
}

/**
 * @returns {string|{ok: false, reason: ClaimRejected|JwsRejected}} Returns
 *   exactly what `signJws` returns — this function has no success shape of
 *   its own. On success, the compact JWS string. On failure, `{ok: false,
 *   reason}` where `reason` is a `ClaimRejected` (invalid/off-menu `error`,
 *   reserved-claim collision, or closed-payload check failing before
 *   signing is ever attempted) or a `JwsRejected` (propagated unchanged
 *   from `signJws`). FAILS CLOSED: discriminate with
 *   `typeof result === 'string'` for success, exactly as `signJws` callers
 *   must — never read the result as a token without that check.
 */
export function attestRefusal(privateKey, kid, base, error, api) {
  // D2 FIX backstop: `base` is caller-supplied and may carry a throwing
  // getter or Proxy trap. Every branch below still returns its own specific
  // code before this catch could see it.
  try {
    if (!isPlainObject(base) || typeof error !== 'string' || typeof api !== 'string' || api.length === 0) {
      return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base must be a plain object, error and api must be strings') };
    }
    if (!KNOWN_APIS.includes(api)) return { ok: false, reason: new ClaimRejected('INVALID_API', 'api is not a known API') };
    // V3-M2: the api comes from the argument only, never from `base`.
    const apiSuppliedErr = checkApiNotCallerSupplied(base);
    if (apiSuppliedErr) return { ok: false, reason: apiSuppliedErr };
    if (!REFUSAL_REASONS.includes(error)) {
      return { ok: false, reason: new ClaimRejected('INVALID_ERROR', 'error not in the closed enum') };
    }
    const collisionErr = checkNoReservedCollision(REFUSAL_WIRE_FIELDS);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const payload = { ...base, api, error };
    const err = checkClosedPayload(payload, REFUSAL_WIRE_FIELDS);
    if (err) return { ok: false, reason: err };
    return signJws(privateKey, kid, payload);
  } catch {
    return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base must be a plain object, error and api must be strings') };
  }
}

/**
 * @returns {{ok: true, claims: object}|{ok: false, reason: JwsRejected|ClaimRejected}}
 *   On success, `{ok: true, claims}` where `claims` is the schema-projected
 *   claim set only (base ∪ api ∪ REFUSAL_FIELDS — never the raw decoded payload;
 *   see `projectClaims`). On failure, `{ok: false, reason}` where `reason`
 *   is a `JwsRejected` (propagated from `verifyJws` — malformed token, bad
 *   signature, unknown kid) or a `ClaimRejected` (closed-set/type/off-menu
 *   `error`/requester check failing, carrying a machine-readable `.code`).
 *   FAILS CLOSED: both branches are plain objects, so `typeof` cannot
 *   distinguish them — discriminate with `.ok === true` / `.ok === false`
 *   only; never read `.claims` without checking `.ok` first, since a
 *   failure object simply has no `claims` key and would read back as
 *   `undefined` rather than throw.
 */
export function verifyRefusal(token, resolveKey, { expectedIss, expectedAud, expectedApi, nonceStore, now }) {
  const r = verifyJws(token, resolveKey);
  if (!r.ok) return r;
  // D2 FIX backstop, symmetric with verifyAnswer's. Every branch below
  // still returns its own specific code before this catch could see it.
  try {
    const collisionErr = checkNoReservedCollision(REFUSAL_WIRE_FIELDS);
    if (collisionErr) return { ok: false, reason: collisionErr };
    // V3-M2: the token must name the API the caller expects. Absent `api`, or
    // no usable expectedApi, fails closed with the same code; checked before
    // the closed set so it holds on its own.
    if (typeof expectedApi !== 'string' || expectedApi.length === 0 ||
        !hasOwn(r.payload, 'api') || r.payload.api !== expectedApi) {
      return { ok: false, reason: new ClaimRejected('API_MISMATCH', 'api claim missing or not the expected api') };
    }
    if (!KNOWN_APIS.includes(r.payload.api)) {
      return { ok: false, reason: new ClaimRejected('INVALID_API', 'api claim is not a known API') };
    }
    const closedErr = checkClosedPayload(r.payload, REFUSAL_WIRE_FIELDS);
    if (closedErr) return { ok: false, reason: closedErr };
    if (!REFUSAL_REASONS.includes(r.payload.error)) {
      return { ok: false, reason: new ClaimRejected('INVALID_ERROR', 'error not in the closed enum') };
    }
    const reqErr = verifyRequesterChecks(r.payload, { expectedIss, expectedAud, nonceStore, now });
    if (reqErr) return { ok: false, reason: reqErr };
    // D1 FIX: hand back only the schema-declared claims (base ∪ api ∪ REFUSAL_FIELDS).
    return { ok: true, claims: projectClaims(r.payload, { ...BASE_FIELDS, ...REFUSAL_WIRE_FIELDS }) };
  } catch {
    return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'malformed refusal payload') };
  }
}

// In-memory nonce ledger for tests and later wiring: a nonce must be
// `issue`d before it can be `consume`d, and each can be consumed once.
export function makeNonceStore() {
  const issued = new Set();
  const used = new Set();
  return {
    issue(nonce) {
      if (typeof nonce !== 'string' || nonce.length === 0) return false;
      if (issued.has(nonce)) return false;
      issued.add(nonce);
      return true;
    },
    consume(nonce) {
      if (typeof nonce !== 'string') return false;
      if (!issued.has(nonce) || used.has(nonce)) return false;
      used.add(nonce);
      return true;
    },
  };
}

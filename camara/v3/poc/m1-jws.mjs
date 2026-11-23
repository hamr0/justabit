// PoC module V2-M1 — JWS (RFC 7515, EdDSA) attestation core. NEW module, built
// alongside the raw-Ed25519 `m1-attestation.mjs` (untouched, still what M2/M6/
// demo run on). Caller migration to this module is a later module (V2-M3).
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

function typeOk(type, value) {
  if (type === 'string') return typeof value === 'string' && value.length > 0;
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
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

// The named schema. SIM_SWAP_CHECK produces the exact seven-claim payload
// in camara/v2/docs/camara-attested-windowed-disclosure.md §4. (A second,
// TENURE_CHECK schema used to live here to prove the mechanism is not
// SimSwap-specific; it had no real caller anywhere in the tree, so it now
// lives as a test-only fixture in m1-jws-check.mjs instead.)
export const SIM_SWAP_CHECK = Object.freeze({
  params: Object.freeze({ maxAge: 'integer' }),
  answer: Object.freeze({ swapped: 'boolean' }),
});

// Closed refusal-reason enum. A refusal is signed too — a signed excuse is
// still an attestation, so its `error` value must come from a fixed menu,
// not free text an operator could smuggle a raw value into.
export const OFF_MENU_THRESHOLD = 'OFF_MENU_THRESHOLD';
export const UNAVAILABLE = 'UNAVAILABLE';
export const REFUSAL_REASONS = Object.freeze([OFF_MENU_THRESHOLD, UNAVAILABLE]);

// `base` = { iss, aud, nonce, iat, exp } — the five claims shared by both
// profiles. `schema` = { params: {name:type}, answer: {name:type} }.
// Key order (`{...base, ...params, ...answer}`) is what makes the SIM_SWAP
// round trip land as iss,aud,nonce,iat,exp,maxAge,swapped, matching the
// docs' worked example byte-for-byte in field order (not load-bearing for
// verification, since object equality doesn't care about key order, but
// worth keeping honest).
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
    const answerEmptyErr = checkAnswerNotEmpty(schema.answer);
    if (answerEmptyErr) return { ok: false, reason: answerEmptyErr };
    const extraFields = { ...schema.params, ...schema.answer };
    const collisionErr = checkNoReservedCollision(extraFields);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const selfCollisionErr = checkNoSelfCollision(schema.params, schema.answer);
    if (selfCollisionErr) return { ok: false, reason: selfCollisionErr };
    const payload = { ...base, ...params, ...answer };
    const err = checkClosedPayload(payload, extraFields);
    if (err) return { ok: false, reason: err };
    return signJws(privateKey, kid, payload);
  } catch {
    return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base/schema/params/answer must be plain objects') };
  }
}

/**
 * @returns {{ok: true, claims: object}|{ok: false, reason: JwsRejected|ClaimRejected}}
 *   On success, `{ok: true, claims}` where `claims` is the schema-projected
 *   claim set only (base ∪ schema.params ∪ schema.answer — never the raw
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
export function verifyAnswer(token, resolveKey, schema, { expectedIss, expectedAud, nonceStore, now }) {
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
    const answerEmptyErr = checkAnswerNotEmpty(schema.answer);
    if (answerEmptyErr) return { ok: false, reason: answerEmptyErr };
    const extraFields = { ...schema.params, ...schema.answer };
    const collisionErr = checkNoReservedCollision(extraFields);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const selfCollisionErr = checkNoSelfCollision(schema.params, schema.answer);
    if (selfCollisionErr) return { ok: false, reason: selfCollisionErr };
    const closedErr = checkClosedPayload(r.payload, extraFields);
    if (closedErr) return { ok: false, reason: closedErr };
    const reqErr = verifyRequesterChecks(r.payload, { expectedIss, expectedAud, nonceStore, now });
    if (reqErr) return { ok: false, reason: reqErr };
    // D1 FIX: hand back only the schema-declared claims (base ∪ extraFields),
    // never the raw decoded payload — see projectClaims above.
    return { ok: true, claims: projectClaims(r.payload, { ...BASE_FIELDS, ...extraFields }) };
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
export function attestRefusal(privateKey, kid, base, error) {
  // D2 FIX backstop: `base` is caller-supplied and may carry a throwing
  // getter or Proxy trap. Every branch below still returns its own specific
  // code before this catch could see it.
  try {
    if (!isPlainObject(base) || typeof error !== 'string') {
      return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base must be a plain object, error must be a string') };
    }
    if (!REFUSAL_REASONS.includes(error)) {
      return { ok: false, reason: new ClaimRejected('INVALID_ERROR', 'error not in the closed enum') };
    }
    const collisionErr = checkNoReservedCollision(REFUSAL_FIELDS);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const payload = { ...base, error };
    const err = checkClosedPayload(payload, REFUSAL_FIELDS);
    if (err) return { ok: false, reason: err };
    return signJws(privateKey, kid, payload);
  } catch {
    return { ok: false, reason: new ClaimRejected('MALFORMED_INPUT', 'base must be a plain object, error must be a string') };
  }
}

/**
 * @returns {{ok: true, claims: object}|{ok: false, reason: JwsRejected|ClaimRejected}}
 *   On success, `{ok: true, claims}` where `claims` is the schema-projected
 *   claim set only (base ∪ REFUSAL_FIELDS — never the raw decoded payload;
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
export function verifyRefusal(token, resolveKey, { expectedIss, expectedAud, nonceStore, now }) {
  const r = verifyJws(token, resolveKey);
  if (!r.ok) return r;
  // D2 FIX backstop, symmetric with verifyAnswer's. Every branch below
  // still returns its own specific code before this catch could see it.
  try {
    const collisionErr = checkNoReservedCollision(REFUSAL_FIELDS);
    if (collisionErr) return { ok: false, reason: collisionErr };
    const closedErr = checkClosedPayload(r.payload, REFUSAL_FIELDS);
    if (closedErr) return { ok: false, reason: closedErr };
    if (!REFUSAL_REASONS.includes(r.payload.error)) {
      return { ok: false, reason: new ClaimRejected('INVALID_ERROR', 'error not in the closed enum') };
    }
    const reqErr = verifyRequesterChecks(r.payload, { expectedIss, expectedAud, nonceStore, now });
    if (reqErr) return { ok: false, reason: reqErr };
    // D1 FIX: hand back only the schema-declared claims (base ∪ REFUSAL_FIELDS).
    return { ok: true, claims: projectClaims(r.payload, { ...BASE_FIELDS, ...REFUSAL_FIELDS }) };
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

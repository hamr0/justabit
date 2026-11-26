// PoC module V3-M1 (built on the V2-M1 core) — standalone check for m1-jws.mjs (JWS/EdDSA attestation
// core, built alongside the untouched raw-Ed25519 m1-attestation.mjs).
// Run: node camara/v3/poc/m1-jws-check.mjs
// Negatives first, then positives, same runner style/exit-code discipline as
// the other check files (a shrinking suite must not read as green).
import { generateKeyPairSync, randomUUID, sign as rawSign } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { seal, open } from './m2-envelope.mjs';
import {
  signJws, verifyJws, compactSize,
  attestAnswer, verifyAnswer, attestRefusal, verifyRefusal,
  makeNonceStore, JwsRejected, ClaimRejected,
  SIM_SWAP_CHECK, TENURE_CHECK, attachAttestation, AttestationFailed, OUT_OF_RANGE, UNAVAILABLE, KNOWN_APIS, parseDuration,
} from './m1-jws.mjs';

// V3-M1: TENURE_CHECK is now an exported named schema in m1-jws.mjs.
// Ad hoc test schemas below carry this api (the shape is what they probe).
const TEST_API = SIM_SWAP_CHECK.api;

// ---- local harness (m1-jws's reasons are typed classes, not strings, so
// check-harness.mjs's string-equality `reason` comparator does not fit —
// this is a parallel, not a divergent, contract: PASS/FAIL lines, an
// asserted case count, exit 0 only if every case AND the count hold). ----
const results = [];
function check(name, wantOk, verdict, expectClass, expectCode) {
  verdict = verdict ?? {};
  const gotOk = verdict.ok === true;
  let reasonOk = true;
  if (!wantOk) {
    reasonOk = expectClass ? verdict.reason instanceof expectClass : true;
    if (reasonOk && expectCode !== undefined) reasonOk = verdict.reason?.code === expectCode;
  }
  const pass = gotOk === wantOk && reasonOk;
  results.push(pass);
  const want = wantOk ? 'OK' : 'REJECT';
  const got = gotOk ? 'OK' : 'REJECT';
  const gotClass = verdict.reason?.constructor?.name;
  const gotCode = verdict.reason?.code;
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${name}: expected ${want}, got ${got}` +
    (wantOk ? '' : ` — reason expected ${expectClass?.name ?? 'any'}${expectCode ? '/' + expectCode : ''}` +
      `, got ${gotClass}${gotCode ? '/' + gotCode : ''} (match=${reasonOk})`)
  );
}
function checkTrue(name, cond, detail) {
  const pass = cond === true;
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
}
// Prints the tally and exits: 0 only if every case (including its extra) held
// AND — when the caller declares one — the suite still has the case count it
// is supposed to have. Measured 2026-08-16: truncating m4-check to drop its
// six assertion cases printed `RESULT: 18/18` and exited 0, and emptying the
// tally entirely printed `RESULT: 0/0` and exited 0. A suite that quietly
// loses the cases carrying its guarantee must not read as green, so a
// declared count is asserted like any other case.
function conclude(expected) {
  const passed = results.filter(Boolean).length;
  const countOk = expected === undefined || results.length === expected;
  console.log(`RESULT: ${passed}/${results.length}`);
  // AFTER the tally, so the LAST line of a count-failing run is the red one:
  // the runbook (and any `| tail -1`) reads the final line, and a green
  // `RESULT: 18/18` printed last would bury the count failure it sits above —
  // the exact eyeball fail-open this argument exists to close.
  if (!countOk) {
    console.log(`FAIL CASE COUNT: expected ${expected} cases, ran ${results.length}` +
      ' — the suite lost or gained cases; a shrinking suite is not a passing suite');
  }
  process.exit(passed === results.length && countOk ? 0 : 1);
}

// ---- fixtures ----
const operator = generateKeyPairSync('ed25519');
const impostor = generateKeyPairSync('ed25519');
const OP_KID = 'op-kid-1';
const directory = new Map([[OP_KID, operator.publicKey]]);
const resolveKey = (kid) => directory.get(kid) ?? null;
const nonceStore = makeNonceStore();
const NOW = Math.floor(Date.now() / 1000);
const ISS = 'opengateway.operator.example';
const AUD = 'requester.example';

function freshBase(ttl = 300) {
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  return { iss: ISS, aud: AUD, nonce, iat: NOW, exp: NOW + ttl };
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

// Forges a token with a REAL EdDSA signature (over whatever header/payload
// text is supplied) but bypassing signJws entirely — this is how a header
// or payload can carry something signJws would never construct (a bogus
// alg label, an extra header member, a duplicate payload key) while still
// being cryptographically genuine, so the resulting rejection can only be
// attributed to the specific claims/structure check under test, not to a
// bad signature.
function forge(headerObj, payloadText, privateKey) {
  const h = b64url(headerObj);
  const p = Buffer.from(payloadText, 'utf8').toString('base64url');
  const signingInput = `${h}.${p}`;
  const sig = rawSign(null, Buffer.from(signingInput, 'ascii'), privateKey);
  return `${signingInput}.${sig.toString('base64url')}`;
}

// =====================================================================
// NEGATIVES
// =====================================================================

// 1 WRONG SEGMENT COUNT — two segments, no signature at all.
check('1 WRONG SEGMENT COUNT', false, verifyJws('abc.def', resolveKey), JwsRejected);

// 2-6 GARBAGE INPUT FUZZ — five hostile strings, none may throw (a throw
// here would crash the whole check file rather than print a line, which is
// itself the failure this proves absent).
{
  const fuzz = ['', 'not a jws', '....', 'ñáéí🎉.b.c', 'a'.repeat(5000) + '.b.c'];
  let allRejectedNoThrow = true;
  for (const f of fuzz) {
    let v;
    try {
      v = verifyJws(f, resolveKey);
    } catch (e) {
      allRejectedNoThrow = false;
      console.log(`  fuzz threw on ${JSON.stringify(f).slice(0, 20)}...: ${e.message}`);
      continue;
    }
    if (v.ok !== false || !(v.reason instanceof JwsRejected)) allRejectedNoThrow = false;
  }
  checkTrue('2-6 GARBAGE INPUT FUZZ (5 strings, none throw, all reject)', allRejectedNoThrow);
}

// 7 EXTRA HEADER MEMBER — {alg,kid,jwk} would be the classic embedded-key
// attack shape; signJws can never construct this, so it must be forged.
{
  const base = freshBase();
  const payloadText = JSON.stringify({ ...base, maxAge: 2160, swapped: false });
  const token = forge({ alg: 'EdDSA', kid: OP_KID, jwk: 'attacker-embedded-key' }, payloadText, operator.privateKey);
  check('7 EXTRA HEADER MEMBER', false, verifyJws(token, resolveKey), JwsRejected);
}

// 8 ALG NONE — a REAL EdDSA signature (the actual operator key) over a
// header whose alg field literally reads "none". Node's null-algorithm
// verify does not itself consult the header text, so only the explicit
// `alg === 'EdDSA'` check stops this from verifying as genuine.
{
  const base = freshBase();
  const payloadText = JSON.stringify({ ...base, maxAge: 2160, swapped: false });
  const token = forge({ alg: 'none', kid: OP_KID }, payloadText, operator.privateKey);
  check('8 ALG NONE (genuine signature, forged label)', false, verifyJws(token, resolveKey), JwsRejected);
}

// 9 ALG ES256 — same forged-label attack, different bogus label.
{
  const base = freshBase();
  const payloadText = JSON.stringify({ ...base, maxAge: 2160, swapped: false });
  const token = forge({ alg: 'ES256', kid: OP_KID }, payloadText, operator.privateKey);
  check('9 ALG ES256 (genuine signature, forged label)', false, verifyJws(token, resolveKey), JwsRejected);
}

// 10 UNKNOWN KID — resolveKey has nothing under this kid.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, 'no-such-kid', { ...base, maxAge: 2160, swapped: false });
  check('10 UNKNOWN KID', false, verifyJws(token, resolveKey), JwsRejected);
}

// 11 WRONG KEY FROM resolveKey — a stale/misconfigured directory resolves
// OP_KID to the IMPOSTOR's public key; the token itself is genuinely signed
// by the real operator key, so this is purely a directory-resolution fault.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  const wrongResolve = () => impostor.publicKey;
  check('11 WRONG KEY FROM resolveKey', false, verifyJws(token, wrongResolve), JwsRejected);
}

// 12 FLIPPED PAYLOAD BYTE — one bit tampered after signing.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  const [h, p, s] = token.split('.');
  const pBuf = Buffer.from(p, 'base64url');
  pBuf[0] ^= 0xff;
  const tampered = `${h}.${pBuf.toString('base64url')}.${s}`;
  check('12 FLIPPED PAYLOAD BYTE', false, verifyJws(tampered, resolveKey), JwsRejected);
}

// 13 DUPLICATE KEY IN PAYLOAD — "swapped" signed twice; JSON.parse is
// last-wins, other parsers first-wins — same equivocation M1 closed.
{
  const base = freshBase();
  const payloadText = `{"iss":"${base.iss}","aud":"${base.aud}","nonce":"${base.nonce}",` +
    `"iat":${base.iat},"exp":${base.exp},"maxAge":2160,"swapped":true,"swapped":false}`;
  const token = forge({ alg: 'EdDSA', kid: OP_KID }, payloadText, operator.privateKey);
  check('13 DUPLICATE KEY IN PAYLOAD', false, verifyJws(token, resolveKey), JwsRejected);
}

// 14 EXTRA CLAIM — a leaky operator ships a raw field alongside the answer.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false, swapTimestamp: '2026-01-02' });
  check('14 EXTRA CLAIM', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'EXTRA_CLAIM');
}

// 15 MISSING CLAIM — labelled and in-window, but the schema's own answer
// field is absent.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D' });
  check('15 MISSING CLAIM', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'MISSING_CLAIM');
}

// 16 WRONG TYPE — the string "false", which is truthy: a caller testing
// `claims.swapped` naively would read it as a yes.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: 'false' });
  check('16 WRONG TYPE (swapped:"false")', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'WRONG_TYPE');
}

// 17 EXP <= IAT — attestAnswer itself would refuse to construct this (same
// checkClosedPayload runs at build time), so this bypasses it via signJws
// directly to prove verifyAnswer holds the line independently too.
{
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const badBase = { iss: ISS, aud: AUD, nonce, iat: NOW, exp: NOW };
  const token = signJws(operator.privateKey, OP_KID, { ...badBase, api: TEST_API, entry: 'P90D', swapped: false });
  check('17 EXP <= IAT', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'EXP_NOT_AFTER_IAT');
}

// 18 ISS MISMATCH — signed and structurally fine, wrong issuer claimed.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  check('18 ISS MISMATCH', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: 'someone-else.example', expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'ISS_MISMATCH');
}

// 19 AUD MISMATCH — a valid answer to a different requester.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  check('19 AUD MISMATCH', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: 'someone-else.example', expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'AUD_MISMATCH');
}

// 20 EXPIRED — exp already in the past relative to the injected clock, but
// still strictly after iat (so this exercises the EXPIRED check alone, not
// EXP_NOT_AFTER_IAT, which case 17 already covers).
{
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const base = { iss: ISS, aud: AUD, nonce, iat: NOW - 1000, exp: NOW - 500 };
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  check('20 EXPIRED', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'EXPIRED');
}

// 21 UNKNOWN NONCE — never issued into the store at all.
{
  const nonce = randomUUID(); // deliberately never nonceStore.issue()'d
  const token = signJws(operator.privateKey, OP_KID, { iss: ISS, aud: AUD, nonce, iat: NOW, exp: NOW + 300, api: TEST_API, entry: 'P90D', swapped: false });
  check('21 UNKNOWN NONCE', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'NONCE_REJECTED');
}

// 22 REPLAYED NONCE — the SAME token verified twice; the first consumes the
// nonce, the second must find it already used.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  const first = verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  const second = verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  checkTrue('22a REPLAYED NONCE first use accepts', first.ok === true);
  check('22b REPLAYED NONCE second use rejects', false, second, ClaimRejected, 'NONCE_REJECTED');
}

// 23 REFUSAL ERROR OFF ENUM — attestRefusal itself would refuse to build
// this; bypass via signJws to prove verifyRefusal holds independently.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, error: 'MADE_UP_REASON' });
  check('23 REFUSAL ERROR OFF ENUM', false,
    verifyRefusal(token, resolveKey, { expectedIss: ISS, expectedAud: AUD, expectedApi: TEST_API, nonceStore, now: NOW }),
    ClaimRejected, 'INVALID_ERROR');
}

// 24 WRONG SCHEMA — a valid SIM_SWAP_CHECK answer verified against
// TENURE_CHECK's schema; every field that IS present is well-formed, but
// the schemas don't overlap, so the closed set must still reject it.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  check('24 WRONG SCHEMA (SIM_SWAP token vs TENURE_CHECK)', false,
    verifyAnswer(token, resolveKey, TENURE_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P2Y', nonceStore, now: NOW }),
    ClaimRejected, 'API_MISMATCH');  // V3-M1: api is checked before shape
}

// 25 SIGNJWS NEVER THROWS ON BAD INPUT — non-object payload is the sender's
// own mistake, refused, not thrown (mirrors M1's own contract for its
// attest()).
{
  let threw = false;
  let v;
  try {
    v = signJws(operator.privateKey, OP_KID, 'not an object');
  } catch {
    threw = true;
  }
  checkTrue('25 SIGNJWS REFUSES NON-OBJECT PAYLOAD, NEVER THROWS', !threw && v && v.ok === false && v.reason instanceof JwsRejected);
}

// 26 RESERVED CLAIM IN params — a schema whose `params` field name collides
// with a base claim (`iat`) must be refused at attest time, before the
// clobbering merge ever runs.
{
  const base = freshBase();
  const collidingSchema = { api: TEST_API, params: { iat: 'boolean' }, answer: { swapped: 'boolean' } };
  check('26 RESERVED CLAIM IN params (schema.params.iat collides with base)', false,
    attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { iat: true }, { swapped: false }),
    ClaimRejected, 'RESERVED_CLAIM');
}

// 27 RESERVED CLAIM IN answer — same collision, on the `answer` side of the
// schema instead of `params`.
{
  const base = freshBase();
  const collidingSchema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { exp: 'boolean' } };
  check('27 RESERVED CLAIM IN answer (schema.answer.exp collides with base)', false,
    attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { maxAge: 2160 }, { exp: true }),
    ClaimRejected, 'RESERVED_CLAIM');
}

// 28 PROVEN EXPLOIT NOW REFUSED — the exact defect this fix closes: schema
// {params:{iat:'boolean'}} with params={iat:true} used to sign a payload
// carrying "iat":true (truthy, coerces to 1), defeating the `exp > iat`
// sanity guard (exp=1400, iat=2000 verified as if exp were after iat). It
// must now be refused at attestAnswer time, before any signature exists.
{
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const exploitBase = { iss: ISS, aud: AUD, nonce, iat: 2000, exp: 1400 };
  const exploitSchema = { api: TEST_API, params: { iat: 'boolean' }, answer: { swapped: 'boolean' } };
  check('28 PROVEN EXPLOIT (exp=1400/iat=2000, schema.params.iat) now refused', false,
    attestAnswer(operator.privateKey, OP_KID, exploitBase, exploitSchema, { iat: true }, { swapped: false }),
    ClaimRejected, 'RESERVED_CLAIM');
}

// 29 NEGATIVE CONTROL — a non-colliding schema must still sign and verify
// normally; the reserved-claim guard must not be reachable from ordinary
// schemas, only from ones that actually name a base claim.
{
  const base = freshBase();
  const okSchema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, okSchema, { maxAge: 2160 }, { swapped: false });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, okSchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check('29 NEGATIVE CONTROL (non-colliding schema still signs and verifies)', true, v);
}

// 34 SCHEMA SELF COLLISION AT ATTEST — the exact defect this fix closes:
// schema {params:{swapped:'integer'}, answer:{swapped:'boolean'}} with
// params={swapped:5}, answer={swapped:true} used to sign a payload carrying
// "swapped":true, silently dropping the caller's params.swapped:5 — both
// `extraFields = {...params, ...answer}` and the payload merge are
// last-key-wins in the same order. Must now be refused at attestAnswer
// time, before any signature exists.
{
  const base = freshBase();
  const collidingSchema = { api: TEST_API, params: { swapped: 'integer' }, answer: { swapped: 'boolean' } };
  check('34 SCHEMA SELF COLLISION AT ATTEST (params.swapped vs answer.swapped)', false,
    attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { swapped: 5 }, { swapped: true }),
    ClaimRejected, 'SCHEMA_SELF_COLLISION');
}

// 35 SCHEMA SELF COLLISION AT VERIFY — attestAnswer would refuse to build
// this (case 34), so this bypasses it via signJws directly to prove
// verifyAnswer holds the same line independently.
{
  const base = freshBase();
  const collidingSchema = { api: TEST_API, params: { swapped: 'integer' }, answer: { swapped: 'boolean' } };
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, swapped: true });
  check('35 SCHEMA SELF COLLISION AT VERIFY (params.swapped vs answer.swapped)', false,
    verifyAnswer(token, resolveKey, collidingSchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'SCHEMA_SELF_COLLISION');
}

// 36 NEGATIVE CONTROL — a normal non-self-colliding schema must still sign
// and verify; the new self-collision guard must not be reachable from
// ordinary schemas, only from ones that actually name the same claim on
// both sides.
{
  const base = freshBase();
  const okSchema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, okSchema, { maxAge: 2160 }, { swapped: false });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, okSchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check('36 NEGATIVE CONTROL (non-self-colliding schema still signs and verifies)', true, v);
}

// 37 VERIFYANSWER MALFORMED SCHEMA {} NEVER THROWS — the regression this fix
// closes: checkNoSelfCollision's Object.keys(schema.params) threw a
// TypeError on an empty schema instead of returning a clean rejection
// (pre-fix behaviour was ClaimRejected/EXTRA_CLAIM). Must reject, not throw.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, {}, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  } catch {
    threw = true;
  }
  checkTrue('37 VERIFYANSWER MALFORMED SCHEMA {} REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 38 VERIFYANSWER SCHEMA=NULL NEVER THROWS — same regression, schema itself
// is null (pre-fix this threw reading `.params` off null, both before and
// after the fix round — this closes it too, which is intended).
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, null, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  } catch {
    threw = true;
  }
  checkTrue('38 VERIFYANSWER SCHEMA=NULL REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 39 VERIFYANSWER SCHEMA MISSING ONE HALF NEVER THROWS — schema with only
// `answer`, no `params`, is the shape most likely to occur from a caller
// bug rather than an adversarial input; must reject cleanly, not throw.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, { answer: { swapped: 'boolean' } },
      { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  } catch {
    threw = true;
  }
  checkTrue('39 VERIFYANSWER SCHEMA MISSING params REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// =====================================================================
// POSITIVES
// =====================================================================

// 30 SIM_SWAP ROUND TRIP — must match camara/v2/docs/camara-attested-
// windowed-disclosure.md §4's seven-claim payload shape exactly (field
// names, types, and — since it costs nothing to also hold — key order).
{
  const base = freshBase();
  const token = attestAnswer(operator.privateKey, OP_KID, base, SIM_SWAP_CHECK, { entry: 'P90D' }, { swapped: false });
  const isString = typeof token === 'string';
  const v = isString
    ? verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check('30 SIM_SWAP ROUND TRIP', true, v, undefined, undefined);
  const shapeOk = isString && v.ok && Object.keys(v.claims).join(',') === 'iss,aud,nonce,iat,exp,api,entry,swapped' &&
    v.claims.iss === ISS && v.claims.aud === AUD && v.claims.nonce === base.nonce &&
    v.claims.api === SIM_SWAP_CHECK.api && v.claims.entry === 'P90D' && v.claims.swapped === false &&
    !Object.prototype.hasOwnProperty.call(v.claims, 'maxAge');
  checkTrue('30b SIM_SWAP payload is the V3-M2 seven-claim shape (entry signed, maxAge not)', shapeOk);
}

// 31 TENURE ROUND TRIP — proves the schema mechanism generalizes beyond
// SimSwap.
{
  const base = freshBase();
  const token = attestAnswer(operator.privateKey, OP_KID, base, TENURE_CHECK, { entry: 'P2Y' }, { tenureDateCheck: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, TENURE_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P2Y', nonceStore, now: NOW })
    : token;
  check('31 TENURE ROUND TRIP', true, v);
  checkTrue('31b TENURE payload fidelity', v.ok && v.claims.entry === 'P2Y' && !Object.prototype.hasOwnProperty.call(v.claims, 'tenureDate') && v.claims.tenureDateCheck === true);
}

// 32 REFUSAL ROUND TRIP — a signed excuse, from the closed enum.
{
  const base = freshBase();
  const token = attestRefusal(operator.privateKey, OP_KID, base, OUT_OF_RANGE, TEST_API);
  const v = typeof token === 'string'
    ? verifyRefusal(token, resolveKey, { expectedIss: ISS, expectedAud: AUD, expectedApi: TEST_API, nonceStore, now: NOW })
    : token;
  check('32 REFUSAL ROUND TRIP', true, v);
  checkTrue('32b REFUSAL payload fidelity', v.ok && v.claims.error === OUT_OF_RANGE && v.claims.api === TEST_API);
}

// 33 SEALED ANSWERS (V3-M2b) — the worst-case signed answers and refusal (30-char iss/aud,
// UUID nonce, 20-char kid) all seal and open to the same bytes, and all seal to ONE length,
// so the hub cannot tell them apart. 33 (an answer under the old RSA-OAEP cap) is dropped: it
// duplicated 33d, and nothing seals with RSA-OAEP alone any more.
{
  const rsaKey = generateKeyPairSync('rsa', { modulusLength: 4096 });
  const longIss = 'a'.repeat(30);
  const longAud = 'b'.repeat(30);
  const kid20 = 'k'.repeat(20);
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const base = { iss: longIss, aud: longAud, nonce, iat: NOW, exp: NOW + 300 };
  const token = attestAnswer(operator.privateKey, kid20, base, SIM_SWAP_CHECK, { entry: 'P90D' }, { swapped: false });
  const size = typeof token === 'string' ? compactSize(token) : Infinity;
  // 33b2: the worst-case Tenure answer (461 B, over the old 446 B RSA cap) seals and opens
  // to the same bytes.
  const nonce2 = randomUUID();
  nonceStore.issue(nonce2);
  const tToken = attestAnswer(operator.privateKey, kid20, { ...base, nonce: nonce2 }, TENURE_CHECK, { entry: 'P2Y' }, { tenureDateCheck: false });
  const tSize = typeof tToken === 'string' ? compactSize(tToken) : Infinity;
  // A regression that returns a refusal object instead of a token must print FAIL, not crash.
  const isStr = typeof token === 'string' && typeof tToken === 'string';
  const tBytes = Buffer.from(typeof tToken === 'string' ? tToken : '', 'utf8');
  const tSealed = seal(rsaKey.publicKey, tBytes);
  const tOpened = open(rsaKey.privateKey, tSealed);
  checkTrue(`33b2 V3-M2b: worst-case Tenure answer (${tSize}B) seals and opens to the same bytes`,
    isStr && tOpened.ok === true && tOpened.payloadBytes?.equals(tBytes) === true);
  const rToken = attestRefusal(operator.privateKey, kid20, { ...base, nonce: nonce2 }, OUT_OF_RANGE, TENURE_CHECK.api);
  const rSize = typeof rToken === 'string' ? compactSize(rToken) : Infinity;
  // 33b: the worst-case signed refusal seals to the same length as the answers (compared below).
  // 33c V3-M2b (was KNOWN GAP): the worst-case Tenure answer seals, and to the SAME sealed
  // length as the SimSwap answer (checked in 33d below), so the hub cannot tell them apart.
  // 33d NEGATIVE CONTROL: the worst-case SimSwap answer seals and opens to the same bytes.
  const sBytes = Buffer.from(typeof token === 'string' ? token : '', 'utf8');
  const sSealed = seal(rsaKey.publicKey, sBytes);
  const sOpened = open(rsaKey.privateKey, sSealed);
  checkTrue(`33c V3-M2b: worst-case Tenure answer (${tSize}B) and SimSwap answer (${size}B) seal to one length (${tSealed.length}B)`,
    isStr && tSize > size && sSealed.length === tSealed.length);
  const rBytes = Buffer.from(typeof rToken === 'string' ? rToken : '', 'utf8');
  const rSealed = seal(rsaKey.publicKey, rBytes);
  checkTrue(`33b worst-case refusal (${rSize}B) seals to the same length (${rSealed.length}B) and opens to the same bytes`,
    typeof rToken === 'string' && rSealed.length === tSealed.length &&
    open(rsaKey.privateKey, rSealed).payloadBytes?.equals(rBytes) === true);
  checkTrue(`33d NEGATIVE CONTROL: the worst-case SimSwap answer (${size}B) seals and opens to the same bytes`,
    typeof token === 'string' && sOpened.ok === true && sOpened.payloadBytes?.equals(sBytes) === true);
}

// =====================================================================
// D1 FIX — prototype-pollution membership bypass (`in` walks the prototype
// chain on a plain object literal). All groups below probe the SAME 12
// Object.prototype member names that made `k in allowed`/`k in payload`
// resolve true even when the key was never actually set.
// =====================================================================
const PROTO_NAMES = [
  'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
  'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__', '__proto__',
];

// 40 D1 WIRE SMUGGLE PER PROTOTYPE NAME — a hand-signed token (bypassing
// attestAnswer, mirroring the wire trust boundary) carries a prototype-
// member name as an EXTRA claim. The JSON payload text is built directly by
// string splice, not via bracket assignment on a JS object — for
// `__proto__`, `obj['__proto__'] = x` invokes the exotic
// Object.prototype.__proto__ SETTER instead of creating a data property, so
// a bracket-assigned fixture could never even construct the attack this
// case exists to prove closed. Splicing the JSON text guarantees every name
// lands as a genuine OWN key exactly the way JSON.parse would create it on
// the real wire. Each name gets its own assertion so a failure names the
// culprit instead of hiding inside one aggregate boolean.
for (const name of PROTO_NAMES) {
  const base = freshBase();
  const baseText = JSON.stringify({ ...base, api: TEST_API, entry: 'P90D', swapped: false });
  const payloadText = baseText.slice(0, -1) + `,${JSON.stringify(name)}:${JSON.stringify('RAW LEAK ' + name)}}`;
  const token = forge({ alg: 'EdDSA', kid: OP_KID }, payloadText, operator.privateKey);
  check(`40 D1 WIRE SMUGGLE [${name}]`, false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'EXTRA_CLAIM');
}

// 41 D1 NEGATIVE — the mirror direction: the SAME 12 names used as
// LEGITIMATE, schema-DECLARED answer field names must still sign, verify,
// and round-trip the value intact. `[name]:` is a COMPUTED property key —
// unlike the literal `__proto__: value` syntax (which sets the object's
// prototype instead of creating a data property), a computed key always
// creates a real own property, so this is a fair, unconfounded test of the
// membership checks themselves, not an artifact of how the fixture is
// built. Without this group, group 40 alone could pass by simply rejecting
// everything — the required negative control that proves the guard is
// still selective, not a blanket denier.
for (const name of PROTO_NAMES) {
  const base = freshBase();
  const schema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { [name]: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, schema, { maxAge: 2160 }, { [name]: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, schema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check(`41 D1 LEGIT DECLARED FIELD [${name}]`, true, v);
  // Also the projection assertion for this name: claims must carry EXACTLY
  // the declared set (base ∪ {maxAge, name}) — no more, no less.
  const expectedKeys = ['iss', 'aud', 'nonce', 'iat', 'exp', 'api', 'maxAge', name].sort().join(',');
  checkTrue(`41b D1 LEGIT DECLARED FIELD [${name}] round-trips intact and projection is exact`,
    v.ok === true && v.claims[name] === true && Object.keys(v.claims).sort().join(',') === expectedKeys);
}

// 42 D1 PROJECTION — DEDICATED __proto__ CASE. Called out explicitly (not
// just as one iteration of group 41) because this is the exact name that
// broke the naive `out[k] = payload[k]` projection: assigning through a
// bracket key literally named `__proto__` invokes the exotic
// Object.prototype.__proto__ setter instead of creating a data property, so
// the claim silently failed to round-trip. `projectClaims` uses
// `Object.defineProperty` specifically to avoid this.
{
  const base = freshBase();
  // Both the schema's answer-field name AND the actual answer value use a
  // COMPUTED key (`['__proto__']`) — the literal, non-computed form
  // (`{ __proto__: x }`) sets the object's PROTOTYPE instead of creating a
  // property named "__proto__", which would silently defeat this exact
  // test rather than exercise it.
  const schema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { ['__proto__']: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, schema, { maxAge: 2160 }, { ['__proto__']: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, schema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check('42 D1 PROJECTION __proto__ FIELD ROUND-TRIPS', true, v);
  checkTrue('42b D1 PROJECTION __proto__ FIELD is an own data property, value true',
    v.ok === true && Object.prototype.hasOwnProperty.call(v.claims, '__proto__') && v.claims.__proto__ === true);
}

// =====================================================================
// D2 FIX — attestAnswer/verifyAnswer must never THROW on a schema whose
// params/answer access itself throws (a defineProperty getter, or a Proxy
// get trap); the guard expression does the access, so the throw used to
// happen inside the guard, before any typed rejection could be built.
// Follows case 25's established pattern: assert BOTH "did not throw" AND
// the resulting code.
// =====================================================================

// 43 D2 ATTESTANSWER, THROWING GETTER ON schema.params.
{
  const base = freshBase();
  const throwingSchema = { get params() { throw new Error('boom-params'); }, answer: { swapped: 'boolean' } };
  let threw = false;
  let v;
  try {
    v = attestAnswer(operator.privateKey, OP_KID, base, throwingSchema, { maxAge: 2160 }, { swapped: false });
  } catch {
    threw = true;
  }
  checkTrue('43 D2 ATTESTANSWER THROWING GETTER ON schema.params REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 44 D2 ATTESTANSWER, PROXY schema WITH A THROWING get TRAP.
{
  const base = freshBase();
  const proxySchema = new Proxy({ api: TEST_API, params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } }, {
    get(t, k) {
      if (k === 'params') throw new Error('proxy-get-boom');
      return t[k];
    },
  });
  let threw = false;
  let v;
  try {
    v = attestAnswer(operator.privateKey, OP_KID, base, proxySchema, { maxAge: 2160 }, { swapped: false });
  } catch {
    threw = true;
  }
  checkTrue('44 D2 ATTESTANSWER PROXY THROWING get TRAP ON schema REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 45 D2 VERIFYANSWER, THROWING GETTER ON schema.params — the token itself is
// a genuinely valid, signed SIM_SWAP_CHECK answer; only the schema passed to
// verifyAnswer is hostile.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  const throwingSchema = { get params() { throw new Error('boom-params'); }, answer: { swapped: 'boolean' } };
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, throwingSchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  } catch {
    threw = true;
  }
  checkTrue('45 D2 VERIFYANSWER THROWING GETTER ON schema.params REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 46 D2 VERIFYANSWER, PROXY schema WITH A THROWING get TRAP.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D', swapped: false });
  const proxySchema = new Proxy({ api: TEST_API, params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } }, {
    get(t, k) {
      if (k === 'params') throw new Error('proxy-get-boom');
      return t[k];
    },
  });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, proxySchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  } catch {
    threw = true;
  }
  checkTrue('46 D2 VERIFYANSWER PROXY THROWING get TRAP ON schema REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 47 BACKSTOP IS NOT A SWALLOWER — the try/catch backstop added for D2 must
// never mask a genuine, more specific typed rejection under the generic
// MALFORMED_INPUT code. Re-runs case 26's exact RESERVED_CLAIM scenario and
// asserts the code explicitly (not merely "some ClaimRejected"), so a
// regression that widens the backstop's catch to swallow specific codes
// shows up here directly.
{
  const base = freshBase();
  const collidingSchema = { api: TEST_API, params: { iat: 'boolean' }, answer: { swapped: 'boolean' } };
  const v = attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { iat: true }, { swapped: false });
  checkTrue('47 BACKSTOP NOT A SWALLOWER (RESERVED_CLAIM stays RESERVED_CLAIM, not MALFORMED_INPUT)',
    v.ok === false && v.reason.code === 'RESERVED_CLAIM' && v.reason.code !== 'MALFORMED_INPUT');
}

// =====================================================================
// S1 FIX — the projection call sites in verifyAnswer/verifyRefusal had no
// test that could observe their removal: with checkClosedPayload's closed-
// set guard intact, `claims: r.payload` and `claims: projectClaims(...)`
// return the SAME set of keys, so a mutant deleting either call site still
// passed 82/82. A unit test of projectClaims alone does not solve this — it
// would prove the function works while a mutant deleting the CALL SITE
// still passes. The observable that survives is KEY ORDER: projectClaims
// copies out in Object.keys(allowedFields) order (BASE_FIELDS, then the
// schema's declared fields) — canonical, regardless of the payload's own
// order — while the raw payload carries whatever order its JSON text had.
// Hand-sign (via signJws, bypassing attestAnswer/attestRefusal, which
// always build canonical order) a payload with the SAME key set inserted
// in a SHUFFLED order. JS preserves object-literal insertion order for
// string keys and JSON.parse preserves document order, so this is a fair,
// unconfounded probe of whether the call site actually ran.
// =====================================================================

// 48 S1 ANSWER PROJECTION LIVE (KEY ORDER) — verifyAnswer's own call site.
{
  const base = freshBase();
  const shuffledPayload = {
    swapped: false, entry: 'P90D',
    exp: base.exp, iat: base.iat, nonce: base.nonce, aud: base.aud, iss: base.iss, api: TEST_API,
  };
  const token = signJws(operator.privateKey, OP_KID, shuffledPayload);
  const v = verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  check('48 S1 ANSWER PROJECTION LIVE (KEY ORDER)', true, v);
  checkTrue('48b S1 ANSWER PROJECTION LIVE claims come back in canonical order despite shuffled wire order',
    v.ok === true && Object.keys(v.claims).join(',') === 'iss,aud,nonce,iat,exp,api,entry,swapped');
}

// 49 S1 ANSWER NEGATIVE CONTROL — a normally (already-canonically) ordered
// hand-signed token must still verify and still come back canonical; proves
// 48's assertion is not merely "any hand-signed token reads as canonical".
{
  const base = freshBase();
  const canonicalPayload = { ...base, api: TEST_API, entry: 'P90D', swapped: false };
  const token = signJws(operator.privateKey, OP_KID, canonicalPayload);
  const v = verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW });
  check('49 S1 ANSWER NEGATIVE CONTROL (already-canonical wire order stays canonical)', true, v);
  checkTrue('49b S1 ANSWER NEGATIVE CONTROL claims order',
    v.ok === true && Object.keys(v.claims).join(',') === 'iss,aud,nonce,iat,exp,api,entry,swapped');
}

// 50 S1 REFUSAL PROJECTION LIVE (KEY ORDER) — verifyRefusal's OWN, separate
// call site; a mutant could delete either call site alone, so each needs
// its own live proof (mirrors 48).
{
  const base = freshBase();
  const shuffledPayload = {
    error: OUT_OF_RANGE, api: TEST_API,
    exp: base.exp, iat: base.iat, nonce: base.nonce, aud: base.aud, iss: base.iss,
  };
  const token = signJws(operator.privateKey, OP_KID, shuffledPayload);
  const v = verifyRefusal(token, resolveKey, { expectedIss: ISS, expectedAud: AUD, expectedApi: TEST_API, nonceStore, now: NOW });
  check('50 S1 REFUSAL PROJECTION LIVE (KEY ORDER)', true, v);
  checkTrue('50b S1 REFUSAL PROJECTION LIVE claims come back in canonical order despite shuffled wire order',
    v.ok === true && Object.keys(v.claims).join(',') === 'iss,aud,nonce,iat,exp,api,error');
}

// 51 S1 REFUSAL NEGATIVE CONTROL — mirrors 49 for the refusal side.
{
  const base = freshBase();
  const canonicalPayload = { ...base, api: TEST_API, error: UNAVAILABLE };
  const token = signJws(operator.privateKey, OP_KID, canonicalPayload);
  const v = verifyRefusal(token, resolveKey, { expectedIss: ISS, expectedAud: AUD, expectedApi: TEST_API, nonceStore, now: NOW });
  check('51 S1 REFUSAL NEGATIVE CONTROL (already-canonical wire order stays canonical)', true, v);
  checkTrue('51b S1 REFUSAL NEGATIVE CONTROL claims order',
    v.ok === true && Object.keys(v.claims).join(',') === 'iss,aud,nonce,iat,exp,api,error');
}

// =====================================================================
// S2 FIX — a literal `__proto__:` key in an object initializer sets the
// PROTOTYPE, not a property, so `answer: { __proto__: 'boolean' }` has ZERO
// own keys — silently, no error at schema-definition time. checkAnswerNotEmpty
// rejects an answer schema with no own fields at both attestAnswer and
// verifyAnswer. schema.params MAY legitimately be empty (roaming/
// reachability predicates have no query value) — the guard must not reach
// params, and a legitimate prototype-named field written with a COMPUTED
// key must keep working (groups 41/42 already depend on this).
// =====================================================================

// 52 S2 EMPTY ANSWER SCHEMA AT ATTEST (literal __proto__ trap).
{
  const base = freshBase();
  const emptyAnswerSchema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { __proto__: 'boolean' } };
  check('52 S2 EMPTY ANSWER SCHEMA AT ATTEST (literal __proto__ trap)', false,
    attestAnswer(operator.privateKey, OP_KID, base, emptyAnswerSchema, { maxAge: 2160 }, {}),
    ClaimRejected, 'EMPTY_ANSWER_SCHEMA');
}

// 53 S2 EMPTY ANSWER SCHEMA AT VERIFY — attestAnswer would refuse to build
// this (case 52), so bypass it via signJws directly to prove verifyAnswer
// holds the same line independently.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, api: TEST_API, entry: 'P90D' });
  const emptyAnswerSchema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { __proto__: 'boolean' } };
  check('53 S2 EMPTY ANSWER SCHEMA AT VERIFY (literal __proto__ trap)', false,
    verifyAnswer(token, resolveKey, emptyAnswerSchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW }),
    ClaimRejected, 'EMPTY_ANSWER_SCHEMA');
}

// 54 S2 NEGATIVE CONTROL — EMPTY params MUST STAY LEGAL — the guard targets
// only the answer half's emptiness; a predicate with no query value
// (roaming, reachability) legitimately has schema.params = {}.
{
  const base = freshBase();
  const noParamsSchema = { api: TEST_API, params: {}, answer: { swapped: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, noParamsSchema, {}, { swapped: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, noParamsSchema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check('54 S2 NEGATIVE CONTROL (empty params stays legal)', true, v);
}

// 55 S2 NEGATIVE CONTROL — COMPUTED-KEY PROTOTYPE-NAMED ANSWER FIELD STAYS
// LEGAL — `{ [name]: 'boolean' }` with name === '__proto__' is a COMPUTED
// key, which always creates a real own property, so Object.keys(schema.answer)
// has length 1, not 0 — the new guard must not reject it. Already exercised
// per-name in groups 41/42; restated here as a direct check against the
// EMPTY_ANSWER_SCHEMA guard specifically.
{
  const base = freshBase();
  const schema = { api: TEST_API, params: { maxAge: 'integer' }, answer: { ['__proto__']: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, schema, { maxAge: 2160 }, { ['__proto__']: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, schema, { expectedIss: ISS, expectedAud: AUD, expectedEntry: 'P90D', nonceStore, now: NOW })
    : token;
  check('55 S2 NEGATIVE CONTROL (computed-key __proto__ answer field stays legal, not empty)', true, v);
}

// =====================================================================
// V3-M1 — signed answer on Sync26 (spec .claude/scratch/camara-v3/v3-m1-spec.md
// §4 assertions 1-7 and §7 build changes). Classified by instanceof + .code,
// never by message text. Claim key order is reversed (`rev`) in the smuggle
// and api cases, so a guard that only reads one key order cannot pass.
// =====================================================================


const SIM = SIM_SWAP_CHECK, TEN = TENURE_CHECK;
const SIM_P = { entry: 'P90D' }, SIM_A = { swapped: true };
const TEN_P = { entry: 'P2Y' }, TEN_A = { tenureDateCheck: true };
const vOpts = () => ({ expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
const rev = (o) => Object.fromEntries(Object.entries(o).reverse());
function signed(schema, params, answer) {
  const base = freshBase();
  return { base, token: attestAnswer(operator.privateKey, OP_KID, base, schema, params, answer) };
}
const verifyFresh = (token, schema, entry) => verifyAnswer(token, resolveKey, schema, { ...vOpts(), expectedEntry: entry ?? (schema && schema.api === TEN.api ? 'P2Y' : 'P90D') });
const b64j = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');

// -- Assertion 1: valid signed answer verifies, each schema; api is in claims.
for (const [nm, schema, par, ans, api] of [
  ['SIM_SWAP_CHECK', SIM, SIM_P, SIM_A, 'sim-swap/v2/check'],
  ['TENURE_CHECK', TEN, TEN_P, TEN_A, 'kyc-tenure/v0.3/check-tenure'],
]) {
  const { token } = signed(schema, par, ans);
  const v = typeof token === 'string' ? verifyFresh(token, schema) : token;
  check(`V3 1 VALID ${nm} verifies`, true, v);
  checkTrue(`V3 1b ${nm} schema api is the fixed value and rides in the claims`,
    schema.api === api && v.ok === true && v.claims.api === api);
}

// -- Assertion 2: tampered payload / tampered signature / wrong key / unknown kid.
{
  const { token } = signed(SIM, SIM_P, SIM_A);
  const [h, p, sg] = token.split('.');
  const pl = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  check('V3 2 TAMPERED PAYLOAD (swapped flipped, old signature)', false,
    verifyFresh(`${h}.${b64j({ ...pl, swapped: !pl.swapped })}.${sg}`, SIM), JwsRejected);
  const flipped = (sg[0] === 'A' ? 'B' : 'A') + sg.slice(1);
  check('V3 2 TAMPERED SIGNATURE', false, verifyFresh(`${h}.${p}.${flipped}`, SIM), JwsRejected);
  const forged = signJws(impostor.privateKey, OP_KID, pl);
  check('V3 2 WRONG KEY (impostor signs under the operator kid)', false, verifyFresh(forged, SIM), JwsRejected);
  const unk = signJws(operator.privateKey, 'no-such-kid', pl);
  check('V3 2 UNKNOWN KID', false, verifyFresh(unk, SIM), JwsRejected);
  check('V3 2 NEGATIVE CONTROL (untampered token verifies)', true, verifyFresh(token, SIM));
}

// -- Assertion 3: expired.
{
  const base = { ...freshBase(), iat: NOW - 600, exp: NOW - 300 };
  const token = attestAnswer(operator.privateKey, OP_KID, base, TEN, TEN_P, TEN_A);
  check('V3 3 EXPIRED (exp in the past)', false, verifyFresh(token, TEN), ClaimRejected, 'EXPIRED');
}

// -- Assertion 4: wrong nonce, and the same nonce twice.
{
  const base = { iss: ISS, aud: AUD, nonce: randomUUID(), iat: NOW, exp: NOW + 300 }; // never issued
  const token = attestAnswer(operator.privateKey, OP_KID, base, SIM, SIM_P, SIM_A);
  check('V3 4 WRONG NONCE (not issued by this requester)', false, verifyFresh(token, SIM), ClaimRejected, 'NONCE_REJECTED');
  const { token: t2 } = signed(TEN, TEN_P, TEN_A);
  check('V3 4 NONCE FIRST USE accepts', true, verifyFresh(t2, TEN));
  check('V3 4 SAME NONCE TWICE rejects', false, verifyFresh(t2, TEN), ClaimRejected, 'NONCE_REJECTED');
}

// -- Assertion 5 / spec §7.2: wrong question. API_MISMATCH proven on its own.
{
  const s1 = signed(TEN, TEN_P, TEN_A), s2 = signed(SIM, SIM_P, SIM_A);
  check('V3 5 TENURE token checked as SimSwap', false, verifyFresh(s1.token, SIM), ClaimRejected, 'API_MISMATCH');
  check('V3 5 SIMSWAP token checked as Tenure', false, verifyFresh(s2.token, TEN), ClaimRejected, 'API_MISMATCH');
  // Two schemas with the SAME shape and DIFFERENT api: shape cannot tell them apart.
  const SAME_A = { api: 'api-a/v1/check', params: { entry: 'duration' }, answer: { swapped: 'boolean' } };
  const SAME_B = { api: 'api-b/v1/check', params: { entry: 'duration' }, answer: { swapped: 'boolean' } };
  const a = signed(SAME_A, SIM_P, SIM_A);
  check('V3 5 SAME-SHAPE token checked under the other api', false, verifyFresh(a.token, SAME_B), ClaimRejected, 'API_MISMATCH');
  const a2 = signed(SAME_A, SIM_P, SIM_A);
  check('V3 5 NEGATIVE CONTROL (same token under its own schema verifies)', true, verifyFresh(a2.token, SAME_A));
  // Hand-signed, otherwise valid, trusted key, reversed key order, api names the OTHER api.
  const base = freshBase();
  const wrongApi = signJws(operator.privateKey, OP_KID, rev({ ...base, api: TEN.api, ...SIM_P, ...SIM_A }));
  check('V3 5 api claim names the other API, all else valid (reversed key order)', false,
    verifyFresh(wrongApi, SIM), ClaimRejected, 'API_MISMATCH');
  const base2 = freshBase();
  const ok = signJws(operator.privateKey, OP_KID, rev({ ...base2, api: SIM.api, ...SIM_P, ...SIM_A }));
  check('V3 5 NEGATIVE CONTROL (hand-signed, right api, reversed key order verifies)', true, verifyFresh(ok, SIM));
  // Missing api fails closed with the same code.
  const base3 = freshBase();
  const noApi = signJws(operator.privateKey, OP_KID, rev({ ...base3, ...SIM_P, ...SIM_A }));
  check('V3 5 MISSING api claim (fail closed)', false, verifyFresh(noApi, SIM), ClaimRejected, 'API_MISMATCH');
}

// -- Caller must not be able to supply `api` (spec §7.1): base, params, answer, schema.
{
  const b = () => freshBase();
  const wrongSupplied = 'attacker/v1/check';
  check('V3 API SUPPLIED IN base', false,
    attestAnswer(operator.privateKey, OP_KID, rev({ ...b(), api: wrongSupplied }), SIM, SIM_P, SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 API SUPPLIED IN base (even the correct value)', false,
    attestAnswer(operator.privateKey, OP_KID, rev({ ...b(), api: SIM.api }), SIM, SIM_P, SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 API SUPPLIED IN params', false,
    attestAnswer(operator.privateKey, OP_KID, b(), SIM, rev({ ...SIM_P, api: wrongSupplied }), SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 API SUPPLIED IN answer', false,
    attestAnswer(operator.privateKey, OP_KID, b(), SIM, SIM_P, rev({ ...SIM_A, api: wrongSupplied })), ClaimRejected, 'RESERVED_CLAIM');
  const apiInParams = { api: SIM.api, params: { api: 'string', maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  check('V3 API NAMED IN schema.params (attest)', false,
    attestAnswer(operator.privateKey, OP_KID, b(), apiInParams, { api: SIM.api, maxAge: 1 }, SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  const { token } = signed(SIM, SIM_P, SIM_A);
  check('V3 API NAMED IN schema.answer (verify)', false,
    verifyFresh(token, { api: SIM.api, params: { maxAge: 'integer' }, answer: { api: 'string', swapped: 'boolean' } }),
    ClaimRejected, 'RESERVED_CLAIM');
  // `attestation` is reserved exactly as `api` is.
  const attInAnswer = { api: SIM.api, params: SIM.params, answer: { attestation: 'boolean' } };
  const attInParams = { api: SIM.api, params: { attestation: 'string', maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  check('V3 ATTESTATION NAMED IN schema.answer (attest)', false,
    attestAnswer(operator.privateKey, OP_KID, b(), attInAnswer, SIM_P, { attestation: true }), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 ATTESTATION NAMED IN schema.params (attest)', false,
    attestAnswer(operator.privateKey, OP_KID, b(), attInParams, { attestation: 'x', maxAge: 1 }, SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 ATTESTATION NAMED IN schema.answer (verify)', false,
    verifyFresh(token, attInAnswer), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 ATTESTATION SUPPLIED IN base', false,
    attestAnswer(operator.privateKey, OP_KID, rev({ ...b(), attestation: 'x' }), SIM, SIM_P, SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 ATTESTATION SUPPLIED IN params', false,
    attestAnswer(operator.privateKey, OP_KID, b(), SIM, rev({ ...SIM_P, attestation: 'x' }), SIM_A), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 ATTESTATION SUPPLIED IN answer', false,
    attestAnswer(operator.privateKey, OP_KID, b(), SIM, SIM_P, rev({ ...SIM_A, attestation: true })), ClaimRejected, 'RESERVED_CLAIM');
  check('V3 ATTESTATION NEGATIVE CONTROL SIM_SWAP_CHECK still signs', true,
    (() => { const t = attestAnswer(operator.privateKey, OP_KID, b(), SIM, SIM_P, SIM_A); return typeof t === 'string' ? verifyFresh(t, SIM) : t; })());
  const noSchemaApi = { params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  check('V3 SCHEMA WITHOUT api (attest)', false,
    attestAnswer(operator.privateKey, OP_KID, b(), noSchemaApi, SIM_P, SIM_A), ClaimRejected, 'MALFORMED_INPUT');
  const { token: t3 } = signed(SIM, SIM_P, SIM_A);
  check('V3 SCHEMA WITHOUT api (verify)', false, verifyFresh(t3, noSchemaApi), ClaimRejected, 'MALFORMED_INPUT');
}

// -- Assertion 6: no raw value. Sign time and verify time, reversed key order.
{
  const RAW = { contractType: 'PAYM', latestSimChange: '2024-09-18T07:37:53Z', monitoredPeriod: 240 };
  for (const [nm, schema, par, ans] of [['SIM_SWAP_CHECK', SIM, SIM_P, SIM_A], ['TENURE_CHECK', TEN, TEN_P, TEN_A]]) {
    for (const [rk, rv] of Object.entries(RAW)) {
      const raw = Object.fromEntries([[rk, rv]]);
      check(`V3 6 SIGN ${nm}: ${rk} in answer`, false,
        attestAnswer(operator.privateKey, OP_KID, freshBase(), schema, par, rev({ ...ans, ...raw })), ClaimRejected, 'EXTRA_CLAIM');
      check(`V3 6 SIGN ${nm}: ${rk} in params`, false,
        attestAnswer(operator.privateKey, OP_KID, freshBase(), schema, rev({ ...par, ...raw }), ans), ClaimRejected, 'EXTRA_CLAIM');
      check(`V3 6 SIGN ${nm}: ${rk} in base`, false,
        attestAnswer(operator.privateKey, OP_KID, rev({ ...freshBase(), ...raw }), schema, par, ans), ClaimRejected, 'EXTRA_CLAIM');
      for (const order of ['raw-first', 'raw-last']) {
        const core = { ...freshBase(), api: schema.api, ...par, ...ans };
        const payload = order === 'raw-first' ? { ...raw, ...rev(core) } : { ...rev(core), ...raw };
        const tok = signJws(operator.privateKey, OP_KID, payload); // a key the verifier trusts signs the raw claim
        check(`V3 6 VERIFY ${nm}: ${rk} ${order}`, false, verifyFresh(tok, schema), ClaimRejected, 'EXTRA_CLAIM');
      }
    }
    const core = { ...freshBase(), api: schema.api, ...par, ...ans };
    check(`V3 6 NEGATIVE CONTROL ${nm}: same signer, reversed order, no raw claim verifies`, true,
      verifyFresh(signJws(operator.privateKey, OP_KID, rev(core)), schema));
  }
}

// -- Assertion 7 / spec §2: the plain answer is unchanged; no nonce, no attestation.
// SimSwap body is schema-derived (simswap-new.yaml has no /check response
// example; CheckSimSwapInfo, lines 244-252, gives {"swapped": true}).
// Tenure body is the YAML example, tenure-new.yaml:62-65.
{
  const SIM_BODY = JSON.parse('{"swapped": true}');
  const TEN_BODY = JSON.parse('{"tenureDateCheck": true, "contractType": "PAYM"}');
  const mkBase = () => ({ iss: ISS, aud: AUD, iat: NOW, exp: NOW + 300 });
  const mkCtx = (schema, params, over = {}) => ({ privateKey: operator.privateKey, kid: OP_KID, base: mkBase(), schema, params, ...over });
  const failsWith = (fn) => { try { fn(); return false; } catch (e) { return e instanceof AttestationFailed; } };
  const fresh0 = () => { const n = randomUUID(); nonceStore.issue(n); return n; };
  for (const [nm, body, schema, par] of [['SimSwap', SIM_BODY, SIM, SIM_P], ['Tenure', TEN_BODY, TEN, TEN_P]]) {
    const before = JSON.stringify(body);
    const nonce = randomUUID(); nonceStore.issue(nonce);
    const out = attachAttestation(body, nonce, mkCtx(schema, par));
    const { attestation, ...stripped } = out;
    const proj0 = Object.fromEntries(Object.keys(schema.answer).map((k) => [k, body[k]]));
    checkTrue(`V3 7 ${nm}: response minus attestation deep-equals the answer-only projection of the body`, isDeepStrictEqual(stripped, proj0));
    checkTrue(`V3 7 ${nm}: body not mutated, new object, Reflect.ownKeys exactly [answer keys, 'attestation']`,
      JSON.stringify(body) === before && out !== body && !('attestation' in body) &&
      isDeepStrictEqual(Reflect.ownKeys(out), [...Object.keys(schema.answer), 'attestation']));
    const vv = verifyFresh(attestation, schema);
    check(`V3 7 ${nm}: attached attestation verifies`, true, vv);
    checkTrue(`V3 7 ${nm}: contractType never enters the JWS (claims carry none)`, vv.ok && !('contractType' in vv.claims));
    // Negative: a changed body is detected by the same comparison.
    checkTrue(`V3 7 ${nm} NEGATIVE: a body with a changed field is not deep-equal`,
      !isDeepStrictEqual({ ...stripped, [Object.keys(schema.answer)[0]]: !stripped[Object.keys(schema.answer)[0]] }, proj0));
    // Only `undefined` means "no nonce": a plain copy, nothing signed (an
    // unusable key would throw if signing were attempted).
    {
      let r = null;
      try { r = attachAttestation(body, undefined, mkCtx(schema, par, { privateKey: undefined })); } catch { r = null; }
      checkTrue(`V3 7 ${nm}: nonce undefined -> no attestation, nothing signed`,
        r !== null && !('attestation' in r) && r !== body && isDeepStrictEqual(r, body));
    }
    // Any other non-string, or an empty string, is a refusal to attach (R3).
    for (const bad of [null, '', 42]) {
      checkTrue(`V3 7 ${nm}: nonce ${JSON.stringify(bad)} -> AttestationFailed`,
        failsWith(() => attachAttestation(body, bad, mkCtx(schema, par, { privateKey: undefined }))));
    }
    // attestAnswer failure -> AttestationFailed, never the unsigned body (F1).
    const badParams = schema === SIM ? { entry: 'not-a-duration' } : { entry: 12345 };
    checkTrue(`V3 7 ${nm}: attestAnswer fails (params violate the schema type) -> AttestationFailed`,
      failsWith(() => attachAttestation(body, 'n1', mkCtx(schema, badParams))));
    checkTrue(`V3 7 ${nm}: unusable private key -> AttestationFailed`,
      failsWith(() => attachAttestation(body, 'n1', mkCtx(schema, par, { privateKey: undefined }))));
    checkTrue(`V3 7 ${nm}: no signing context at all -> AttestationFailed`,
      failsWith(() => attachAttestation(body, 'n1')));
    // Pre-existing own `attestation`: with a nonce it is never copied (the
    // response carries the fresh token); with no nonce the response is today's
    // response unchanged (copied as is).
    const preSpread = { ...body, attestation: 'old.tok.en' };
    const preParsed = JSON.parse(JSON.stringify(body).replace(/}$/, ',"attestation":"old.tok.en"}'));
    for (const [pn, pre] of [['spread', preSpread], ['JSON.parse', preParsed]]) {
      const npre = randomUUID(); nonceStore.issue(npre);
      let po = null;
      try { po = attachAttestation(pre, npre, mkCtx(schema, par)); } catch { po = null; }
      const vpo = po !== null ? verifyFresh(po.attestation, schema) : null;
      checkTrue(`V3 7 ${nm}: pre-existing attestation (${pn}) + nonce -> never copied; the fresh token is returned and verifies`,
        po !== null && po.attestation !== 'old.tok.en' && vpo.ok === true &&
        isDeepStrictEqual(Reflect.ownKeys(po), [...Object.keys(schema.answer), 'attestation']));
      const pn0 = attachAttestation(pre, undefined, mkCtx(schema, par));
      checkTrue(`V3 7 ${nm}: pre-existing attestation (${pn}), no nonce -> today's response unchanged (deep-equal, new object)`,
        pn0 !== pre && isDeepStrictEqual(pn0, pre));
    }
    // The signed claims come from the BODY. A body whose answer differs from the
    // v3 fixtures (SIM_A/TEN_A, both true) must verify with that same answer.
    for (const flipped of [false, true]) {
      const b2 = nm === 'SimSwap' ? { swapped: flipped } : { tenureDateCheck: flipped, contractType: 'PAYM' };
      const n2 = randomUUID(); nonceStore.issue(n2);
      const o2 = attachAttestation(b2, n2, mkCtx(schema, par));
      const v2 = verifyFresh(o2.attestation, schema);
      const key = Object.keys(schema.answer)[0];
      checkTrue(`V3 7 ${nm}: signed ${key}=${flipped} comes from the body, not the context`,
        v2.ok === true && v2.claims[key] === b2[key] && v2.claims[key] === flipped);
    }
    // Body missing the schema answer key -> AttestationFailed (with and without extra keys).
    checkTrue(`V3 7 ${nm}: body missing the answer key -> AttestationFailed`,
      failsWith(() => attachAttestation({ other: true }, 'n1', mkCtx(schema, par))));
    checkTrue(`V3 7 ${nm}: answer key only inherited (not own) -> AttestationFailed`,
      failsWith(() => attachAttestation(JSON.parse('{"x":1}'), 'n1', mkCtx({ ...schema, answer: { toString: 'boolean' } }, par))));
    // base carrying its own nonce -> AttestationFailed (the nonce argument is the only source).
    checkTrue(`V3 7 ${nm}: base with own nonce -> AttestationFailed`,
      failsWith(() => attachAttestation(body, 'n1', mkCtx(schema, par, { base: { ...mkBase(), nonce: 'smuggled' } }))));
    // Throwing getters: on a NON-answer key and on the answer key -> AttestationFailed.
    const answerKey = Object.keys(schema.answer)[0];
    const thrower = (k) => { const o = { ...body }; Object.defineProperty(o, k, { get() { throw new Error('boom'); }, enumerable: true, configurable: true }); return o; };
    checkTrue(`V3 7 ${nm}: throwing getter on a non-answer key is never read -> signs, keys exact`,
      (() => { try { const r = attachAttestation(thrower('extra'), fresh0(), mkCtx(schema, par)); return isDeepStrictEqual(Reflect.ownKeys(r), [...Object.keys(schema.answer), 'attestation']); } catch { return false; } })());
    checkTrue(`V3 7 ${nm}: throwing getter on the answer key -> AttestationFailed`,
      failsWith(() => attachAttestation(thrower(answerKey), 'n1', mkCtx(schema, par))));
    // T1: ONE snapshot. A getter on the answer key returns false on the first
    // read and true afterwards; the response and the signed claim must agree.
    {
      let reads = 0;
      const gb = { ...body };
      Object.defineProperty(gb, answerKey, { get() { reads += 1; return reads === 1 ? false : true; }, enumerable: true, configurable: true });
      const ng = randomUUID(); nonceStore.issue(ng);
      let og = null;
      try { og = attachAttestation(gb, ng, mkCtx(schema, par)); } catch { og = null; }
      const vg = og !== null ? verifyFresh(og.attestation, schema) : null;
      checkTrue(`V3 7 ${nm} T1: getter on the answer key (false then true) -> response value equals the VERIFIED claim value`,
        og !== null && vg.ok === true && og[answerKey] === vg.claims[answerKey] && vg.claims[answerKey] === false);
    }
    // T2: with no nonce nothing else is checked; today's response comes back unchanged.
    checkTrue(`V3 7 ${nm} T2: no nonce, body with an extra key -> copy unchanged`,
      isDeepStrictEqual(attachAttestation({ ...body, mystery: 1 }, undefined, mkCtx(schema, par)), { ...body, mystery: 1 }));
    checkTrue(`V3 7 ${nm} T2: no nonce, no opts at all -> copy unchanged`,
      isDeepStrictEqual(attachAttestation(body, undefined), body));
    checkTrue(`V3 7 ${nm} T2: no nonce, schema.answer not a plain object -> copy unchanged`,
      isDeepStrictEqual(attachAttestation(body, undefined, mkCtx({ ...schema, answer: [] }, par)), body));
    {
      const rn = attachAttestation(body, undefined, mkCtx(schema, par));
      checkTrue(`V3 7 ${nm} T2: no nonce, Sync26-conformant body -> plain copy, no attestation, nothing signed`,
        rn !== body && isDeepStrictEqual(rn, body) && !('attestation' in rn));
    }
    // Negative control: a valid call verifies and its nonce claim equals the nonce argument.
    {
      const snap = JSON.stringify(body);
      const n3 = randomUUID(); nonceStore.issue(n3);
      const ok = attachAttestation(body, n3, mkCtx(schema, par));
      const v3 = verifyFresh(ok.attestation, schema);
      checkTrue(`V3 7 ${nm} CONTROL: valid call -> attestation last, body not mutated, verifies, nonce claim equals the argument`,
        v3.ok === true && v3.claims.nonce === n3 && Object.keys(ok).at(-1) === 'attestation' &&
        JSON.stringify(body) === snap && !('attestation' in body));
      checkTrue(`V3 7 ${nm} CONTROL: every schema.answer key in the response equals the VERIFIED claim`,
        Object.keys(schema.answer).every((k) => ok[k] === v3.claims[k]));
    }
  }
  // __proto__ as a real own key (JSON.parse), not bracket assignment.
  {
    const np = randomUUID(); nonceStore.issue(np);
    // The body's own "__proto__" key (JSON.parse) is never copied into the signed response.
    const pb2 = JSON.parse('{"__proto__": {"raw": 42}, "swapped": true}');
    const po = attachAttestation(pb2, np, mkCtx(SIM, SIM_P));
    checkTrue('V3 7 own "__proto__" key in the body is not copied; keys exactly [swapped, attestation]',
      !Object.prototype.hasOwnProperty.call(po, '__proto__') && isDeepStrictEqual(Reflect.ownKeys(po), ['swapped', 'attestation']) &&
      Object.getPrototypeOf(po) === Object.prototype);
  }
  // __proto__ as an ANSWER key in the schema: the answer copy must keep it an own property.
  {
    const body = JSON.parse('{"__proto__": true}');
    const sch = { api: 'x/v1/y', params: {}, answer: JSON.parse('{"__proto__": "boolean"}') };
    const np = randomUUID(); nonceStore.issue(np);
    // attestAnswer's own checks decide; either a token or AttestationFailed, never a prototype swap or other throw.
    // Pinned (R7): measured outcome is that it SIGNS. The own JSON.parse'd key is
    // copied by defineProperty, spread copies own keys as data properties, and the
    // verified claims carry it as an own data property.
    let ok = false;
    try {
      const o = attachAttestation(body, np, mkCtx(sch, {}));
      const vv = typeof o.attestation === 'string' ? verifyFresh(o.attestation, sch) : null;
      ok = vv !== null && vv.ok === true && Object.prototype.hasOwnProperty.call(vv.claims, '__proto__') && vv.claims.__proto__ === true;
    } catch { ok = false; }
    checkTrue('V3 7 "__proto__" answer key: signs and verifies with an own __proto__ claim (pinned)', ok);
  }
}

// -- Review-2 guards: R1 Proxy body, R2 own `api`, B build-design probes, R5 date type.
{
  const mkBase = () => ({ iss: ISS, aud: AUD, iat: NOW, exp: NOW + 300 });
  const mkCtx = (schema, params, over = {}) => ({ privateKey: operator.privateKey, kid: OP_KID, base: mkBase(), schema, params, ...over });
  const failsWith = (fn) => { try { fn(); return false; } catch (e) { return e instanceof AttestationFailed; } };
  const typeErr = (fn) => { try { fn(); return false; } catch (e) { return e instanceof TypeError && !(e instanceof AttestationFailed); } };
  const fresh = () => { const n = randomUUID(); nonceStore.issue(n); return n; };

  // R1: a Proxy whose getPrototypeOf trap throws must not escape as anything but TypeError.
  const trapBody = new Proxy({ swapped: true }, { getPrototypeOf() { throw new Error('trap'); } });
  checkTrue('V3 R1 Proxy body with throwing getPrototypeOf trap (nonce) -> TypeError',
    typeErr(() => attachAttestation(trapBody, 'n1', mkCtx(SIM, SIM_P))));
  checkTrue('V3 R1 Proxy body with throwing getPrototypeOf trap (no nonce) -> TypeError',
    typeErr(() => attachAttestation(trapBody, undefined, mkCtx(SIM, SIM_P))));
  checkTrue('V3 R1 CONTROL: array body -> TypeError (same class)', typeErr(() => attachAttestation([], 'n1', mkCtx(SIM, SIM_P))));

  // R2: schema without an OWN api never signs or verifies, even when Object.prototype.api is polluted.
  {
    const noOwnApi = { params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } };
    const { token: goodTok } = signed(SIM, SIM_P, SIM_A);
    let polluted = null;
    try {
      Object.prototype.api = 'sim-swap/v2/check';
      polluted = {
        attest: attestAnswer(operator.privateKey, OP_KID, freshBase(), noOwnApi, SIM_P, SIM_A),
        verify: verifyFresh(goodTok, noOwnApi),
        attach: failsWith(() => attachAttestation({ swapped: true }, fresh(), mkCtx(noOwnApi, SIM_P))),
        control: attestAnswer(operator.privateKey, OP_KID, freshBase(), SIM, SIM_P, SIM_A),
      };
    } finally { delete Object.prototype.api; }
    check('V3 R2 no own api + polluted Object.prototype.api: attest refuses', false, polluted.attest, ClaimRejected, 'MALFORMED_INPUT');
    check('V3 R2 no own api + polluted Object.prototype.api: verify refuses', false, polluted.verify, ClaimRejected, 'MALFORMED_INPUT');
    checkTrue('V3 R2 no own api + polluted Object.prototype.api: attachAttestation -> AttestationFailed', polluted.attach);
    checkTrue('V3 R2 CONTROL: own-api schema still signs while polluted', typeof polluted.control === 'string');
    checkTrue('V3 R2 pollution cleaned up', !('api' in Object.prototype));
  }

  // B: the BUILD design. The signed response is made ONLY of the answer keys and
  // `attestation`; nothing else from the body is copied. Every probe runs on both schemas.
  {
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const def = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
    const API = {
      sim: { schema: SIM, params: SIM_P, ak: 'swapped', val: true, name: 'SimSwap' },
      ten: { schema: TEN, params: TEN_P, ak: 'tenureDateCheck', val: true, name: 'Tenure' },
    };
    const goodBody = (a) => a === 'sim' ? JSON.parse('{"swapped": true}') : JSON.parse('{"tenureDateCheck": true, "contractType": "PAYM"}');
    const mkOpts = (a, over = {}) => mkCtx(API[a].schema, API[a].params, over);
    const probes = [];
    const P = (name, api, expect, make, cleanup) => probes.push({ name, api, expect, make, cleanup });
    for (const a of ['sim', 'ten']) {
      const k = API[a].ak;
      const mk = (extra, nonce = 'N') => () => ({ body: { ...goodBody(a), ...extra }, nonce, opts: mkOpts(a) });
      P('baseline good body', a, 'OK', mk({}));
      P('raw extra field latestSimChange', a, 'OK', mk({ latestSimChange: '2024-05-06T07:08:09Z' }));
      P('contractType PAYM', a, 'OK', mk({ contractType: 'PAYM' }));
      P('contractType object {since,raw}', a, 'OK', mk({ contractType: { since: '2019-03-04', raw: 42 } }));
      P('unknown key', a, 'OK', mk({ mystery: 'x' }));
      P('Symbol-keyed raw value', a, 'OK', mk({ [Symbol('raw')]: '2019-03-04' }));
      P('own __proto__ key via JSON.parse', a, 'OK', () => ({ body: JSON.parse(`{"${k}": true, "__proto__": {"raw": 42}}`), nonce: 'N', opts: mkOpts(a) }));
      P('body already has attestation', a, 'OK', mk({ attestation: 'FORGED.TOKEN.X' }));
      P('getter on answer key false then true', a, 'OK', () => {
        let n = 0; const body = {}; Object.defineProperty(body, k, { enumerable: true, get() { return n++ === 0 ? false : true; } });
        return { body, nonce: 'N', opts: mkOpts(a) };
      });
      P('getter on non-answer key throws', a, 'OK', () => {
        const body = goodBody(a); Object.defineProperty(body, 'boom', { enumerable: true, get() { throw new Error('boom'); } });
        return { body, nonce: 'N', opts: mkOpts(a) };
      });
      P('Proxy body getPrototypeOf throws', a, 'TE', () => ({ body: new Proxy(goodBody(a), { getPrototypeOf() { throw new Error('trap'); } }), nonce: 'N', opts: mkOpts(a) }));
      P('Proxy body hides attestation (has/ownKeys)', a, 'OK', () => ({ body: new Proxy({ ...goodBody(a), attestation: 'X' }, {
        ownKeys(t) { return Reflect.ownKeys(t).filter((x) => x !== 'attestation'); },
        has(t, p) { return p !== 'attestation' && p in t; },
        getOwnPropertyDescriptor(t, p) { return p === 'attestation' ? undefined : Reflect.getOwnPropertyDescriptor(t, p); } }), nonce: 'N', opts: mkOpts(a) }));
      P('Proxy body shows attestation (flip)', a, 'OK', () => { let n = 0; return { body: new Proxy(goodBody(a), {
        ownKeys(t) { return n++ % 2 ? [...Reflect.ownKeys(t), 'attestation'] : Reflect.ownKeys(t); },
        getOwnPropertyDescriptor(t, p) { return p === 'attestation' ? { value: 'X', enumerable: true, configurable: true, writable: true } : Reflect.getOwnPropertyDescriptor(t, p); },
        get(t, p, r) { return p === 'attestation' ? 'X' : Reflect.get(t, p, r); } }), nonce: 'N', opts: mkOpts(a) }; });
      P('opts getter for schema throws', a, 'AF', () => { const opts = mkOpts(a); delete opts.schema; Object.defineProperty(opts, 'schema', { enumerable: true, get() { throw new Error('opts boom'); } }); return { body: goodBody(a), nonce: 'N', opts }; });
      P('opts is null', a, 'AF', () => ({ body: goodBody(a), nonce: 'N', opts: null }));
      P('opts undefined', a, 'AF', () => ({ body: goodBody(a), nonce: 'N', opts: undefined }));
      P('schema no own api, Object.prototype.api polluted', a, 'AF', () => {
        Object.prototype.api = API[a].schema.api;
        return { body: goodBody(a), nonce: 'N', opts: mkOpts(a, { schema: { params: API[a].schema.params, answer: API[a].schema.answer } }) };
      }, () => { delete Object.prototype.api; });
      P('schema.answer getter changes between reads', a, 'OK', () => {
        let n = 0; const schema = { api: API[a].schema.api, params: API[a].schema.params };
        Object.defineProperty(schema, 'answer', { enumerable: true, get() { return n++ === 0 ? API[a].schema.answer : { other: 'boolean', [k]: 'boolean' }; } });
        return { body: goodBody(a), nonce: 'N', opts: mkOpts(a, { schema }) };
      });
      P('answer value wrong type (string for boolean)', a, 'AF', () => ({ body: { [k]: '2024-01-01T00:00:00Z' }, nonce: 'N', opts: mkOpts(a) }));
      P('answer key missing from body', a, 'AF', () => ({ body: { other: true }, nonce: 'N', opts: mkOpts(a) }));
      P('answer key inherited (Object.create proto, non-plain)', a, 'TE', () => ({ body: Object.create({ [k]: true }), nonce: 'N', opts: mkOpts(a) }));
      P('nonce 12345', a, 'AF', mk({}, 12345));
      P('nonce null', a, 'AF', mk({}, null));
      P('nonce empty string', a, 'AF', mk({}, ''));
      P('base carries own nonce', a, 'AF', () => ({ body: goodBody(a), nonce: 'N', opts: mkOpts(a, { base: { ...mkBase(), nonce: 'EVIL' } }) }));
      P('signer key unusable (undefined)', a, 'AF', () => ({ body: goodBody(a), nonce: 'N', opts: mkOpts(a, { privateKey: undefined }) }));
      P('signer key unusable (garbage object)', a, 'AF', () => ({ body: goodBody(a), nonce: 'N', opts: mkOpts(a, { privateKey: { not: 'a key' } }) }));
      P('non-plain body (array)', a, 'TE', () => ({ body: [], nonce: 'N', opts: mkOpts(a) }));
      P('non-plain body (null)', a, 'TE', () => ({ body: null, nonce: 'N', opts: mkOpts(a) }));
    }
    for (const pr of probes) {
      const label = `V3 B [${API[pr.api].name}] ${pr.name}`;
      let outcome = 'OK', out = null, thrown = null;
      try {
        const m = pr.make();
        out = attachAttestation(m.body, m.nonce === 'N' ? fresh() : m.nonce, m.opts);
      } catch (e) {
        thrown = e;
        outcome = e instanceof AttestationFailed ? 'AF' : e instanceof TypeError ? 'TE' : 'OTHER';
      } finally { if (pr.cleanup) pr.cleanup(); }
      if (outcome !== 'OK') { checkTrue(`${label} -> ${pr.expect === 'AF' ? 'AttestationFailed' : 'TypeError'}`, outcome === pr.expect); continue; }
      const ak = API[pr.api].ak;
      const v = pr.expect === 'OK' ? verifyFresh(out.attestation, API[pr.api].schema) : null;
      const wantVal = pr.name.startsWith('getter on answer key') ? false : API[pr.api].val;
      checkTrue(`${label} -> signs; Reflect.ownKeys exactly [answer key, 'attestation']; answer equals the verified claim; attestation is the fresh token`,
        pr.expect === 'OK' && isDeepStrictEqual(Reflect.ownKeys(out), [ak, 'attestation']) && v.ok === true &&
        out[ak] === v.claims[ak] && v.claims[ak] === wantVal &&
        typeof out.attestation === 'string' && !out.attestation.startsWith('FORGED') && out.attestation !== 'X');
    }
    // A bad nonce is refused BEFORE opts is touched: no signing material is read at all.
    for (const a of ['sim', 'ten']) {
      for (const bad of [12345, null, '']) {
        let reads = 0;
        const opts = { kid: OP_KID, base: mkBase(), schema: API[a].schema, params: API[a].params };
        Object.defineProperty(opts, 'privateKey', { enumerable: true, get() { reads += 1; return operator.privateKey; } });
        checkTrue(`V3 B [${API[a].name}] nonce ${JSON.stringify(bad)} -> AttestationFailed, opts never read`,
          failsWith(() => attachAttestation(goodBody(a), bad, opts)) && reads === 0);
      }
    }
    // contractType never appears in a signed Tenure response (nor in its claims).
    {
      const r = attachAttestation(goodBody('ten'), fresh(), mkOpts('ten'));
      const tv = verifyFresh(r.attestation, TEN);
      checkTrue('V3 B [Tenure] contractType never appears in a signed response or its claims',
        !own(r, 'contractType') && tv.ok === true && !own(tv.claims, 'contractType'));
    }
    // cause of a signing failure is the refusal reason.
    {
      let e = null;
      try { attachAttestation(goodBody('sim'), fresh(), mkOpts('sim', { params: { entry: 'not-a-duration' } })); } catch (x) { e = x; }
      checkTrue('V3 B [SimSwap] attestAnswer failure -> AttestationFailed whose cause is ClaimRejected',
        e instanceof AttestationFailed && e.cause instanceof ClaimRejected);
    }
    // no-nonce: today's Sync26 response, deep-equal, a NEW object, contractType kept.
    for (const [nm, body] of [['Sync26 SimSwap {swapped:true}', { swapped: true }], ['Sync26 Tenure with contractType', { tenureDateCheck: true, contractType: 'PAYM' }]]) {
      const r = attachAttestation(body, undefined, undefined);
      checkTrue(`V3 B [no-nonce] ${nm} -> deep-equal, new object, no attestation`,
        isDeepStrictEqual(r, body) && r !== body && !own(r, 'attestation'));
    }
    checkTrue('V3 B [no-nonce] array body -> TypeError (not AttestationFailed)', typeErr(() => attachAttestation([], undefined, undefined)));

    // U3: schema properties are read once.
    {
      let reads = 0;
      const sch = { api: SIM.api, params: SIM.params };
      Object.defineProperty(sch, 'answer', { get() { reads += 1; return reads === 1 ? { swapped: 'boolean' } : { other: 'boolean' }; }, enumerable: true, configurable: true });
      let og = null;
      try { og = attachAttestation(JSON.parse('{"swapped": true}'), fresh(), mkCtx(sch, SIM_P)); } catch (e) { og = e instanceof AttestationFailed ? 'failed' : null; }
      const vg = (og && og !== 'failed') ? verifyFresh(og.attestation, SIM) : null;
      checkTrue('V3 U3 schema.answer getter changing between reads: the FIRST read is used throughout; response equals the verified claim',
        vg !== null && vg.ok === true && og.swapped === vg.claims.swapped && vg.claims.swapped === true);
    }

    // U4: the underlying reason rides along as `cause`.
    {
      let e1 = null;
      try { attachAttestation({ swapped: 'yes' }, fresh(), mkCtx(SIM, SIM_P)); } catch (e) { e1 = e; }
      checkTrue('V3 U4 wrong-typed answer value -> AttestationFailed with cause ClaimRejected WRONG_TYPE',
        e1 instanceof AttestationFailed && e1.cause instanceof ClaimRejected && e1.cause.code === 'WRONG_TYPE');
      let e2 = null;
      try { attachAttestation({ swapped: true }, fresh(), mkCtx(SIM, SIM_P, { base: { ...mkBase(), api: 'x' } })); } catch (e) { e2 = e; }
      checkTrue('V3 U4 base carrying api -> AttestationFailed with cause ClaimRejected RESERVED_CLAIM',
        e2 instanceof AttestationFailed && e2.cause instanceof ClaimRejected && e2.cause.code === 'RESERVED_CLAIM');
      let ea = null;
      try { attachAttestation({ attestation: true }, fresh(), mkCtx({ api: SIM.api, params: SIM.params, answer: { attestation: 'boolean' } }, SIM_P)); } catch (e) { ea = e; }
      checkTrue('V3 ATTESTATION NAMED IN schema.answer (attach) -> AttestationFailed with cause ClaimRejected RESERVED_CLAIM',
        ea instanceof AttestationFailed && ea.cause instanceof ClaimRejected && ea.cause.code === 'RESERVED_CLAIM');
      let e3 = null;
      const tb = {}; Object.defineProperty(tb, 'swapped', { get() { throw new Error('boom'); }, enumerable: true });
      try { attachAttestation(tb, fresh(), mkCtx(SIM, SIM_P)); } catch (e) { e3 = e; }
      checkTrue('V3 U4 throwing getter (catch-all) -> AttestationFailed with the original Error as cause',
        e3 instanceof AttestationFailed && e3.cause instanceof Error && e3.cause.message === 'boom');
    }
  }

  // R5: 'date' type, at attest and at verify. V3-M2 (option 1): no named
  // schema signs a date any more, so the type is exercised on a test-local
  // schema that declares one; the same refusals hold.
  {
    const DATE_SCHEMA = { api: TEN.api, params: { tenureDate: 'date' }, answer: TEN.answer };
    for (const bad of ['2024-02-30', '2023-02-29', '2024-1-01', '2024-01-01T12:34:56Z', 'yesterday', '']) {
      check(`V3 R5 tenureDate ${JSON.stringify(bad)} refused at attest`, false,
        attestAnswer(operator.privateKey, OP_KID, freshBase(), DATE_SCHEMA, { tenureDate: bad }, TEN_A), ClaimRejected, 'WRONG_TYPE');
    }
    const forgedBad = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: TEN.api, tenureDate: '2024-02-30', ...TEN_A });
    check('V3 R5 tenureDate "2024-02-30" refused at verify (signer-trusted token)', false, verifyFresh(forgedBad, DATE_SCHEMA), ClaimRejected, 'WRONG_TYPE');
    for (const good of ['2024-01-01', '2024-02-29']) {
      const t = attestAnswer(operator.privateKey, OP_KID, freshBase(), DATE_SCHEMA, { tenureDate: good }, TEN_A);
      check(`V3 R5 NEGATIVE CONTROL tenureDate ${good} signs and verifies`, true, typeof t === 'string' ? verifyFresh(t, DATE_SCHEMA) : t);
    }
  }

  // R8 (V3-M2): refusals are API-bound, proven in this suite on its own.
  {
    const mk = () => attestRefusal(operator.privateKey, OP_KID, freshBase(), OUT_OF_RANGE, SIM.api);
    const vr = (t, expectedApi) => verifyRefusal(t, resolveKey, { ...vOpts(), expectedApi });
    check('V3 R8 SimSwap refusal checked as Tenure', false, vr(mk(), TEN.api), ClaimRejected, 'API_MISMATCH');
    check('V3 R8 NEGATIVE CONTROL SimSwap refusal checked as SimSwap verifies', true, vr(mk(), SIM.api));
    const noApi = signJws(operator.privateKey, OP_KID, { ...freshBase(), error: OUT_OF_RANGE });
    check('V3 R8 refusal with no api claim', false, vr(noApi, SIM.api), ClaimRejected, 'API_MISMATCH');
    check('V3 R8 no expectedApi given fails closed', false, vr(mk(), undefined), ClaimRejected, 'API_MISMATCH');
  }

  // R6 (V3-M2): the `duration` type of the signed `entry`, at attest and at
  // verify, on the real schemas. P0D, leading zeros, lower case, a bare number
  // and a month unit are all refused; P90D / P2Y verify.
  {
    for (const [nm, schema, ans] of [['SIM_SWAP_CHECK', SIM, SIM_A], ['TENURE_CHECK', TEN, TEN_A]]) {
      for (const bad of ['P0D', 'P090D', 'p90d', '90', 'P3M', 'P', 'PD', 'P-1D', 'P1.5D', '', 'P90D ']) {
        check(`V3 R6 ${nm} entry ${JSON.stringify(bad)} refused at attest`, false,
          attestAnswer(operator.privateKey, OP_KID, freshBase(), schema, { entry: bad }, ans), ClaimRejected, 'WRONG_TYPE');
      }
      const forgedBad = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: schema.api, entry: 'P0D', ...ans });
      check(`V3 R6 ${nm} entry "P0D" refused at verify (signer-trusted token)`, false, verifyFresh(forgedBad, schema, 'P0D'), ClaimRejected, 'ENTRY_MISMATCH');
      for (const good of ['P90D', 'P2Y']) {
        const t = attestAnswer(operator.privateKey, OP_KID, freshBase(), schema, { entry: good }, ans);
        check(`V3 R6 NEGATIVE CONTROL ${nm} entry ${good} signs and verifies`, true, typeof t === 'string' ? verifyFresh(t, schema, good) : t);
      }
      // F7: one parser. An over-long or leading-zero entry fails typeOk at attest and at verify.
      for (const bad of ['P99999999999999999999D', 'P0090D', 'P00D', 'P9007199254740992D']) {
        check(`V3 R6 ${nm} entry ${bad} refused at attest`, false,
          attestAnswer(operator.privateKey, OP_KID, freshBase(), schema, { entry: bad }, ans), ClaimRejected, 'WRONG_TYPE');
        const f = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: schema.api, entry: bad, ...ans });
        check(`V3 R6 ${nm} entry ${bad} refused at verify`, false, verifyFresh(f, schema, bad), ClaimRejected, 'ENTRY_MISMATCH');
      }
    }
    checkTrue('V3 R6 parseDuration: P90D=90, P2Y=730, P1Y=P365D, junk null',
      parseDuration('P90D') === 90 && parseDuration('P2Y') === 730 && parseDuration('P1Y') === parseDuration('P365D') &&
      parseDuration('P3M') === null && parseDuration('P090D') === null && parseDuration(90) === null);
  }

  // R9 (V3-M2, F1): the requester says which entry it asked for. A valid
  // answer for a DIFFERENT entry, or no expectedEntry, is refused.
  {
    const asked = 'P90D';
    const tOther = attestAnswer(operator.privateKey, OP_KID, freshBase(), SIM, { entry: 'P30D' }, SIM_A);
    check('V3 R9 menu 30/60/90: asked P90D, signed P30D -> LOOSER', false, verifyFresh(tOther, SIM, asked), ClaimRejected, 'LOOSER');
    const tRight = attestAnswer(operator.privateKey, OP_KID, freshBase(), SIM, { entry: asked }, SIM_A);
    const noExp = verifyAnswer(tRight, resolveKey, SIM, vOpts());
    check('V3 R9 expectedEntry missing -> ENTRY_MISMATCH (fail closed)', false, noExp, ClaimRejected, 'ENTRY_MISMATCH');
    const tRight2 = attestAnswer(operator.privateKey, OP_KID, freshBase(), SIM, { entry: asked }, SIM_A);
    const numExp = verifyAnswer(tRight2, resolveKey, SIM, { ...vOpts(), expectedEntry: 90 });
    check('V3 R9 expectedEntry not a string -> ENTRY_MISMATCH', false, numExp, ClaimRejected, 'ENTRY_MISMATCH');
    const tRight3 = attestAnswer(operator.privateKey, OP_KID, freshBase(), SIM, { entry: asked }, SIM_A);
    check('V3 R9 NEGATIVE CONTROL: the right entry verifies', true, verifyFresh(tRight3, SIM, asked));
    // A schema with no `entry` in params ignores the option.
    const noEntry = { api: 'x/v1/y', params: { n: 'integer' }, answer: { ok: 'boolean' } };
    const tn = attestAnswer(operator.privateKey, OP_KID, freshBase(), noEntry, { n: 1 }, { ok: true });
    check('V3 R9 schema without entry ignores expectedEntry', true, verifyAnswer(tn, resolveKey, noEntry, vOpts()));
  }

  // R10 (V3-M2, F3): a refusal's api is one of KNOWN_APIS, at attest and at verify.
  {
    const free = 'sim-swap/v2/check;2026-10-01';
    check('V3 R10 attestRefusal free-text api refused', false,
      attestRefusal(operator.privateKey, OP_KID, freshBase(), OUT_OF_RANGE, free), ClaimRejected, 'INVALID_API');
    const hand = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: free, error: OUT_OF_RANGE });
    check('V3 R10 hand-signed free-text api refused at verify', false,
      verifyRefusal(hand, resolveKey, { ...vOpts(), expectedApi: free }), ClaimRejected, 'INVALID_API');
    for (const api of KNOWN_APIS) {
      const t = attestRefusal(operator.privateKey, OP_KID, freshBase(), OUT_OF_RANGE, api);
      check(`V3 R10 NEGATIVE CONTROL known api ${api} refuses and verifies`, true,
        typeof t === 'string' ? verifyRefusal(t, resolveKey, { ...vOpts(), expectedApi: api }) : t);
    }
    checkTrue('V3 R10 KNOWN_APIS is the two named schemas', KNOWN_APIS.length === 2 &&
      KNOWN_APIS[0] === SIM.api && KNOWN_APIS[1] === TEN.api && Object.isFrozen(KNOWN_APIS));
  }

  // R7 (V3-M2, option 1): no date and no hours value appears in any signed
  // answer or signed refusal. The decoded payload has no `maxAge`, no
  // `tenureDate`, and no value that looks like a date; the signed question is
  // the menu entry only. NEGATIVE CONTROL: the same assertion catches a
  // payload built with the old shape (maxAge / tenureDate signed).
  {
    const DATE_LIKE = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
    const noRawQuestion = (payload) =>
      !Object.prototype.hasOwnProperty.call(payload, 'maxAge') &&
      !Object.prototype.hasOwnProperty.call(payload, 'tenureDate') &&
      !Object.values(payload).some((v) => typeof v === 'string' && DATE_LIKE.test(v));
    const decode = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    for (const [nm, schema, par, ans] of [['SIM_SWAP_CHECK', SIM, SIM_P, SIM_A], ['TENURE_CHECK', TEN, TEN_P, TEN_A]]) {
      const { token } = signed(schema, par, ans);
      checkTrue(`V3 R7 ${nm} signed answer carries no maxAge, no tenureDate, no date value`,
        typeof token === 'string' && noRawQuestion(decode(token)));
      const rt = attestRefusal(operator.privateKey, OP_KID, freshBase(), OUT_OF_RANGE, schema.api);
      checkTrue(`V3 R7 ${nm} signed refusal carries no maxAge, no tenureDate, no date value`,
        typeof rt === 'string' && noRawQuestion(decode(rt)));
    }
    // Negative control: old-shape payloads (V3-M1 / the abandoned both-claims
    // shape) are caught by the very same assertion.
    const oldSim = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: SIM.api, maxAge: 2160, swapped: false });
    const oldSimEntry = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: SIM.api, maxAge: 2160, entry: 'P90D', swapped: false });
    const oldTen = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: TEN.api, tenureDate: '2024-11-23', tenureDateCheck: true });
    const oddDate = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: TEN.api, entry: '2024-11-23', tenureDateCheck: true });
    checkTrue('V3 R7 NEGATIVE CONTROL old shape with maxAge is caught', !noRawQuestion(decode(oldSim)) && !noRawQuestion(decode(oldSimEntry)));
    checkTrue('V3 R7 NEGATIVE CONTROL old shape with tenureDate is caught', !noRawQuestion(decode(oldTen)));
    checkTrue('V3 R7 NEGATIVE CONTROL a date value under another name is caught', !noRawQuestion(decode(oddDate)));
    // And verifyAnswer itself refuses the old shapes (EXTRA_CLAIM): the
    // schema is closed, so a leaky signer cannot ship a date or hours value.
    check('V3 R7 verifyAnswer refuses a SimSwap token that also signs maxAge', false,
      verifyFresh(oldSimEntry, SIM), ClaimRejected, 'EXTRA_CLAIM');
    const oldTenEntry = signJws(operator.privateKey, OP_KID, { ...freshBase(), api: TEN.api, tenureDate: '2024-11-23', entry: 'P2Y', tenureDateCheck: true });
    check('V3 R7 verifyAnswer refuses a Tenure token that also signs tenureDate', false,
      verifyFresh(oldTenEntry, TEN), ClaimRejected, 'EXTRA_CLAIM');
  }
}

// V3-M3 §4.3: entry comparison. Equal entry: any answer; stricter entry: pass
// answer only; looser entry: refused.
{
  const SIM_PASS = { swapped: false }, SIM_FAIL = { swapped: true };
  const ent = (e, ans) => attestAnswer(operator.privateKey, OP_KID, freshBase(), SIM, { entry: e }, ans);
  const ver = (t, r) => verifyAnswer(t, resolveKey, SIM, { ...vOpts(), expectedEntry: r });
  check('V3 §4.3 equal entry, pass answer accepted', true, ver(ent('P90D', SIM_PASS), 'P90D'));
  check('V3 §4.3 equal entry, fail answer accepted', true, ver(ent('P90D', SIM_FAIL), 'P90D'));
  check('V3 §4.3 stricter entry (P90D vs P60D), pass answer accepted', true, ver(ent('P90D', SIM_PASS), 'P60D'));
  check('V3 §4.3 stricter entry (P90D vs P60D), fail answer -> NOT_PASS', false, ver(ent('P90D', SIM_FAIL), 'P60D'), ClaimRejected, 'NOT_PASS');
  check('V3 §4.3 looser entry (P60D vs P90D) -> LOOSER', false, ver(ent('P60D', SIM_PASS), 'P90D'), ClaimRejected, 'LOOSER');
  check('V3 §4.3 P1Y vs P365D accepted as equal (fail answer too)', true, ver(ent('P1Y', SIM_FAIL), 'P365D'));
  check('V3 §4.3 P2Y vs P731D -> LOOSER', false, ver(ent('P2Y', SIM_PASS), 'P731D'), ClaimRejected, 'LOOSER');
  // Negative control: the looser case is refused only because of the
  // comparison. With the comparison reversed (E > R refused, E < R accepted)
  // the same case would be accepted, and the equal case still passes.
  const cmp = (e, r, pass) => { const a = parseDuration(e), b = parseDuration(r); return a === b || (a > b && pass); };
  const cmpReversed = (e, r, pass) => { const a = parseDuration(e), b = parseDuration(r); return a === b || (a < b && pass); };
  checkTrue('V3 §4.3 NEGATIVE CONTROL looser case is refused by the rule, accepted if the comparison is reversed',
    cmp('P60D', 'P90D', true) === false && cmpReversed('P60D', 'P90D', true) === true && cmp('P90D', 'P90D', false) === true);
}

conclude(393);

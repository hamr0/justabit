// PoC module V2-M1 — standalone check for m1-jws.mjs (JWS/EdDSA attestation
// core, built alongside the untouched raw-Ed25519 m1-attestation.mjs).
// Run: node camara/v2/poc/m1-jws-check.mjs
// Negatives first, then positives, same runner style/exit-code discipline as
// the other check files (a shrinking suite must not read as green).
import { generateKeyPairSync, randomUUID, sign as rawSign } from 'node:crypto';
import {
  signJws, verifyJws, compactSize,
  attestAnswer, verifyAnswer, attestRefusal, verifyRefusal,
  makeNonceStore, JwsRejected, ClaimRejected,
  SIM_SWAP_CHECK, OFF_MENU_THRESHOLD,
} from './m1-jws.mjs';

// Test-only fixture (moved out of m1-jws.mjs — it had no real caller
// anywhere in the tree): a second schema, unrelated to SimSwap, proving the
// schema mechanism in attestAnswer/verifyAnswer is not SimSwap-specific.
const TENURE_CHECK = Object.freeze({
  params: Object.freeze({ tenureDate: 'string' }),
  answer: Object.freeze({ tenureDateCheck: 'boolean' }),
});

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
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  const wrongResolve = () => impostor.publicKey;
  check('11 WRONG KEY FROM resolveKey', false, verifyJws(token, wrongResolve), JwsRejected);
}

// 12 FLIPPED PAYLOAD BYTE — one bit tampered after signing.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
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
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false, swapTimestamp: '2026-01-02' });
  check('14 EXTRA CLAIM', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'EXTRA_CLAIM');
}

// 15 MISSING CLAIM — labelled and in-window, but the schema's own answer
// field is absent.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160 });
  check('15 MISSING CLAIM', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'MISSING_CLAIM');
}

// 16 WRONG TYPE — the string "false", which is truthy: a caller testing
// `claims.swapped` naively would read it as a yes.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: 'false' });
  check('16 WRONG TYPE (swapped:"false")', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'WRONG_TYPE');
}

// 17 EXP <= IAT — attestAnswer itself would refuse to construct this (same
// checkClosedPayload runs at build time), so this bypasses it via signJws
// directly to prove verifyAnswer holds the line independently too.
{
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const badBase = { iss: ISS, aud: AUD, nonce, iat: NOW, exp: NOW };
  const token = signJws(operator.privateKey, OP_KID, { ...badBase, maxAge: 2160, swapped: false });
  check('17 EXP <= IAT', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'EXP_NOT_AFTER_IAT');
}

// 18 ISS MISMATCH — signed and structurally fine, wrong issuer claimed.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  check('18 ISS MISMATCH', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: 'someone-else.example', expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'ISS_MISMATCH');
}

// 19 AUD MISMATCH — a valid answer to a different requester.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  check('19 AUD MISMATCH', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: 'someone-else.example', nonceStore, now: NOW }),
    ClaimRejected, 'AUD_MISMATCH');
}

// 20 EXPIRED — exp already in the past relative to the injected clock, but
// still strictly after iat (so this exercises the EXPIRED check alone, not
// EXP_NOT_AFTER_IAT, which case 17 already covers).
{
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const base = { iss: ISS, aud: AUD, nonce, iat: NOW - 1000, exp: NOW - 500 };
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  check('20 EXPIRED', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'EXPIRED');
}

// 21 UNKNOWN NONCE — never issued into the store at all.
{
  const nonce = randomUUID(); // deliberately never nonceStore.issue()'d
  const token = signJws(operator.privateKey, OP_KID, { iss: ISS, aud: AUD, nonce, iat: NOW, exp: NOW + 300, maxAge: 2160, swapped: false });
  check('21 UNKNOWN NONCE', false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'NONCE_REJECTED');
}

// 22 REPLAYED NONCE — the SAME token verified twice; the first consumes the
// nonce, the second must find it already used.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  const first = verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
  const second = verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
  checkTrue('22a REPLAYED NONCE first use accepts', first.ok === true);
  check('22b REPLAYED NONCE second use rejects', false, second, ClaimRejected, 'NONCE_REJECTED');
}

// 23 REFUSAL ERROR OFF ENUM — attestRefusal itself would refuse to build
// this; bypass via signJws to prove verifyRefusal holds independently.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, error: 'MADE_UP_REASON' });
  check('23 REFUSAL ERROR OFF ENUM', false,
    verifyRefusal(token, resolveKey, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'INVALID_ERROR');
}

// 24 WRONG SCHEMA — a valid SIM_SWAP_CHECK answer verified against
// TENURE_CHECK's schema; every field that IS present is well-formed, but
// the schemas don't overlap, so the closed set must still reject it.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  check('24 WRONG SCHEMA (SIM_SWAP token vs TENURE_CHECK)', false,
    verifyAnswer(token, resolveKey, TENURE_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'MISSING_CLAIM');
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
  const collidingSchema = { params: { iat: 'boolean' }, answer: { swapped: 'boolean' } };
  check('26 RESERVED CLAIM IN params (schema.params.iat collides with base)', false,
    attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { iat: true }, { swapped: false }),
    ClaimRejected, 'RESERVED_CLAIM');
}

// 27 RESERVED CLAIM IN answer — same collision, on the `answer` side of the
// schema instead of `params`.
{
  const base = freshBase();
  const collidingSchema = { params: { maxAge: 'integer' }, answer: { exp: 'boolean' } };
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
  const exploitSchema = { params: { iat: 'boolean' }, answer: { swapped: 'boolean' } };
  check('28 PROVEN EXPLOIT (exp=1400/iat=2000, schema.params.iat) now refused', false,
    attestAnswer(operator.privateKey, OP_KID, exploitBase, exploitSchema, { iat: true }, { swapped: false }),
    ClaimRejected, 'RESERVED_CLAIM');
}

// 29 NEGATIVE CONTROL — a non-colliding schema must still sign and verify
// normally; the reserved-claim guard must not be reachable from ordinary
// schemas, only from ones that actually name a base claim.
{
  const base = freshBase();
  const okSchema = { params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, okSchema, { maxAge: 2160 }, { swapped: false });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, okSchema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
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
  const collidingSchema = { params: { swapped: 'integer' }, answer: { swapped: 'boolean' } };
  check('34 SCHEMA SELF COLLISION AT ATTEST (params.swapped vs answer.swapped)', false,
    attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { swapped: 5 }, { swapped: true }),
    ClaimRejected, 'SCHEMA_SELF_COLLISION');
}

// 35 SCHEMA SELF COLLISION AT VERIFY — attestAnswer would refuse to build
// this (case 34), so this bypasses it via signJws directly to prove
// verifyAnswer holds the same line independently.
{
  const base = freshBase();
  const collidingSchema = { params: { swapped: 'integer' }, answer: { swapped: 'boolean' } };
  const token = signJws(operator.privateKey, OP_KID, { ...base, swapped: true });
  check('35 SCHEMA SELF COLLISION AT VERIFY (params.swapped vs answer.swapped)', false,
    verifyAnswer(token, resolveKey, collidingSchema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
    ClaimRejected, 'SCHEMA_SELF_COLLISION');
}

// 36 NEGATIVE CONTROL — a normal non-self-colliding schema must still sign
// and verify; the new self-collision guard must not be reachable from
// ordinary schemas, only from ones that actually name the same claim on
// both sides.
{
  const base = freshBase();
  const okSchema = { params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, okSchema, { maxAge: 2160 }, { swapped: false });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, okSchema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
    : token;
  check('36 NEGATIVE CONTROL (non-self-colliding schema still signs and verifies)', true, v);
}

// 37 VERIFYANSWER MALFORMED SCHEMA {} NEVER THROWS — the regression this fix
// closes: checkNoSelfCollision's Object.keys(schema.params) threw a
// TypeError on an empty schema instead of returning a clean rejection
// (pre-fix behaviour was ClaimRejected/EXTRA_CLAIM). Must reject, not throw.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, {}, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
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
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, null, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
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
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, { answer: { swapped: 'boolean' } },
      { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
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
  const token = attestAnswer(operator.privateKey, OP_KID, base, SIM_SWAP_CHECK, { maxAge: 2160 }, { swapped: false });
  const isString = typeof token === 'string';
  const v = isString
    ? verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
    : token;
  check('30 SIM_SWAP ROUND TRIP', true, v, undefined, undefined);
  const shapeOk = isString && v.ok && Object.keys(v.claims).join(',') === 'iss,aud,nonce,iat,exp,maxAge,swapped' &&
    v.claims.iss === ISS && v.claims.aud === AUD && v.claims.nonce === base.nonce &&
    v.claims.maxAge === 2160 && v.claims.swapped === false;
  checkTrue('30b SIM_SWAP payload matches docs §4 shape exactly', shapeOk);
}

// 31 TENURE ROUND TRIP — proves the schema mechanism generalizes beyond
// SimSwap.
{
  const base = freshBase();
  const token = attestAnswer(operator.privateKey, OP_KID, base, TENURE_CHECK, { tenureDate: '2024-01-01' }, { tenureDateCheck: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, TENURE_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
    : token;
  check('31 TENURE ROUND TRIP', true, v);
  checkTrue('31b TENURE payload fidelity', v.ok && v.claims.tenureDate === '2024-01-01' && v.claims.tenureDateCheck === true);
}

// 32 REFUSAL ROUND TRIP — a signed excuse, from the closed enum.
{
  const base = freshBase();
  const token = attestRefusal(operator.privateKey, OP_KID, base, OFF_MENU_THRESHOLD);
  const v = typeof token === 'string'
    ? verifyRefusal(token, resolveKey, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
    : token;
  check('32 REFUSAL ROUND TRIP', true, v);
  checkTrue('32b REFUSAL payload fidelity', v.ok && v.claims.error === OFF_MENU_THRESHOLD);
}

// 33 SIZE GUARD — a SIM_SWAP_CHECK answer with a 30-char iss/aud, a UUID
// nonce, and a 20-char kid must fit under the M2 RSA-4096 OAEP cap. The
// cap is DERIVED here from a freshly generated RSA-4096 key (bits/8 - 66),
// never hard-coded, mirroring m2-envelope.mjs's own seal()-side derivation
// exactly — m2 exports the constant 446 but not a standalone deriving
// function, so this re-derives from the same formula against a real key.
{
  const rsaKey = generateKeyPairSync('rsa', { modulusLength: 4096 });
  const modulusBits = rsaKey.publicKey.asymmetricKeyDetails.modulusLength;
  const capacity = modulusBits / 8 - 66;
  const longIss = 'a'.repeat(30);
  const longAud = 'b'.repeat(30);
  const kid20 = 'k'.repeat(20);
  const nonce = randomUUID();
  nonceStore.issue(nonce);
  const base = { iss: longIss, aud: longAud, nonce, iat: NOW, exp: NOW + 300 };
  const token = attestAnswer(operator.privateKey, kid20, base, SIM_SWAP_CHECK, { maxAge: 2160 }, { swapped: false });
  const size = typeof token === 'string' ? compactSize(token) : Infinity;
  checkTrue(`33 SIZE GUARD (${size}B < ${capacity}B derived RSA-4096 OAEP cap)`, typeof token === 'string' && size < capacity);
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
  const baseText = JSON.stringify({ ...base, maxAge: 2160, swapped: false });
  const payloadText = baseText.slice(0, -1) + `,${JSON.stringify(name)}:${JSON.stringify('RAW LEAK ' + name)}}`;
  const token = forge({ alg: 'EdDSA', kid: OP_KID }, payloadText, operator.privateKey);
  check(`40 D1 WIRE SMUGGLE [${name}]`, false,
    verifyAnswer(token, resolveKey, SIM_SWAP_CHECK, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW }),
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
  const schema = { params: { maxAge: 'integer' }, answer: { [name]: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, schema, { maxAge: 2160 }, { [name]: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, schema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
    : token;
  check(`41 D1 LEGIT DECLARED FIELD [${name}]`, true, v);
  // Also the projection assertion for this name: claims must carry EXACTLY
  // the declared set (base ∪ {maxAge, name}) — no more, no less.
  const expectedKeys = ['iss', 'aud', 'nonce', 'iat', 'exp', 'maxAge', name].sort().join(',');
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
  const schema = { params: { maxAge: 'integer' }, answer: { ['__proto__']: 'boolean' } };
  const token = attestAnswer(operator.privateKey, OP_KID, base, schema, { maxAge: 2160 }, { ['__proto__']: true });
  const v = typeof token === 'string'
    ? verifyAnswer(token, resolveKey, schema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW })
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
  const proxySchema = new Proxy({ params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } }, {
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
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  const throwingSchema = { get params() { throw new Error('boom-params'); }, answer: { swapped: 'boolean' } };
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, throwingSchema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
  } catch {
    threw = true;
  }
  checkTrue('45 D2 VERIFYANSWER THROWING GETTER ON schema.params REFUSES, NEVER THROWS',
    !threw && v && v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'MALFORMED_INPUT');
}

// 46 D2 VERIFYANSWER, PROXY schema WITH A THROWING get TRAP.
{
  const base = freshBase();
  const token = signJws(operator.privateKey, OP_KID, { ...base, maxAge: 2160, swapped: false });
  const proxySchema = new Proxy({ params: { maxAge: 'integer' }, answer: { swapped: 'boolean' } }, {
    get(t, k) {
      if (k === 'params') throw new Error('proxy-get-boom');
      return t[k];
    },
  });
  let threw = false;
  let v;
  try {
    v = verifyAnswer(token, resolveKey, proxySchema, { expectedIss: ISS, expectedAud: AUD, nonceStore, now: NOW });
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
  const collidingSchema = { params: { iat: 'boolean' }, answer: { swapped: 'boolean' } };
  const v = attestAnswer(operator.privateKey, OP_KID, base, collidingSchema, { iat: true }, { swapped: false });
  checkTrue('47 BACKSTOP NOT A SWALLOWER (RESERVED_CLAIM stays RESERVED_CLAIM, not MALFORMED_INPUT)',
    v.ok === false && v.reason.code === 'RESERVED_CLAIM' && v.reason.code !== 'MALFORMED_INPUT');
}

conclude(82);

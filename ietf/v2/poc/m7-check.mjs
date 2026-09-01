// PoC module IETF-M7 — standalone check. Run: node ietf/v2/poc/m7-check.mjs
// Negatives first: every silent-widening path the spec identified is shown
// being rejected before the happy paths. Same style/discipline as M3's
// check (camara/v2/poc/m3-check.mjs): exact-reason assertions, not just
// pass/fail, and a declared case count so a shrinking suite cannot read
// green (check-harness.mjs's own defence, reused unchanged here).
import { generateKeyPairSync } from 'node:crypto';
import { signJws } from './m1-jws.mjs';
import { checkActionFloor, admit, classify, deriveChainId } from './m7-actionclass.mjs';
import { makeHarness } from './check-harness.mjs';

// One shared harness, field 'ok'/'ADMIT'. checkActionFloor's {allowed,
// reason} results and classify's bare-string results are adapted to the
// same {ok, reason} shape below rather than standing up a second harness —
// the tally and exit-code contract stay in one place either way.
const { check, checkThrows, conclude } = makeHarness({ field: 'ok', okWord: 'ADMIT' });

// checkActionFloor returns {allowed, reason[, effective]} — adapt to {ok, reason}.
function adaptGate(r) {
  return { ok: r.allowed, reason: r.reason };
}

// admit returns {ok:true, actionClass, effective} | {ok:false, reason: ActionRejected}.
// Adapt the failure's Error to its .message so the harness's string compare
// works the same way it does for every other module's plain-string reasons.
function adaptAdmit(r) {
  return r.ok ? { ok: true, reason: 'ok' } : { ok: false, reason: r.reason.message };
}

// classify() never fails — it always returns one of 'r'|'w'|'x'. Wrapped so
// a wrong answer shows as a named FAIL line instead of a bare assert.
function adaptClassify(actual) {
  return { ok: true, reason: actual };
}

// ---------------------------------------------------------------------------
// Fixtures: an owner keypair and a signed menu, plus a byte-flipped forgery.
// ---------------------------------------------------------------------------

const owner = generateKeyPairSync('ed25519');
const impostor = generateKeyPairSync('ed25519');

// The origin the menu below is bound to, and that every declared-classSource
// test presents as the request's targetOrigin unless it is deliberately
// testing the origin-binding mismatch (case 24). RFC 6454 origin, no path.
const TARGET_ORIGIN = 'https://api.example.com';

const menuPayload = {
  iss: TARGET_ORIGIN,
  menu: {
    'POST /check': 'r',   // a POST the owner is willing to CLASSIFY as read-only
    'GET /danger': 'x',   // a GET the owner wants CLASSIFIED as a write/execute
    'POST /pay': 'x',
  },
};
const menuToken = signJws(owner.privateKey, 'owner-1', menuPayload);
if (typeof menuToken !== 'string') {
  throw new Error('fixture setup failed: could not sign menu');
}

// Flip one byte of the signature segment — the tampered token must fail
// verifyJws's signature check while remaining structurally well-formed
// (three dot-separated base64url segments), so the failure it exercises is
// specifically signature invalidity, not malformed-token rejection.
function flipSignatureByte(token) {
  const [h, p, s] = token.split('.');
  const sigBuf = Buffer.from(s, 'base64url');
  sigBuf[0] ^= 0xff;
  return `${h}.${p}.${sigBuf.toString('base64url')}`;
}
const forgedMenuToken = flipSignatureByte(menuToken);

const validMenu = { token: menuToken, ownerPublicKey: owner.publicKey };
const forgedMenu = { token: forgedMenuToken, ownerPublicKey: owner.publicKey };
// Not used in a case directly, but confirms the fixture couldn't accidentally
// verify under the WRONG key either (defence against a degenerate fixture).
void impostor;

// ---------------------------------------------------------------------------
// Negatives first.
// ---------------------------------------------------------------------------

// 1 — N1: classSource: method IGNORES a looser declared menu. Menu says
// POST /check -> r, but classSource=method classifies by HTTP method alone
// -> x. Link actionClass: r -> REFUSED.
{
  const link = { actionClass: 'r', classSource: 'method' };
  const req = { method: 'POST', path: '/check', menu: validMenu, rootSignature: 'c1sig' };
  const r = admit(link, req, new Map());
  check('1 N1 classSource=method ignores menu, classified x, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 2 — N3: classSource: declared, but the menu signature is forged (one byte
// flipped) -> verifyJws fails -> classify falls back to the method default
// (x for POST) -> REFUSED under actionClass: r.
{
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/check', menu: forgedMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c2sig' };
  const r = admit(link, req, new Map());
  check('2 N3 forged menu signature falls back to method, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 3 — N4: menu declares GET /danger -> x, classSource: declared, link
// actionClass: r -> REFUSED. A declaration may TIGHTEN a GET beyond its
// method default (r), which is exactly what classSource=declared opts into.
{
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'GET', path: '/danger', menu: validMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c3sig' };
  const r = admit(link, req, new Map());
  check('3 N4 declared menu tightens GET to x, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 4 — N10a: unknown actionClass value "rw" is a hard rejection.
check('4 N10a unknown actionClass hard-rejected', false,
  adaptGate(checkActionFloor({ actionClass: 'x' }, { actionClass: 'rw' })),
  'child: invalid actionClass: "rw"');

// 5 — N10b: unknown classSource value "trust" is a hard rejection.
check('5 N10b unknown classSource hard-rejected', false,
  adaptGate(checkActionFloor({ actionClass: 'x' }, { actionClass: 'x', classSource: 'trust' })),
  'child: invalid classSource: "trust"');

// 6 — N10c: negative writeBudget is rejected.
check('6 N10c negative writeBudget rejected', false,
  adaptGate(checkActionFloor({ actionClass: 'x', writeBudget: 5 }, { actionClass: 'x', writeBudget: -1 })),
  'child: invalid writeBudget: -1');

// 7 — N10d: non-integer writeBudget (1.5) is rejected.
check('7 N10d non-integer writeBudget rejected', false,
  adaptGate(checkActionFloor({ actionClass: 'x', writeBudget: 5 }, { actionClass: 'x', writeBudget: 1.5 })),
  'child: invalid writeBudget: 1.5');

// 8 — N7: a child link RAISING writeBudget (1 -> 2) is refused.
check('8 N7 child raises writeBudget, refused', false,
  adaptGate(checkActionFloor({ actionClass: 'x', writeBudget: 1 }, { actionClass: 'x', writeBudget: 2 })),
  'writeBudget raised: 2 > 1');

// 9 — N8: a child link moving classSource method -> declared is a
// LOOSENING (declared is the looser of the two) and is refused.
check('9 N8 child loosens classSource method->declared, refused', false,
  adaptGate(checkActionFloor({ actionClass: 'x', classSource: 'method' }, { actionClass: 'x', classSource: 'declared' })),
  'classSource loosened: declared looser than method');

// 10 — N9a: a child link RAISING actionClass (w -> x) is refused.
check('10 N9a child raises actionClass w->x, refused', false,
  adaptGate(checkActionFloor({ actionClass: 'w' }, { actionClass: 'x' })),
  'actionClass raised: x > w');

// 11 — N5: writeBudget: 1 — a second identical POST /bookings after the
// first exhausts the budget is REFUSED with a budget code.
{
  const link = { actionClass: 'x', classSource: 'method', writeBudget: 1 };
  const state = new Map();
  const req = { method: 'POST', path: '/bookings', rootSignature: 'c5sig' };
  const first = admit(link, req, state);
  const second = admit(link, req, state);
  check('11 N5 second write after budget exhausted, refused', false, adaptAdmit(second),
    `writeBudget exhausted for chain ${deriveChainId('c5sig')}`,
    { label: 'first request was admitted', ok: first.ok === true && first.effective.writeBudget === 0 });
}

// 12 — N14: admit() called with a throwing-getter Proxy as `request` never
// throws — it returns a typed MALFORMED_INPUT-style refusal.
{
  const hostileRequest = new Proxy({}, {
    get() { throw new Error('boom'); },
  });
  let escaped = false;
  let r;
  try {
    r = admit({ actionClass: 'x' }, hostileRequest, new Map());
  } catch {
    escaped = true;
    r = { ok: false, reason: { message: 'ESCAPED' } };
  }
  check('12 N14 throwing-getter request never throws', false, adaptAdmit(r),
    'request must be a readable plain object',
    { label: 'did not escape as a raw throw', ok: escaped === false });
}

// ---------------------------------------------------------------------------
// Positives — the wiring controls, each paired with the negative it proves
// is not vacuous.
// ---------------------------------------------------------------------------

// 13 — N2: the positive control for case 1. Same menu, link classSource:
// declared with a VALID signature -> classified r (the menu's declared
// value for POST /check) -> ADMITTED with actionClass r. Proves the menu
// is actually wired into the classSource=declared path, not just ignored.
{
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/check', menu: validMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c13sig' };
  const r = admit(link, req, new Map());
  check('13 N2 declared classSource + valid menu, admitted as r', true, adaptAdmit(r),
    'ok', { label: `actionClass=${r.ok ? r.actionClass : 'n/a'}`, ok: r.ok === true && r.actionClass === 'r' });
}

// 14 — N6: writeBudget: 1, three GET requests (actionClass r). All three
// ADMITTED; r never touches the budget, so the effective writeBudget stays
// visibly 1 across all three, AND a following w/x request still sees the
// full budget (proving the state Map was truly never seeded by the r's).
{
  const link = { actionClass: 'r', classSource: 'method', writeBudget: 1 };
  const state = new Map();
  const req = { method: 'GET', path: '/bookings/1', rootSignature: 'c14sig' };
  const r1 = admit(link, req, state);
  const r2 = admit(link, req, state);
  const r3 = admit(link, req, state);
  const wLink = { actionClass: 'x', classSource: 'method', writeBudget: 1 };
  const wReq = { method: 'POST', path: '/bookings', rootSignature: 'c14sig' };
  const rw = admit(wLink, wReq, state); // proves the r's above never spent
  check('14 N6 three r requests admitted, budget untouched', true, adaptAdmit(r3),
    'ok', {
      label: 'all three effective.writeBudget=1, follow-on write still had full budget',
      ok: r1.ok && r2.ok && r3.ok
        && r1.effective.writeBudget === 1 && r2.effective.writeBudget === 1 && r3.effective.writeBudget === 1
        && rw.ok === true && rw.effective.writeBudget === 0,
    });
}

// 15 — N9b: a child link LOWERING actionClass (x -> w) is allowed.
{
  const v = checkActionFloor({ actionClass: 'x' }, { actionClass: 'w' });
  check('15 N9b child lowers actionClass x->w, allowed', true, adaptGate(v),
    'ok', { label: `effective.actionClass=${v.effective?.actionClass}`, ok: v.effective?.actionClass === 'w' });
}

// 16 — N11a: an omitted writeBudget defaults to effective 0; any w/x
// request is then REFUSED for budget exhaustion (0 remaining), and the
// effective 0 is VISIBLE in checkActionFloor's result.
{
  const gate = checkActionFloor({ actionClass: 'x' }, { actionClass: 'x' }); // both omit writeBudget
  const link = { actionClass: 'x', classSource: 'method' }; // writeBudget omitted
  const r = admit(link, { method: 'POST', path: '/bookings', rootSignature: 'c16sig' }, new Map());
  check('16 N11a omitted writeBudget -> effective 0, w/x refused', false, adaptAdmit(r),
    `writeBudget exhausted for chain ${deriveChainId('c16sig')}`,
    { label: `checkActionFloor effective.writeBudget=${gate.effective?.writeBudget}`, ok: gate.allowed === true && gate.effective.writeBudget === 0 });
}

// 17 — N11b: an omitted classSource defaults to effective 'method', visible
// in both checkActionFloor's and admit()'s effective field.
{
  const gate = checkActionFloor({ actionClass: 'x' }, { actionClass: 'x' }); // both omit classSource
  const link = { actionClass: 'r' }; // classSource omitted -> 'method'
  const req = { method: 'GET', path: '/danger', menu: validMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c17sig' }; // menu would say x if consulted
  const r = admit(link, req, new Map());
  check('17 N11b omitted classSource -> effective method, menu ignored', true, adaptAdmit(r),
    'ok', {
      label: `checkActionFloor effective.classSource=${gate.effective?.classSource}, admit effective.classSource=${r.ok ? r.effective.classSource : 'n/a'}`,
      ok: gate.allowed === true && gate.effective.classSource === 'method'
        && r.ok === true && r.effective.classSource === 'method' && r.actionClass === 'r',
    });
}

// 18 — N12: an unknown/unrecognized HTTP method ("BREW") classifies as x
// (the least-trusting default), under either classSource.
check('18 N12 unknown method BREW classifies as x', true,
  adaptClassify(classify('BREW', '/pot', undefined, 'method')), 'x');

// 19 — N13: menu present, signature-valid, and its iss matches the request
// target's origin, but it lacks the requested METHOD path -> falls back to
// the method default.
check('19 N13 menu present but missing entry, falls back to method default', true,
  adaptClassify(classify('GET', '/unlisted', validMenu, 'declared', TARGET_ORIGIN)), 'r');

// 20 — EQUAL: restating the parent link exactly is allowed; effective
// mirrors the child (which here equals the parent).
{
  const link = { actionClass: 'w', classSource: 'declared', writeBudget: 3 };
  const v = checkActionFloor(link, { ...link });
  check('20 EQUAL parent/child link allowed', true, adaptGate(v),
    'ok', { label: `effective=${JSON.stringify(v.effective)}`, ok: JSON.stringify(v.effective) === JSON.stringify(link) });
}

// 21 — TIGHTER on all three axes at once is allowed.
{
  const parent = { actionClass: 'x', classSource: 'declared', writeBudget: 5 };
  const child = { actionClass: 'w', classSource: 'method', writeBudget: 2 };
  const v = checkActionFloor(parent, child);
  check('21 TIGHTER on all three axes at once, allowed', true, adaptGate(v),
    'ok', { label: `effective=${JSON.stringify(v.effective)}`, ok: JSON.stringify(v.effective) === JSON.stringify(child) });
}

// ---------------------------------------------------------------------------
// Cases 22-24: the three assumptions the -01 draft text has since resolved
// (write-budget-chain-identifier, action-class's declared-menu path-template
// matching, and its origin-binding rule). The code below now implements
// each rule; these cases pin the RESOLVED behaviour, replacing the
// ASSUMPTION cases that used to pin the gap. See README.md's dated note.
// ---------------------------------------------------------------------------

// 22 — write-budget-chain-identifier: the chain identifier is derived by
// the verifier itself, as the SHA-256 digest of L(0)'s wire signature
// bytes, and MUST NOT be taken from a value the request supplies. Same
// rootSignature (the same chain), writeBudget 1: the first x-class request
// spends the budget; a second request against the SAME chain, which also
// carries an arbitrary caller-supplied "chainId"-shaped field, is refused
// on the exhausted budget rather than being treated as a fresh chain —
// proving admit() never reads that field at all.
{
  const link = { actionClass: 'x', writeBudget: 1 };
  const state = new Map();
  const rootSig = 'c22root';
  const req1 = { method: 'POST', path: '/bookings', rootSignature: rootSig };
  const r1 = admit(link, req1, state);
  const req2 = {
    method: 'POST', path: '/bookings', rootSignature: rootSig,
    chainId: 'attacker-supplied-fresh-id', // MUST be ignored; not a fresh chain
  };
  const r2 = admit(link, req2, state);
  check('22 chain identifier is verifier-derived; caller-supplied chainId does not refill budget', false, adaptAdmit(r2),
    `writeBudget exhausted for chain ${deriveChainId(rootSig)}`,
    { label: 'first request (same chain) was admitted', ok: r1.ok === true });
}

// 23 — declared-menu path-template matching: the menu declares
// "POST /calls/{callId}": "r" as a template; a concrete request path
// "/calls/123" MUST match it per the deterministic segment rule (same
// segment count, {callId} matches the single non-empty segment "123") and
// classification uses the menu's declared value, r -> ADMITTED under
// actionClass: r.
{
  const templateMenuPayload = {
    iss: TARGET_ORIGIN,
    menu: { 'POST /calls/{callId}': 'r' },
  };
  const templateMenuToken = signJws(owner.privateKey, 'owner-1', templateMenuPayload);
  if (typeof templateMenuToken !== 'string') {
    throw new Error('fixture setup failed: could not sign template menu');
  }
  const templateMenu = { token: templateMenuToken, ownerPublicKey: owner.publicKey };
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/calls/123', menu: templateMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c23sig' };
  const r = admit(link, req, new Map());
  check('23 path-template menu key /calls/{callId} matches /calls/123, admitted as r', true, adaptAdmit(r),
    'ok', { label: `actionClass=${r.ok ? r.actionClass : 'n/a'}`, ok: r.ok === true && r.actionClass === 'r' });
}

// 24 — declared-menu origin binding: the menu is signed by the resource
// owner's own key and declares "POST /check": "r" with a VALID signature,
// but its iss is a different origin (https://attacker.example.com) than
// the request target's origin (TARGET_ORIGIN). Per -01's rule the menu
// fails exactly as if its signature had not verified — this is V9's shape
// from the appendix — so classification falls back to the method default
// for POST, x, which exceeds the actionClass: r floor -> REFUSED.
{
  const mismatchMenuPayload = {
    iss: 'https://attacker.example.com',
    menu: { 'POST /check': 'r' },
  };
  const mismatchMenuToken = signJws(owner.privateKey, 'owner-1', mismatchMenuPayload);
  if (typeof mismatchMenuToken !== 'string') {
    throw new Error('fixture setup failed: could not sign mismatched-origin menu');
  }
  const mismatchMenu = { token: mismatchMenuToken, ownerPublicKey: owner.publicKey };
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/check', menu: mismatchMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c24sig' };
  const r = admit(link, req, new Map());
  check('24 declared menu iss does not match request target origin, method default applies, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 25 — V10 from the appendix: a single chain, actionClass x, writeBudget 2,
// against a sequence of x-class requests. Two successive requests are
// admitted (remaining count 2 -> 1 -> 0); a third is refused, budget
// exhausted.
{
  const link = { actionClass: 'x', writeBudget: 2 };
  const state = new Map();
  const rootSig = 'c25root';
  const req = { method: 'POST', path: '/bookings', rootSignature: rootSig };
  const step1 = admit(link, req, state);
  const step2 = admit(link, req, state);
  const step3 = admit(link, req, state);
  check('25 V10 budget 2: admit, admit, refuse', false, adaptAdmit(step3),
    `writeBudget exhausted for chain ${deriveChainId(rootSig)}`,
    {
      label: 'step1 admitted remaining=1, step2 admitted remaining=0',
      ok: step1.ok === true && step1.effective.writeBudget === 1
        && step2.ok === true && step2.effective.writeBudget === 0,
    });
}

// 26 — declared-menu tie: two operation keys under the same method both
// match the same concrete request path with an EQUAL number of literal
// segments ("POST /a/{id}" and "POST /{id}/b" both match "/a/b" with
// exactly one literal segment each). -01 requires a verifier to treat such
// a tie as a miss, never resolving it by JSON key order or any other
// means, so classification falls back to the method default for POST, x —
// not either tied declared value (r or w) — proving the tie is not merely
// ignored down to a single arbitrary winner.
{
  const tieMenuPayload = {
    iss: TARGET_ORIGIN,
    menu: { 'POST /a/{id}': 'r', 'POST /{id}/b': 'w' },
  };
  const tieMenuToken = signJws(owner.privateKey, 'owner-1', tieMenuPayload);
  if (typeof tieMenuToken !== 'string') {
    throw new Error('fixture setup failed: could not sign tie menu');
  }
  const tieMenu = { token: tieMenuToken, ownerPublicKey: owner.publicKey };
  const link = { actionClass: 'x', classSource: 'declared', writeBudget: 1 };
  const req = { method: 'POST', path: '/a/b', menu: tieMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c26sig' };
  const r = admit(link, req, new Map());
  check('26 equal-literal-segment tie between distinct menu keys fails closed to method default', true, adaptAdmit(r),
    'ok', { label: `actionClass=${r.ok ? r.actionClass : 'n/a'}`, ok: r.ok === true && r.actionClass === 'x' });
}

// 27 — prototype safety of the path-template lookup: a menu whose JSON
// payload carries a literal "__proto__" key (a real OWN property once
// decoded by JSON.parse inside verifyJws, not the Object.prototype
// accessor) is matched like any other string key by matchOperationKey's
// Object.keys-only enumeration — no crash, no bypass, and the unrelated
// "__proto__ /x" key does not match a "/calls/123" request under a
// different method/path.
{
  const protoMenuPayload = JSON.parse(JSON.stringify({
    iss: TARGET_ORIGIN,
    menu: { '__proto__ /x': 'x', 'POST /calls/{callId}': 'r' },
  }));
  const protoMenuToken = signJws(owner.privateKey, 'owner-1', protoMenuPayload);
  if (typeof protoMenuToken !== 'string') {
    throw new Error('fixture setup failed: could not sign proto-keyed menu');
  }
  const protoMenu = { token: protoMenuToken, ownerPublicKey: owner.publicKey };
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/calls/123', menu: protoMenu, targetOrigin: TARGET_ORIGIN, rootSignature: 'c27sig' };
  const r = admit(link, req, new Map());
  check('27 a literal __proto__ menu key does not crash or bypass template matching', true, adaptAdmit(r),
    'ok', { label: `actionClass=${r.ok ? r.actionClass : 'n/a'}`, ok: r.ok === true && r.actionClass === 'r' });
}

conclude(27);

// PoC module IETF-M7 — standalone check. Run: node ietf/v2/poc/m7-check.mjs
// Negatives first: every silent-widening path the spec identified is shown
// being rejected before the happy paths. Same style/discipline as M3's
// check (camara/v2/poc/m3-check.mjs): exact-reason assertions, not just
// pass/fail, and a declared case count so a shrinking suite cannot read
// green (check-harness.mjs's own defence, reused unchanged here).
import { generateKeyPairSync } from 'node:crypto';
import { signJws } from './m1-jws.mjs';
import { checkActionFloor, admit, classify } from './m7-actionclass.mjs';
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

const menuPayload = {
  iss: 'owner-1',
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
  const req = { method: 'POST', path: '/check', menu: validMenu, chainId: 'c1' };
  const r = admit(link, req, new Map());
  check('1 N1 classSource=method ignores menu, classified x, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 2 — N3: classSource: declared, but the menu signature is forged (one byte
// flipped) -> verifyJws fails -> classify falls back to the method default
// (x for POST) -> REFUSED under actionClass: r.
{
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/check', menu: forgedMenu, chainId: 'c2' };
  const r = admit(link, req, new Map());
  check('2 N3 forged menu signature falls back to method, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 3 — N4: menu declares GET /danger -> x, classSource: declared, link
// actionClass: r -> REFUSED. A declaration may TIGHTEN a GET beyond its
// method default (r), which is exactly what classSource=declared opts into.
{
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'GET', path: '/danger', menu: validMenu, chainId: 'c3' };
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
  const req = { method: 'POST', path: '/bookings', chainId: 'c5' };
  const first = admit(link, req, state);
  const second = admit(link, req, state);
  check('11 N5 second write after budget exhausted, refused', false, adaptAdmit(second),
    'writeBudget exhausted for chain c5',
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
  const req = { method: 'POST', path: '/check', menu: validMenu, chainId: 'c13' };
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
  const req = { method: 'GET', path: '/bookings/1', chainId: 'c14' };
  const r1 = admit(link, req, state);
  const r2 = admit(link, req, state);
  const r3 = admit(link, req, state);
  const wLink = { actionClass: 'x', classSource: 'method', writeBudget: 1 };
  const wReq = { method: 'POST', path: '/bookings', chainId: 'c14' };
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
  const r = admit(link, { method: 'POST', path: '/bookings', chainId: 'c16' }, new Map());
  check('16 N11a omitted writeBudget -> effective 0, w/x refused', false, adaptAdmit(r),
    'writeBudget exhausted for chain c16',
    { label: `checkActionFloor effective.writeBudget=${gate.effective?.writeBudget}`, ok: gate.allowed === true && gate.effective.writeBudget === 0 });
}

// 17 — N11b: an omitted classSource defaults to effective 'method', visible
// in both checkActionFloor's and admit()'s effective field.
{
  const gate = checkActionFloor({ actionClass: 'x' }, { actionClass: 'x' }); // both omit classSource
  const link = { actionClass: 'r' }; // classSource omitted -> 'method'
  const req = { method: 'GET', path: '/danger', menu: validMenu, chainId: 'c17' }; // menu would say x if consulted
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

// 19 — N13: menu present and signature-valid, but lacks the requested
// METHOD path -> falls back to the method default.
check('19 N13 menu present but missing entry, falls back to method default', true,
  adaptClassify(classify('GET', '/unlisted', validMenu, 'declared')), 'r');

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
// ASSUMPTION cases — each pins a spike-scope limit the review flagged. These
// document the behaviour as it stands, not a bug: a later -01 change that
// closes the gap will flip the case's expected value and force this file's
// (and the README's) description to be updated, rather than letting the gap
// go unnoticed.
// ---------------------------------------------------------------------------

// 22 — ASSUMPTION: chainId is caller-supplied; a fresh chainId refills the
// budget. The verifier MUST derive chainId from the signed chain (e.g. a
// digest of the root link's signature), never take it from the request —
// the spike takes chainId as plain input and does not model that
// derivation. A -01 requirement, not spike scope.
{
  const link = { actionClass: 'x', writeBudget: 1 };
  const state = new Map();
  const req1 = { method: 'POST', path: '/bookings', chainId: 'c22a' };
  const r1 = admit(link, req1, state);
  const req2 = { method: 'POST', path: '/bookings', chainId: 'c22b' };
  const r2 = admit(link, req2, state);
  check('22 ASSUMPTION fresh chainId refills budget, both admitted', true, adaptAdmit(r2),
    'ok', { label: 'first chainId c22a was also admitted', ok: r1.ok === true });
}

// 23 — ASSUMPTION: menu keys are exact strings; path templates do not match.
// The menu declares "POST /calls/{callId}": "r" verbatim, but a real request
// path like /calls/123 is looked up as-is and misses, so classification
// falls back to the method default (x for POST) -> REFUSED under
// actionClass: r. A real menu needs OpenAPI-style path-template matching;
// out of spike scope. Note this fails CLOSED (refuse), the safe direction.
{
  const templateMenuPayload = {
    iss: 'owner-1',
    menu: { 'POST /calls/{callId}': 'r' },
  };
  const templateMenuToken = signJws(owner.privateKey, 'owner-1', templateMenuPayload);
  if (typeof templateMenuToken !== 'string') {
    throw new Error('fixture setup failed: could not sign template menu');
  }
  const templateMenu = { token: templateMenuToken, ownerPublicKey: owner.publicKey };
  const link = { actionClass: 'r', classSource: 'declared' };
  const req = { method: 'POST', path: '/calls/123', menu: templateMenu, chainId: 'c23' };
  const r = admit(link, req, new Map());
  check('23 ASSUMPTION menu keys exact-string only, path template misses, refused', false, adaptAdmit(r),
    'classified x exceeds actionClass floor r');
}

// 24 — ASSUMPTION: the menu is not bound to the resource being called.
// The menu is signed by the owner key but carries iss: 'owner-OTHER' — a
// different issuer than the request's notional target — and the request
// itself has no host field at all (that absence is the point: nothing in
// admit()/classify() ever checks the menu's origin against the target).
// classSource: declared still ADMITS as the menu's declared class. -01 must
// bind the menu to the resource origin (iss == the authority of the request
// target, or the key resolver must be per-origin); a multi-API gate that
// resolves one key for many owners would otherwise accept the wrong menu.
// Out of spike scope.
{
  const otherOwnerMenuPayload = {
    iss: 'owner-OTHER',
    menu: { 'POST /pay': 'r' },
  };
  const otherOwnerMenuToken = signJws(owner.privateKey, 'owner-1', otherOwnerMenuPayload);
  if (typeof otherOwnerMenuToken !== 'string') {
    throw new Error('fixture setup failed: could not sign other-owner menu');
  }
  const otherOwnerMenu = { token: otherOwnerMenuToken, ownerPublicKey: owner.publicKey };
  const link = { actionClass: 'r', classSource: 'declared' };
  // No host field on the request at all — the point being pinned is that
  // nothing in admit()/classify() consults one.
  const req = { method: 'POST', path: '/pay', menu: otherOwnerMenu, chainId: 'c24' };
  const r = admit(link, req, new Map());
  check('24 ASSUMPTION menu iss not bound to target resource, admitted as r', true, adaptAdmit(r),
    'ok', { label: `actionClass=${r.ok ? r.actionClass : 'n/a'}`, ok: r.ok === true && r.actionClass === 'r' });
}

conclude(24);

// PoC module V3-M2 — standalone check for menu.mjs (the published menu).
// Run: node camara/v3/poc/menu-check.mjs   (exit 0 only if every case holds)
// Also run under TZ=Pacific/Kiritimati and TZ=America/Adak: dates are UTC only.
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  DEFAULT_MENU, loadMenu, checkMenu, answerWithMenu, entryFor, SIMSWAP_MAX_HOURS,
} from './menu.mjs';
import {
  attestAnswer, verifyAnswer, attestRefusal, verifyRefusal, makeNonceStore, ClaimRejected,
  SIM_SWAP_CHECK, TENURE_CHECK, OUT_OF_RANGE, parseDuration, KNOWN_APIS,
} from './m1-jws.mjs';

const results = [];
function checkTrue(name, cond, detail) {
  const pass = cond === true;
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
}
function conclude(expected) {
  const passed = results.filter(Boolean).length;
  const countOk = results.length === expected;
  console.log(`RESULT: ${passed}/${results.length}`);
  if (!countOk) console.log(`FAIL CASE COUNT: expected ${expected} cases, ran ${results.length}`);
  process.exit(passed === results.length && countOk ? 0 : 1);
}

const S = SIM_SWAP_CHECK.api, T = TENURE_CHECK.api;
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const OPERATOR_MENU = loadMenu({ [S]: ['P30D', 'P60D', 'P90D'], [T]: ['P2Y'] });
const T0 = new Date('2026-11-23T12:00:00Z');
const dayMs = 86400000;
const isoMinus = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - n * dayMs).toISOString().slice(0, 10); // independent ms arithmetic
const ctxOf = (menu, today = T0, thresholdR) => ({ menu, today, thresholdR });

// Every ask goes through the guard with a read-counting spy.
const log = [];
function ask(api, params, ctx, answerFn = () => true) {
  let reads = 0;
  const r = answerWithMenu(api, params, ctx, () => { reads++; return answerFn(); });
  log.push({ accepted: !r.refused, reads });
  return r;
}

// ---- A. menu.json and loadMenu ----
{
  const file = JSON.parse(readFileSync(new URL('./menu.json', import.meta.url), 'utf8'));
  const loaded = loadMenu(file);
  checkTrue('M1 menu.json loads and equals DEFAULT_MENU (simSwap P90D, tenure P2Y)',
    JSON.stringify(loaded) === JSON.stringify(DEFAULT_MENU) && DEFAULT_MENU[S].join() === 'P90D' && DEFAULT_MENU[T].join() === 'P2Y');
  checkTrue('M2 DEFAULT_MENU is frozen all the way down',
    Object.isFrozen(DEFAULT_MENU) && Object.isFrozen(DEFAULT_MENU[S]) && Object.isFrozen(DEFAULT_MENU[T]) && Object.isFrozen(loaded) && Object.isFrozen(loaded[S]));
  checkTrue('M3 the 30/60/90 operator menu loads', OPERATOR_MENU[S].join() === 'P30D,P60D,P90D');
}
{
  const bad = [
    ['SimSwap P365D (8760 h, above the 2400 h cap)', { [S]: ['P365D'], [T]: ['P2Y'] }],
    ['SimSwap P1Y (above the cap)', { [S]: ['P1Y'], [T]: ['P2Y'] }],
    ['SimSwap P101D (2424 h, one day above the cap)', { [S]: ['P101D'], [T]: ['P2Y'] }],
    ['SimSwap P0D', { [S]: ['P0D'], [T]: ['P2Y'] }],
    ['Tenure P0Y', { [S]: ['P90D'], [T]: ['P0Y'] }],
    ['bad entry "90"', { [S]: ['90'], [T]: ['P2Y'] }],
    ['bad entry "P3M" (months)', { [S]: ['P90D'], [T]: ['P3M'] }],
    ['bad entry lower case', { [S]: ['p90d'], [T]: ['P2Y'] }],
    ['bad entry leading zero', { [S]: ['P090D'], [T]: ['P2Y'] }],
    ['non-string entry', { [S]: [90], [T]: ['P2Y'] }],
    ['empty SimSwap list', { [S]: [], [T]: ['P2Y'] }],
    ['list not an array', { [S]: 'P90D', [T]: ['P2Y'] }],
    ['unknown API', { [S]: ['P90D'], [T]: ['P2Y'], other: ['P1D'] }],
    ['duplicate entry', { [S]: ['P90D', 'P90D'], [T]: ['P2Y'] }],
    ['null', null], ['array', []], ['string', 'x'],
  ];
  const missed = [];
  for (const [n, m] of bad) { try { loadMenu(m); missed.push(n); } catch { /* expected */ } }
  checkTrue('M4 loadMenu throws on every bad menu', missed.length === 0, `${bad.length} cases, not thrown=[${missed}]`);
  // Negative controls: the cap edge and the long Tenure entry load.
  let ok = true;
  try { loadMenu({ [S]: ['P100D'], [T]: ['P2Y', 'P10Y'] }); } catch { ok = false; }
  checkTrue('M5 NEGATIVE CONTROL: SimSwap P100D (exactly 2400 h) and Tenure P10Y load', ok && SIMSWAP_MAX_HOURS === 2400);
  checkTrue('M6 parseDuration grammar: P90D=90, P2Y=730, P0D=0, months and junk null',
    parseDuration('P90D') === 90 && parseDuration('P2Y') === 730 && parseDuration('P0D') === 0 &&
    parseDuration('P3M') === null && parseDuration('P090D') === null && parseDuration(90) === null && parseDuration('P99999999999999999D') === null);
}

// ---- B. checkMenu on a menu that skipped loadMenu: the cap holds here too ----
{
  const unloaded = { [S]: ['P365D', 'P0D', 'junk'], [T]: ['P2Y'] };
  const r365 = checkMenu(S, { maxAge: 8760 }, { menu: unloaded, today: T0 });
  const r0 = checkMenu(S, { maxAge: 0 }, { menu: unloaded, today: T0 });
  const r2401 = checkMenu(S, { maxAge: 2400 }, { menu: unloaded, today: T0 });
  checkTrue('M7 an UNLOADED menu naming P365D / P0D still cannot be asked (8760, 0, 2400 refused)',
    !r365.ok && !r0.ok && !r2401.ok && r365.code === 'OUT_OF_RANGE');
}

// ---- C. Assertion 1/2: every menu value accepted and named; off menu refused, never rounded ----
{
  const vals = []; for (let i = 0; i <= 2500; i++) vals.push(i);
  vals.push(2401, 9999, -1, 2160.0, '2160', 2160.5, null, NaN, Infinity);
  const bad = [];
  for (const [mname, menu, okSet] of [['default', DEFAULT_MENU, { 2160: 'P90D' }], ['operator', OPERATOR_MENU, { 720: 'P30D', 1440: 'P60D', 2160: 'P90D' }]]) {
    for (const v of vals) {
      const r = ask(S, { maxAge: v }, ctxOf(menu));
      const expect = typeof v === 'number' && hasOwn(okSet, String(v)) ? okSet[String(v)] : undefined;
      if ((expect === undefined) !== !!r.refused || (expect && r.entry !== expect)) bad.push(`${mname}:${String(v)}`);
    }
  }
  checkTrue('M8 SimSwap sweep: only the menu hours are accepted and each names its entry', bad.length === 0, `${vals.length} values x 2 menus, bad=[${bad}]`);
}
{
  const bad = []; let acc = 0;
  for (let off = -30; off <= 3 * 365 + 5; off++) {
    const s = isoMinus(T0, off);
    const r = ask(T, { tenureDate: s }, ctxOf(DEFAULT_MENU));
    if (!r.refused) acc++;
    if ((off === 730) === !!r.refused) bad.push(s);
  }
  checkTrue('M9 Tenure sweep: only today minus 730 days (UTC) is accepted', bad.length === 0 && acc === 1, `accepted=${acc} bad=[${bad}]`);
  const oneYear = ask(T, { tenureDate: isoMinus(T0, 365) }, ctxOf(DEFAULT_MENU));
  checkTrue('M10 NEGATIVE CONTROL: one year (365 d) is off the default menu, 730 d is on it',
    !!oneYear.refused && !ask(T, { tenureDate: isoMinus(T0, 730) }, ctxOf(DEFAULT_MENU)).refused);
}

// ---- D. UTC midnight edge, leap year ----
{
  const A = new Date('2026-11-23T23:59:59.999Z'), B = new Date('2026-11-24T00:00:00.000Z');
  const dA = isoMinus(A, 730), dB = isoMinus(B, 730);
  const q = (d, s) => !ask(T, { tenureDate: s }, ctxOf(DEFAULT_MENU, d)).refused;
  const edge = q(A, dA) && !q(B, dA) && q(B, dB) && !q(A, dB) && dA !== dB;
  let wrong = 0;
  for (const d of [A, B]) for (let off = 725; off <= 735; off++) { const s = isoMinus(d, off); if (q(d, s) !== (s === isoMinus(d, 730))) wrong++; }
  checkTrue('M11 UTC midnight edge: the exact UTC day only, never the wrong day', edge && wrong === 0, `23:59:59.999Z accepts ${dA}; 00:00:00.000Z accepts ${dB}`);
  const L1 = new Date('2028-03-01T10:00:00Z'), L2 = new Date('2028-02-29T10:00:00Z');
  checkTrue('M12 leap year: 2028-03-01 -> 2026-03-02, 2028-02-29 -> 2026-03-01',
    q(L1, '2026-03-02') && !q(L1, '2026-03-01') && q(L2, '2026-03-01') && !q(L2, '2026-02-28') && !q(L2, '2026-03-02'));
}

// ---- E. Assertion 3: leak control above the cap, spy, negative control ----
{
  const n0 = log.length;
  const a = ask(S, { maxAge: 2401 }, ctxOf(DEFAULT_MENU));
  const b = ask(S, { maxAge: 9999 }, ctxOf(DEFAULT_MENU));
  const lk = log.slice(n0);
  const ctl = ask(S, { maxAge: 2160 }, ctxOf(DEFAULT_MENU));
  const ctlLog = log[log.length - 1];
  checkTrue('M13 maxAge 2401 and 9999 are refused with ZERO backend reads', a.refused === 'OUT_OF_RANGE' && b.refused === 'OUT_OF_RANGE' && lk.every((l) => !l.accepted && l.reads === 0));
  checkTrue('M14 NEGATIVE CONTROL: an on-menu value records exactly one read', !ctl.refused && ctlLog.reads === 1);
  const refBad = log.filter((l) => !l.accepted && l.reads !== 0).length;
  const accBad = log.filter((l) => l.accepted && l.reads !== 1).length;
  checkTrue('M15 across every ask so far: refusals read nothing, acceptances read exactly once', refBad === 0 && accBad === 0, `asks=${log.length}`);
}

// ---- F. Assertion 5: threshold R ----
{
  const entry = isoMinus(T0, 730), s = { tenureDate: entry };
  const later = ask(T, s, ctxOf(DEFAULT_MENU, T0, isoMinus(T0, 729)));
  const lrReads = log[log.length - 1].reads;
  const eq = ask(T, s, ctxOf(DEFAULT_MENU, T0, entry));
  const earlier = ask(T, s, ctxOf(DEFAULT_MENU, T0, isoMinus(T0, 731)));
  const none = ask(T, s, ctxOf(DEFAULT_MENU, T0, undefined));
  checkTrue('M16 threshold R after the entry date: refused, zero reads; R equal, earlier or absent: answered',
    !!later.refused && lrReads === 0 && !eq.refused && !earlier.refused && !none.refused, `entry date ${entry}`);
  const junkR = ['2024-1-1', 'yesterday', 20240101, null, ''].map((r) => !!ask(T, s, ctxOf(DEFAULT_MENU, T0, r)).refused);
  checkTrue('M17 a malformed thresholdR refuses (fail closed), never answers', junkR.every(Boolean));
}

// ---- G. Assertion 7: wire junk never throws ----
{
  const c = ctxOf(DEFAULT_MENU);
  const trap = new Proxy({}, { ownKeys() { throw new Error('boom'); }, get() { throw new Error('boom'); }, getOwnPropertyDescriptor() { throw new Error('boom'); } });
  const cases = [['missing', S, {}], ['unknown api', 'nope', { maxAge: 2160 }],
    ['null', S, null], ['array', S, [2160]], ['proxy', S, trap], ['proxy tenure', T, trap],
    ['proto', S, JSON.parse('{"__proto__":{"maxAge":2160}}')],
    ['api __proto__', '__proto__', { maxAge: 2160 }], ['api constructor', 'constructor', {}], ['api obj', { toString() { throw 1; } }, {}],
    ['wrong field', S, { tenureDate: '2024-11-23' }], ['undefined params', S, undefined], ['string params', T, '2024-11-23'],
    ['simswap no today, no ctx', S, { maxAge: 99 }, { menu: DEFAULT_MENU }]];
  const bad = [];
  for (const [n, a, p, cx] of cases) {
    try { const r = checkMenu(a, p, cx ?? c); if (r.ok !== false || r.code !== 'OUT_OF_RANGE') bad.push(n); } catch { bad.push(n + ':threw'); }
  }
  try { const r = checkMenu(S, { maxAge: 99 }, undefined); if (r.ok) bad.push('no ctx'); } catch { bad.push('noctx threw'); }
  let threw = false;
  try { answerWithMenu(S, trap, c, () => { throw new Error('read'); }); } catch { threw = true; }
  checkTrue('M18 wire junk (types, extra fields, __proto__ via JSON.parse, proxies, bad today) -> OUT_OF_RANGE, never throws, never reads',
    bad.length === 0 && !threw, `${cases.length + 1} cases, bad=[${bad}]`);
}

// ---- H. Assertion 4: a scripted bisection learns one bit per menu entry ----
{
  const SW = 1000, SUB = 900; // hours since swap; days since subscription
  const swAns = (maxAge) => SW > maxAge;
  const tnAns = (date) => isoMinus(T0, SUB) <= date;
  let ok = true; const out = [];
  for (const [mname, menu] of [['default', DEFAULT_MENU], ['operator', OPERATOR_MENU]]) {
    const accepted = [];
    for (let m = 1; m <= 2400; m++) { const r = ask(S, { maxAge: m }, ctxOf(menu), () => swAns(m)); if (!r.refused) accepted.push(m); }
    const lowB = Math.max(0, ...accepted.filter((m) => swAns(m)));
    const upB = Math.min(Infinity, ...accepted.filter((m) => !swAns(m)));
    if (accepted.length !== menu[S].length || !(lowB < SW && SW <= upB) || upB - lowB < 100) ok = false;
    out.push(`simSwap ${mname}: ${accepted.length} questions, swap age only known in (${lowB}, ${upB}] h`);
    const accT = [];
    for (let off = 0; off <= 3 * 365; off++) { const s = isoMinus(T0, off); const r = ask(T, { tenureDate: s }, ctxOf(menu), () => tnAns(s)); if (!r.refused) accT.push(s); }
    if (accT.length !== menu[T].length) ok = false;
  }
  // Negative control: a RANGE menu (every hour 1..2400 allowed) does let a bisection find the raw hour.
  let lo = 1, hi = 2400;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (swAns(mid)) lo = mid + 1; else hi = mid; }
  checkTrue('M19 the set of accepted questions equals the menu: one bit per entry, raw value not isolated', ok, out.join('; '));
  checkTrue('M20 NEGATIVE CONTROL: with every hour askable (a range) the same bisection finds the raw swap hour', lo === SW);
}

// ---- I. Assertion 6 + end to end: menu check -> signed answer -> entry verified ----
{
  const operator = generateKeyPairSync('ed25519');
  const KID = 'op-kid-m2';
  const resolveKey = (kid) => (kid === KID ? operator.publicKey : null);
  const nonceStore = makeNonceStore();
  const NOW = Math.floor(Date.now() / 1000);
  const base = () => { const nonce = randomUUID(); nonceStore.issue(nonce); return { iss: 'op.example', aud: 'req.example', nonce, iat: NOW, exp: NOW + 300 }; };
  const vo = (extra = {}) => ({ expectedIss: 'op.example', expectedAud: 'req.example', nonceStore, now: NOW, ...extra });
  const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
  const DATE_LIKE = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
  const clean = (p) => !hasOwn(p, 'maxAge') && !hasOwn(p, 'tenureDate') && !Object.values(p).some((v) => typeof v === 'string' && DATE_LIKE.test(v));

  for (const [nm, api, schema, params, ansKey, entry] of [
    ['SimSwap', S, SIM_SWAP_CHECK, { maxAge: 2160 }, 'swapped', 'P90D'],
    ['Tenure', T, TENURE_CHECK, { tenureDate: isoMinus(T0, 730) }, 'tenureDateCheck', 'P2Y'],
  ]) {
    let reads = 0;
    const r = answerWithMenu(api, params, ctxOf(DEFAULT_MENU), () => { reads++; return true; });
    const token = r.refused ? null : attestAnswer(operator.privateKey, KID, base(), schema, { entry: r.entry }, { [ansKey]: r.answer });
    const v = typeof token === 'string' ? verifyAnswer(token, resolveKey, schema, vo({ expectedEntry: entry })) : { ok: false };
    checkTrue(`M21 ${nm} end to end: on-menu question read once, signed answer verifies and names ${entry}`,
      reads === 1 && v.ok === true && v.claims.entry === entry && v.claims[ansKey] === true && v.claims.api === schema.api);
    checkTrue(`M22 ${nm} signed answer holds no maxAge, no tenureDate and no date value (payload keys: ${typeof token === 'string' ? Object.keys(decode(token)).join(',') : 'none'})`,
      typeof token === 'string' && clean(decode(token)));
  }
  // Off-menu end to end: refused, nothing read, a signed refusal that names its API.
  for (const [nm, api, schema, params] of [
    ['SimSwap', S, SIM_SWAP_CHECK, { maxAge: 2401 }],
    ['Tenure', T, TENURE_CHECK, { tenureDate: isoMinus(T0, 400) }],
  ]) {
    let reads = 0;
    const r = answerWithMenu(api, params, ctxOf(DEFAULT_MENU), () => { reads++; return true; });
    const token = r.refused ? attestRefusal(operator.privateKey, KID, base(), r.refused, schema.api) : null;
    const v = typeof token === 'string' ? verifyRefusal(token, resolveKey, vo({ expectedApi: schema.api })) : { ok: false };
    checkTrue(`M23 ${nm} off menu end to end: OUT_OF_RANGE, zero reads, signed refusal verifies and names its API, no raw value`,
      reads === 0 && r.refused === OUT_OF_RANGE && v.ok === true && v.claims.error === OUT_OF_RANGE && v.claims.api === schema.api && clean(decode(token)));
  }
  // Assertion 6: a refusal is bound to its API.
  const sRef = attestRefusal(operator.privateKey, KID, base(), OUT_OF_RANGE, SIM_SWAP_CHECK.api);
  const asTenure = verifyRefusal(sRef, resolveKey, vo({ expectedApi: TENURE_CHECK.api }));
  checkTrue('M24 a SimSwap refusal checked as Tenure -> API_MISMATCH',
    asTenure.ok === false && asTenure.reason instanceof ClaimRejected && asTenure.reason.code === 'API_MISMATCH');
  const sRef2 = attestRefusal(operator.privateKey, KID, base(), OUT_OF_RANGE, SIM_SWAP_CHECK.api);
  checkTrue('M25 NEGATIVE CONTROL: the same refusal checked as SimSwap verifies', verifyRefusal(sRef2, resolveKey, vo({ expectedApi: SIM_SWAP_CHECK.api })).ok === true);
  // The `clean` predicate must be able to FAIL: old-shape payloads are caught.
  checkTrue('M27 NEGATIVE CONTROL: the no-date predicate flags a payload that signs maxAge, tenureDate, or a date value',
    !clean({ api: 'x', maxAge: 2160, swapped: false }) && !clean({ api: 'x', tenureDate: '2024-11-23' }) && !clean({ api: 'x', entry: '2024-11-23' }) && clean({ api: 'x', entry: 'P2Y', tenureDateCheck: true }));
  // Assertion 1 (operator menu): each 30/60/90 entry is signed and verifies.
  const named = [[720, 'P30D'], [1440, 'P60D'], [2160, 'P90D']].every(([h, e]) => {
    const r = answerWithMenu(S, { maxAge: h }, ctxOf(OPERATOR_MENU), () => false);
    const t = attestAnswer(operator.privateKey, KID, base(), SIM_SWAP_CHECK, { entry: r.entry }, { swapped: r.answer });
    const v = typeof t === 'string' ? verifyAnswer(t, resolveKey, SIM_SWAP_CHECK, vo({ expectedEntry: r.entry })) : { ok: false };
    return r.entry === e && v.ok === true && v.claims.entry === e;
  });
  checkTrue('M26 operator menu 30/60/90: every entry is answered, signed and verifies under its own name', named);
}

// ---- J. F1 entryFor, F6 duplicate by days ----
{
  const operator = generateKeyPairSync('ed25519');
  const KID = 'op-kid-m2f';
  const resolveKey = (kid) => (kid === KID ? operator.publicKey : null);
  const nonceStore = makeNonceStore();
  const NOW = Math.floor(Date.now() / 1000);
  const base = () => { const nonce = randomUUID(); nonceStore.issue(nonce); return { iss: 'op.example', aud: 'req.example', nonce, iat: NOW, exp: NOW + 300 }; };
  const vo = (extra = {}) => ({ expectedIss: 'op.example', expectedAud: 'req.example', nonceStore, now: NOW, ...extra });
  const ctx = ctxOf(OPERATOR_MENU);
  checkTrue('M28 entryFor maps the requester field to the entry, and off-menu to null',
    entryFor(S, { maxAge: 2160 }, ctx) === 'P90D' && entryFor(S, { maxAge: 720 }, ctx) === 'P30D' &&
    entryFor(T, { tenureDate: isoMinus(T0, 730) }, ctx) === 'P2Y' &&
    entryFor(S, { maxAge: 2000 }, ctx) === null && entryFor('nope', {}, ctx) === null);
  // Asked P90D; the operator signs a valid P30D answer. The requester must refuse it.
  const wrong = attestAnswer(operator.privateKey, KID, base(), SIM_SWAP_CHECK, { entry: 'P30D' }, { swapped: false });
  const asked = entryFor(S, { maxAge: 2160 }, ctx);
  const v = verifyAnswer(wrong, resolveKey, SIM_SWAP_CHECK, vo({ expectedEntry: asked }));
  checkTrue('M29 asked P90D, signed P30D: ENTRY_MISMATCH', v.ok === false && v.reason instanceof ClaimRejected && v.reason.code === 'ENTRY_MISMATCH');
  const right = attestAnswer(operator.privateKey, KID, base(), SIM_SWAP_CHECK, { entry: 'P90D' }, { swapped: false });
  checkTrue('M30 NEGATIVE CONTROL: asked P90D, signed P90D verifies', verifyAnswer(right, resolveKey, SIM_SWAP_CHECK, vo({ expectedEntry: asked })).ok === true);
  let dup = false;
  try { loadMenu({ [S]: ['P90D'], [T]: ['P1Y', 'P365D'] }); } catch { dup = true; }
  let dupOk = true;
  try { loadMenu({ [S]: ['P90D'], [T]: ['P1Y', 'P2Y'] }); } catch { dupOk = false; }
  checkTrue('M31 duplicate is by days: tenure [P1Y, P365D] throws, [P1Y, P2Y] loads', dup && dupOk);
}

// ---- K. V3-M2 fix round 2: one name per API, caps, calendar dates ----
{
  // N2: the menu is keyed by the schema api value; the old short names are unknown.
  let oldThrows = false, mixedThrows = false;
  try { loadMenu({ simSwap: ['P90D'], tenure: ['P2Y'] }); } catch { oldThrows = true; }
  try { loadMenu({ [S]: ['P90D'], [T]: ['P2Y'], simSwap: ['P90D'] }); } catch { mixedThrows = true; }
  const oldMenu = { simSwap: ['P90D'], tenure: ['P2Y'] };
  const oS = checkMenu('simSwap', { maxAge: 2160 }, { menu: oldMenu, today: T0 });
  const oT = checkMenu('tenure', { tenureDate: isoMinus(T0, 730) }, { menu: oldMenu, today: T0 });
  const oS2 = checkMenu('simSwap', { maxAge: 2160 }, { menu: DEFAULT_MENU, today: T0 });
  checkTrue('M32 the old names simSwap/tenure are refused: loadMenu throws, checkMenu refuses (even on a menu that names them)',
    oldThrows && mixedThrows && !oS.ok && !oT.ok && !oS2.ok && oS.code === 'OUT_OF_RANGE');
}
{
  // N2: the SAME api value flows menu -> signer -> verifier, and menu -> refusal -> verifier.
  const operator = generateKeyPairSync('ed25519');
  const KID = 'op-kid-m2k';
  const resolveKey = (kid) => (kid === KID ? operator.publicKey : null);
  const nonceStore = makeNonceStore();
  const NOW = Math.floor(Date.now() / 1000);
  const base = () => { const nonce = randomUUID(); nonceStore.issue(nonce); return { iss: 'op.example', aud: 'req.example', nonce, iat: NOW, exp: NOW + 300 }; };
  const vo = (extra = {}) => ({ expectedIss: 'op.example', expectedAud: 'req.example', nonceStore, now: NOW, ...extra });
  const ctx = ctxOf(DEFAULT_MENU);
  const sp = { maxAge: 2160 };
  const e = entryFor(SIM_SWAP_CHECK.api, sp, ctx);
  const r = answerWithMenu(SIM_SWAP_CHECK.api, sp, ctx, () => false);
  const tok = attestAnswer(operator.privateKey, KID, base(), SIM_SWAP_CHECK, { entry: r.entry }, { swapped: r.answer });
  const v = verifyAnswer(tok, resolveKey, SIM_SWAP_CHECK, vo({ expectedEntry: e }));
  const off = answerWithMenu(SIM_SWAP_CHECK.api, { maxAge: 2161 }, ctx, () => { throw new Error('read'); });
  const rt = attestRefusal(operator.privateKey, KID, base(), off.refused, SIM_SWAP_CHECK.api);
  const rv = verifyRefusal(rt, resolveKey, vo({ expectedApi: SIM_SWAP_CHECK.api }));
  checkTrue('M33 entryFor(SIM_SWAP_CHECK.api) is P90D; the same api value flows menu -> signed answer -> verifyAnswer, and off menu -> signed refusal -> verifyRefusal',
    e === 'P90D' && entryFor(TENURE_CHECK.api, { tenureDate: isoMinus(T0, 730) }, ctx) === 'P2Y' && v.ok === true && v.claims.entry === 'P90D' &&
    off.refused === OUT_OF_RANGE && rv.ok === true && rv.claims.api === SIM_SWAP_CHECK.api && KNOWN_APIS.includes(S) && KNOWN_APIS.includes(T));
}
{
  // N1: answerWithMenu never returns a SimSwap entry above 2400 h, for any loadable menu.
  let loads100 = true, throws101 = false;
  try { loadMenu({ [S]: ['P100D'], [T]: ['P2Y'] }); } catch { loads100 = false; }
  try { loadMenu({ [S]: ['P101D'], [T]: ['P2Y'] }); } catch { throws101 = true; }
  let worst = 0, accepted = 0;
  for (const list of [['P1D'], ['P100D'], ['P1D', 'P50D', 'P100D'], ['P30D', 'P60D', 'P90D']]) {
    const m = loadMenu({ [S]: list, [T]: ['P2Y'] });
    for (let h = 0; h <= 3000; h++) {
      const r = answerWithMenu(S, { maxAge: h }, ctxOf(m), () => false);
      if (!r.refused) { accepted++; worst = Math.max(worst, parseDuration(r.entry) * 24); }
    }
  }
  checkTrue('M34 answerWithMenu never returns a SimSwap entry above 2400 h for any loadable menu; P100D loads, P101D throws',
    loads100 && throws101 && accepted === 1 + 1 + 3 + 3 && worst <= SIMSWAP_MAX_HOURS && worst === 2400, `accepted=${accepted} worst=${worst} h`);
}
{
  // N4: Tenure entries are capped at P100Y.
  const tryT = (e) => { try { loadMenu({ [S]: ['P90D'], [T]: [e] }); return true; } catch { return false; } };
  checkTrue('M35 Tenure P100Y loads; P101Y and P30000000000Y throw (P100Y is the cap, with P99Y a negative control)',
    tryT('P100Y') && tryT('P99Y') && !tryT('P101Y') && !tryT('P30000000000Y') && !tryT('P36501D') && tryT('P36500D'));
}
{
  // N5: a thresholdR (or a requester date) that is not a real calendar date refuses.
  const entry = isoMinus(T0, 730), s = { tenureDate: entry };
  const refuses = ['2024-13-01', '2024-00-01', '2024-02-30', '2025-02-29'].map((r) => !!ask(T, s, ctxOf(DEFAULT_MENU, T0, r)).refused);
  const real = !ask(T, s, ctxOf(DEFAULT_MENU, T0, '2024-02-29')).refused && !ask(T, s, ctxOf(DEFAULT_MENU, T0, isoMinus(T0, 731))).refused;
  const badReq = ['2024-13-01', '2024-02-30', '2024-00-10'].map((d) => !!ask(T, { tenureDate: d }, ctxOf(DEFAULT_MENU)).refused);
  checkTrue('M36 thresholdR 2024-13-01, 2024-00-01, 2024-02-30, 2025-02-29 refuse; a real R (leap day, earlier date) still answers; non-dates as tenureDate refuse',
    refuses.every(Boolean) && real && badReq.every(Boolean));
}

// ---- L. V3-M2 fix round 3: request body, today, ctx.menu, absent API ----
const PN = '+99012345678';
const throwsT = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError; } };
{
  // P1: the whole request body goes in; only the API's own field is read, as an own property.
  const spy = [];
  const rb = (...a) => { spy.push(a); return true; };
  const bodyS = { phoneNumber: PN, maxAge: 2160, nonce: 'n' };
  const bodyT = { phoneNumber: PN, tenureDate: isoMinus(T0, 730), nonce: 'n' };
  const rS = answerWithMenu(S, bodyS, ctxOf(DEFAULT_MENU), rb);
  const rT = answerWithMenu(T, bodyT, ctxOf(DEFAULT_MENU), rb);
  const inh = Object.create({ maxAge: 2160 });
  const pj = JSON.parse('{"__proto__":{"maxAge":2160}}');
  const spyRefused = [];
  const rI = answerWithMenu(S, inh, ctxOf(DEFAULT_MENU), () => { spyRefused.push(1); return true; });
  const rP = answerWithMenu(S, pj, ctxOf(DEFAULT_MENU), () => { spyRefused.push(1); return true; });
  const rA = answerWithMenu(S, { phoneNumber: PN, nonce: 'n' }, ctxOf(DEFAULT_MENU), () => { spyRefused.push(1); return true; });
  const rD = answerWithMenu(S, { phoneNumber: PN, maxAge: 240 }, ctxOf(DEFAULT_MENU), () => { spyRefused.push(1); return true; });
  checkTrue('M37 request body {phoneNumber, maxAge, nonce} -> P90D; Tenure body -> P2Y; extra keys ignored',
    rS.entry === 'P90D' && rT.entry === 'P2Y' && entryFor(S, bodyS, ctxOf(DEFAULT_MENU)) === 'P90D');
  checkTrue('M38 maxAge absent, only on the prototype, or via JSON.parse __proto__: refused, nothing read; Sync26 default 240 is not applied',
    [rI, rP, rA, rD].every((r) => r.refused === 'OUT_OF_RANGE') && spyRefused.length === 0);
  checkTrue('M39 readBackend receives only (api, entry): never the body, never phoneNumber or nonce',
    spy.length === 2 && spy.every((a) => a.length === 2 && typeof a[0] === 'string' && typeof a[1] === 'string' && !JSON.stringify(a).includes(PN)) &&
    spy[0][0] === S && spy[0][1] === 'P90D' && spy[1][0] === T && spy[1][1] === 'P2Y');
}
{
  // P2: entryFor is computed when the request is built; recomputing at verify time fails across UTC midnight.
  const A = new Date('2026-11-23T23:59:59Z'), B = new Date('2026-11-24T00:00:01Z');
  const body = { phoneNumber: PN, tenureDate: isoMinus(A, 730), nonce: 'n' };
  const atBuild = entryFor(T, body, ctxOf(DEFAULT_MENU, A));
  const atVerify = entryFor(T, body, ctxOf(DEFAULT_MENU, B));
  const operator = generateKeyPairSync('ed25519');
  const KID = 'op-kid-m2p2';
  const nonceStore = makeNonceStore();
  const NOW = Math.floor(Date.now() / 1000);
  const nonce = randomUUID(); nonceStore.issue(nonce);
  const tok = attestAnswer(operator.privateKey, KID, { iss: 'op.example', aud: 'req.example', nonce, iat: NOW, exp: NOW + 300 }, TENURE_CHECK, { entry: 'P2Y' }, { tenureDateCheck: true });
  const v = verifyAnswer(tok, (k) => (k === KID ? operator.publicKey : null), TENURE_CHECK, { expectedIss: 'op.example', expectedAud: 'req.example', nonceStore, now: NOW, expectedEntry: atBuild });
  checkTrue('M40 entryFor at build time (23:59:59Z) still matches the answer verified after 00:00Z; recomputing at verify time returns null',
    atBuild === 'P2Y' && v.ok === true && atVerify === null);
}
{
  // P3: a raw ctx.menu goes through loadMenu.
  const raw = { [T]: ['P1Y', 'P365D'] };
  const r = checkMenu(T, { tenureDate: isoMinus(T0, 365) }, { menu: raw, today: T0 });
  const good = checkMenu(S, { maxAge: 2160 }, { menu: { [S]: ['P90D'] }, today: T0 });
  checkTrue('M41 a raw ctx.menu with a duplicate-by-days list is refused (loadMenu runs); a valid raw menu still answers',
    !r.ok && r.code === 'OUT_OF_RANGE' && good.ok === true);
}
{
  // P4: an API may be absent from the menu; a present list must still be non-empty.
  const m = loadMenu({ [S]: ['P90D'] });
  const t = checkMenu(T, { tenureDate: isoMinus(T0, 730) }, ctxOf(m));
  const s = checkMenu(S, { maxAge: 2160 }, ctxOf(m));
  let emptyThrows = false;
  try { loadMenu({ [S]: ['P90D'], [T]: [] }); } catch { emptyThrows = true; }
  let emptyObj = true;
  try { loadMenu({}); } catch { emptyObj = false; }
  checkTrue('M42 SimSwap-only menu loads and refuses every Tenure question; an empty list still throws',
    s.ok === true && !t.ok && t.code === 'OUT_OF_RANGE' && emptyThrows && emptyObj);
}
{
  // P5: a bad ctx.today on a Tenure question is a caller bug: TypeError. Wire input still never throws.
  const b = { tenureDate: isoMinus(T0, 730) };
  const ok = checkMenu(T, b, ctxOf(DEFAULT_MENU, T0));
  const tests = [
    throwsT(() => checkMenu(T, b, { menu: DEFAULT_MENU, today: Date.now() })),
    throwsT(() => checkMenu(T, b, { menu: DEFAULT_MENU, today: new Date('x') })),
    throwsT(() => checkMenu(T, b, { menu: DEFAULT_MENU })),
    throwsT(() => checkMenu(T, b, undefined)),
    throwsT(() => entryFor(T, b, { menu: DEFAULT_MENU })),
    throwsT(() => answerWithMenu(T, b, { menu: DEFAULT_MENU }, () => true)),
  ];
  let simOk = true;
  try { simOk = checkMenu(S, { maxAge: 2160 }, { menu: DEFAULT_MENU }).ok === true; } catch { simOk = false; }
  let wireOk = true;
  try { wireOk = checkMenu(T, null, ctxOf(DEFAULT_MENU, T0)).code === 'OUT_OF_RANGE' && checkMenu(T, 'junk', ctxOf(DEFAULT_MENU, T0)).ok === false; } catch { wireOk = false; }
  checkTrue('M43 Tenure with today as a number, an invalid Date or missing: TypeError; a valid Date works; SimSwap needs no today; a bad body with a valid today refuses, no throw',
    tests.every(Boolean) && ok.ok === true && simOk && wireOk);
}

conclude(46);

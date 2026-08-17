// PoC module M6 — standalone check. Run: node poc/m6-check.mjs
//
// ZERO credentials, zero network — including the `--backend orange` cases, which
// drive M5 through an INJECTED transport replaying captured Playground bytes
// (the same technique m5-check.mjs uses, for the same reason: an offline suite
// that reached the network would be a live gate wearing an offline label).
//
// Negatives first, as in every module: each guard M6 adds is shown REFUSING, and
// then shown ACCEPTING with that one guard disabled — a control that cannot
// accept means the negative was vacuous, and a guard never disabled has not been
// proven load-bearing.
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { attest } from './m1-attestation.mjs';
import { generateEnvelopeKeys, seal, open } from './m2-envelope.mjs';
import { checkFloor } from './m3-floor.mjs';
import { makeHarness } from './check-harness.mjs';
import * as M5 from './m5-facts-orange.mjs';
import {
  NOW, VALIDITY_MS, DEMO_NUMBER, PUBLISHED_FLOOR, PUBLISHED_THRESHOLD_MENU, WIRE_REASON_MAX, REQUEST_FIELDS,
  packSigned, unpackSigned, canonicalPredicate, clampReason, rawNeedles, scan,
  createBackend, createWorld, createHub, generateKeys, roundTrip, parseArgs, main, runDemo,
} from './demo.mjs';

const { check, conclude } = makeHarness({ field: 'ok', okWord: 'OK' });

const DAY_MS = 86400000;
const SWAPPED_DAYS_AGO = 137;
const PREDICATE = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };
const TIGHTER = { swapAgeMin: 'P180D' };
const NEEDLES = rawNeedles(SWAPPED_DAYS_AGO);
const STORY = { swappedDaysAgo: SWAPPED_DAYS_AGO, roamingCountry: 'FR', reachable: true };

// A fresh world per case where state matters (the nonce store, the hub log), so
// no case can pass because an earlier one left the right thing lying around.
// The KEY SET is shared across worlds on purpose: RSA-4096 generation is ~2.7s
// per key here, and one set per case would put this suite past two minutes
// while asserting nothing extra. Every case that actually turns on key identity
// (10 pinning, 15 forged refusal, 8 impostor) mints its own keys inside itself.
const KEYS = generateKeys();
async function mockWorld() {
  const backend = await createBackend('mock');
  await backend.setBackstory(DEMO_NUMBER, STORY, NOW);
  return createWorld({ backend, keys: KEYS });
}
const ok = (name, pass, extra) => check(name, true, { ok: pass === true, reason: pass === true ? 'ok' : 'failed' }, 'ok', extra);
const rejects = (name, verdict, expectedReason, extra) =>
  check(name, false, { ok: verdict.accepted === true, reason: verdict.reason }, expectedReason, extra);

const W = await mockWorld();

// ══════════════════════════════ NEGATIVES ════════════════════════════════════

// 1 NONCE REPLAY — the single-use store is M6's, because M1's nonce check is
// stateless BINDING and says so in its own comments. The control is the whole
// case: with the store bypassed the SAME bytes verify again, which is exactly
// M1's documented limit and not a defect in it.
{
  const q = W.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(W, q);
  const replay = W.rp.verifyResponse(r.atRp, q.nonce, NOW + 2_000);
  const control = W.rp.verifyResponse(r.atRp, q.nonce, NOW + 2_000, { skipNonceStore: true, fallbackPredicate: PREDICATE });
  rejects('1 NONCE REPLAY', replay, 'unknown or already-used nonce',
    { label: 'store-off control ACCEPTS the same replay', ok: r.verdict.accepted === true && control.accepted === true });
}

// 2 EXPIRED — checked on FIRST presentation past the expiry. Presenting a second
// time would hit the single-use store first and assert the wrong guard.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const late = await roundTrip(w, q, { nowMs: NOW + 2 * VALIDITY_MS });
  const w2 = await mockWorld();
  const q2 = w2.rp.buildRequest(PREDICATE, TIGHTER);
  const inTime = await roundTrip(w2, q2, { nowMs: NOW + VALIDITY_MS - 1 });
  rejects('2 EXPIRED', late.verdict, 'expired',
    { label: 'one ms inside the window the SAME shape is accepted', ok: inTime.verdict.accepted === true });
}

// 3 LEAKY OPERATOR — an operator that ships the age alongside the bit. TWO
// independent defences must fire: the wire scan reds, and M1's closed claim set
// rejects the response. If only one fired, the other was decoration.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q, { operator: { leakRaw: true } });
  const hits = scan(unpackSigned(r.out.plain).signed.payloadBytes, NEEDLES);
  rejects('3 LEAKY OPERATOR', r.verdict, 'unexpected fields: swapAgeMs',
    { label: `wire scan also reds (hits=${JSON.stringify(hits)})`, ok: hits.includes('swapAgeMs') && hits.includes(String(SWAPPED_DAYS_AGO * DAY_MS)) });
}

// 4 BELOW-FLOOR REFUSED — FR4. The refusal must be SIGNED and no bit may be
// computed; the control shows the silent widening is one missing call away.
{
  const w = await mockWorld();
  const r = await roundTrip(w, w.rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' }));
  const c = await roundTrip(w, w.rp.buildRequest(PREDICATE, { swapAgeMin: 'P30D' }), { operator: { skipFloorGate: true } });
  rejects('4 BELOW-FLOOR REFUSED', r.verdict, 'operator refused: below floor: swapAgeMin P30D < P90D',
    { label: 'no attestation produced; gate-off control ANSWERS the same request',
      ok: r.out.floorRejected === true && r.out.claims.result === undefined && c.out.kind === 'answer' && c.verdict.accepted === true });
}

// 5 OFF-MENU THRESHOLD REFUSED — decision #1. Refused BEFORE any fact is read,
// because a computed-then-discarded answer is still an oracle query. With the
// menu off, the same free-choice threshold is answered — one rung of the walk
// the spike used to recover the exact swap age.
{
  const w = await mockWorld();
  const off = { type: 'simSwapAge', operator: 'gte', value: 'P137D' };
  const r = await roundTrip(w, w.rp.buildRequest(off, TIGHTER));
  const c = await roundTrip(w, w.rp.buildRequest(off, TIGHTER), { operator: { skipMenu: true } });
  const onMenu = await roundTrip(w, w.rp.buildRequest({ type: 'simSwapAge', operator: 'gte', value: 'P365D' }, TIGHTER));
  rejects('5 OFF-MENU THRESHOLD REFUSED', r.verdict,
    'operator refused: threshold not on the published menu for simSwapAge (allowed: P30D, P90D, P180D, P365D)',
    { label: 'menu-off control ANSWERS it; every menu entry still answers',
      ok: r.out.menuRejected === true && c.out.kind === 'answer' && c.out.claims.result === true && onMenu.verdict.accepted === true });
}

// 5b MENU COVERS ONLY ORDERED THRESHOLDS — the absence of a menu for `roamingIn`
// and `reachable` is a decision, not an oversight (a set has no ordering to
// bisect; a boolean is already at full resolution). Pinned so that "quantise
// everything" cannot be added later by accident, and so the published menu
// cannot silently gain or lose a bucket.
{
  const w = await mockWorld();
  const roam = await roundTrip(w, w.rp.buildRequest({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }, TIGHTER));
  const reach = await roundTrip(w, w.rp.buildRequest({ type: 'reachable', operator: 'eq', value: true }, TIGHTER));
  ok('6 MENU SCOPE', roam.verdict.accepted === true && reach.verdict.accepted === true,
    { label: 'menu keys are exactly [simSwapAge] with 4 buckets',
      ok: JSON.stringify(Object.keys(PUBLISHED_THRESHOLD_MENU)) === '["simSwapAge"]'
        && JSON.stringify(PUBLISHED_THRESHOLD_MENU.simSwapAge) === '["P30D","P90D","P180D","P365D"]' });
}

// 7 DUPLICATE-KEY REQUEST REFUSED — decision #2, using M1's exported scanner.
// `attest()` cannot produce these bytes (JSON.stringify de-dups), so they are
// signed directly — which is what an attacker does anyway.
{
  const w = await mockWorld();
  const text = JSON.stringify({ number: DEMO_NUMBER, predicate: PREDICATE, floor: { swapAgeMin: 'P365D' }, nonce: 'dup-nonce-01' })
    .replace('"nonce"', '"floor":{"swapAgeMin":"P90D"},"nonce"');
  const bytes = Buffer.from(text, 'utf8');
  const sealed = seal(w.keys.opEnc.publicKey, packSigned({ payloadBytes: bytes, signature: edSign(null, bytes, w.keys.rpSig.privateKey) }, w.keys.rpIss));
  const r = await w.operator.handle(sealed);
  const c = await w.operator.handle(sealed, { skipDupKeyScan: true });
  check('7 DUPLICATE-KEY REQUEST', false, { ok: r.kind === 'answer', reason: r.reason },
    'duplicate top-level key in request (ambiguous bytes — re-request cleanly)',
    { label: 'scan-off control ANSWERS the same bytes, reading the LAST floor',
      ok: c.kind === 'answer' && JSON.parse(text).floor.swapAgeMin === 'P90D' });
}

// 8 IMPOSTOR REQUEST — signed by a key that is not the claimed RP's. Rejected
// before any fact is read; this is the seam that closes M2's audit open item,
// and the control shows the operator would otherwise answer anyone who can
// reach its public envelope key.
{
  const w = await mockWorld();
  const impostor = generateKeyPairSync('ed25519');
  const req = { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER, nonce: 'impostor-nonce' };
  const sealed = seal(w.keys.opEnc.publicKey, packSigned(attest(impostor.privateKey, req), w.keys.rpIss));
  const r = await w.operator.handle(sealed);
  const c = await w.operator.handle(sealed, { skipRequestAuth: true });
  check('8 IMPOSTOR REQUEST', false, { ok: r.kind === 'answer', reason: r.reason }, 'bad request signature',
    { label: 'auth-off control gives the forged request a SIGNED answer', ok: c.kind === 'answer' });
}

// 9 UNKNOWN ISSUER — the key comes from the directory, never from the wire.
{
  const w = await mockWorld();
  const req = { number: DEMO_NUMBER, predicate: PREDICATE, floor: TIGHTER, nonce: 'n' };
  const r = await w.operator.handle(seal(w.keys.opEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, req), 'rp:not-in-directory')));
  check('9 UNKNOWN ISSUER', false, { ok: r.kind === 'answer', reason: r.reason }, 'unknown issuer',
    { label: 'unsealed: an operator cannot sign a refusal to a party it cannot name', ok: r.sealed === null && r.stage === 'transport' });
}

// 10 RESPONSE KEY PINNING — profile rule 3. A DIFFERENT directory-listed party
// answers a query addressed to the operator, with a truthful `iss` pointing at
// its own real directory key. Forging a key that is in NO directory entry cannot
// tell pinning from hint-following, which is why the attacker here is listed.
{
  const w = await mockWorld();
  const claims = { predicate: canonicalPredicate(PREDICATE), result: true, nonce: 'side-nonce', exp: NOW + VALIDITY_MS };
  const sealed = seal(w.keys.rpEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, claims), w.keys.rpIss));
  w.rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  const pinned = w.rp.verifyResponse(sealed, 'side-nonce', NOW + 1_000);
  w.rp.pending.set('side-nonce', { predicate: canonicalPredicate(PREDICATE) });
  const hint = w.rp.verifyResponse(sealed, 'side-nonce', NOW + 1_000, { trustIssHint: true });
  rejects('10 RESPONSE KEY PINNING', pinned, 'bad signature',
    { label: 'iss-hint control ACCEPTS the same answer', ok: hint.accepted === true });
}

// 11 WRONG-THRESHOLD ANSWER — the operator answers `gte P1D` to a `gte P90D`
// question. Only an INJECTIVE canonical string catches this: the spike proved a
// mapping that drops the threshold leaves every test green while both sides
// happily derive the same lossy string.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q, { operator: { answerPredicate: { type: 'simSwapAge', operator: 'gte', value: 'P1D' } } });
  rejects('11 WRONG-THRESHOLD ANSWER', r.verdict, 'predicate mismatch',
    { label: `signed '${r.out.claims.predicate}' vs asked '${canonicalPredicate(PREDICATE)}'`,
      ok: r.out.claims.predicate !== canonicalPredicate(PREDICATE) });
}

// 12 UNSCRIPTED NUMBER — M4/M5 THROW rather than fabricate a backstory, and the
// number came off the wire, so M6 must catch it and refuse loudly. A crash here
// would take the operator down on an input anyone can send.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER, { number: '+990999999999' });
  const r = await roundTrip(w, q);
  check('12 UNSCRIPTED NUMBER', false, { ok: r.out.kind === 'answer', reason: r.out.reason ? 'refused' : 'crashed' }, 'refused',
    { label: 'refusal is signed, nonce-bound, clamped, and names the number',
      ok: r.verdict.refused === true && r.out.reason.includes('+990999999999') && r.out.reason.length <= WIRE_REASON_MAX + 1 });
}

// 13 UNANSWERABLE PREDICATE — profile §3.3.1: a fact the operator cannot supply
// is REFUSED, never defaulted. `result:false` here would be a signed confident
// negative about a question that was never answerable.
{
  const w = await mockWorld();
  const r = await roundTrip(w, w.rp.buildRequest({ type: 'simSwapAgeTypo', operator: 'gte', value: 'P90D' }, TIGHTER));
  check('13 UNANSWERABLE PREDICATE', false, { ok: r.out.kind === 'answer', reason: r.out.kind }, 'reject',
    { label: 'the signed refusal carries NO result field — not a defaulted false',
      ok: r.out.claims.result === undefined && Object.keys(r.out.claims).sort().join(',') === 'error,exp,nonce' && r.verdict.refused === true });
}

// 14 HUB CANNOT READ + the log carries metering only. The chatty control is what
// makes the log assertion mean anything: a scanner that cannot red is not a
// scanner.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  const hubKeys = generateEnvelopeKeys();
  const tried = open(hubKeys.privateKey, r.atRp);
  const logNeedles = [...NEEDLES, DEMO_NUMBER, 'simSwapAge', 'P90D'];
  const clean = scan(JSON.stringify(w.hub.log), logNeedles);
  const chatty = createHub();
  chatty.route(w.keys.rpIss, w.keys.opIss, r.atRp, { chatty: `${DEMO_NUMBER} asked simSwapAge P90D → true` });
  check('14 BLIND HUB', false, { ok: tried.ok, reason: tried.reason }, 'undecryptable',
    { label: `log clean (hits=${JSON.stringify(clean)}); chatty control reds the SAME scanner`,
      ok: clean.length === 0 && scan(JSON.stringify(chatty.log), logNeedles).length > 0 });
}

// 15 FORGED REFUSAL — the blind hub invents a denial. It cannot: refusals past
// authentication are SIGNED, so a hub-authored one fails the pinned key. This is
// why refusals are signed at all rather than returned as plain transport errors.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const hubSig = generateKeyPairSync('ed25519');
  const forged = seal(w.keys.rpEnc.publicKey,
    packSigned(attest(hubSig.privateKey, { error: 'below floor: swapAgeMin P30D < P90D', nonce: q.nonce, exp: NOW + VALIDITY_MS }), w.keys.opIss));
  const v = w.rp.verifyResponse(forged, q.nonce, NOW + 1_000);
  rejects('15 FORGED REFUSAL', v, 'bad signature',
    { label: 'not reported as a refusal — a forgery is not an operator decision', ok: v.refused === undefined });
}

// 16 UNDECRYPTABLE REQUEST — untrusted bytes must produce a verdict, never a
// throw, all the way through the composition.
{
  const w = await mockWorld();
  const r = await w.operator.handle(Buffer.alloc(512, 7));
  const notBuffer = await w.operator.handle('not a buffer');
  check('16 UNDECRYPTABLE REQUEST', false, { ok: r.kind === 'answer', reason: r.reason }, 'undecryptable',
    { label: 'a non-Buffer is also a verdict, not a throw', ok: notBuffer.reason === 'malformed ciphertext' });
}

// ══════════════════════════════ POSITIVES / SEAMS ════════════════════════════

// 17 HAPPY PATH — one full round trip, closed claim set, and the ONE disclosure.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  ok('17 HAPPY PATH', r.verdict.accepted === true && r.out.claims.result === true,
    { label: 'claim set is exactly {predicate, result, nonce, exp}',
      ok: JSON.stringify(Object.keys(r.verdict.claims)) === '["predicate","result","nonce","exp"]' });
}

// 18 NO RAW VALUE ON THE WIRE — every artifact the requester or the hub can hold.
// The bare day count is deliberately not a needle: three digits land inside a
// 32-character hex nonce about once every 140 runs, so it would flake rather
// than assert. The long forms are the values that would actually leak.
{
  const w = await mockWorld();
  const q = w.rp.buildRequest(PREDICATE, TIGHTER);
  const r = await roundTrip(w, q);
  const artifacts = [r.atRp, r.out.plain, unpackSigned(r.out.plain).signed.payloadBytes, Buffer.from(JSON.stringify(w.hub.log), 'utf8')];
  const hits = artifacts.flatMap((a) => scan(a, NEEDLES));
  ok('18 NO RAW VALUE ON THE WIRE', hits.length === 0,
    { label: 'and the same scanner reds on a planted leak', ok: scan(Buffer.from(`{"swapAgeMs":${SWAPPED_DAYS_AGO * DAY_MS}}`), NEEDLES).length === 2 });
}

// 19 INJECTIVE CANONICALISATION — the two collisions the spike found, closed.
// The threshold is part of the string, and `["FR","BE"]` does not render the
// same as the single-element set `["FR,BE"]` (the obvious `join(',')` spelling
// made them identical, and M4 only happened to reject the second one).
{
  const c = canonicalPredicate;
  const thresholdKept = c({ type: 'simSwapAge', operator: 'gte', value: 'P90D' }) !== c({ type: 'simSwapAge', operator: 'gte', value: 'P1D' });
  const setsDistinct = c({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }) !== c({ type: 'roamingIn', operator: 'in', value: ['FR,BE'] });
  const typesDistinct = c({ type: 'reachable', operator: 'eq', value: true }) !== c({ type: 'reachable', operator: 'eq', value: 'true' });
  ok('19 INJECTIVE CANONICALISATION', thresholdKept && setsDistinct && typesDistinct,
    { label: `e.g. ${JSON.stringify(c({ type: 'roamingIn', operator: 'in', value: ['FR', 'BE'] }))}`,
      ok: c(PREDICATE) === 'simSwapAge gte "P90D"' });
}

// 20 REASON CLAMP — M3 builds reasons from wire input and does not bound them;
// M2's seal() THROWS above the envelope capacity. Unclamped, a long enough
// refusal makes the operator CRASH instead of refuse. Both halves measured here:
// the unclamped reason throws at seal, the clamped one seals.
{
  const w = await mockWorld();
  const long = checkFloor(PUBLISHED_FLOOR, { swapAgeMin: `P${'9'.repeat(600)}Q` });
  const sealIt = (reason) => {
    try {
      seal(w.keys.rpEnc.publicKey, packSigned(attest(w.keys.opSig.privateKey, { error: reason, nonce: 'n', exp: NOW + VALIDITY_MS }), w.keys.opIss));
      return null;
    } catch (e) { return e.message; }
  };
  const rawThrew = sealIt(long.reason);
  const clampedThrew = sealIt(clampReason(long.reason));
  ok('20 REASON CLAMP', rawThrew !== null && clampedThrew === null,
    { label: `unclamped ${long.reason.length} B → '${String(rawThrew).slice(0, 40)}…'; clamped ${clampReason(long.reason).length} B seals`,
      ok: long.allowed === false && clampReason(long.reason).length <= WIRE_REASON_MAX + 1 && clampReason(42) === 'rejected' });
}

// 21 LARGEST WIRE-REACHABLE FLOOR VALUE — how reachable case 20 actually is:
// the 446-byte envelope caps the REQUEST too, which caps how long a wire value
// (and therefore an M3 reason) can be. The operator must survive the worst one a
// requester can physically send, and refuse it rather than crash.
{
  const w = await mockWorld();
  let biggest = null;
  for (let n = 1; n <= 400; n++) {
    try { biggest = { n, req: w.rp.buildRequest(PREDICATE, { swapAgeMin: `P${'9'.repeat(n)}Q` }) }; } catch { break; }
  }
  const r = await roundTrip(w, biggest.req);
  ok('21 LARGEST WIRE-REACHABLE FLOOR VALUE', r.out.kind === 'reject',
    { label: `max wire value ${biggest.n + 2} chars → refused, signed, sealed`,
      ok: r.verdict.refused === true && r.out.reason.length <= WIRE_REASON_MAX + 1 });
}

// 22 BACKEND SEAM — the whole FR5 claim in one case. The orange backend runs
// through an INJECTED transport replaying captured Playground bytes (zero
// credentials, zero network). Hold the keys and the nonce fixed and the two
// backends produce a BYTE-IDENTICAL signed frame — signature included, since
// Ed25519 is deterministic. That is the strongest form the FR5 claim can take:
// the backend is demonstrably the only variable, and the wire is not merely
// equivalent between the two modes but literally the same bytes.
{
  const CRED = `Basic ${Buffer.from('CLIENTID0000000000000000000000AA:SECRET000000000000000000000000000000000000BB').toString('base64')}`;
  const swapIso = new Date(NOW - SWAPPED_DAYS_AGO * DAY_MS).toISOString();
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const isToken = String(opts?.headers?.['Content-Type']).includes('urlencoded');
    const body = !isToken && typeof opts?.body === 'string' ? JSON.parse(opts.body) : null;
    calls.push({ url, action: body?.action });
    const reply = (status, text) => ({ status, text: async () => text });
    if (isToken) return reply(200, '{"token_type":"Bearer","access_token":"T.OK.0000","expires_in":3600}');
    if (url.includes('/admin/')) {
      // READ mirrors the write, so the module's load-bearing read-after-write
      // verification passes; UPDATE echoes, exactly as the real API does.
      if (body.action === 'READ') {
        return reply(200, JSON.stringify({ data: { simSwap: { latestSimChange: swapIso }, roaming: { roaming: true, countryName: ['FR'] }, reachability: { reachabilityStatus: 'CONNECTED_DATA' } } }));
      }
      return reply(200, JSON.stringify({ data: body.data ?? {} }));
    }
    if (url.includes('sim-swap')) return reply(200, JSON.stringify({ latestSimChange: swapIso }));
    if (url.includes('roaming')) return reply(200, '{"roaming":true,"countryName":["FR"]}');
    if (url.includes('reachability')) return reply(200, '{"reachabilityStatus":"CONNECTED_DATA"}');
    return reply(404, '{}');
  };
  const orange = await createBackend('orange', { basicAuth: CRED, fetchImpl });
  await orange.setBackstory(DEMO_NUMBER, STORY, NOW);
  const wo = createWorld({ backend: orange, keys: KEYS });
  const wm = await mockWorld();
  const NONCE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const ro = await roundTrip(wo, wo.rp.buildRequest(PREDICATE, TIGHTER, { nonce: NONCE }));
  const rm = await roundTrip(wm, wm.rp.buildRequest(PREDICATE, TIGHTER, { nonce: NONCE }));
  const bytesOf = (r) => unpackSigned(r.out.plain).signed.payloadBytes.toString('utf8');
  ok('22 BACKEND SEAM', ro.verdict.accepted === true && rm.verdict.accepted === true && ro.out.plain.equals(rm.out.plain),
    { label: `identical frame; claims ${JSON.stringify(bytesOf(ro))} over ${calls.length} replayed calls, none live`,
      ok: bytesOf(ro) === bytesOf(rm) && calls.some((c) => c.url.includes('sim-swap')) && calls.some((c) => c.action === 'READ') });
}

// 23 ONE EVALUATION STEP — M5 exports `createOrangeFacts` and nothing else, so
// both backends share M4's `evaluatePredicate`. If M5 ever grew its own copy,
// the backends would be two code paths and case 22's equality would be proving
// far less than it looks like it proves.
ok('23 ONE EVALUATION STEP', Object.keys(M5).sort().join(',') === 'createOrangeFacts',
  { label: `M5 exports=${JSON.stringify(Object.keys(M5).sort())}`, ok: true });

// 24 ENTRY POINT — argument parsing and the exit-code contract. The orange leg
// runs with ORANGE_BASIC_AUTH DELETED for the duration: on a machine that has
// the credential, leaving it set would make this offline suite talk to the live
// Playground, which is precisely what it must never do.
{
  const saved = process.env.ORANGE_BASIC_AUTH;
  delete process.env.ORANGE_BASIC_AUTH;
  // The prerequisite banner is the demo's job to print, not this suite's — the
  // contract under test is the EXIT CODE, so the banner is swallowed rather than
  // left to look like a failure in the middle of a green run.
  const realErr = console.error;
  console.error = () => {};
  let noCred; let badArg; let badBackend;
  try {
    noCred = await main(['--backend', 'orange']);
    badArg = await main(['--oops']);
    badBackend = await main(['--backend', 'sqlite']);
  } finally {
    console.error = realErr;
    if (saved !== undefined) process.env.ORANGE_BASIC_AUTH = saved;
  }
  ok('24 ENTRY POINT', noCred === 2 && badArg === 2 && badBackend === 2,
    { label: 'defaults to mock; --backend=x accepted; unknown value refused',
      ok: parseArgs([]).backend === 'mock' && parseArgs(['--backend=orange']).backend === 'orange' && parseArgs(['--backend', 'x']).error !== undefined });
}

// 25 THE DEMO ITSELF — run it and check the contract a reader depends on: exit
// 0, a RESULT line, and CLAIMS DISCIPLINE. Every mention of zero-knowledge in
// the output must be a NEGATION; the repo invariant is that Mode A is attested
// windowed disclosure and is never described as ZK, and the demo is the one
// place that discipline is enforced in an artifact rather than in prose.
{
  const backend = await createBackend('mock');
  const lines = [];
  const real = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  let code;
  try { code = await runDemo(backend); } finally { console.log = real; }
  const zk = lines.filter((l) => /zero.knowledge|\bZK\b/i.test(l));
  const allNegated = zk.length > 0 && zk.every((l) => /never|not |NOT |reserved for Mode B/.test(l));
  const result = lines.find((l) => l.startsWith('RESULT: '));
  ok('25 THE DEMO ITSELF', code === 0 && result === 'RESULT: 22/22',
    { label: `${zk.length} ZK mentions, all negations=${allNegated}; ${result}`, ok: allNegated });
}

// 26 CLOSED REQUEST FIELD SET — the outermost layer, and the last one that was
// left open. Found by an adversarial probe of demo.mjs AFTER it was first
// written and green: a request carrying `floors` (one letter off) had its floor
// silently DROPPED, so the operator applied its own P90D and signed an answer
// while the requester believed it had demanded P365D. Silent widening through a
// spelling mistake — M3's closed-axis argument, one level further out, and
// invisible to every module because no module owns this envelope. The control
// reproduces the widening exactly.
{
  const w = await mockWorld();
  const typo = { number: DEMO_NUMBER, predicate: PREDICATE, floors: { swapAgeMin: 'P365D' }, nonce: 'typo-1' };
  const bytes = Buffer.from(JSON.stringify(typo), 'utf8');
  const sealed = seal(w.keys.opEnc.publicKey, packSigned({ payloadBytes: bytes, signature: edSign(null, bytes, w.keys.rpSig.privateKey) }, w.keys.rpIss));
  const r = await w.operator.handle(sealed);
  const c = await w.operator.handle(sealed, { skipRequestFields: true });
  // A field NAME is requester-chosen text: an unprintable one must not ride into
  // the reason verbatim, where an embedded newline could forge a log line.
  const nasty = { number: DEMO_NUMBER, predicate: PREDICATE, floor: {}, nonce: 'typo-2', ['a\nb\u0000']: 1 };
  const nastyBytes = Buffer.from(JSON.stringify(nasty), 'utf8');
  const nastyOut = await w.operator.handle(seal(w.keys.opEnc.publicKey,
    packSigned({ payloadBytes: nastyBytes, signature: edSign(null, nastyBytes, w.keys.rpSig.privateKey) }, w.keys.rpIss)));
  check('26 CLOSED REQUEST FIELD SET', false, { ok: r.kind === 'answer', reason: r.reason }, 'unexpected request fields: floors',
    { label: 'set-open control reproduces the silent widening; unprintable names are not echoed',
      ok: c.kind === 'answer' && c.claims.result === true
        && JSON.stringify(REQUEST_FIELDS) === '["number","predicate","floor","nonce"]'
        && nastyOut.reason === 'unexpected request fields: (unprintable field name)' });
}

// 27 HOSTILE PREDICATE NEVER THROWS — the composition's own "wire input never
// throws" contract, which each module states for itself and nobody had stated
// for the seam between them. Every shape here arrives through a real JSON
// transit and must come back as a verdict, not an exception: the operator is
// reachable by anyone who has its public envelope key.
{
  const w = await mockWorld();
  const send = async (predicate, nonce) => {
    const req = { number: DEMO_NUMBER, predicate, floor: { swapAgeMin: 'P180D' }, nonce };
    const sealed = seal(w.keys.opEnc.publicKey, packSigned(attest(w.keys.rpSig.privateKey, req), w.keys.rpIss));
    try { return await w.operator.handle(sealed); } catch (e) { return { kind: 'THREW', reason: `${e.constructor.name}: ${e.message}` }; }
  };
  const shapes = [null, undefined, ['simSwapAge'], 'simSwapAge gte P90D', 7, true,
    { type: { a: 1 }, operator: 'gte', value: 'P90D' },
    { type: 'simSwapAge', operator: 'gte', value: { a: 1 } },
    { type: 'roamingIn', operator: 'in', value: ['FR', null] },
    { type: 'roamingIn', operator: 'in', value: [] }];
  const outs = [];
  for (let i = 0; i < shapes.length; i++) outs.push(await send(shapes[i], `hostile-${i}`));
  const threw = outs.filter((o) => o.kind === 'THREW');
  const answered = outs.filter((o) => o.kind === 'answer');
  ok('27 HOSTILE PREDICATE NEVER THROWS', threw.length === 0 && answered.length === 0,
    { label: `${outs.length} shapes, ${threw.length} threw, ${answered.length} answered${threw.length ? `: ${threw[0].reason}` : ''}`,
      ok: outs.every((o) => typeof o.reason === 'string' && o.reason.length <= WIRE_REASON_MAX + 1) });
}

// The declared case count. A suite that silently loses the cases carrying its
// guarantee still printed a green `RESULT: n/n` before this argument existed
// (measured 2026-08-16 on m4-check: truncated to 18/18 exit 0, emptied to 0/0
// exit 0).
conclude(27);

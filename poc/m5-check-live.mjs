// PoC module M5 — LIVE check against the Orange Network APIs Playground.
// Run: ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/m5-check-live.mjs
//
// This is the G2 gate. `m5-check.mjs` proves the mapping offline against
// captured bytes; this proves the same adapter still gets those bytes from the
// real Playground today — and that the two guards that matter are load-bearing
// in production, not just against fixtures:
//
//   * the SWAP-AGE BIT FLIPS when the backstory is re-scripted live (FR1 with
//     its negative, on real infrastructure), and
//   * the WRITE-TRAP DEFENCE FIRES on a real built-in number, with the same
//     call against a real custom slot as the negative control.
//
// Exit 0 only if every case holds; 1 if any fails; 2 if the prerequisites are
// missing — never a silent pass and never a mock fallback.
//
// It costs live quota: it CREATEs and then DELETEs one slot for the trap case,
// and leaves the custom slot re-scripted to a known state.
import { createOrangeFacts } from './m5-facts-orange.mjs';
import { evaluatePredicate } from './m4-facts-mock.mjs';
import { makeHarness } from './check-harness.mjs';

const SUPPLIED = (process.env.ORANGE_BASIC_AUTH ?? '').trim();
if (SUPPLIED === '') {
  console.error('PREREQUISITES MISSING — this check talks to the live Orange Playground.\n');
  console.error('  1. Free account at developer.orange.com → My Apps → create an app');
  console.error('  2. Add an API → "Network APIs Playground" → Credentials tab → Show');
  console.error('  3. Run with the Basic Auth string in the environment (never the tree):\n');
  console.error('     ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/m5-check-live.mjs\n');
  console.error('  `| head -1` because the entry is multi-line; a leading "Basic " is fine.');
  console.error('exit 2: prerequisites missing (this is NOT a pass, and there is no mock fallback)');
  process.exit(2);
}

const { check, conclude } = makeHarness({ field: 'answered', okWord: 'OK' });

const CUSTOM = '+990100000099';   // the scriptable slot (quota: 10 per app)
const BUILTIN = '+990100000000';  // a built-in: shadows every write
const DAY = 86400000;
// The clock is injected here exactly as M4 injects it — but a LIVE run must use
// a real instant, because the dates written go to a real API and are read back
// and differenced. Captured ONCE so every case in this run shares one clock.
const NOW = Date.now();

const facts = createOrangeFacts({ basicAuth: SUPPLIED });

const athrew = async (fn) => {
  try { return { threw: false, msg: 'did not throw', value: await fn() }; }
  catch (e) { return { threw: true, msg: e instanceof Error ? e.message : String(e) }; }
};
const ok = (name, cond, label) => check(name, true, { answered: cond === true, reason: cond === true ? 'ok' : 'failed' }, 'ok', { label, ok: cond === true });
const threw = (name, r, cond, label) =>
  check(name, false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw', { label, ok: cond === true });

// A RAW admin call, used only to build a state the adapter's own (deliberately
// narrow) backstory shape cannot express, and to clean up afterwards. It never
// prints a body — only booleans derived from one.
const CRED = SUPPLIED.replace(/^Basic\s+/i, '');
let adminToken = null;
async function rawAdmin(body) {
  if (adminToken === null) {
    const t = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${CRED}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    adminToken = JSON.parse(await t.text()).access_token;
  }
  const res = await fetch('https://api.orange.com/camara/playground/admin/v1.0/action', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

console.log(`live run against the Orange Playground, injected now = ${new Date(NOW).toISOString()}\n`);

// ===================== 1-2 THE WRITE TRAP, LIVE =============================

// 1 THE TRAP FIRES ON A REAL BUILT-IN NUMBER. Measured 2026-08-16: the adapter
// CREATEs the slot (201), UPDATEs it (200, echoing the written date straight
// back), and the very next READ carries the built-in's own dataset instead. The
// echo is never proof — so this call MUST fail loudly rather than leave the
// demo asserting against a backstory that never took effect.
{
  const r = await athrew(() => facts.setBackstory(BUILTIN, { swappedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW));
  threw('1 LIVE TRAP: built-in number write FAILS LOUD', r,
    r.threw && r.msg.includes('write verification FAILED') && r.msg.includes('Built-in numbers'),
    `names the shadowing: ${r.threw && r.msg.includes('Built-in numbers')}`);
  // Give the consumed slot back — the app's custom-number quota is 10.
  await rawAdmin({ action: 'DELETE', phoneNumber: BUILTIN });
}

// 2 THE NEGATIVE CONTROL, LIVE. The identical call against a CUSTOM slot must
// SUCCEED. Without it, case 1 would pass on an adapter that rejected every
// write — "it stopped" is not evidence a guard is load-bearing.
{
  const r = await athrew(() => facts.setBackstory(CUSTOM, { swappedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW));
  ok('2 LIVE CONTROL: custom slot write VERIFIES', !r.threw, r.threw ? r.msg : 'write stored and read back');
}

// ============ 3-4 FR1 LIVE: the bit flips, the payload shape does not ========

const P90 = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };

// 3 A 120-DAY-OLD SIM ANSWERS TRUE — and the answer carries the BOOLEAN ONLY.
// The swap DATE came back from Orange and was differenced here; it never
// reaches the answer.
{
  const f = await facts.getFacts(CUSTOM, NOW);
  const a = evaluatePredicate(f, P90);
  const closed = Object.keys(a).sort().join(',') === 'answered,reason,result';
  ok('3 LIVE FR1: 120-day-old SIM → true (closed answer)',
    a.answered === true && a.result === true && closed,
    `answered=${a.answered} result=${a.result} keys=${Object.keys(a).sort().join(',')} (age is NOT in the answer)`);
}

// 4 THE NEGATIVE, LIVE: re-script the SAME number to "swapped yesterday" and
// re-ask the SAME predicate. The bit flips to false. This is the FR1 negative
// on real infrastructure — the assertion the whole PoC exists to make.
{
  await facts.setBackstory(CUSTOM, { swappedDaysAgo: 1, roamingCountry: null, reachable: true }, NOW);
  const f = await facts.getFacts(CUSTOM, NOW);
  const a = evaluatePredicate(f, P90);
  ok('4 LIVE FR1 NEGATIVE: re-scripted to 1 day → false',
    a.answered === true && a.result === false && f.swapAgeMs < 2 * DAY,
    `answered=${a.answered} result=${a.result}`);
}

// ================== 5-7 the wired axes serve REAL values ====================

// 5 ROAMING IS WIRED — device-roaming-status answers live, and a scripted
// country round-trips through the CAMARA read.
{
  await facts.setBackstory(CUSTOM, { swappedDaysAgo: 1, roamingCountry: 'FR', reachable: true }, NOW);
  const f = await facts.getFacts(CUSTOM, NOW);
  const inFr = evaluatePredicate(f, { type: 'roamingIn', operator: 'in', value: ['FR'] });
  const inDe = evaluatePredicate(f, { type: 'roamingIn', operator: 'in', value: ['DE'] });
  ok('5 LIVE roaming WIRED: scripted FR → in[FR] true, in[DE] false',
    f.roamingCountry === 'FR' && inFr.answered === true && inFr.result === true && inDe.result === false,
    `roamingCountry=${f.roamingCountry}`);
}

// 6 `null` IS AN HONEST "NOT ROAMING", LIVE — a real signed answer of `false`,
// not a refusal. The pair to case 7.
{
  await facts.setBackstory(CUSTOM, { swappedDaysAgo: 1, roamingCountry: null, reachable: true }, NOW);
  const f = await facts.getFacts(CUSTOM, NOW);
  const a = evaluatePredicate(f, { type: 'roamingIn', operator: 'in', value: ['FR'] });
  ok('6 LIVE not-roaming → key PRESENT and null → answered false',
    'roamingCountry' in f && f.roamingCountry === null && a.answered === true && a.result === false,
    `present=${'roamingCountry' in f} value=${String(f.roamingCountry)}`);
}

// 7 …AND AN UNAVAILABLE AXIS REFUSES, LIVE. All three axes are wired on this
// app, so "unavailable" is demonstrated the only honest way available: by
// putting the subscriber into a state the Playground genuinely produces and the
// adapter genuinely cannot answer from — roaming TRUE with NO country
// (`{"roaming":true}` on the wire). The raw admin write is used because the
// adapter's own backstory shape deliberately cannot express "roaming, country
// unknown". The key must be ABSENT and the predicate must REFUSE — folding this
// into `null` would answer "not roaming in FR" about a subscriber who is
// roaming and may well be in FR.
{
  const w = await rawAdmin({ action: 'UPDATE', phoneNumber: CUSTOM, data: { roaming: { roaming: true } } });
  const f = await facts.getFacts(CUSTOM, NOW);
  const a = evaluatePredicate(f, { type: 'roamingIn', operator: 'in', value: ['FR'] });
  ok('7 LIVE unavailable axis → key ABSENT → predicate REFUSES',
    w.status === 200 && !('roamingCountry' in f) && a.answered === false && a.reason === 'fact unavailable: roamingCountry',
    `present=${'roamingCountry' in f} answered=${a.answered} reason='${a.reason}'`);
}

// 8 REACHABILITY IS WIRED — and flips with the backstory.
{
  await facts.setBackstory(CUSTOM, { swappedDaysAgo: 1, roamingCountry: null, reachable: false }, NOW);
  const off = await facts.getFacts(CUSTOM, NOW);
  await facts.setBackstory(CUSTOM, { swappedDaysAgo: 1, roamingCountry: null, reachable: true }, NOW);
  const on = await facts.getFacts(CUSTOM, NOW);
  ok('8 LIVE reachability WIRED: flips false → true',
    off.reachable === false && on.reachable === true,
    `off=${String(off.reachable)} on=${String(on.reachable)}`);
}

// ==================== 9-10 live error classification + redaction ============

// 9 AN UNKNOWN NUMBER IS CLASSIFIED AS ONE, LIVE — `403 FORBIDDEN` here means
// UNKNOWN NUMBER, and saying so is what stops the next person debugging auth.
{
  const r = await athrew(() => facts.getFacts('+990100000077', NOW));
  threw('9 LIVE unknown number → classified, not read as bad auth', r,
    r.threw && r.msg.includes('unknown number') && r.msg.includes('not bad auth'),
    `msg starts: ${r.threw ? r.msg.slice(0, 48) : r.msg}`);
}

// 10 THE LIVE BODY LEAKS THE CLIENT ID; THE ADAPTER'S MESSAGE DOES NOT. The
// precondition is DEMONSTRATED, not assumed: the raw response for the very same
// call is fetched and confirmed to contain the client id first. Without that
// half, this case could pass against a Playground that had simply stopped
// echoing it — a redaction proof with nothing to redact.
{
  const clientId = (() => {
    try { const d = Buffer.from(CRED, 'base64').toString('utf8'); const i = d.indexOf(':'); return i > 0 ? d.slice(0, i) : ''; }
    catch { return ''; }
  })();
  const camara = await fetch('https://api.orange.com/openidconnect/playground/v1.0/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${CRED}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const tok = JSON.parse(await camara.text()).access_token;
  const raw = await fetch('https://api.orange.com/camara/playground/api/sim-swap/v1/retrieve-date', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '+990100000077' }),
  });
  const rawBody = await raw.text();
  const leaks = clientId !== '' && rawBody.includes(clientId);
  // The token must be a real one: `msg.includes(undefined)` coerces to
  // `includes('undefined')`, which would pass this case without ever having a
  // token to look for.
  const tokUsable = typeof tok === 'string' && tok.length > 20;
  const r = await athrew(() => facts.getFacts('+990100000077', NOW));
  ok('10 LIVE redaction: raw body carries the client id, the error does not',
    leaks === true && tokUsable && r.threw && !r.msg.includes(clientId) && !r.msg.includes(CRED) && !r.msg.includes(tok),
    `raw body leaks client id=${leaks}, adapter message leaks=${r.threw && clientId !== '' && r.msg.includes(clientId)}`);
}

// Leave the slot in the demo's known state, so a re-run starts where this one did.
await facts.setBackstory(CUSTOM, { swappedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW);
console.log(`\n${CUSTOM} left scripted: swapped 120 days ago, not roaming, reachable`);

conclude(10);

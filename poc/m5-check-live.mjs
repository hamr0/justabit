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
// It costs live quota: it CREATEs and then DELETEs one of the app's 10
// custom-number slots for the trap case, and leaves the custom slot re-scripted
// to a known state. The slot is RECLAIMED before it is consumed (so a run
// interrupted mid-trap does not leak one permanently), the count is printed at
// both ends against the cap, and case 11 asserts it came back.
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

// ============================ QUOTA HYGIENE =================================
// The app's custom-number quota is 10, and case 1 CONSUMES one: the adapter
// CREATEs the built-in slot before it can discover the write is shadowed, and
// gives it back immediately afterwards. A run that is INTERRUPTED between those
// two points (Ctrl-C, a dropped connection, a machine going away) leaves that
// slot consumed, and nothing in the previous version of this check reported it
// — the cleanup DELETE's result was discarded, so repeated interrupted runs
// could walk the quota to its cap silently and the next run would fail for a
// reason nothing on screen explained.
//
// Three cheap measures, all of them observable in the output:
//   * RECLAIM FIRST — the slot is deleted BEFORE it is consumed, so a leak from
//     an earlier interrupted run is recovered rather than accumulated;
//   * the count is PRINTED at both ends, against the cap; and
//   * case 11 ASSERTS it came back to where it started.
const QUOTA_CAP = 10;
async function slotCount() {
  const r = await rawAdmin({ action: 'LIST' });
  try {
    const arr = JSON.parse(r.text).phoneNumbers;
    return Array.isArray(arr) ? arr.length : null;
  } catch { return null; }
}

console.log(`live run against the Orange Playground, injected now = ${new Date(NOW).toISOString()}\n`);

// Measured 2026-08-16: DELETE of a slot that is NOT held answers `400
// BAD_REQUEST "PhoneNumber Not Found"` — i.e. "nothing to reclaim", which is
// the normal case and not a fault. A `204` here means an earlier run really did
// leak, and says so.
const reclaimed = await rawAdmin({ action: 'DELETE', phoneNumber: BUILTIN });
// The CUSTOM demo slot is made to EXIST before the baseline is taken, and that
// ordering is the whole point. Case 2 writes to it, and on a FRESH account the
// adapter's CREATE-if-`PhoneNumber Not Found` path creates it — a legitimate,
// deliberate, permanent consumption (line ~290 leaves it scripted on purpose),
// NOT a leak. Taking the baseline before that happened made `end === start`
// false on a first run and reported it as "the trap case did not give its slot
// back" — a red on a clean account, blaming the wrong case, found at the v0.3.0
// release gate. Measuring after it exists keeps the assertion EXACT (`===`,
// not a loosened `<=`) on a fresh account and a re-run alike, and a genuine
// BUILTIN leak still fails it. CREATE on a slot already held is a harmless
// no-op error, so this is idempotent.
const ensured = await rawAdmin({ action: 'CREATE', phoneNumber: CUSTOM });
const startSlots = await slotCount();
console.log(`quota: ${startSlots} of ${QUOTA_CAP} custom slots in use at start` +
  (reclaimed.status === 204 ? '  (RECLAIMED a slot leaked by an earlier interrupted run)' : '') +
  (ensured.status === 201 ? `  (CREATED ${CUSTOM}: first run on this app)` : '') + '\n');

let gaveBack = null;   // the trap case's cleanup DELETE, asserted by case 11

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
  // Give the consumed slot back — the app's custom-number quota is 10. The
  // result is KEPT, not discarded: a cleanup whose failure nothing observes is
  // how the quota drains without anyone noticing. Case 11 asserts on it.
  gaveBack = await rawAdmin({ action: 'DELETE', phoneNumber: BUILTIN });
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

// 11 THE RUN GIVES ITS QUOTA BACK. Added by the 2026-08-16 review round. Case 1
// CONSUMES one of the app's 10 custom-number slots and hands it back; before
// this case the hand-back was unobserved, so a cleanup that silently failed
// would have walked the quota toward its cap across runs and the eventual
// failure would have named a number, not a quota. The COUNT is the assertion
// because it is the authoritative observable; the DELETE's status is reported
// alongside it and required only to be a success, not to be exactly `204`.
// The comparison is EXACT on purpose. It stays exact because the baseline above
// is taken with the CUSTOM slot already in existence — the one legitimate
// permanent consumption this run makes is therefore inside `startSlots` rather
// than showing up here as phantom growth (v0.3.0 release gate).
{
  const endSlots = await slotCount();
  const deleted = gaveBack !== null && gaveBack.status >= 200 && gaveBack.status < 300;
  ok('11 QUOTA RESTORED: the trap case gave its slot back',
    startSlots !== null && endSlots !== null && endSlots === startSlots && endSlots < QUOTA_CAP && deleted,
    `start=${startSlots} end=${endSlots} of ${QUOTA_CAP}, cleanup DELETE status=${gaveBack?.status}`);
  console.log(`\nquota: ${endSlots} of ${QUOTA_CAP} custom slots in use at end (started at ${startSlots})`);
}

// Leave the slot in the demo's known state, so a re-run starts where this one did.
await facts.setBackstory(CUSTOM, { swappedDaysAgo: 120, roamingCountry: null, reachable: true }, NOW);
console.log(`${CUSTOM} left scripted: swapped 120 days ago, not roaming, reachable`);

conclude(11);

// PoC module M5 — LIVE check against the Orange Network APIs Playground.
// Run: ORANGE_BASIC_AUTH="$(pass camara/orange_network | head -1)" node poc/m5-check-live.mjs
//
// This is the G2 gate. `m5-check.mjs` proves the mapping offline against
// captured bytes; this proves the same adapter still gets those bytes from the
// real Playground today — and that the guards that matter are load-bearing in
// production, not just against fixtures:
//
//   * the SWAP-AGE BIT FLIPS when the backstory is re-scripted live (FR1 with
//     its negative, on real infrastructure),
//   * the WRITE-TRAP DEFENCE FIRES on a real built-in number, with the same
//     call against a real custom slot as the negative control, and
//   * every one of the SIX wired predicates answers off a real endpoint, each
//     with its negative — the axis this file was missing until 2026-08-17.
//
// Exit 0 only if every case holds; 1 if any fails; 2 if the prerequisites are
// missing — never a silent pass and never a mock fallback.
//
// It costs live quota: it CREATEs and then DELETEs one of the app's 10 custom
// number slots for the trap case, and leaves the custom slot re-scripted
// to a known state. The slot is RECLAIMED before it is consumed (so a run
// interrupted mid-trap does not leak one permanently), the count is printed at
// both ends against the cap, and the last case asserts it came back.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY CASE 1 EXISTS, and it is the most important paragraph in this file.
//
// The 3 → 6 predicate round (2026-08-17) widened M5's backstory from three
// fields to six and updated every sibling suite. It did not touch this one.
// `git log 8238d02..81f8da4 -- poc/m5-check-live.mjs` was EMPTY. Every
// `setBackstory` call here still passed the old three-field story, so the first
// live run died on M5's own closed-field validation
// (`deviceSwappedDaysAgo must be whole non-negative days`) before it reached a
// single guard it was written to prove — and case 1's trap, which asserts a
// throw NAMING the built-in shadowing, went red having caught a validation
// error instead. It failed for a reason that was not its own.
//
// That is a GROUNDING failure, not a coding one: the module's contract moved and
// the only file that could not be run offline drifted away from it silently. So
// the first case now pins this file's story against the adapter's own closed
// field set, OFFLINE and before any network call — a future field addition reds
// here, on a clean clone with no credentials, instead of at the live gate.
// ─────────────────────────────────────────────────────────────────────────────
import { createOrangeFacts } from './m5-facts-orange.mjs';
import { evaluatePredicate, factQuery } from './m4-facts-mock.mjs';
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
const HOUR = 3600000;
// The clock is injected here exactly as M4 injects it — but a LIVE run must use
// a real instant, because the dates written go to a real API and are read back
// and differenced. Captured ONCE so every case in this run shares one clock.
const NOW = Date.now();

// ONE backstory, built in ONE place, six fields and no defaults — the same shape
// `m5-check.mjs` uses offline and `demo.mjs` uses end to end. Case 1 is what
// keeps this definition honest against the adapter's closed field set.
const SUBSCRIBER_AT = Object.freeze({ lat: 48.8566, long: 2.3522 });    // Paris
const REGISTERED = 'Alice Arnaud';                                       // the operator's record
const NEAR_MISS = 'Alice Arnaut';                                        // one letter off — measured 97
const WRONG_NAME = 'Bob Wrong';                                          // measured 53
const BACKSTORY_FIELDS = Object.freeze(['swappedDaysAgo', 'deviceSwappedDaysAgo', 'roamingCountry', 'reachable', 'location', 'registeredName']);
const story = (over = {}) => ({
  swappedDaysAgo: 120,
  deviceSwappedDaysAgo: 200,     // deliberately NOT the SIM count: a mapping that
  roamingCountry: null,          // reads the wrong axis must not pass
  reachable: true,
  location: SUBSCRIBER_AT,
  registeredName: REGISTERED,
  ...over,
});

// The areas the live location endpoint is asked about. The subscriber's own
// position is scripted above; these are the QUESTIONS, and they are deliberately
// not the position (a question that is byte-identical to the answer proves
// nothing about which one the endpoint used).
const AREA_NEAR = Object.freeze({ lat: 48.86, long: 2.35, radiusM: 10000 });    // same city
const AREA_FAR = Object.freeze({ lat: 35.68, long: 139.77, radiusM: 10000 });   // Tokyo
const AREA_FINE = Object.freeze({ lat: 48.86, long: 2.35, radiusM: 100 });      // the measured PARTIAL radius

// ─────────────────────────── the recording transport ─────────────────────────
// A pass-through around the real `fetch`. This is still a LIVE run — every byte
// goes to Orange — but the URL and the two request fields the surface-choice
// cases assert on are recorded on the way past. Dependency injection, not a
// test-only branch: the adapter has exactly one code path either way.
//
// It records the URL, the admin action and `maxAge` and NOTHING else: no
// headers (that is where the credential is) and no response bodies (that is
// where Orange echoes the client id back). A recorder that logged more would be
// the one place in this file with no redaction layer.
const wire = [];
const recordingFetch = async (url, opts) => {
  const isToken = String(opts?.headers?.['Content-Type']).includes('urlencoded');
  let body = null;
  if (!isToken && typeof opts?.body === 'string') { try { body = JSON.parse(opts.body); } catch { body = null; } }
  wire.push({ url: String(url), isToken, action: body?.action ?? null, maxAge: body?.maxAge ?? null });
  return globalThis.fetch(url, opts);
};
// Everything since a mark, so a case reads only its own calls.
const mark = () => wire.length;
const since = (m) => wire.slice(m).filter((c) => !c.isToken);
const hit = (m, fragment) => since(m).filter((c) => c.url.includes(fragment));

const facts = createOrangeFacts({ basicAuth: SUPPLIED, fetchImpl: recordingFetch });

const athrew = async (fn) => {
  try { return { threw: false, msg: 'did not throw', value: await fn() }; }
  catch (e) { return { threw: true, msg: e instanceof Error ? e.message : String(e) }; }
};
const ok = (name, cond, label) => check(name, true, { answered: cond === true, reason: cond === true ? 'ok' : 'failed' }, 'ok', { label, ok: cond === true });
const threw = (name, r, cond, label) =>
  check(name, false, { answered: !r.threw, reason: r.threw ? 'threw' : 'did not throw' }, 'threw', { label, ok: cond === true });
// The closed answer shape, asserted wherever a live answer is asserted: the bit
// and nothing else — no age, no score, no verdict word, no date.
const closed = (a) => Object.keys(a).sort().join(',') === 'answered,reason,result';
// A predicate, asked live end to end: the adapter is told only what `factQuery`
// validated out of the predicate, exactly as M6 wires it.
const ask = async (predicate) => {
  const f = await facts.getFacts(CUSTOM, NOW, factQuery(predicate));
  return { f, a: evaluatePredicate(f, predicate) };
};

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
    // Guarded parse, and NEVER the body in the message: this raw path has no
    // redaction layer, so the only safe diagnostic is the status. Unguarded,
    // two failures were silent-or-worse (post-v0.3.0 review round): a 401 JSON
    // error body parsed fine and cached `access_token: undefined` — and
    // `undefined === null` is false, so every later call sent
    // `Bearer undefined` and the quota case blamed QUOTA for an AUTH fault; a
    // non-JSON body (gateway HTML) threw a raw SyntaxError that on Node 20+
    // quotes a snippet of the body, contradicting the promise above.
    let tok;
    try { tok = JSON.parse(await t.text()).access_token; } catch { tok = undefined; }
    if (t.status !== 200 || typeof tok !== 'string' || tok === '') {
      throw new Error(`raw admin token exchange failed (status ${t.status}) — `
        + 'check ORANGE_BASIC_AUTH (revoked/wrong credential) or the Playground may be down; body withheld (no redaction on this raw path)');
    }
    adminToken = tok;
  }
  const res = await fetch('https://api.orange.com/camara/playground/admin/v1.0/action', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

// ============================ QUOTA HYGIENE =================================
// The app's custom-number quota is 10, and the trap case CONSUMES one: the
// adapter CREATEs the built-in slot before it can discover the write is
// shadowed, and gives it back immediately afterwards. A run that is INTERRUPTED
// between those two points (Ctrl-C, a dropped connection, a machine going away)
// leaves that slot consumed, and nothing in the original version of this check
// reported it — the cleanup DELETE's result was discarded, so repeated
// interrupted runs could walk the quota to its cap silently and the next run
// would fail for a reason nothing on screen explained.
//
// Three cheap measures, all of them observable in the output:
//   * RECLAIM FIRST — the slot is deleted BEFORE it is consumed, so a leak from
//     an earlier interrupted run is recovered rather than accumulated;
//   * the count is PRINTED at both ends, against the cap; and
//   * the last case ASSERTS it came back to where it started.
const QUOTA_CAP = 10;
async function slotCount() {
  const r = await rawAdmin({ action: 'LIST' });
  try {
    const arr = JSON.parse(r.text).phoneNumbers;
    return Array.isArray(arr) ? arr.length : null;
  } catch { return null; }
}

console.log(`live run against the Orange Playground, injected now = ${new Date(NOW).toISOString()}\n`);

// ============ 1 THE STORY MATCHES THE ADAPTER — OFFLINE, BEFORE ANY CALL =====
// The grounding guard described at the top of this file, and the only case here
// that needs no network. It asserts three things about the ONE story definition
// above, against the adapter's own validator:
//
//   * the FULL story is ACCEPTED — proven by the fact that it gets all the way
//     to the transport, which is a sentinel that always throws. That is the leg
//     that would have caught the 3 → 6 drift: a story missing a newly-required
//     field never reaches the sentinel, it dies in validation.
//   * EVERY field is REQUIRED — dropping any one of the six is refused, so a
//     field the adapter stops requiring cannot rot here unnoticed either.
//   * an UNKNOWN field is refused by name, which is what makes a typo both an
//     unknown field and a missing one.
{
  const SENTINEL = 'SENTINEL: reached the transport';
  const offline = createOrangeFacts({
    basicAuth: SUPPLIED,
    fetchImpl: async () => { throw new Error(SENTINEL); },
  });
  const full = await athrew(() => offline.setBackstory(CUSTOM, story(), NOW));
  const accepted = full.threw && full.msg.includes(SENTINEL);
  const dropped = [];
  for (const field of BACKSTORY_FIELDS) {
    const partial = story();
    delete partial[field];
    const r = await athrew(() => offline.setBackstory(CUSTOM, partial, NOW));
    // Refused by VALIDATION, which is not the same as "threw": the sentinel
    // throws too, and a case that accepted either would pass on a story that was
    // never validated at all.
    dropped.push(r.threw && r.msg.includes('invalid backstory') && !r.msg.includes(SENTINEL));
  }
  const typo = await athrew(() => offline.setBackstory(CUSTOM, { ...story(), swapedDaysAgo: 1 }, NOW));
  ok('1 THE STORY MATCHES THE ADAPTER\'S CLOSED FIELD SET (offline, no network)',
    accepted && dropped.every(Boolean) && typo.threw && typo.msg.includes('unknown field') && typo.msg.includes('swapedDaysAgo'),
    `full story accepted (reached the transport)=${accepted}; each of the ${BACKSTORY_FIELDS.length} fields required=`
    + `${JSON.stringify(BACKSTORY_FIELDS.map((f, i) => `${f}:${dropped[i]}`))}; unknown field refused by name=${typo.threw && typo.msg.includes('swapedDaysAgo')}`);
}

// Measured 2026-08-16: DELETE of a slot that is NOT held answers `400
// BAD_REQUEST "PhoneNumber Not Found"` — i.e. "nothing to reclaim", which is
// the normal case and not a fault. A `204` here means an earlier run really did
// leak, and says so.
const reclaimed = await rawAdmin({ action: 'DELETE', phoneNumber: BUILTIN });
// The CUSTOM demo slot is made to EXIST before the baseline is taken, and that
// ordering is the whole point. The control case writes to it, and on a FRESH
// account the adapter's CREATE-if-`PhoneNumber Not Found` path creates it — a
// legitimate, deliberate, permanent consumption (the courtesy re-script at the
// end leaves it scripted on purpose), NOT a leak. Taking the baseline before
// that happened made `end === start` false on a first run and reported it as
// "the trap case did not give its slot back" — a red on a clean account, blaming
// the wrong case, found at the v0.3.0 release gate. Measuring after it exists
// keeps the assertion EXACT (`===`, not a loosened `<=`) on a fresh account and
// a re-run alike, and a genuine BUILTIN leak still fails it. CREATE on a slot
// already held is a harmless no-op error, so this is idempotent.
const ensured = await rawAdmin({ action: 'CREATE', phoneNumber: CUSTOM });
const startSlots = await slotCount();
console.log(`quota: ${startSlots} of ${QUOTA_CAP} custom slots in use at start` +
  (reclaimed.status === 204 ? '  (RECLAIMED a slot leaked by an earlier interrupted run)' : '') +
  (ensured.status === 201 ? `  (CREATED ${CUSTOM}: first run on this app)` : '') + '\n');

let gaveBack = null;   // the trap case's cleanup DELETE, asserted by the last case

// ===================== 2-3 THE WRITE TRAP, LIVE =============================

// 2 THE TRAP FIRES ON A REAL BUILT-IN NUMBER. Measured 2026-08-16: the adapter
// CREATEs the slot (201), UPDATEs it (200, echoing the written date straight
// back), and the very next READ carries the built-in's own dataset instead. The
// echo is never proof — so this call MUST fail loudly rather than leave the
// demo asserting against a backstory that never took effect.
//
// It must fail for ITS OWN reason. The 2026-08-17 live run is why that is
// spelled out as an assertion rather than assumed: this case threw, and the
// throw was a backstory-validation error from a story that had drifted out of
// shape. "It threw" is not evidence a guard fired. So the message must name the
// shadowing AND must NOT be a validation refusal — and case 1 above has already
// proven, offline, that this exact story passes validation.
{
  const r = await athrew(() => facts.setBackstory(BUILTIN, story(), NOW));
  threw('2 LIVE TRAP: built-in number write FAILS LOUD (for the shadowing, not for anything else)', r,
    r.threw && r.msg.includes('write verification FAILED') && r.msg.includes('Built-in numbers')
      && !r.msg.includes('invalid backstory'),
    `names the shadowing=${r.threw && r.msg.includes('Built-in numbers')}, `
    + `is NOT a validation refusal=${r.threw && !r.msg.includes('invalid backstory')}`);
  // Give the consumed slot back — the app's custom-number quota is 10. The
  // result is KEPT, not discarded: a cleanup whose failure nothing observes is
  // how the quota drains without anyone noticing. The last case asserts on it.
  gaveBack = await rawAdmin({ action: 'DELETE', phoneNumber: BUILTIN });
}

// 3 THE NEGATIVE CONTROL, LIVE. The identical call against a CUSTOM slot must
// SUCCEED. Without it, case 2 would pass on an adapter that rejected every
// write — "it stopped" is not evidence a guard is load-bearing.
//
// It is also the case that SETTLES the remaining ASSUMED Admin write shapes,
// because every one of them rides this single payload and every one of them is
// READ BACK and compared: `deviceSwap:{latestDeviceChange}`,
// `location:{latitude, longitude, lastLocationTime}` (the shape the 2026-08-17
// live run corrected — the bare pair was refused with `400 "…lastLocationTime is
// required"`) and `kyc:{name}`, which has never reached the Admin API at all
// because that run aborted at the location axis. If one of them is still wrong,
// this case reds and the adapter's message names the axis and says the shape is
// a suspect.
{
  const r = await athrew(() => facts.setBackstory(CUSTOM, story(), NOW));
  ok('3 LIVE CONTROL: custom slot write VERIFIES (all assumed Admin shapes read back)',
    !r.threw, r.threw ? r.msg : 'write stored and read back on every axis: simSwap, deviceSwap, location(+lastLocationTime), kyc, roaming, reachability');
}

// ============ 4-6 FR1 LIVE: the bit flips, the payload shape does not ========

const P90 = { type: 'simSwapAge', operator: 'gte', value: 'P90D' };

// 4 A 120-DAY-OLD SIM ANSWERS TRUE — and the answer carries the BOOLEAN ONLY.
// Whatever the operator read (a date, or a `/check` bit about a window) stayed
// operator-side; it never reaches the answer.
{
  const { a } = await ask(P90);
  ok('4 LIVE FR1: 120-day-old SIM → true (closed answer)',
    a.answered === true && a.result === true && closed(a),
    `answered=${a.answered} result=${a.result} keys=${Object.keys(a).sort().join(',')} (no age, no date, no window in the answer)`);
}

// 5 THE NEGATIVE, LIVE: re-script the SAME number to "swapped yesterday" and
// re-ask the SAME predicate. The bit flips to false. This is the FR1 negative
// on real infrastructure — the assertion the whole PoC exists to make.
{
  await facts.setBackstory(CUSTOM, story({ swappedDaysAgo: 1 }), NOW);
  const { a } = await ask(P90);
  ok('5 LIVE FR1 NEGATIVE: re-scripted to 1 day → false',
    a.answered === true && a.result === false && closed(a),
    `answered=${a.answered} result=${a.result}`);
}

// 6 THE SURFACE IS CHOSEN LIVE FROM THE MEASURED CAP. `/check` answers a bit
// about a `maxAge` window in HOURS capped at 2400 (boundary-tested 2026-08-17),
// and it is the profile-conforming surface: the operator never learns the date.
// So `P90D` (2160 h) must go to `/check` carrying that window, and `P365D`
// (8760 h) cannot be expressed there at all and must fall back to the date
// surface — never rounded down to a window `/check` CAN express, which would
// answer a question nobody asked, signed.
//
// This is the one case here that reads the WIRE rather than the answer, because
// which endpoint ran is not observable from a boolean. `m5-check.mjs` proves the
// same choice against replayed bytes; this proves both surfaces still answer.
{
  await facts.setBackstory(CUSTOM, story(), NOW);
  const m1 = mark();
  const fits = await ask(P90);
  const c1 = hit(m1, 'sim-swap');
  const m2 = mark();
  const over = await ask({ type: 'simSwapAge', operator: 'gte', value: 'P365D' });
  const c2 = hit(m2, 'sim-swap');
  ok('6 LIVE SURFACE CHOICE: /check under the cap, /retrieve-date above it',
    c1.length === 1 && c1[0].url.endsWith('/check') && c1[0].maxAge === (90 * DAY) / HOUR && c1[0].maxAge <= 2400
      && c2.length === 1 && c2[0].url.endsWith('/retrieve-date')
      && fits.a.answered === true && fits.a.result === true
      && over.a.answered === true && over.a.result === false,
    `P90D → ${c1[0]?.url.split('/').pop()} maxAge=${c1[0]?.maxAge}h → ${fits.a.result}; `
    + `P365D → ${c2[0]?.url.split('/').pop()} maxAge=${c2[0]?.maxAge} → ${over.a.result}`);
}

// ==================== 7-8 deviceSwapAge, LIVE ===============================

// 7 THE DEVICE AXIS ANSWERS OFF ITS OWN ENDPOINT, AND ITS OWN FIELD. It is a
// SEPARATE fact from the SIM axis with a DIFFERENT field name on the wire
// (`latestDeviceChange`, not `latestSimChange`), and the story deliberately
// gives the two different day counts — so an adapter reading the wrong axis
// answers the wrong question and this case reds rather than passing by luck.
{
  const m = mark();
  const { a } = await ask({ type: 'deviceSwapAge', operator: 'gte', value: 'P180D' });
  const calls = hit(m, 'device-swap');
  ok('7 LIVE deviceSwapAge: a 200-day-old device → true off device-swap',
    a.answered === true && a.result === true && closed(a) && calls.length === 1,
    `answered=${a.answered} result=${a.result}, ${calls.length} device-swap call(s) → ${calls[0]?.url.split('/').pop()}`);
}

// 8 THE DEVICE NEGATIVE, LIVE — and the axes are INDEPENDENT. The device is
// re-scripted to yesterday while the SIM keeps its 120 days, so the device bit
// flips and the SIM bit does not. One flip alone would also pass on an adapter
// that read one axis for both questions; the pair cannot.
{
  await facts.setBackstory(CUSTOM, story({ deviceSwappedDaysAgo: 1 }), NOW);
  const device = await ask({ type: 'deviceSwapAge', operator: 'gte', value: 'P180D' });
  const sim = await ask(P90);
  await facts.setBackstory(CUSTOM, story(), NOW);
  ok('8 LIVE deviceSwapAge NEGATIVE: the device bit flips and the SIM bit does not',
    device.a.answered === true && device.a.result === false
      && sim.a.answered === true && sim.a.result === true,
    `device (re-scripted to 1 day) → ${device.a.result}; SIM (untouched, 120 days) → ${sim.a.result}`);
}

// ================== 9-11 roaming: null, a country, and unknown ==============

// 9 ROAMING IS WIRED — device-roaming-status answers live, and a scripted
// country round-trips through the CAMARA read.
{
  await facts.setBackstory(CUSTOM, story({ roamingCountry: 'FR' }), NOW);
  const inFr = await ask({ type: 'roamingIn', operator: 'in', value: ['FR'] });
  const inDe = await ask({ type: 'roamingIn', operator: 'in', value: ['DE'] });
  ok('9 LIVE roaming WIRED: scripted FR → in[FR] true, in[DE] false',
    inFr.f.roamingCountry === 'FR' && inFr.a.answered === true && inFr.a.result === true
      && inDe.a.answered === true && inDe.a.result === false && closed(inFr.a),
    `roamingCountry=${inFr.f.roamingCountry} → in[FR]=${inFr.a.result}, in[DE]=${inDe.a.result}`);
}

// 10 `null` IS AN HONEST "NOT ROAMING", LIVE — a real signed answer of `false`,
// not a refusal. The pair to case 11.
{
  await facts.setBackstory(CUSTOM, story(), NOW);
  const { f, a } = await ask({ type: 'roamingIn', operator: 'in', value: ['FR'] });
  ok('10 LIVE not-roaming → key PRESENT and null → answered false',
    'roamingCountry' in f && f.roamingCountry === null && a.answered === true && a.result === false,
    `present=${'roamingCountry' in f} value=${String(f.roamingCountry)}`);
}

// 11 …AND AN UNAVAILABLE AXIS REFUSES, LIVE. All the axes are wired on this app,
// so "unavailable" is demonstrated the only honest way available: by putting the
// subscriber into a state the Playground genuinely produces and the adapter
// genuinely cannot answer from — roaming TRUE with NO country
// (`{"roaming":true}` on the wire). The raw admin write is used because the
// adapter's own backstory shape deliberately cannot express "roaming, country
// unknown". The key must be ABSENT and the predicate must REFUSE — folding this
// into `null` would answer "not roaming in FR" about a subscriber who is
// roaming and may well be in FR.
{
  const w = await rawAdmin({ action: 'UPDATE', phoneNumber: CUSTOM, data: { roaming: { roaming: true } } });
  const { f, a } = await ask({ type: 'roamingIn', operator: 'in', value: ['FR'] });
  ok('11 LIVE unavailable axis → key ABSENT → predicate REFUSES',
    w.status === 200 && !('roamingCountry' in f) && a.answered === false && a.reason === 'fact unavailable: roamingCountry',
    `present=${'roamingCountry' in f} answered=${a.answered} reason='${a.reason}'`);
}

// ========================= 12-13 presentIn, LIVE ============================

// 12 THE POSITION QUESTION IS ANSWERED, BOTH WAYS, OFF A REAL ENDPOINT. The
// subscriber is scripted into Paris; a Paris-sized circle answers TRUE and a
// Tokyo one answers FALSE. The AREA is the requester's question and the POSITION
// never leaves the operator: the answer carries the bit and nothing else.
{
  await facts.setBackstory(CUSTOM, story(), NOW);
  const near = await ask({ type: 'presentIn', operator: 'in', value: AREA_NEAR });
  const far = await ask({ type: 'presentIn', operator: 'in', value: AREA_FAR });
  ok('12 LIVE presentIn: inside the asked area → true, 9,700 km away → false',
    near.a.answered === true && near.a.result === true && closed(near.a)
      && far.a.answered === true && far.a.result === false && closed(far.a)
      && near.f.presentVerdict === 'TRUE' && far.f.presentVerdict === 'FALSE',
    `Paris r=${AREA_NEAR.radiusM}m → ${near.a.result} (verdict ${near.f.presentVerdict}); `
    + `Tokyo r=${AREA_FAR.radiusM}m → ${far.a.result} (verdict ${far.f.presentVerdict})`);
}

// 13 THE VERDICT VOCABULARY IS CLOSED LIVE, AND EACH STATE IS HANDLED AS ITSELF.
// `location-verification/v1/verify` was measured answering THREE states —
// `TRUE`, `FALSE` and `PARTIAL` (Paris at a 100 m radius) — and `PARTIAL` is the
// operator saying it cannot resolve the subscriber at the resolution asked for.
//
// What this case asserts is exactly what it can: the live verdict at a fine
// radius is one of the three, and the profile's handling of WHICHEVER came back
// is correct — `PARTIAL` produces a REFUSAL carrying no bit (never a rounded
// true/false), `TRUE`/`FALSE` produce a signed bit. It deliberately does NOT
// assert that a 100 m radius IS `PARTIAL`: that was measured against the
// Playground's own stored position, and this run scripts its own, so pinning it
// would be claiming a label this assertion cannot check. A FOURTH state leaves
// the axis absent and reds here either way, which is the guard that matters.
{
  const fine = await ask({ type: 'presentIn', operator: 'in', value: AREA_FINE });
  const v = fine.f.presentVerdict;
  const handled = v === 'PARTIAL'
    ? fine.a.answered === false && fine.a.reason === 'location partial: refused, never rounded' && fine.a.result === undefined
    : (v === 'TRUE' || v === 'FALSE') && fine.a.answered === true && fine.a.result === (v === 'TRUE') && closed(fine.a);
  ok('13 LIVE presentIn third state: the verdict is in the closed set and is handled as itself',
    ['TRUE', 'FALSE', 'PARTIAL'].includes(v) && handled,
    `r=${AREA_FINE.radiusM}m → verdict '${v}' → answered=${fine.a.answered} result=${String(fine.a.result)} reason='${fine.a.reason}'`);
}

// ======================== 14-15 numberMatch, LIVE ===========================

// 14 THE MATCH BIT, BOTH WAYS, OFF THE REAL kyc-match ENDPOINT. Measured
// 2026-08-17: `nameMatch` is the STRING `"true"`/`"false"` on the wire, and
// `"false"` is TRUTHY — so an adapter that read it unguarded would report a
// NON-match as a match. The wrong name at the lowest menu rung is the negative
// that catches exactly that.
{
  const exact = await ask({ type: 'numberMatch', operator: 'gte', value: 90, claimed: REGISTERED });
  const wrong = await ask({ type: 'numberMatch', operator: 'gte', value: 60, claimed: WRONG_NAME });
  ok('14 LIVE numberMatch: the registered name matches, a wrong one does not',
    exact.a.answered === true && exact.a.result === true && closed(exact.a)
      && wrong.a.answered === true && wrong.a.result === false && closed(wrong.a),
    `"${REGISTERED}" ≥90 → ${exact.a.result} (exact match carries no score: score present=${'nameMatchScore' in exact.f}); `
    + `"${WRONG_NAME}" ≥60 → ${wrong.a.result}`);
}

// 15 THE GRADIENT IS REAL, AND IT STOPS AT THE OPERATOR. The measured near miss
// — the registered name with ONE letter changed — scores 97, which is the whole
// reason this predicate is a threshold and not a passthrough: a score preserves
// the DISTANCE to the answer, so a free-choice threshold against it is a
// warmer/colder oracle a requester can hill-climb to the registered name itself.
//
// Three legs, live: the same claim answers DIFFERENTLY at two thresholds (so the
// window is genuinely the requester's), the operator's own facts DO carry the
// score (so there is something real to withhold), and the ANSWER carries the bit
// and nothing else at either rung.
{
  const low = await ask({ type: 'numberMatch', operator: 'gte', value: 90, claimed: NEAR_MISS });
  const high = await ask({ type: 'numberMatch', operator: 'gte', value: 98, claimed: NEAR_MISS });
  const scored = Number.isSafeInteger(low.f.nameMatchScore) && low.f.nameMatchScore >= 0 && low.f.nameMatchScore <= 100;
  ok('15 LIVE numberMatch: a gradient the operator holds and the answer does not carry',
    low.a.answered === true && low.a.result === true && closed(low.a)
      && high.a.answered === true && high.a.result === false && closed(high.a)
      && scored && low.f.nameMatch === false,
    `"${NEAR_MISS}" ≥90 → ${low.a.result}, ≥98 → ${high.a.result}; the operator holds a score (present=${scored}) `
    + `and the answers carry keys=${Object.keys(low.a).sort().join(',')}`);
}

// 16 REACHABILITY IS WIRED — and flips with the backstory.
{
  await facts.setBackstory(CUSTOM, story({ reachable: false }), NOW);
  const off = await ask({ type: 'reachable', operator: 'eq', value: true });
  await facts.setBackstory(CUSTOM, story(), NOW);
  const on = await ask({ type: 'reachable', operator: 'eq', value: true });
  ok('16 LIVE reachability WIRED: flips false → true',
    off.f.reachable === false && on.f.reachable === true
      && off.a.answered === true && off.a.result === false
      && on.a.answered === true && on.a.result === true,
    `off=${String(off.f.reachable)}→${off.a.result} on=${String(on.f.reachable)}→${on.a.result}`);
}

// ==================== 17-18 live error classification + redaction ===========

// 17 AN UNKNOWN NUMBER IS CLASSIFIED AS ONE, LIVE — `403 FORBIDDEN` here means
// UNKNOWN NUMBER, and saying so is what stops the next person debugging auth.
{
  const r = await athrew(() => facts.getFacts('+990100000077', NOW));
  threw('17 LIVE unknown number → classified, not read as bad auth', r,
    r.threw && r.msg.includes('unknown number') && r.msg.includes('not bad auth'),
    `msg starts: ${r.threw ? r.msg.slice(0, 48) : r.msg}`);
}

// 18 THE LIVE BODY LEAKS THE CLIENT ID; THE ADAPTER'S MESSAGE DOES NOT. The
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
  ok('18 LIVE redaction: raw body carries the client id, the error does not',
    leaks === true && tokUsable && r.threw && !r.msg.includes(clientId) && !r.msg.includes(CRED) && !r.msg.includes(tok),
    `raw body leaks client id=${leaks}, adapter message leaks=${r.threw && clientId !== '' && r.msg.includes(clientId)}`);
}

// 19 THE RUN GIVES ITS QUOTA BACK. Added by the 2026-08-16 review round. The
// trap case CONSUMES one of the app's 10 custom-number slots and hands it back;
// before this case the hand-back was unobserved, so a cleanup that silently
// failed would have walked the quota toward its cap across runs and the eventual
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
  // `endSlots < QUOTA_CAP` is deliberately NOT part of this assertion: being
  // at cap is a distinct account-health property, and folding it in made an
  // account legitimately holding 10/10 red THIS case's name — blaming the
  // cleanup that had in fact succeeded, the exact wrong-blame shape the
  // baseline fix above closed. At-cap is reported as a warning instead.
  ok('19 QUOTA RESTORED: the trap case gave its slot back',
    startSlots !== null && endSlots !== null && endSlots === startSlots && deleted,
    `start=${startSlots} end=${endSlots} of ${QUOTA_CAP}, cleanup DELETE status=${gaveBack?.status}`);
  console.log(`\nquota: ${endSlots} of ${QUOTA_CAP} custom slots in use at end (started at ${startSlots})`
    + (endSlots !== null && endSlots >= QUOTA_CAP ? '  (WARNING: at cap — the next CREATE on this app will fail)' : ''));
}

// Leave the slot in the demo's known state, so a re-run starts where this one
// did. GUARDED: this is a courtesy write AFTER the last case — unguarded, a
// transient failure here killed an all-green run before `conclude()` could
// print the tally or enforce the case count (post-v0.3.0 review round). The
// failure is still printed loudly; it just no longer eats the verdict.
try {
  await facts.setBackstory(CUSTOM, story(), NOW);
  console.log(`${CUSTOM} left scripted: ${JSON.stringify(story())}`);
} catch (e) {
  console.log(`${CUSTOM} courtesy re-script FAILED (${e instanceof Error ? e.message : String(e)}) — a re-run's case 4 starts from a different scripted state`);
}

conclude(19);

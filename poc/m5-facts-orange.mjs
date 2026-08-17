// PoC module M5 — LIVE facts adapter, Orange Network APIs Playground. Same
// interface as M4's mock (`setBackstory` / `getFacts`), a real operator behind
// it. `evaluatePredicate` is deliberately NOT reimplemented here: M6 imports it
// from M4 and feeds it whichever adapter's facts. That split IS the point —
// swapping the facts source must not touch the step that turns facts into the
// bit, because that step is where the profile invariant lives.
//
// Three rules shape this file, and every one of them is a MEASURED Playground
// behaviour, not a precaution (spike 2026-08-16, raw captures in the findings
// log; the fixtures in `m5-check.mjs` are those responses verbatim):
//
// 1. THE ECHO IS NEVER PROOF. An Admin `UPDATE` against a BUILT-IN number
//    answers `200` echoing YOUR payload back while the stored dataset never
//    changes — measured: wrote `latestSimChange 2001-02-03…`, the echo carried
//    it, the very next `READ` carried the built-in's own `2020-03-15…`, and
//    sim-swap agreed with the READ. So every write is followed by a `READ` and
//    an explicit per-axis comparison, and a mismatch is a LOUD throw. Without
//    that, the demo would assert against a backstory that never took effect and
//    call it green.
//
// 2. `null` MEANS "NOT ROAMING"; AN ABSENT KEY MEANS "UNAVAILABLE". These are
//    different answers and the Playground genuinely produces both: roaming
//    false comes back `{"roaming":false}` (an honest NO), while roaming true
//    with no country comes back `{"roaming":true}` — the subscriber IS roaming
//    and the country is UNKNOWN. Folding the second into `null` would answer
//    "not roaming in FR" about someone who may well be in FR: a fail-open with
//    a confident voice. An unavailable axis is therefore ABSENT from the facts,
//    and `evaluatePredicate` refuses it (`fact unavailable`) rather than
//    comparing against it.
//
// 3. THE CREDENTIAL, EVERY TOKEN, AND THE CLIENT ID NEVER REACH A STRING THIS
//    MODULE CAN PRINT OR THROW. The client id is not a paranoid addition: the
//    Playground ECHOES it inside 403 bodies ("+990… does not exist for
//    <client_id>"), and those bodies are exactly what a diagnostic wants to
//    quote. Everything outbound goes through `redact()`.
//
// The clock is INJECTED (`nowMs`), as in M4 — the relative→absolute conversion
// the mock only simulates is real here, and it happens at THIS boundary: a
// backstory says "swapped 120 days ago", this module turns that into an
// absolute ISO instant for the Admin API, and differences the date Orange hands
// back against the SAME injected `now`. No wall clock is read anywhere in this
// file, token caching included (see `tokenFor`).

const DAY_MS = 86400000;
// `Date`'s widest representable instant (±8.64e15 ms from the epoch). A safe
// integer can sit far beyond it, and `new Date(x).toISOString()` answers such
// an `x` with a bare `RangeError: Invalid time value` — an opaque error
// replacing this module's loud, named-input one. So `now` is bounded HERE.
const MAX_EPOCH_MS = 8640000000000000;
// Byte-identical to M4's bound, and deliberately duplicated for the same
// reason M4 duplicates M3's duration parser: PRD §4.4 requires each module to
// work alone. A real subscriber number must never reach the Playground.
const TEST_NUMBER = /^\+990\d{6,12}$/;
// ISO-3166-1 alpha-2, uppercase and canonical — the same rule M4 applies, and
// load-bearing here for a measured reason: the Playground's BUILT-IN roaming
// records carry country NAMES (`countryName:["Spain"]`), not codes. Coercing
// that to a country would put `"Spain"` where `"ES"` belongs.
const COUNTRY = /^[A-Z]{2}$/;

const TOKEN_URL = Object.freeze({
  // NOT interchangeable, re-verified 2026-08-16: the CAMARA token is rejected
  // by the Admin API with `401 UNAUTHENTICATED`, and the Admin token is
  // rejected by sim-swap with `403 FORBIDDEN "Request must be authorized"`.
  // One token per surface, never a shared one.
  camara: 'https://api.orange.com/openidconnect/playground/v1.0/token',
  admin: 'https://api.orange.com/oauth/v3/token',
});
const API = 'https://api.orange.com/camara/playground/api';
const ADMIN_URL = 'https://api.orange.com/camara/playground/admin/v1.0/action';

// The three CAMARA reads, one per fact axis. All three answered live on
// 2026-08-16 under the Playground app's own token scopes
// (`sim-swap:retrieve-date`, `device-roaming-status:read`,
// `device-reachability-status:read`), so all three axes are WIRED — nothing
// here is stubbed and nothing is faked when a call fails.
//
// Note the two request shapes: sim-swap takes a BARE `phoneNumber`, the two
// device-status APIs take a `device` WRAPPER. Sending the bare form to them
// answers `400 INVALID_ARGUMENT "phoneNumber is not allowed"` — which is how
// the spike told a real-but-differently-shaped endpoint apart from a
// non-existent one (`400 BAD_REQUEST "unhandled path"`).
const READS = Object.freeze({
  simSwap: { url: `${API}/sim-swap/v1/retrieve-date`, body: (n) => ({ phoneNumber: n }) },
  roaming: { url: `${API}/device-roaming-status/v1/retrieve`, body: (n) => ({ device: { phoneNumber: n } }) },
  reachability: { url: `${API}/device-reachability-status/v1/retrieve`, body: (n) => ({ device: { phoneNumber: n } }) },
});

// Reachability is an enum on the wire and a boolean in the facts. Closed on
// purpose: a status this table does not name leaves the axis ABSENT rather than
// guessing a polarity. Measured values, and the Admin API refuses anything else
// (`400 … must be one of [CONNECTED_DATA, CONNECTED_SMS, NOT_CONNECTED]`).
const REACHABLE = Object.freeze({
  CONNECTED_DATA: true,
  CONNECTED_SMS: true,
  NOT_CONNECTED: false,
});

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A diagnostic rendering of an arbitrary value that CANNOT throw, CANNOT run
// away, and — the part that matters — INVOKES NOTHING CALLER-SUPPLIED. This is
// M4's release-gate lesson carried over rather than re-learned: a bare
// `String(value)` or `JSON.stringify(value)` in a throw message runs the
// caller's `toString`/`valueOf`/`toJSON`, and a try/catch bounds a THROW, not
// an ALLOCATION — M4 measured a ~40-byte value whose hook returned
// `'x'.repeat(3e8)` killing the process outright at exit 134 (fatal OOM, no
// catch can degrade it). A dead process cannot fail loud, which is the one
// thing every operator-side fault here is supposed to do. Primitives render
// directly and are clamped BEFORE rendering; anything else renders as its kind.
const BRIEF_MAX = 48;
function brief(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') {
    // The slice happens first, so what gets serialized is bounded whatever
    // arrived. `JSON.stringify` on a STRING runs no user code and cannot throw.
    return JSON.stringify(value.length > BRIEF_MAX ? `${value.slice(0, BRIEF_MAX)}…` : value);
  }
  // Each of these is the primitive's own spec-defined conversion — there is no
  // caller code to run, and no allocation to run away.
  if (t === 'number' || t === 'boolean' || t === 'undefined' || t === 'bigint' || t === 'symbol') return String(value);
  if (t === 'function') return '[function]';
  // Deliberately NOT `Array.isArray(value)` and never a property read: both
  // throw on a revoked Proxy, and this function's contract is that it cannot.
  return '[object]';
}

// The stored `countryName` arrives off the WIRE, and joining it is a coercion:
// `Array.prototype.join` calls `String()` on every element, so a JSON-parsed
// `{"toString":"x"}` element makes the join throw a bare `TypeError: Cannot
// convert object to primitive value` — which REPLACES the loud write-verify
// message below with an opaque 40-char one at exactly the moment it is needed
// (measured 2026-08-16, release gate round 2: 40 chars and no "write
// verification FAILED", against 418 chars for the same mismatch reached with a
// benign element). This is the sibling of the `show()` guard further down and
// is fixed the same way — nothing caller-supplied is invoked:
//   * a STRING is `redact()`ed FIRST and clamped SECOND, NOT `brief()`-rendered:
//     `brief()` would add JSON quotes and `"FR"` must still compare equal to
//     `FR`. The order is the same rule `show()` documents below — the
//     known-secret layer is an EXACT match, so clamping before redacting would
//     leave a 48-char FRAGMENT of a longer echoed credential unmatched and
//     therefore printed (found by the post-v0.3.0 review round: the fragment
//     leak this comment warns about lived one step upstream, in this very
//     function). `redact()` leaves a legitimate alpha-2 code untouched
//     (secrets are ≥8 chars) and returns a ≤REDACT_MAX string, which the
//     clamp then bounds — a hostile 2e7-char value stays bounded (measured
//     691ms unclamped);
//   * anything else renders as its KIND via `brief()`, which runs no user code
//     and can never equal a canonical country, so the comparison still fails
//     LOUD rather than silently.
// `length` is read ONCE into `n` — re-reading it per iteration is the
// time-of-check/time-of-use window M4 measured walking 5,000,000 indices.
const MAX_STORED_COUNTRIES = 16;
function joinStored(v, redact) {
  if (!Array.isArray(v)) return undefined;
  const n = Math.min(v.length, MAX_STORED_COUNTRIES);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const el = v[i];
    if (typeof el === 'string') {
      const r = redact(el);
      parts.push(r.length > BRIEF_MAX ? `${r.slice(0, BRIEF_MAX)}…` : r);
    } else {
      parts.push(brief(el));
    }
  }
  return parts.join(',');
}

// Plain own-data or nothing — the same bound M4 applies to a backstory, and
// duplicated for the same reason (§4.4: each module works alone). Without it a
// field carried on the PROTOTYPE is read by the destructuring below and USED,
// while `Object.keys` never sees it — so the unknown-field check that is
// supposed to catch a typo'd axis silently passes over it. M4 measured the
// mirror-image of this (a prototype-borne axis being DROPPED and defaults used);
// either direction is a scripted story that is not the story in force.
function isPlainData(o) {
  try {
    if (typeof o !== 'object' || o === null || Array.isArray(o)) return false;
    const proto = Object.getPrototypeOf(o);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.getOwnPropertyNames(o).length === Object.keys(o).length;
  } catch {
    return false;   // revoked proxy: enumeration itself throws
  }
}

// ============================== redaction ==================================

// Anything this module can print or throw goes through here first. Three
// layers, because each one covers a hole the others cannot:
//
//  * the KNOWN secrets (the credential as supplied AND normalized, its decoded
//    `clientId:secret`, each half, and every bearer token ever issued) are
//    replaced by exact match, longest first so a longer secret is never left
//    half-redacted by a shorter one that is its substring;
//  * a PATTERN pass strips the identifier Orange appends to "does not exist
//    for …", which covers the case where the credential is not base64 at all
//    and no client id could be derived to add to the known set; and
//  * a CLAMP, because a diagnostic built from a response body can end up in a
//    log verbatim, and an unbounded one is the same footgun M4 measured.
const REDACT_MAX = 200;
function makeRedactor(supplied, normalized) {
  const secrets = new Set();
  const add = (s) => {
    // Below 8 chars a "secret" is more likely to be a common substring, and
    // redacting one would corrupt every diagnostic it appears in.
    if (typeof s === 'string' && s.length >= 8) secrets.add(s);
  };
  add(supplied);
  add(normalized);
  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i > 0) { add(decoded); add(decoded.slice(0, i)); add(decoded.slice(i + 1)); }
  } catch { /* not base64: the supplied string itself is still guarded */ }

  function redact(text) {
    let out = typeof text === 'string' ? text : String(text ?? '');
    // Longest first: `clientId:secret` must be replaced before `clientId`,
    // otherwise the tail of the pair survives as a lone fragment.
    for (const s of [...secrets].sort((a, b) => b.length - a.length)) {
      out = out.split(s).join('[REDACTED]');
    }
    // The client-id echo, defended a second way. The gap stays BOUNDED rather
    // than `.*` — an unbounded gap over a semi-trusted response body is the
    // quadratic-blowup footgun — but 80 was tighter than the thing it redacts:
    // an identifier longer than the bound would have the first 80 characters
    // masked and the REMAINDER printed, which is a worse outcome than not
    // matching at all. 256 is comfortably past any client id this API issues
    // (the observed one is 32) while still a fixed, non-catastrophic bound.
    out = out.replace(/does not exist for \S{0,256}/g, 'does not exist for [REDACTED]');
    return out.length > REDACT_MAX ? `${out.slice(0, REDACT_MAX)}…` : out;
  }
  return { add, redact };
}

// ============================== the adapter ================================

/**
 * One instance = one operator's live Playground app.
 *
 * @param {object} opts
 * @param {string} opts.basicAuth  The Playground Basic Auth string, from the
 *   ENVIRONMENT only (`ORANGE_BASIC_AUTH`) — never the tree. A leading
 *   `Basic ` is tolerated and stripped: measured 2026-08-16, the credential as
 *   it is stored and as `poc/README.md`'s runbook line yields it is ALREADY
 *   scheme-prefixed, and sending `Basic Basic …` fails both token endpoints
 *   with `400 invalid_request` / `401 "Basic authentication is malformed"`.
 * @param {Function} [opts.fetchImpl]  Injected transport. Defaults to global
 *   `fetch`; the offline check passes a replay of CAPTURED responses so it runs
 *   on a clean clone with zero credentials. This is dependency injection, not
 *   a test-only branch in production code — there is one code path.
 */
export function createOrangeFacts({ basicAuth, fetchImpl } = {}) {
  const supplied = typeof basicAuth === 'string' ? basicAuth.trim() : '';
  const cred = supplied.replace(/^Basic\s+/i, '');
  // No silent fallback to a mock, ever. A missing credential is a prerequisite
  // failure the caller must see, not a reason to quietly answer from a stub —
  // an adapter that "worked" without credentials would make the live gate
  // meaningless.
  if (cred === '') {
    throw new Error('missing credential: set ORANGE_BASIC_AUTH to the Playground Basic Auth string (environment only — never the tree, never a mock fallback)');
  }
  const { add: guard, redact } = makeRedactor(supplied, cred);
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new Error('no fetch available: pass opts.fetchImpl or run on Node >= 20');
  }

  // One token per surface. There is deliberately NO time-based expiry: reading
  // a wall clock here would be the one place this module looked at a clock it
  // does not own, and the 401 path below is required regardless (a token can be
  // revoked long before it expires). Refresh is therefore driven by the only
  // authority on whether a token is still good — the server's own `401`.
  const tokens = new Map();

  async function tokenFor(surface) {
    if (tokens.has(surface)) return tokens.get(surface);
    let res;
    try {
      res = await doFetch(TOKEN_URL[surface], {
        method: 'POST',
        headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      });
    } catch (e) {
      // A transport failure is loud too — never a degraded answer.
      throw new Error(`token request failed (${surface}): ${redact(e instanceof Error ? e.message : String(e))}`);
    }
    let text;
    try {
      // Reading the body is INSIDE a try for the same reason `post()`'s send
      // reads it inside one: a stream that dies mid-response rejects HERE, not
      // at `doFetch`, and its message can carry wire text. Outside a try that
      // message escaped unredacted (the /security fix landed in `post()` only;
      // this sibling was closed by the post-v0.3.0 review round).
      text = await res.text();
    } catch (e) {
      throw new Error(`token response read failed (${surface}): ${redact(e instanceof Error ? e.message : String(e))}`);
    }
    if (res.status !== 200) {
      throw new Error(`token rejected (${surface}, status ${res.status}): ${redact(text)} — check ORANGE_BASIC_AUTH`);
    }
    let token;
    try { token = JSON.parse(text).access_token; } catch { token = undefined; }
    if (typeof token !== 'string' || token === '') {
      throw new Error(`token response has no access_token (${surface}): ${redact(text)}`);
    }
    // Guarded BEFORE it is ever used, so a body echoing it back cannot leak it.
    guard(token);
    tokens.set(surface, token);
    return token;
  }

  // One request, with the single 401 refresh-and-retry. Exactly one retry: a
  // second 401 with a token minted seconds earlier is a credential problem, and
  // spinning on it would turn an auth fault into a quota burn.
  async function post(surface, url, body) {
    const send = async (token) => {
      let res;
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        // Reading the body is INSIDE the try on purpose: a stream that dies
        // mid-response rejects here, not at `doFetch`, and its message can
        // carry wire text. Outside the try that message escaped unredacted.
        return { status: res.status, text: await res.text() };
      } catch (e) {
        throw new Error(`request failed (${url}): ${redact(e instanceof Error ? e.message : String(e))}`);
      }
    };
    let out = await send(await tokenFor(surface));
    if (out.status === 401) {
      tokens.delete(surface);
      out = await send(await tokenFor(surface));
    }
    return out;
  }

  // Status → outcome. The 403 SPLIT is the part that matters and it CHANGED at
  // the 2026-08-16 re-verification: `403 FORBIDDEN` does NOT uniquely mean
  // "unknown number". An unknown number answers
  // `"+990… does not exist for <client_id>"`, but a request carrying the WRONG
  // SURFACE's token answers `403 "Request must be authorized"`. Reading the
  // second as an unknown number would send you hunting a backstory bug when the
  // real fault is the token — the exact wrong-thing-debugged failure the
  // original finding exists to prevent, one layer in.
  function classify(out, number, what) {
    if (out.status === 403) {
      if (out.text.includes('does not exist for')) {
        throw new Error(`unknown number: ${number} (${what}: the Playground has no such subscriber — 403 FORBIDDEN here means UNKNOWN NUMBER, not bad auth; create the custom slot first)`);
      }
      throw new Error(`not authorized (${what}, status 403): ${redact(out.text)} — a 403 WITHOUT "does not exist" is an authorization fault, not an unknown number (most often the wrong surface's token)`);
    }
    if (out.status < 200 || out.status >= 300) {
      throw new Error(`${what} failed (status ${out.status}): ${redact(out.text)}`);
    }
  }

  function parseJson(out, what) {
    // `DELETE` answers `204` with an EMPTY `text/html` body — measured, and the
    // reason this is not a blind `res.json()`.
    if (out.text === '') return null;
    try {
      return JSON.parse(out.text);
    } catch {
      throw new Error(`${what} returned a non-JSON body (status ${out.status}): ${redact(out.text)}`);
    }
  }

  const admin = async (action, number, data) => {
    const body = { action, phoneNumber: number };
    if (data !== undefined) body.data = data;
    const out = await post('admin', ADMIN_URL, body);
    return out;
  };

  function assertTestNumber(number) {
    if (typeof number !== 'string' || !TEST_NUMBER.test(number)) {
      throw new Error(`invalid number: ${brief(number)} (+990 test range only — a real subscriber number must never reach the PoC)`);
    }
  }
  function assertNow(nowMs) {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error(`invalid now: ${brief(nowMs)} (unix epoch ms as a safe integer — the clock is injected, never read)`);
    }
    if (nowMs > MAX_EPOCH_MS) {
      throw new Error(`invalid now: ${brief(nowMs)} (beyond Date's representable range of ${MAX_EPOCH_MS} epoch ms — past it, formatting the instant throws a bare RangeError instead of this message)`);
    }
  }

  // -------------------------- operator-side WRITE --------------------------

  /**
   * Script a subscriber. Trusted operator input, so every fault is a THROW.
   * The backstory is RELATIVE (`swappedDaysAgo`), exactly as in M4 — the
   * relative→absolute conversion happens HERE, against the injected `nowMs`,
   * and `getFacts` differences Orange's answer back against the same clock.
   */
  async function setBackstory(number, backstory, nowMs) {
    assertTestNumber(number);
    assertNow(nowMs);
    if (!isPlainData(backstory)) {
      throw new Error(`invalid backstory for ${number}: not a plain object (own enumerable data only — a field on the prototype, or behind a getter, would be USED while escaping the unknown-field check below)`);
    }
    const { swappedDaysAgo, roamingCountry, reachable } = backstory;
    // Same closed, required, un-defaulted field set as M4 — and the same
    // reason: a typo must be BOTH an unknown field and a missing one.
    for (const k of Object.keys(backstory)) {
      if (!['swappedDaysAgo', 'roamingCountry', 'reachable'].includes(k)) {
        throw new Error(`invalid backstory for ${number}: unknown field ${brief(k)}`);
      }
    }
    if (!Number.isSafeInteger(swappedDaysAgo) || swappedDaysAgo < 0) {
      throw new Error(`invalid backstory for ${number}: swappedDaysAgo must be whole non-negative days (strings, null and booleans are NOT coerced)`);
    }
    if (!(roamingCountry === null || (typeof roamingCountry === 'string' && COUNTRY.test(roamingCountry)))) {
      throw new Error(`invalid backstory for ${number}: roamingCountry must be ISO-3166-1 alpha-2 uppercase, or null for not roaming`);
    }
    if (typeof reachable !== 'boolean') {
      throw new Error(`invalid backstory for ${number}: reachable must be boolean true or false, never a string`);
    }
    const swappedAtMs = nowMs - swappedDaysAgo * DAY_MS;
    if (swappedAtMs < 0) {
      throw new Error(`invalid backstory for ${number}: swappedDaysAgo ${swappedDaysAgo} predates the epoch relative to the injected now`);
    }
    const latestSimChange = new Date(swappedAtMs).toISOString();

    // `countryCode` is deliberately NOT written. Measured 2026-08-16: the
    // Playground's own records are internally inconsistent about it (the
    // built-in Spain record carries `34`, the DIALLING code, while an
    // admin-scripted France record takes `208`, the MCC), so nothing honest can
    // be read from it and writing one would imply a mapping this PoC does not
    // have. `countryName` alone is accepted and round-trips — verified live.
    const data = {
      simSwap: { latestSimChange },
      roaming: roamingCountry === null ? { roaming: false } : { roaming: true, countryName: [roamingCountry] },
      reachability: { reachabilityStatus: reachable ? 'CONNECTED_DATA' : 'NOT_CONNECTED' },
    };

    let out = await admin('UPDATE', number, data);
    // A number the app has never claimed answers `400 "PhoneNumber Not Found"`
    // to UPDATE — including a BUILT-IN one. Claim the slot, then write.
    if (out.status === 400 && out.text.includes('PhoneNumber Not Found')) {
      const created = await admin('CREATE', number);
      classify(created, number, 'admin CREATE');
      out = await admin('UPDATE', number, data);
    }
    classify(out, number, 'admin UPDATE');

    // ------ READ-after-write. The load-bearing line of the whole module. -----
    // The `out` above is a 200 whose body echoes exactly what was sent, on a
    // built-in number that stored NONE of it. So the echo is discarded unread
    // and the STORED state is fetched fresh and compared per axis.
    const readOut = await admin('READ', number);
    classify(readOut, number, 'admin READ (write verification)');
    const stored = parseJson(readOut, 'admin READ')?.data;
    if (typeof stored !== 'object' || stored === null) {
      throw new Error(`write verification failed for ${number}: READ returned no data object`);
    }
    const got = {
      latestSimChange: stored.simSwap?.latestSimChange,
      roaming: stored.roaming?.roaming,
      country: joinStored(stored.roaming?.countryName, redact),
      reachabilityStatus: stored.reachability?.reachabilityStatus,
    };
    const want = {
      latestSimChange,
      roaming: roamingCountry !== null,
      country: roamingCountry === null ? undefined : roamingCountry,
      reachabilityStatus: data.reachability.reachabilityStatus,
    };
    // This diagnostic quotes values that came off the WIRE, so it is the one
    // place a stored value could carry an echoed secret into a throw — and the
    // one place an unbounded stored value could be serialized. Both are closed
    // by composing the two helpers this file already has, in this order:
    //
    //   * a STRING goes through `redact()` FIRST, because the known-secret layer
    //     is an EXACT match — clamping before redacting would leave a 48-char
    //     FRAGMENT of a 110-char credential unmatched and therefore printed —
    //     and `redact()` returns a ≤200-char result, which `brief()` can then
    //     serialize safely;
    //   * a NON-string goes to `brief()` DIRECTLY: no secret can hide in one,
    //     and `redact()`'s `String(value)` coercion would run a wire-supplied
    //     `toString` — `JSON.parse('{"toString":"x"}')` makes `String(v)` throw
    //     a bare TypeError, which would replace this loud, actionable message
    //     with an opaque one at exactly the moment it is needed.
    //
    // Measured 2026-08-16: the previous `JSON.stringify(String(v)).slice(0,60)`
    // clamped AFTER serializing — 2354ms on a 2e8-char stored value, and a
    // RangeError ("Invalid string length") at V8's max string length, which
    // destroyed this message entirely. `brief()` bounds BEFORE it renders, which
    // is the same lesson case 43 of the offline suite already states.
    const show = (v) => (typeof v === 'string' ? brief(redact(v)) : brief(v));
    for (const axis of ['latestSimChange', 'roaming', 'reachabilityStatus', 'country']) {
      // `country` is only compared when one was written: a stale country left
      // alongside `roaming:false` is producible (measured) and is not a write
      // failure — `roaming:false` is the authoritative half either way.
      if (axis === 'country' && want.country === undefined) continue;
      if (got[axis] !== want[axis]) {
        throw new Error(
          `write verification FAILED for ${number}: stored ${axis} is ${show(got[axis])}, wrote ${show(want[axis])}` +
          ' — the Admin API echoed the write back with a 200 and did NOT store it.' +
          ' Built-in numbers (+990100000000-05) shadow every write: CREATE succeeds, UPDATE returns 200 echoing your payload, and READ/CAMARA keep serving the built-in dataset.' +
          ' Script a CUSTOM slot (e.g. +990100000099) instead.'
        );
      }
    }
  }

  // --------------------------- operator-side READ --------------------------

  /**
   * Raw facts for one subscriber, against the INJECTED clock. Never a wire
   * shape and never an answer — `evaluatePredicate` (M4's, unchanged) turns
   * these into the bit.
   *
   * An axis the Playground cannot honestly supply is ABSENT from the returned
   * object. `roamingCountry: null` is a PRESENT key meaning "not roaming".
   */
  async function getFacts(number, nowMs) {
    assertTestNumber(number);
    assertNow(nowMs);
    const facts = {};

    const swapOut = await post('camara', READS.simSwap.url, READS.simSwap.body(number));
    classify(swapOut, number, 'sim-swap retrieve-date');
    const swap = parseJson(swapOut, 'sim-swap retrieve-date');
    const swappedAtMs = Date.parse(swap?.latestSimChange);
    // An unparseable date, or one in the FUTURE relative to the injected clock,
    // leaves the axis absent rather than producing a negative age. `undefined >=
    // threshold` is `false`, so a fabricated age here would read as "the SIM is
    // not old enough" about a SIM nobody could date — an answer, from garbage.
    if (Number.isSafeInteger(swappedAtMs) && swappedAtMs <= nowMs) {
      facts.swapAgeMs = nowMs - swappedAtMs;
    }

    const roamOut = await post('camara', READS.roaming.url, READS.roaming.body(number));
    classify(roamOut, number, 'device-roaming-status');
    const roam = parseJson(roamOut, 'device-roaming-status');
    if (roam?.roaming === false) {
      // The honest NO. A present key with a null value: "not roaming".
      facts.roamingCountry = null;
    } else if (roam?.roaming === true) {
      const names = roam.countryName;
      // Exactly one canonical alpha-2 code, or the axis stays ABSENT. All three
      // rejected shapes are real: `{"roaming":true}` with no country at all
      // (measured), a country NAME rather than a code (`["Spain"]`, the
      // built-in records' own spelling), and a MULTI-country list
      // (`["FR","MC"]`, producible) where no single country is the answer.
      // Every one of them is "roaming, country unknown" — the opposite of the
      // `null` above, and the whole reason the two are spelled differently.
      if (Array.isArray(names) && names.length === 1 && typeof names[0] === 'string' && COUNTRY.test(names[0])) {
        facts.roamingCountry = names[0];
      }
    }

    const reachOut = await post('camara', READS.reachability.url, READS.reachability.body(number));
    classify(reachOut, number, 'device-reachability-status');
    const reach = parseJson(reachOut, 'device-reachability-status');
    const status = reach?.reachabilityStatus;
    if (typeof status === 'string' && hasOwn(REACHABLE, status)) {
      facts.reachable = REACHABLE[status];
    }

    // Frozen for M4's reason: an M6 caller mutating facts in place would
    // rewrite the input to the bit after the fact.
    return Object.freeze(facts);
  }

  return { setBackstory, getFacts };
}

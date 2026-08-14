# PoC — Mode A on Orange Network APIs Playground

**Blocked on:** Orange Playground credentials (free, instant — see below).

## What it proves (four assertions)

1. **Windowing** — never a raw value on the wire: `swapAge ≥ 90d → true`
   even though the Playground knows the exact date.
2. **Nonce + validity** — replaying a captured response fails; responses
   expire with the query.
3. **Blind hub** — the hub's own log on screen: metering records only,
   no numbers, no predicates, no answers.
4. **Monotone floor** — tighten `tenure` live; looser queries rejected,
   never silently widened.

## Architecture

```
[RP demo "bank"] ──(predicate + floor + nonce, encrypted)──▶ [blind hub sim] ──▶ [operator shim]
                                                              meters & "bills"     wraps Playground
                                                              ciphertext only      sim-swap / roaming
[RP demo] ◀──(signed {result, nonce, exp}, encrypted)───────────────────────────────┘
```

Playground admin backstory flips ("swapped yesterday" ↔ "swapped 120d ago")
flip the boolean live. Operator shim simulates operator-side predicate
computation and signing; consent/legal-basis legs are out of scope.

## Getting Playground credentials (grounded)

1. Create account at developer.orange.com (email, name, country, job) → verify email
2. My Apps → create app (name, description)
3. In the app: Add an API → search "Network APIs Playground" → Next
4. Credentials tab → Show → copy the Basic Auth string
   (free, instant, no approval process)

Built-in test numbers: +990 country code (e.g. +99012345678), 15 available
instantly; up to 10 custom numbers with scriptable backstories via the
Playground Admin API. Orange lab tier (real lab implementation) afterwards:
e.g. device-roaming-status v0.6, lab numbers +40789103050–59.

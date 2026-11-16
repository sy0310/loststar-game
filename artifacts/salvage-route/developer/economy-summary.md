# Scripted economy, developer-only spoilers

All service, sale, tool and debt actions are actually dispatched. Unsold value is never treated as cash. 32 deterministic seeds per policy; no human or optimum claim.

| Policy | Mean depth | Mean debt-payoff voyages | Gross cash / voyage | Fuel burned / voyage | Actual port fuel + repair / voyage | Operating cash / voyage | Rescues | Blocked departures observed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| cautious | 3.00 | 34.25 | 426.99 | 37.61 | 60.15 | 357.46 | 0 | 0 |
| cargo | 4.00 | 27.28 | 603.83 | 55.62 | 132.31 | 453.03 | 0 | 0 |
| deep | 4.97 | 20.91 | 815.49 | 75.96 | 196.63 | 596.83 | 0 | 0 |
| equipped | 4.84 | 21.19 | 803.95 | 72.14 | 159.08 | 631.85 | 0 | 0 |

All 128 scripted runs paid the debt without failure. This does not exhaust all dangerous decisions; explicit poor-resource and rescue tests are separate. Repetition over 20-35 voyages remains an unaccepted content/pacing risk. No BALANCE_V01 numeric changes.

Full seeded checkpoints and exact cash bridge: policy-economy.json.

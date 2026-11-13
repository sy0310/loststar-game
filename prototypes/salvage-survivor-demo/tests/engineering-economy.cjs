/* Cash-ledger forecast using actual completed combat samples. Intermediate
 * engineering uses the novice-income bound until every permanent branch is full.
 * This is a spend policy model, not a natural player retention forecast. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../..");
const input = path.resolve(
  process.env.SURVIVOR_ECONOMY_INPUT || "releases/survivor-adaptive.json",
);
const output = path.resolve(
  process.env.SURVIVOR_ECONOMY_OUT ||
    "releases/survivor-engineering-economy.json",
);
const raw = fs.readFileSync(input),
  samples = JSON.parse(raw),
  B = JSON.parse(
    fs.readFileSync(
      path.join(root, "design/star-salvage/v068/BALANCE_V068.json"),
    ),
  );
const report = {
  version: B.version,
  scope:
    "Actual adaptive combat cash samples and exact configured purchase costs. Novice-income bound is used during intermediate growth, all-max samples only after all branches are full. Receipts settle on return. Unsettled loot is the latest observed sample. Optional starting weapon is reserved before a new voyage. No human or TapTap-income claim.",
  inputSha256: crypto.createHash("sha256").update(raw).digest("hex"),
  scenarios: [],
};
for (const old of [false, true]) {
  const account = {
      credits: old ? 27049 : 0,
      hull: old ? 3 : 0,
      gun: old ? 3 : 0,
      engineering: { thrusters: 0, salvage: 0, plating: 0 },
    },
    checkpoints = [0, 300, 900, 1800, 3600, 7200],
    table = [],
    ledger = [];
  const initial = account.credits;
  let time = 0,
    trip = 0,
    row = null,
    leg = 0,
    unsettled = 0;
  function debit(cost, kind) {
    assert(account.credits >= cost);
    account.credits -= cost;
    ledger.push({ at: time, kind, cost });
  }
  function prepare() {
    for (;;) {
      const offers = [];
      for (const id of ["hull", "gun"])
        if (account[id] < 3)
          offers.push({
            kind: id,
            cost: B.permanentCosts[id][account[id]],
          });
      for (const id of ["thrusters", "salvage", "plating"])
        if (account.engineering[id] < 6)
          offers.push({
            kind: id,
            cost: B.engineering.costs[account.engineering[id]],
          });
      offers.sort((a, b) => a.cost - b.cost);
      const next = offers[0];
      if (!next || next.cost > account.credits) break;
      debit(next.cost, next.kind);
      if (next.kind === "hull" || next.kind === "gun") account[next.kind]++;
      else account.engineering[next.kind]++;
    }
    if (account.credits >= B.engineering.launchCost)
      debit(B.engineering.launchCost, "starting-weapon");
    const full =
      account.hull === 3 &&
      account.gun === 3 &&
      Object.values(account.engineering).every((n) => n === 6);
    const pool = samples.rows.filter(
      (x) =>
        x.perks === (full ? 3 : 0) &&
        ["beam", "swarm", "guard"].includes(x.policy),
    );
    assert(pool.length);
    row = pool[trip % pool.length];
    trip++;
    leg = 0;
  }
  table.push({
    minutes: 0,
    wallet: account.credits,
    settledIncome: 0,
    spent: 0,
    unsettled: 0,
    profile: structuredClone(account),
  });
  prepare();
  for (const checkpoint of checkpoints.slice(1)) {
    while (time < checkpoint - 1e-7) {
      const step = Math.min(checkpoint - time, row.time - leg);
      time += step;
      leg += step;
      if (leg >= row.time - 1e-7) {
        account.credits += row.credits;
        ledger.push({ at: time, kind: "return-income", income: row.credits });
        prepare();
      }
    }
    unsettled = row.samples.filter((x) => x.time <= leg).at(-1)?.credits || 0;
    const income = ledger.reduce((sum, x) => sum + (x.income || 0), 0),
      spent = ledger.reduce((sum, x) => sum + (x.cost || 0), 0);
    assert.equal(account.credits, initial + income - spent);
    assert(Number.isSafeInteger(account.credits) && account.credits >= 0);
    table.push({
      minutes: checkpoint / 60,
      wallet: account.credits,
      settledIncome: income,
      spent,
      unsettled,
      profile: structuredClone(account),
    });
  }
  report.scenarios.push({
    name: old ? "27049 old wallet with existing3plus3 rights" : "new wallet0",
    initial,
    table,
    ledger,
  });
}
report.perBranchTotal = B.engineering.costs.reduce((a, b) => a + b, 0);
report.engineeringTotal = report.perBranchTotal * 3;
assert.equal(report.engineeringTotal, 36450);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  report.scenarios.map((s) => ({
    name: s.name,
    table: s.table.map(({ profile, ...row }) => row),
  })),
);

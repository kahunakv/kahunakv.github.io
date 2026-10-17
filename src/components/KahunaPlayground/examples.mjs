// Sample data and example scripts of the playground. Plain ES module, so the Node smoke test
// (scripts/smoke-playground.mjs) runs every example against the real engine.

export const seedScript = `
set \`services/email/instance-1\` '{"ip": "10.1.1.21", "port": 9090}'
set \`services/email/instance-2\` '{"ip": "10.1.1.22", "port": 9090}'
set \`services/auth/instance-1\` '{"ip": "10.1.2.10", "port": 8080}'
set \`wallets/alice\` 500
set \`wallets/bob\` 120
set \`inventory/item-42\` 10
set \`config/feature-flags/dark-mode\` true
`;

export const examples = [
  {
    label: 'Hello',
    script: `return 'Hello from Kahuna'`,
  },
  {
    label: 'Set and get',
    script: `set \`greeting\` "hello, world"
get \`greeting\``,
  },
  {
    label: 'Revisions',
    description: 'Every write to a key increments its revision.',
    script: `set \`counters/visits\` 1
set \`counters/visits\` 2
set \`counters/visits\` 3
get \`counters/visits\``,
  },
  {
    label: 'Bucket',
    description: 'Read every key in the services/email bucket.',
    script: `get by bucket \`services/email\``,
  },
  {
    label: 'Scan prefix',
    script: `scan by prefix \`services\``,
  },
  {
    label: 'Transfer',
    description: 'Every script is one transaction: both writes commit together, or neither does.',
    script: `let alice_value = get \`wallets/alice\`
let bob_value = get \`wallets/bob\`
let alice = to_int(alice_value)
let bob = to_int(bob_value)

if alice < 100 then
  throw "insufficient funds"
end

set \`wallets/alice\` alice - 100
set \`wallets/bob\` bob + 100
get by bucket \`wallets\``,
  },
  {
    label: 'Begin and commit',
    description: 'A begin block sets the transaction options. Nothing is visible before commit.',
    script: `begin (locking="pessimistic", timeout=5000)
  let stock_value = get \`inventory/item-42\`
  let stock = to_int(stock_value)

  if stock <= 0 then
    rollback
  end

  set \`inventory/item-42\` stock - 1
  commit
end`,
  },
  {
    label: 'Leader election',
    description: 'Only the first run wins. Run it twice: the second run throws and rolls back.',
    script: `let leader = get \`election/leader\`
if not is_null(leader) then
  throw "election failed: a leader already exists"
end
set \`election/leader\` "node-A"
return "node-A is the leader"`,
  },
  {
    label: 'Rate limit',
    description: 'An ephemeral counter allows three calls per minute. Run it four times.',
    script: `let hits_value = eget \`rate/api-key-1\`
let hits = 0
if not is_null(hits_value) then
  let hits = to_int(hits_value)
end
if hits >= 3 then
  throw "rate limit exceeded"
end
eset \`rate/api-key-1\` hits + 1 ex 60000
return hits + 1`,
  },
  {
    label: 'Reserve stock',
    description: 'Placeholders such as @inventory_key get their values from the parameters.',
    script: `let stock_value = get @inventory_key
let stock = to_int(stock_value)
let requested = to_int(@requested_amount)

if stock < requested then
  throw "not enough stock"
end

set @inventory_key stock - requested
return stock - requested`,
    parameters: '@inventory_key = inventory/item-42\n@requested_amount = 3',
  },
  {
    label: 'Expiring key',
    description: 'The session key expires 30 seconds after this write.',
    script: `set \`sessions/alice\` "token-7f3a" ex 30000
get \`sessions/alice\``,
  },
  {
    label: 'Loops',
    script: `let total = 0
for i in 1..10 do
  let total = total + i
end
return total`,
  },
  {
    label: 'Switch',
    script: `let status = "shipped"
switch status
  case "pending" then
    return "wait"
  case "paid", "shipped" then
    return "accepted"
  else
    return "unknown status"
end`,
  },
];

// Parses the parameter box: one "@name = value" pair on each line. Blank lines and lines that
// start with # are ignored. The leading @ is optional.
export function parseParameters(text) {
  const parameters = {};
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`Parameter line "${line}" has no "=".`);
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    parameters[name.startsWith('@') ? name : `@${name}`] = value;
  }
  return parameters;
}

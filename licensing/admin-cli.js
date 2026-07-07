/**
 * License Server Admin CLI
 * 
 * Usage:
 *   node licensing/admin-cli.js generate --name "John Doe" --email "john@example.com" --days 365
 *   node licensing/admin-cli.js list
 *   node licensing/admin-cli.js renew --key BUZZ-XXXX-XXXX-XXXX --days 365
 *   node licensing/admin-cli.js suspend --key BUZZ-XXXX-XXXX-XXXX
 *   node licensing/admin-cli.js validate --key BUZZ-XXXX-XXXX-XXXX --machine "abc123"
 *
 * Environment variables:
 *   LICENSE_SERVER_URL  - License server URL (default: http://localhost:4000)
 *   ADMIN_SECRET        - Admin secret for protected endpoints
 */

const API_URL = process.env.LICENSE_SERVER_URL || "http://localhost:4000";

async function api(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = { "Content-Type": "application/json" };

  if (options.admin) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      console.error("Error: ADMIN_SECRET environment variable is required for admin actions.");
      console.error("Set it with: set ADMIN_SECRET=your-secret");
      process.exit(1);
    }
    headers["x-admin-secret"] = secret;
  }

  try {
    const response = await fetch(url, {
      method: options.method || "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Error (${response.status}):`, data.error || data.reason || "Unknown error");
      process.exit(1);
    }

    return data;
  } catch (err) {
    console.error(`Failed to connect to license server at ${API_URL}:`, err.message);
    console.error("Make sure the license server is running.");
    process.exit(1);
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

function printLicense(lic) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Key:         ${lic.key}`);
  console.log(`  Customer:    ${lic.customerName}`);
  console.log(`  Email:       ${lic.customerEmail}`);
  if (lic.customerPhone) console.log(`  Phone:       ${lic.customerPhone}`);
  if (lic.machineId) console.log(`  Machine ID:  ${lic.machineId}`);
  console.log(`  Plan:        ${lic.plan}`);
  console.log(`  Status:      ${lic.status}`);
  console.log(`  Created:     ${formatDate(lic.createdAt)}`);
  console.log(`  Expires:     ${formatDate(lic.expiresAt)}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ── Commands ──

async function cmdGenerate(args) {
  const name = args.name || args.n;
  const email = args.email || args.e;
  const phone = args.phone || args.p;
  const days = parseInt(args.days || args.d, 10) || 365;
  const plan = args.plan || 'standard';

  if (!name || !email) {
    console.error("Usage: node licensing/admin-cli.js generate --name <name> --email <email> [--days 365] [--phone <phone>] [--plan standard|premium]");
    process.exit(1);
  }

  if (!['standard', 'premium'].includes(plan)) {
    console.error("Error: plan must be 'standard' or 'premium'");
    process.exit(1);
  }

  console.log(`Generating ${plan} license for ${name} (${email}) — valid for ${days} days...`);

  const result = await api("/generate", {
    admin: true,
    body: { customerName: name, customerEmail: email, customerPhone: phone, plan, validityDays: days },
  });

  printLicense(result.license);
  console.log("✅ License generated successfully!\n");
}

async function cmdList() {
  console.log("Fetching all licenses...\n");

  const result = await api("/licenses", { admin: true, method: "GET" });

  if (result.licenses.length === 0) {
    console.log("No licenses found.");
    return;
  }

  // Summary table
  const active = result.licenses.filter((l) => l.status === "active").length;
  const expired = result.licenses.filter((l) => l.status === "expired").length;
  const suspended = result.licenses.filter((l) => l.status === "suspended").length;

  console.log(`Total: ${result.licenses.length} licenses (${active} active, ${expired} expired, ${suspended} suspended)\n`);

  for (const lic of result.licenses) {
    printLicense(lic);
  }
}

async function cmdRenew(args) {
  const key = args.key || args.k;
  const days = parseInt(args.days || args.d, 10) || 365;
  const plan = args.plan;

  if (!key) {
    console.error("Usage: node licensing/admin-cli.js renew --key BUZZ-XXXX-XXXX-XXXX [--days 365] [--plan standard|premium]");
    process.exit(1);
  }

  if (plan && !['standard', 'premium'].includes(plan)) {
    console.error("Error: plan must be 'standard' or 'premium'");
    process.exit(1);
  }

  const body = { key, days };
  if (plan) body.plan = plan;

  console.log(`Renewing ${key} by ${days} days${plan ? ` (changing plan to ${plan})` : ''}...`);

  const result = await api("/renew", {
    admin: true,
    body,
  });

  console.log(`✅ ${result.message}\n`);
}

async function cmdSuspend(args) {
  const key = args.key || args.k;

  if (!key) {
    console.error("Usage: node licensing/admin-cli.js suspend --key BUZZ-XXXX-XXXX-XXXX");
    process.exit(1);
  }

  console.log(`Suspending ${key}...`);

  const result = await api("/suspend", {
    admin: true,
    body: { key },
  });

  console.log(`✅ ${result.message}\n`);
}

async function cmdValidate(args) {
  const key = args.key || args.k;
  const machine = args.machine || args.m;

  if (!key || !machine) {
    console.error("Usage: node licensing/admin-cli.js validate --key BUZZ-XXXX-XXXX-XXXX --machine <machine-id>");
    process.exit(1);
  }

  console.log(`Validating ${key} on machine ${machine}...\n`);

  const result = await api("/validate", {
    body: { key, machineId: machine },
  });

  if (result.valid) {
    console.log(`✅ ${result.reason}`);
    console.log(`   Expires: ${formatDate(result.expiresAt)}`);
    if (result.customerName) console.log(`   Customer: ${result.customerName}`);
  } else {
    console.log(`❌ ${result.reason}`);
    if (result.expiresAt) console.log(`   Expires: ${formatDate(result.expiresAt)}`);
  }
}

// ── Main entry point ──

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith("--")) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const val = argv[i + 1];
      if (val && !val.startsWith("-")) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
License Server Admin CLI

Commands:
  generate   Generate a new license key
  list       List all licenses
  renew      Renew a license (extend expiry)
  suspend    Suspend a license
  validate   Validate a license key against a machine ID

Environment:
  LICENSE_SERVER_URL  License server URL (default: http://localhost:4000)
  ADMIN_SECRET        Admin secret for admin actions

Examples:
  node licensing/admin-cli.js generate --name "John Doe" --email "john@example.com"
  node licensing/admin-cli.js generate --name "Jane Doe" --email "jane@example.com" --plan premium
  node licensing/admin-cli.js list
  node licensing/admin-cli.js renew --key BUZZ-XXXX-XXXX-XXXX --days 365
  node licensing/admin-cli.js suspend --key BUZZ-XXXX-XXXX-XXXX
  node licensing/admin-cli.js validate --key BUZZ-XXXX-XXXX-XXXX --machine abc123
`);
    return;
  }

  const args = parseArgs(process.argv);

  switch (command) {
    case "generate":
      await cmdGenerate(args);
      break;
    case "list":
      await cmdList();
      break;
    case "renew":
      await cmdRenew(args);
      break;
    case "suspend":
      await cmdSuspend(args);
      break;
    case "validate":
      await cmdValidate(args);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("CLI error:", err.message);
  process.exit(1);
});

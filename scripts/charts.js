const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');

// Use the same TypeScript helpers as the builder, like validate-manifest.js.
require('ts-node').register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    esModuleInterop: true,
    module: 'Node16',
    moduleResolution: 'Node16',
    target: 'ES2022'
  }
});
const { chartTypeError, readChartResponse, uploadCustomChart } =
  require('../projects/builder/src/app/helpers/custom-chart-upload.ts');

const rootDir = path.resolve(__dirname, '..');
const help = `Usage:
  npm run charts -- list [--json]
  npm run charts -- upload --type <type> --name <name> [--json]
  npm run charts -- upload --id <chart-id> [--json]

Uploads always build and validate the local chart first.
Set LUZMO_API_KEY and LUZMO_API_TOKEN in the environment or .env.local.
LUZMO_API_URL defaults to https://api.luzmo.com.
For machine-readable stdout, use npm run --silent charts -- <command> --json.
Exit codes: 0 success, 1 build/API failure, 2 invalid arguments/configuration.
`;

class UsageError extends Error {}

function argumentsFor(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        json: { type: 'boolean' },
        type: { type: 'string' },
        name: { type: 'string' },
        id: { type: 'string' }
      }
    });
  } catch (error) {
    throw new UsageError(error.message);
  }
  const { values, positionals } = parsed;
  if (values.help || argv.length === 0) return { help: true };
  const [command] = positionals;
  if (positionals.length !== 1 || !['list', 'upload'].includes(command)) {
    throw new UsageError('Expected list or upload. Use --help for usage.');
  }
  for (const key of ['id', 'type', 'name']) {
    if (values[key] !== undefined) {
      values[key] = values[key].trim();
      if (!values[key]) throw new UsageError(`--${key} must not be empty.`);
    }
  }
  if (command === 'list' && (values.id || values.type || values.name)) {
    throw new UsageError('list only accepts --json.');
  }
  if (command === 'upload') {
    if (values.id && (values.type || values.name)) {
      throw new UsageError('Use --id to replace a chart, or --type and --name to create one.');
    }
    if (!values.id && (!values.type || !values.name)) {
      throw new UsageError('Creating a chart requires --type and --name; replacing one requires --id.');
    }
    const error = values.type && chartTypeError(values.type);
    if (error) throw new UsageError(error);
  }
  return { command, ...values };
}

function credentialsFromEnvironment() {
  const envFile = path.join(rootDir, '.env.local');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const key = process.env.LUZMO_API_KEY?.trim();
  const token = process.env.LUZMO_API_TOKEN?.trim();
  const apiUrl = (process.env.LUZMO_API_URL ?? 'https://api.luzmo.com').trim().replace(/\/+$/, '');
  if (!key || !token) {
    throw new UsageError('Set LUZMO_API_KEY and LUZMO_API_TOKEN in the environment or .env.local.');
  }
  let url;
  try { url = new URL(apiUrl); } catch {
    throw new UsageError('LUZMO_API_URL must be an absolute HTTP(S) URL.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new UsageError('LUZMO_API_URL must be an HTTP(S) URL without credentials, query parameters, or a fragment.');
  }
  return { key, token, apiUrl };
}

async function searchCharts(credentials, where = {}, offset = 0) {
  const response = await fetch(`${credentials.apiUrl}/0.1.0/customchart`, {
    method: 'SEARCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get', version: '0.1.0', key: credentials.key, token: credentials.token,
      find: {
        attributes: ['id', 'name', 'type', 'status'], where,
        order: [['id', 'asc']], limit: 100, offset
      }
    }),
    signal: AbortSignal.timeout(120_000),
    redirect: 'error'
  });
  const body = await readChartResponse(response);
  if (!body || !Array.isArray(body.rows)) throw new Error('Unexpected chart listing response.');
  return body;
}

function buildChart() {
  console.error('Building and validating custom chart...');
  // Invoke npm through Node when launched by npm; the fixed fallback also works
  // when running this script directly on Windows (where npm is a .cmd file).
  const npmPath = process.env.npm_execpath;
  const result = npmPath
    ? spawnSync(process.execPath, [npmPath, 'run', 'build'], { cwd: rootDir, stdio: ['ignore', 2, 2] })
    : spawnSync('npm run build', { cwd: rootDir, shell: true, stdio: ['ignore', 2, 2] });
  if (result.error || result.status !== 0) {
    throw new Error('Build failed. No upload was attempted. See build output above.');
  }
  return new Blob([fs.readFileSync(path.join(rootDir, 'custom-chart-build-output', 'bundle.zip'))], {
    type: 'application/zip'
  });
}

async function main() {
  const args = argumentsFor(process.argv.slice(2));
  if (args.help) { console.log(help); return; }
  const credentials = credentialsFromEnvironment();
  if (args.command === 'list') {
    const charts = [];
    while (true) {
      const page = await searchCharts(credentials, {}, charts.length);
      charts.push(...page.rows);
      if (!page.rows.length || (typeof page.count === 'number' ? charts.length >= page.count : page.rows.length < 100)) break;
    }
    if (args.json) console.log(JSON.stringify({ charts }));
    else if (!charts.length) console.log('No custom charts found.');
    else console.table(charts.map(({ id, type, name, status }) => ({
      id, type, name: name?.en ?? Object.values(name ?? {})[0] ?? '', status
    })));
    return;
  }

  const matches = await searchCharts(credentials, args.id ? { id: args.id } : { type: args.type });
  if (args.id && !matches.rows.length) {
    throw new Error(`Chart ${args.id} was not found or is not accessible. Use list to find an available chart.`);
  }
  if (!args.id && matches.rows.length) {
    throw new Error(`A chart with type "${args.type}" already exists (${matches.rows[0].id}). To replace it, use upload --id ${matches.rows[0].id}.`);
  }
  const zip = buildChart();
  const action = args.id ? 'update' : 'create';
  console.error(`${action === 'create' ? 'Creating' : 'Updating'} custom chart...`);
  const chart = await uploadCustomChart(credentials, args.id
    ? { action, id: args.id, zip }
    : { action, type: args.type, name: args.name, zip });
  if (!chart || typeof chart.id !== 'string' || !chart.id) {
    throw new Error('The upload response did not contain a chart ID. Check the chart listing before retrying; the upload may have succeeded.');
  }
  const result = { action, id: chart.id, type: chart.type, name: chart.name, status: chart.status };
  console.log(args.json ? JSON.stringify(result) : `Custom chart ${chart.id} ${action === 'create' ? 'created' : 'updated'} successfully.`);
}

main().catch((error) => {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [process.env.LUZMO_API_KEY, process.env.LUZMO_API_TOKEN]) {
    if (secret) message = message.split(secret).join('[redacted]');
  }
  console.error(process.argv.includes('--json') ? JSON.stringify({ error: message }) : `Error: ${message}`);
  process.exitCode = error instanceof UsageError ? 2 : 1;
});

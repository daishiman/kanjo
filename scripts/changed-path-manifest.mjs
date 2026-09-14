import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCHEMA_VERSION = '3.0.0';
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIOME_CLI = resolve(REPOSITORY_ROOT, 'node_modules/@biomejs/biome/bin/biome');
const BIOME_CONFIG = resolve(REPOSITORY_ROOT, 'biome.json');
const CONTENT_EXCLUDED_ROOTS = ['data', 'packages/api/.dev.vars', 'samples'];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function changedPathDigest(baseRevision, entries) {
  return sha256(
    JSON.stringify({
      schema_version: SCHEMA_VERSION,
      base_revision: baseRevision,
      entries,
    }),
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function formatManifestJson(manifest) {
  const source = `${JSON.stringify(manifest, null, 2)}\n`;
  const result = spawnSync(
    process.execPath,
    [
      BIOME_CLI,
      'format',
      '--write',
      '--config-path',
      BIOME_CONFIG,
      '--stdin-file-path',
      'docs/design-system/changed-path-manifest.json',
    ],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      input: source,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.status !== 0 || result.error) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? `exit ${result.status}`;
    throw new Error(`failed to format changed-path manifest with Biome: ${detail}`);
  }
  return result.stdout;
}

function writeManifest(outputPath, manifest) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatManifestJson(manifest));
}

function receiptRecordDigest(receipt) {
  const { record_digest: _omitted, ...record } = receipt;
  return sha256(stableJson(record));
}

function commandReceiptsDigest(receipts) {
  return sha256(stableJson(receipts));
}

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function repositoryRelative(repoRoot, path) {
  const root = resolve(repoRoot);
  const absolute = resolve(path);
  const rel = relative(root, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`path must be a repository-relative file: ${path}`);
  }
  return rel.split(sep).join('/');
}

function parseStatus(repoRoot) {
  const raw = execFileSync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=no'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const fields = raw.split('\0');
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    const path = field.slice(3);
    entries.push({ path, status });
    if (status.includes('R') || status.includes('C')) {
      const sourcePath = fields[index + 1];
      if (!sourcePath) throw new Error(`rename/copy source is absent for ${path}`);
      entries.push({ path: sourcePath, status: status.includes('R') ? 'D ' : status });
      index += 1;
    }
  }
  return entries;
}

function exclusionReason(path, outputPath, outputArtifacts = new Set()) {
  if (path === outputPath) return 'self-referential-evidence-artifact';
  if (outputArtifacts.has(path)) return 'reproducibility-output-artifact';
  if (path === 'data' || path.startsWith('data/')) return 'protected-real-data-path';
  if (path === 'packages/api/.dev.vars') return 'protected-secret-path';
  if (path === 'samples' || path.startsWith('samples/')) {
    return 'anonymous-sample-outside-change-scope';
  }
  return null;
}

function fileKind(stat) {
  if (stat.isFile()) return 'file';
  if (stat.isDirectory()) return 'directory';
  if (stat.isSymbolicLink()) return 'symlink';
  return 'other';
}

function contentExcludedMetadata(repoRoot) {
  const metadata = new Map();
  const visit = (path) => {
    const absolute = resolve(repoRoot, path);
    if (!existsSync(absolute)) {
      metadata.set(path, { exists: false });
      return;
    }
    const stat = lstatSync(absolute, { bigint: true });
    metadata.set(path, {
      exists: true,
      kind: fileKind(stat),
      size: stat.size.toString(),
      mode: stat.mode.toString(),
      device: stat.dev.toString(),
      inode: stat.ino.toString(),
      mtime_ns: stat.mtimeNs.toString(),
      ctime_ns: stat.ctimeNs.toString(),
    });
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name, 'en'),
    )) {
      visit(`${path}/${entry.name}`);
    }
  };
  for (const path of CONTENT_EXCLUDED_ROOTS) visit(path);
  return metadata;
}

function changedContentExcludedPath(before, after) {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort((left, right) =>
    left.localeCompare(right, 'en'),
  );
  return paths.find((path) => stableJson(before.get(path)) !== stableJson(after.get(path))) ?? null;
}

export function normalizeEvidenceBinding(path, source) {
  if (path === 'docs/design-system/verification-run.json') {
    return source.replace(
      /("changed_path_aggregate_digest"\s*:\s*")[^"]*(")/,
      '$1CHANGED_PATH_AGGREGATE_DIGEST$2',
    );
  }
  if (path === 'docs/design-system/evidence.md') {
    return source.replace(/^(Changed-path aggregate digest:\s*).*$/m, '$1CHANGED_PATH_AGGREGATE_DIGEST');
  }
  return source;
}

export function bindEvidenceIndexDigest(repoRoot, digest) {
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('aggregate digest must be lowercase SHA-256');
  const verificationPath = resolve(repoRoot, 'docs/design-system/verification-run.json');
  if (existsSync(verificationPath)) {
    const source = readFileSync(verificationPath, 'utf8');
    JSON.parse(source);
    const marker = /("changed_path_aggregate_digest"\s*:\s*")[^"]*(")/;
    if (!marker.test(source)) throw new Error('verification-run aggregate digest field is absent');
    const bound = source.replace(marker, `$1${digest}$2`);
    JSON.parse(bound);
    writeFileSync(verificationPath, bound);
  }
  const evidencePath = resolve(repoRoot, 'docs/design-system/evidence.md');
  if (existsSync(evidencePath)) {
    const source = readFileSync(evidencePath, 'utf8');
    const marker = /^(Changed-path aggregate digest:\s*).*$/m;
    if (!marker.test(source)) throw new Error('evidence index aggregate digest marker is absent');
    writeFileSync(evidencePath, source.replace(marker, `$1${digest}`));
  }
}

function entryFor(repoRoot, candidate, outputPath, outputArtifacts) {
  const excludedReason = exclusionReason(candidate.path, outputPath, outputArtifacts);
  if (excludedReason) {
    return { path: candidate.path, status: candidate.status, sha256: null, excluded_reason: excludedReason };
  }
  if (candidate.status.includes('D')) {
    return {
      path: candidate.path,
      status: candidate.status,
      sha256: null,
      excluded_reason: 'deleted-path-has-no-content',
    };
  }
  const absolute = resolve(repoRoot, candidate.path);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    return {
      path: candidate.path,
      status: candidate.status,
      sha256: null,
      excluded_reason: 'symlink-content-not-followed',
    };
  }
  if (!stat.isFile()) {
    return {
      path: candidate.path,
      status: candidate.status,
      sha256: null,
      excluded_reason: 'non-regular-file',
    };
  }
  const bytes = readFileSync(absolute);
  const digestInput =
    candidate.path === 'docs/design-system/verification-run.json' ||
    candidate.path === 'docs/design-system/evidence.md'
      ? normalizeEvidenceBinding(candidate.path, bytes.toString('utf8'))
      : bytes;
  return {
    path: candidate.path,
    status: candidate.status,
    sha256: sha256(digestInput),
    excluded_reason: null,
  };
}

function snapshotCore(repoRoot, outputPath, outputArtifactPaths = []) {
  const root = resolve(repoRoot);
  const output = repositoryRelative(root, outputPath);
  const byPath = new Map(parseStatus(root).map((entry) => [entry.path, entry]));
  if (!byPath.has(output)) byPath.set(output, { path: output, status: '??' });
  const entries = [...byPath.values()]
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
    .map((entry) => entryFor(root, entry, output, new Set(outputArtifactPaths)));
  const baseRevision = git(root, ['rev-parse', 'HEAD']);
  return {
    baseRevision,
    entries,
    digest: changedPathDigest(baseRevision, entries),
  };
}

export function buildChangedPathManifest({
  repoRoot,
  outputPath,
  commandBindings = [],
  commandReceipts = [],
  outputArtifactPaths = [],
  commandConfigurationDigest = null,
}) {
  if (commandBindings.length > 0) {
    throw new Error('manual command bindings are not execution evidence');
  }
  const snapshot = snapshotCore(repoRoot, outputPath, outputArtifactPaths);
  const receipts = [...commandReceipts].sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const included = snapshot.entries.filter((entry) => entry.sha256 !== null).length;
  return {
    schema_version: SCHEMA_VERSION,
    evidence_model: 'reproducibility-snapshot',
    authenticity_claim: 'none-local-files-are-not-a-trust-anchor',
    status: 'fresh',
    base_revision: snapshot.baseRevision,
    aggregate_digest: snapshot.digest,
    entry_count: snapshot.entries.length,
    included_count: included,
    excluded_count: snapshot.entries.length - included,
    stale_policy: {
      fresh_when:
        'base_revision and the exact sorted changed-path entries (status/hash/exclusion) reproduce aggregate_digest',
      stale_when: 'base revision, path set, status, content hash, or exclusion reason differs',
      evidence_binding_normalization:
        'verification-run.json and evidence.md normalize only their aggregate digest reference to avoid a digest cycle',
      protected_paths: ['data/**', 'packages/api/.dev.vars'],
      protected_path_policy:
        'never read content; record path/status/reason and reject validation-time metadata mutation',
      sample_policy:
        'samples/** entries are always unhashed in this evidence scope; validation-time metadata mutation is rejected',
    },
    entries: snapshot.entries,
    command_receipts: receipts,
    command_receipts_digest: commandReceiptsDigest(receipts),
    command_configuration_digest: commandConfigurationDigest,
  };
}

export function runValidationCommands({ repoRoot, outputPath, commands }) {
  if (!Array.isArray(commands) || commands.length === 0) throw new Error('at least one command is required');
  const normalized = commands.map(({ id, executable, args = [], stdout_log, stderr_log }) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('command id is required');
    if (typeof executable !== 'string' || !executable.trim())
      throw new Error(`executable is required: ${id}`);
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
      throw new Error(`command args must be strings: ${id}`);
    }
    if (typeof stdout_log !== 'string' || typeof stderr_log !== 'string') {
      throw new Error(`stdout_log and stderr_log are required: ${id}`);
    }
    return { id, executable, args, stdout_log, stderr_log };
  });
  const outputArtifactPaths = normalized.flatMap(({ stdout_log, stderr_log }) => [stdout_log, stderr_log]);
  for (const path of outputArtifactPaths) {
    const absolute = resolve(repoRoot, path);
    repositoryRelative(repoRoot, absolute);
    mkdirSync(dirname(absolute), { recursive: true });
    if (!existsSync(absolute)) writeFileSync(absolute, '');
  }
  const commandConfigurationDigest = sha256(stableJson(normalized));
  const before = snapshotCore(repoRoot, outputPath, outputArtifactPaths);
  const excludedMetadataBefore = contentExcludedMetadata(repoRoot);
  const receipts = normalized.map(({ id, executable, args, stdout_log, stderr_log }) => {
    const started = new Date();
    const startedNs = process.hrtime.bigint();
    const result = spawnSync(executable, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
    });
    const finishedNs = process.hrtime.bigint();
    const finished = new Date();
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    writeFileSync(resolve(repoRoot, stdout_log), stdout);
    writeFileSync(resolve(repoRoot, stderr_log), stderr);
    const receipt = {
      id,
      executable,
      args,
      exit_code: result.status,
      signal: result.signal,
      started_at: started.toISOString(),
      finished_at: finished.toISOString(),
      runtime_ms: Number(finishedNs - startedNs) / 1_000_000,
      input_manifest_digest: before.digest,
      stdout_digest: sha256(stdout),
      stderr_digest: sha256(stderr),
      output_digest: sha256(`stdout\0${stdout}\0stderr\0${stderr}`),
      stdout_bytes: Buffer.byteLength(stdout),
      stderr_bytes: Buffer.byteLength(stderr),
      stdout_log,
      stderr_log,
      command_configuration_digest: commandConfigurationDigest,
      spawn_error: result.error?.message ?? null,
    };
    return { ...receipt, record_digest: receiptRecordDigest(receipt) };
  });
  const after = snapshotCore(repoRoot, outputPath, outputArtifactPaths);
  const excludedMetadataAfter = contentExcludedMetadata(repoRoot);
  const mutatedExcludedPath = changedContentExcludedPath(excludedMetadataBefore, excludedMetadataAfter);
  if (mutatedExcludedPath) {
    throw new Error(`content-excluded path metadata changed during validation: ${mutatedExcludedPath}`);
  }
  if (before.digest !== after.digest) {
    throw new Error('validation commands changed the exact changed-path snapshot');
  }
  return buildChangedPathManifest({
    repoRoot,
    outputPath,
    commandReceipts: receipts,
    outputArtifactPaths,
    commandConfigurationDigest,
  });
}

export function verifyChangedPathManifest({ repoRoot, manifestPath, commands }) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const normalizedCommands = Array.isArray(commands)
    ? commands.map(({ id, executable, args = [], stdout_log, stderr_log }) => ({
        id,
        executable,
        args,
        stdout_log,
        stderr_log,
      }))
    : [];
  const outputArtifactPaths = normalizedCommands.flatMap(({ stdout_log, stderr_log }) => [
    stdout_log,
    stderr_log,
  ]);
  const current = snapshotCore(repoRoot, manifestPath, outputArtifactPaths);
  const reasons = [];
  const recordedEntries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const recordedReceipts = Array.isArray(manifest.command_receipts) ? manifest.command_receipts : [];
  const commandConfigurationDigest = sha256(stableJson(normalizedCommands));
  if (manifest.status !== 'fresh') reasons.push('recorded status is not fresh');
  if (manifest.schema_version !== SCHEMA_VERSION) reasons.push('schema version differs');
  if (
    manifest.evidence_model !== 'reproducibility-snapshot' ||
    manifest.authenticity_claim !== 'none-local-files-are-not-a-trust-anchor'
  )
    reasons.push('evidence trust boundary differs');
  if (normalizedCommands.length === 0 || manifest.command_configuration_digest !== commandConfigurationDigest)
    reasons.push('configured command identity differs');
  if (manifest.base_revision !== current.baseRevision) reasons.push('base revision differs');
  if (manifest.aggregate_digest !== current.digest) reasons.push('changed-path snapshot digest differs');
  if (JSON.stringify(recordedEntries) !== JSON.stringify(current.entries)) {
    reasons.push('recorded changed-path entries differ');
  }
  if (manifest.aggregate_digest !== changedPathDigest(manifest.base_revision, recordedEntries)) {
    reasons.push('recorded aggregate digest does not describe recorded entries');
  }
  if (
    !Array.isArray(manifest.command_receipts) ||
    recordedReceipts.some((receipt) => receipt?.input_manifest_digest !== manifest.aggregate_digest)
  ) {
    reasons.push('command receipt input digest differs');
  }
  const receiptsValid = recordedReceipts.every(
    (receipt) =>
      receipt &&
      typeof receipt.id === 'string' &&
      receipt.id.trim() &&
      typeof receipt.executable === 'string' &&
      Array.isArray(receipt.args) &&
      receipt.args.every((arg) => typeof arg === 'string') &&
      (Number.isInteger(receipt.exit_code) || receipt.exit_code === null) &&
      typeof receipt.started_at === 'string' &&
      typeof receipt.finished_at === 'string' &&
      typeof receipt.runtime_ms === 'number' &&
      receipt.runtime_ms >= 0 &&
      /^[0-9a-f]{64}$/.test(receipt.stdout_digest ?? '') &&
      /^[0-9a-f]{64}$/.test(receipt.stderr_digest ?? '') &&
      /^[0-9a-f]{64}$/.test(receipt.output_digest ?? '') &&
      receipt.record_digest === receiptRecordDigest(receipt),
  );
  const ids = recordedReceipts.map((receipt) => receipt?.id);
  if (
    !receiptsValid ||
    JSON.stringify(ids) !== JSON.stringify([...ids].sort((left, right) => left.localeCompare(right, 'en'))) ||
    new Set(ids).size !== ids.length
  ) {
    reasons.push('command receipt record digest differs');
  }
  if (manifest.command_receipts_digest !== commandReceiptsDigest(recordedReceipts)) {
    reasons.push('command receipt aggregate digest differs');
  }
  for (const [index, command] of normalizedCommands.entries()) {
    const receipt = recordedReceipts[index];
    if (
      !receipt ||
      receipt.id !== command.id ||
      receipt.executable !== command.executable ||
      JSON.stringify(receipt.args) !== JSON.stringify(command.args) ||
      receipt.stdout_log !== command.stdout_log ||
      receipt.stderr_log !== command.stderr_log ||
      receipt.command_configuration_digest !== commandConfigurationDigest
    ) {
      reasons.push(`configured command identity differs: ${command.id}`);
      continue;
    }
    try {
      const stdout = readFileSync(resolve(repoRoot, command.stdout_log));
      const stderr = readFileSync(resolve(repoRoot, command.stderr_log));
      const output = Buffer.concat([Buffer.from('stdout\0'), stdout, Buffer.from('\0stderr\0'), stderr]);
      if (
        receipt.stdout_digest !== sha256(stdout) ||
        receipt.stderr_digest !== sha256(stderr) ||
        receipt.output_digest !== sha256(output) ||
        receipt.stdout_bytes !== stdout.length ||
        receipt.stderr_bytes !== stderr.length
      )
        reasons.push(`retained command output differs: ${command.id}`);
    } catch {
      reasons.push(`retained command output is absent: ${command.id}`);
    }
  }
  const verificationPath = resolve(repoRoot, 'docs/design-system/verification-run.json');
  if (existsSync(verificationPath)) {
    const verification = JSON.parse(readFileSync(verificationPath, 'utf8'));
    if (verification.changed_path_aggregate_digest !== manifest.aggregate_digest) {
      reasons.push('verification-run aggregate digest differs');
    }
  }
  const evidencePath = resolve(repoRoot, 'docs/design-system/evidence.md');
  if (existsSync(evidencePath)) {
    const evidence = readFileSync(evidencePath, 'utf8');
    if (!evidence.includes(`Changed-path aggregate digest: ${manifest.aggregate_digest}`)) {
      reasons.push('evidence index aggregate digest differs');
    }
  }
  if (
    recordedReceipts.length === 0 ||
    recordedReceipts.some((receipt) => receipt?.exit_code !== 0 || receipt?.spawn_error !== null)
  ) {
    reasons.push('not all validation commands passed');
  }
  if (
    manifest.entry_count !== current.entries.length ||
    manifest.included_count !== current.entries.filter((entry) => entry.sha256 !== null).length ||
    manifest.excluded_count !== current.entries.filter((entry) => entry.sha256 === null).length
  ) {
    reasons.push('recorded entry counts differ');
  }
  return {
    status: reasons.length === 0 ? 'fresh' : 'stale',
    expected_digest: manifest.aggregate_digest,
    actual_digest: current.digest,
    reasons,
  };
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) throw new Error(`${name} is required`);
  return args[index + 1];
}

function main(args) {
  const command = args[0];
  if (command === 'generate') {
    const outputPath = resolve(option(args, '--out'));
    const manifest = buildChangedPathManifest({ repoRoot: process.cwd(), outputPath });
    writeManifest(outputPath, manifest);
    process.stdout.write(
      `${JSON.stringify({ status: 'generated', path: repositoryRelative(process.cwd(), outputPath), aggregate_digest: manifest.aggregate_digest, entry_count: manifest.entry_count })}\n`,
    );
    return;
  }
  if (command === 'run') {
    const outputPath = resolve(option(args, '--out'));
    const commandsPath = resolve(option(args, '--commands'));
    const commands = JSON.parse(readFileSync(commandsPath, 'utf8'));
    const manifest = runValidationCommands({ repoRoot: process.cwd(), outputPath, commands });
    writeManifest(outputPath, manifest);
    bindEvidenceIndexDigest(process.cwd(), manifest.aggregate_digest);
    process.stdout.write(
      `${JSON.stringify({ status: 'captured', path: repositoryRelative(process.cwd(), outputPath), aggregate_digest: manifest.aggregate_digest, commands: manifest.command_receipts.map(({ id, exit_code }) => ({ id, exit_code })) })}\n`,
    );
    if (manifest.command_receipts.some((receipt) => receipt.exit_code !== 0 || receipt.spawn_error)) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === 'check') {
    const manifestPath = resolve(option(args, '--manifest'));
    const commandsPath = resolve(option(args, '--commands'));
    const commands = JSON.parse(readFileSync(commandsPath, 'utf8'));
    const result = verifyChangedPathManifest({ repoRoot: process.cwd(), manifestPath, commands });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== 'fresh') process.exitCode = 1;
    return;
  }
  throw new Error(
    'usage: changed-path-manifest.mjs <generate --out PATH | run --out PATH --commands JSON | check --manifest PATH --commands JSON>',
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

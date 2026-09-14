import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  bindEvidenceIndexDigest,
  buildChangedPathManifest,
  formatManifestJson,
  normalizeEvidenceBinding,
  runValidationCommands,
  verifyChangedPathManifest,
} from './changed-path-manifest.mjs';

test('capture binds its aggregate digest into both normalized evidence indexes', () => {
  const root = mkdtempSync(join(tmpdir(), 'kanjo-evidence-bindings-'));
  try {
    mkdirSync(join(root, 'docs', 'design-system'), { recursive: true });
    const verificationPath = join(root, 'docs', 'design-system', 'verification-run.json');
    const verificationBefore = `{
  "changed_path_aggregate_digest": "PENDING",
  "command_receipt_ids": ["fixture-full-gate"],
  "untouched": true
}\n`;
    writeFileSync(verificationPath, verificationBefore);
    writeFileSync(
      join(root, 'docs', 'design-system', 'evidence.md'),
      '# Evidence\n\nChanged-path aggregate digest: PENDING\n',
    );
    const digest = 'b'.repeat(64);

    bindEvidenceIndexDigest(root, digest);

    assert.equal(JSON.parse(readFileSync(verificationPath, 'utf8')).changed_path_aggregate_digest, digest);
    assert.equal(
      normalizeEvidenceBinding(
        'docs/design-system/verification-run.json',
        readFileSync(verificationPath, 'utf8'),
      ),
      normalizeEvidenceBinding('docs/design-system/verification-run.json', verificationBefore),
    );
    assert.match(
      readFileSync(join(root, 'docs', 'design-system', 'evidence.md'), 'utf8'),
      new RegExp(`Changed-path aggregate digest: ${digest}`),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verification index bindings are normalized to avoid an aggregate-digest cycle', () => {
  const digest = 'a'.repeat(64);
  assert.equal(
    normalizeEvidenceBinding(
      'docs/design-system/verification-run.json',
      `{"changed_path_aggregate_digest":"${digest}"}`,
    ),
    normalizeEvidenceBinding(
      'docs/design-system/verification-run.json',
      '{"changed_path_aggregate_digest":"PENDING"}',
    ),
  );
  assert.equal(
    normalizeEvidenceBinding('docs/design-system/evidence.md', `Changed-path aggregate digest: ${digest}`),
    normalizeEvidenceBinding('docs/design-system/evidence.md', 'Changed-path aggregate digest: PENDING'),
  );
});

test('acceptance evidence binds the full S6 gate while fast remains iteration-only', () => {
  const commands = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'design-system-validation-commands.json'), 'utf8'),
  );
  assert.deepEqual(commands, [
    {
      id: 'acceptance-worktree-full-s6-gate',
      executable: 'pnpm',
      args: ['run', 'verify:full'],
      stdout_log: 'docs/design-system/evidence/acceptance-worktree-full-s6-gate.stdout.txt',
      stderr_log: 'docs/design-system/evidence/acceptance-worktree-full-s6-gate.stderr.txt',
    },
  ]);
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['design-system:fast'], /delivery:test/);
  assert.doesNotMatch(packageJson.scripts['evidence:acceptance'], /design-system:fast/);
});

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kanjo-changed-paths-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'Changed Path Test');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'tracked.txt'), 'before\n');
  git(root, 'add', 'src/tracked.txt');
  git(root, 'commit', '-qm', 'fixture');
  return root;
}

test('run command writes a deterministic manifest that already satisfies the repository formatter', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'tracked.txt'), 'after\n');
    mkdirSync(join(root, 'config'));
    const commandsPath = join(root, 'config', 'commands.json');
    writeFileSync(
      commandsPath,
      `${JSON.stringify([
        {
          id: 'fixture-pass',
          executable: process.execPath,
          args: ['-e', 'process.stdout.write("verified")'],
          stdout_log: 'evidence/fixture.stdout.log',
          stderr_log: 'evidence/fixture.stderr.log',
        },
      ])}\n`,
    );
    const out = join(root, 'evidence', 'changed-path-manifest.json');
    execFileSync(
      process.execPath,
      [
        join(process.cwd(), 'scripts', 'changed-path-manifest.mjs'),
        'run',
        '--out',
        'evidence/changed-path-manifest.json',
        '--commands',
        'config/commands.json',
      ],
      { cwd: root, encoding: 'utf8' },
    );

    const first = readFileSync(out, 'utf8');
    const biome = spawnSync('pnpm', ['exec', 'biome', 'check', '--config-path', 'biome.json', out], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(biome.status, 0, `${biome.stdout}\n${biome.stderr}`);
    assert.equal(first, formatManifestJson(JSON.parse(first)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('changed path manifest is exact, deterministic, and never hashes protected paths', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'tracked.txt'), 'after\n');
    writeFileSync(join(root, 'src', 'new.txt'), 'new\n');
    mkdirSync(join(root, 'data'));
    writeFileSync(join(root, 'data', 'private.csv'), 'must-not-be-read\n');
    mkdirSync(join(root, 'packages', 'api'), { recursive: true });
    writeFileSync(join(root, 'packages', 'api', '.dev.vars'), 'SECRET=must-not-be-read\n');
    mkdirSync(join(root, 'samples'));
    writeFileSync(join(root, 'samples', 'anonymous.csv'), 'anonymous-but-out-of-scope\n');

    const out = join(root, 'evidence', 'changed-path-manifest.json');
    const first = buildChangedPathManifest({ repoRoot: root, outputPath: out });
    const second = buildChangedPathManifest({ repoRoot: root, outputPath: out });

    assert.equal(first.aggregate_digest, second.aggregate_digest);
    assert.deepEqual(first.entries, second.entries);
    assert.deepEqual(
      first.entries.map((entry) => entry.path),
      [
        'data/private.csv',
        'evidence/changed-path-manifest.json',
        'packages/api/.dev.vars',
        'samples/anonymous.csv',
        'src/new.txt',
        'src/tracked.txt',
      ],
    );
    assert.equal(
      first.entries.find((entry) => entry.path === 'data/private.csv').excluded_reason,
      'protected-real-data-path',
    );
    assert.equal(
      first.entries.find((entry) => entry.path === 'packages/api/.dev.vars').excluded_reason,
      'protected-secret-path',
    );
    assert.equal(
      first.entries.find((entry) => entry.path === 'samples/anonymous.csv').excluded_reason,
      'anonymous-sample-outside-change-scope',
    );
    assert.equal(
      first.entries.find((entry) => entry.path === 'evidence/changed-path-manifest.json').excluded_reason,
      'self-referential-evidence-artifact',
    );
    assert.equal(first.entries.find((entry) => entry.path === 'data/private.csv').sha256, null);
    assert.equal(
      first.stale_policy.sample_policy,
      'samples/** entries are always unhashed in this evidence scope; validation-time metadata mutation is rejected',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validation rejects a same-status protected-file mutation without hashing its contents', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, 'data'));
    writeFileSync(join(root, 'data', 'private.csv'), 'before-secret\n');
    const out = join(root, 'evidence', 'changed-path-manifest.json');
    const commands = [
      {
        id: 'mutates-protected-file',
        executable: process.execPath,
        args: ['-e', 'require("node:fs").writeFileSync("data/private.csv", "after--secret\\n")'],
        stdout_log: 'evidence/mutation.stdout.log',
        stderr_log: 'evidence/mutation.stderr.log',
      },
    ];

    assert.throws(
      () => runValidationCommands({ repoRoot: root, outputPath: out, commands }),
      /content-excluded path metadata changed during validation: data\/private\.csv/,
    );
    const manifest = buildChangedPathManifest({ repoRoot: root, outputPath: out });
    const protectedEntry = manifest.entries.find((entry) => entry.path === 'data/private.csv');
    assert.equal(protectedEntry.sha256, null);
    assert.equal(protectedEntry.excluded_reason, 'protected-real-data-path');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('manual status bindings are rejected instead of being accepted as execution evidence', () => {
  const root = fixture();
  try {
    const out = join(root, 'evidence', 'changed-path-manifest.json');
    assert.throws(
      () =>
        buildChangedPathManifest({
          repoRoot: root,
          outputPath: out,
          commandBindings: [{ command: 'pnpm lint', status: 'pass', summary: 'fabricated' }],
        }),
      /manual command bindings are not execution evidence/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checker reports fresh only for the exact snapshot and machine-captured receipts', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'tracked.txt'), 'after\n');
    const out = join(root, 'evidence', 'changed-path-manifest.json');
    const commands = [
      {
        id: 'fixture-pass',
        executable: process.execPath,
        args: ['-e', 'process.stdout.write("verified")'],
        stdout_log: 'evidence/fixture.stdout.log',
        stderr_log: 'evidence/fixture.stderr.log',
      },
    ];
    const manifest = runValidationCommands({
      repoRoot: root,
      outputPath: out,
      commands,
    });
    mkdirSync(join(root, 'evidence'), { recursive: true });
    writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);

    assert.deepEqual(verifyChangedPathManifest({ repoRoot: root, manifestPath: out, commands }), {
      status: 'fresh',
      expected_digest: manifest.aggregate_digest,
      actual_digest: manifest.aggregate_digest,
      reasons: [],
    });

    const tamperedEntry = structuredClone(manifest);
    tamperedEntry.entries.find((entry) => entry.path === 'src/tracked.txt').sha256 = '0'.repeat(64);
    writeFileSync(out, `${JSON.stringify(tamperedEntry, null, 2)}\n`);
    const invalidEntry = verifyChangedPathManifest({ repoRoot: root, manifestPath: out, commands });
    assert.equal(invalidEntry.status, 'stale');
    assert.ok(invalidEntry.reasons.includes('recorded changed-path entries differ'));
    assert.ok(invalidEntry.reasons.includes('recorded aggregate digest does not describe recorded entries'));

    const tamperedResult = structuredClone(manifest);
    tamperedResult.command_receipts[0].exit_code = 1;
    writeFileSync(out, `${JSON.stringify(tamperedResult, null, 2)}\n`);
    const invalidResult = verifyChangedPathManifest({ repoRoot: root, manifestPath: out, commands });
    assert.equal(invalidResult.status, 'stale');
    assert.ok(invalidResult.reasons.includes('command receipt record digest differs'));
    assert.ok(invalidResult.reasons.includes('not all validation commands passed'));

    const tampered = structuredClone(manifest);
    tampered.command_receipts[0].input_manifest_digest = '0'.repeat(64);
    writeFileSync(out, `${JSON.stringify(tampered, null, 2)}\n`);
    const invalidBinding = verifyChangedPathManifest({ repoRoot: root, manifestPath: out, commands });
    assert.equal(invalidBinding.status, 'stale');
    assert.ok(invalidBinding.reasons.includes('command receipt input digest differs'));

    writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);

    const forgedIdentity = verifyChangedPathManifest({
      repoRoot: root,
      manifestPath: out,
      commands: [{ ...commands[0], executable: 'false' }],
    });
    assert.equal(forgedIdentity.status, 'stale');
    assert.match(forgedIdentity.reasons.join('\n'), /configured command identity differs/);

    writeFileSync(join(root, 'evidence', 'fixture.stdout.log'), 'forged output');
    const forgedOutput = verifyChangedPathManifest({ repoRoot: root, manifestPath: out, commands });
    assert.equal(forgedOutput.status, 'stale');
    assert.ok(forgedOutput.reasons.includes('retained command output differs: fixture-pass'));
    writeFileSync(join(root, 'evidence', 'fixture.stdout.log'), 'verified');

    writeFileSync(join(root, 'src', 'tracked.txt'), 'changed-again\n');
    const stale = verifyChangedPathManifest({ repoRoot: root, manifestPath: out, commands });
    assert.equal(stale.status, 'stale');
    assert.notEqual(stale.actual_digest, manifest.aggregate_digest);
    assert.ok(stale.reasons.includes('changed-path snapshot digest differs'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

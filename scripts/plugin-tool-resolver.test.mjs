import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { resolvePluginTool } from './plugin-tool-resolver.mjs';

test('plugin tool resolver is path-portable and resolves newest compatible capability', () => {
  const root = mkdtempSync(join(tmpdir(), 'kanjo-plugin-'));
  try {
    mkdirSync(join(root, '.codex-plugin'), { recursive: true });
    mkdirSync(join(root, 'scripts'));
    writeFileSync(join(root, '.codex-plugin', 'plugin.json'), '{"name":"fixture","version":"1.2.3"}\n');
    writeFileSync(join(root, 'scripts', 'check.py'), 'print("ok")\n');
    const specification = {
      name: 'fixture',
      versionRange: '>=1.2.0 <2.0.0',
      capabilities: { check: ['scripts/check.py'] },
    };
    const resolved = resolvePluginTool({ specification, explicitRoot: root });
    assert.equal(resolved.root, root);
    assert.equal(resolved.scripts.check, join(root, 'scripts', 'check.py'));
    assert.throws(
      () =>
        resolvePluginTool({
          specification: { ...specification, versionRange: '>=2.0.0 <3.0.0' },
          explicitRoot: root,
        }),
      /not compatible/,
    );
    assert.throws(
      () =>
        resolvePluginTool({
          specification: { ...specification, capabilities: { missing: ['scripts/missing.py'] } },
          explicitRoot: root,
        }),
      /plugin script is absent/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('cache discovery is version-independent and selects the newest compatible install', () => {
  const cache = mkdtempSync(join(tmpdir(), 'kanjo-plugin-cache-'));
  try {
    for (const version of ['1.1.9', '1.5.0', '2.0.0']) {
      const root = join(cache, 'vendor', 'fixture', version);
      mkdirSync(join(root, '.codex-plugin'), { recursive: true });
      mkdirSync(join(root, 'scripts'));
      writeFileSync(join(root, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'fixture', version }));
      writeFileSync(join(root, 'scripts', 'check.py'), 'print("ok")\n');
    }
    const resolved = resolvePluginTool({
      cacheRoot: cache,
      specification: {
        publisher: 'vendor',
        name: 'fixture',
        versionRange: '>=1.0.0 <2.0.0',
        capabilities: { check: ['scripts/check.py'] },
      },
    });
    assert.equal(resolved.manifest.version, '1.5.0');
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test('newer compatible install without the capability falls back to an older capable install', () => {
  const cache = mkdtempSync(join(tmpdir(), 'kanjo-plugin-capability-fallback-'));
  try {
    for (const version of ['1.4.0', '1.5.0']) {
      const root = join(cache, 'vendor', 'fixture', version);
      mkdirSync(join(root, '.codex-plugin'), { recursive: true });
      mkdirSync(join(root, 'scripts'));
      writeFileSync(join(root, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'fixture', version }));
      if (version === '1.4.0') writeFileSync(join(root, 'scripts', 'validate.py'), 'print("ok")\n');
    }
    const resolved = resolvePluginTool({
      cacheRoot: cache,
      specification: {
        publisher: 'vendor',
        name: 'fixture',
        versionRange: '>=1.0.0 <2.0.0',
        capabilities: { validate: ['scripts/validate.py'] },
      },
    });
    assert.equal(resolved.manifest.version, '1.4.0');
    assert.equal(
      resolved.scripts.validate,
      join(cache, 'vendor', 'fixture', '1.4.0', 'scripts', 'validate.py'),
    );
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

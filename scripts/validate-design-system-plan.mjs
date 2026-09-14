#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectDesignSystemDelivery } from './check-design-system-delivery.mjs';
import { resolvePluginTool, runResolvedPythonTool } from './plugin-tool-resolver.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

try {
  const config = JSON.parse(readFileSync(join(root, 'scripts/design-system-toolchain.json'), 'utf8'));
  const resolved = resolvePluginTool({
    specification: config.systemPlanValidator,
    explicitRoot: option('--plugin-root'),
    cacheRoot: option('--cache-root'),
  });
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ status: 'preflight-pass', plugin: resolved.manifest, script: 'validate' }));
  } else {
    const staging = '.dev-graph/plans/feature-package-feat-design-system-foundation';
    const execution = runResolvedPythonTool({
      tool: resolved.scripts.validate,
      args: ['--repo-root', root, '--staging', staging],
      cwd: root,
    });
    if (execution.error || !execution.stdout) {
      throw new Error(execution.error ?? execution.stderr ?? 'legacy validator produced no output');
    }
    const legacy = JSON.parse(execution.stdout);
    const shared = inspectDesignSystemDelivery(root, { requireTracked: false });
    const status = shared.status === 'pass' ? 'pass' : 'fail';
    process.stdout.write(
      `${JSON.stringify(
        {
          status,
          canonical_validator: shared,
          legacy_validator: {
            plugin: resolved.manifest,
            status: 'advisory-result',
            violations: legacy.violations ?? [],
          },
        },
        null,
        2,
      )}\n`,
    );
    if (status !== 'pass') process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

function pluginManifest(pluginRoot) {
  for (const relativePath of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const path = join(pluginRoot, relativePath);
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  }
  throw new Error(`plugin manifest is absent: ${pluginRoot}`);
}

export function resolvePluginTool({ specification, explicitRoot, cacheRoot }) {
  const bases = [
    cacheRoot,
    process.env.KANJO_PLUGIN_CACHE_ROOT,
    join(homedir(), '.codex/plugins/cache'),
  ].filter(Boolean);
  if (!specification.versionRange) throw new Error('plugin versionRange is required');
  const capabilities = Object.entries(specification.capabilities ?? {});
  for (const [id, alternatives] of capabilities) {
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      throw new Error(`plugin capability must declare at least one script: ${id}`);
    }
    for (const relativePath of alternatives) {
      if (
        typeof relativePath !== 'string' ||
        isAbsolute(relativePath) ||
        relativePath.split(/[\\/]/).includes('..')
      ) {
        throw new Error(`plugin script must stay within plugin root: ${relativePath}`);
      }
    }
  }
  const parents = bases.flatMap((base) => [
    join(resolve(base), specification.publisher ?? 'harness-dev', specification.name),
    join(resolve(base), specification.name),
  ]);
  const candidates = explicitRoot
    ? [resolve(explicitRoot)]
    : parents.flatMap((parent) =>
        existsSync(parent)
          ? readdirSync(parent, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => join(parent, entry.name))
          : [],
      );
  let rangeCompatibleCount = 0;
  const capable = candidates.flatMap((root) => {
    try {
      const manifest = pluginManifest(root);
      if (manifest.name !== specification.name || !satisfies(manifest.version, specification.versionRange)) {
        return [];
      }
      rangeCompatibleCount += 1;
      const scripts = {};
      for (const [id, alternatives] of capabilities) {
        const relativePath = alternatives.find((candidate) => existsSync(join(root, candidate)));
        if (!relativePath) return [];
        scripts[id] = join(root, relativePath);
      }
      return [{ root, manifest, scripts }];
    } catch {
      return [];
    }
  });
  capable.sort((left, right) => compareVersions(right.manifest.version, left.manifest.version));
  const selected = capable[0];
  if (!selected) {
    if (rangeCompatibleCount > 0) {
      const absent = capabilities
        .map(([id, alternatives]) => `${id} (${alternatives.join(' | ')})`)
        .join(', ');
      throw new Error(`plugin script is absent from every compatible install: ${absent}`);
    }
    const found = candidates.flatMap((candidate) => {
      try {
        return [pluginManifest(candidate).version];
      } catch {
        return [];
      }
    });
    throw new Error(
      `plugin ${specification.name} is not compatible with ${specification.versionRange}; found [${found.join(', ')}]`,
    );
  }
  const { root, manifest, scripts } = selected;
  return { root, manifest: { name: manifest.name, version: manifest.version }, scripts };
}

function tuple(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`unsupported plugin version: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = tuple(left);
  const b = tuple(right);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function satisfies(version, range) {
  return range
    .split(/\s+/)
    .filter(Boolean)
    .every((clause) => {
      const match = clause.match(/^(>=|>|<=|<|=)(\d+\.\d+\.\d+)$/);
      if (!match) throw new Error(`unsupported version range: ${range}`);
      const comparison = compareVersions(version, match[2]);
      return match[1] === '>='
        ? comparison >= 0
        : match[1] === '>'
          ? comparison > 0
          : match[1] === '<='
            ? comparison <= 0
            : match[1] === '<'
              ? comparison < 0
              : comparison === 0;
    });
}

export function runResolvedPythonTool({ tool, args, cwd }) {
  const result = spawnSync('python3', [tool, ...args], { cwd, encoding: 'utf8' });
  return {
    exit_code: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    error: result.error?.message ?? null,
  };
}

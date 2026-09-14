#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectDesignSystemDelivery } from './check-design-system-delivery.mjs';
import { deriveGoalSpec, validateCanonicalGraph } from './design-system-delivery-core.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const feature = 'feat-design-system-foundation';
const plan = `.dev-graph/plans/feature-package-${feature}`;
const taskNames = [
  'requirements',
  'architecture',
  'design-review',
  'test-design',
  'implementation',
  'test-run',
  'acceptance',
  'refactoring-migration',
  'quality-assurance',
  'final-review',
  'evidence',
  'documentation-operations',
  'release-deploy',
];
const baseSourcePaths = [
  'feature-package.json',
  'workstream-inventory.json',
  'task-graph.json',
  ...taskNames.map((name, index) => `task-specs/phase-${String(index + 1).padStart(2, '0')}-${name}.md`),
];
const stagedSourcePaths = [...baseSourcePaths, 'goal-spec.json', 'system-build-handoff.json'].sort(
  (left, right) => left.localeCompare(right, 'en'),
);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
const read = (path) => readFileSync(join(root, path));
const readText = (path) => read(path).toString('utf8');
const readJson = (path) => JSON.parse(readText(path));

function canonicalDigest(contents) {
  const hash = createHash('sha256');
  for (const path of [...contents.keys()].sort((left, right) => left.localeCompare(right, 'en'))) {
    hash.update(path);
    hash.update('\0');
    hash.update(contents.get(path));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function projectTaskText(source, node) {
  const dependencyJson = JSON.stringify(node.depends_on ?? []);
  const direct = node.depends_on?.[0] ?? null;
  let projected = source.replace(/^depends_on:\s*\[[^\n]*\]\s*$/m, `depends_on: ${dependencyJson}`);
  if (/^(?:- )?lifecycle_role:/m.test(projected)) {
    projected = projected.replace(
      /^(- )?lifecycle_role:.*$/m,
      (_match, bullet = '') =>
        `${bullet}lifecycle_role: ${bullet ? '' : '"'}${node.lifecycle_role}${bullet ? '' : '"'}`,
    );
  } else if (/^phase_ref:/m.test(projected)) {
    projected = projected.replace(/^(phase_ref:\s*[^\n]+)$/m, `$1\nlifecycle_role: "${node.lifecycle_role}"`);
  } else {
    projected = projected.replace(
      /^(- phase_ref:\s*[^\n]+)$/m,
      `$1\n- lifecycle_role: ${node.lifecycle_role}`,
    );
  }
  projected = projected.replace(/^- Dependencies:.*$/m, `- Dependencies: ${direct ?? 'none'}`);
  if (direct) {
    projected = projected
      .replace(/Entry gate: 依存 task \([^)]*\)/g, `Entry gate: 依存 task (${direct})`)
      .replace(/Parallel safety: depends_on \([^)]*\)/g, `Parallel safety: depends_on (${direct})`);
  }
  return projected;
}

function renderPlanMarkdown(nodes) {
  const edgeCount = nodes.reduce((total, node) => total + (node.depends_on?.length ?? 0), 0);
  return `# task-progress (canonical projection)

> task-graph.json から生成する派生ビュー。手編集しない。

- 全 ${nodes.length} タスク・${edgeCount} 依存エッジ
${nodes.map((node) => `- ☐ \`${node.id}\` ${node.title} (depends_on: ${node.depends_on.length ? node.depends_on.join(', ') : 'none'}; role: ${node.lifecycle_role})`).join('\n')}
`;
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function renderPlanReport(nodes) {
  const rows = nodes
    .map(
      (node) =>
        `<tr><td><code>${escapeHtml(node.id)}</code></td><td>${escapeHtml(node.title)}</td><td>${escapeHtml(node.lifecycle_role)}</td><td>${node.depends_on.map((dependency) => `<code>${escapeHtml(dependency)}</code>`).join(' ') || '<span>root</span>'}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Design-system task graph</title></head>
<body>
<main>
<section aria-labelledby="rel-title"><h2 id="rel-title">relationships</h2>
<table><thead><tr><th>id</th><th>title</th><th>role</th><th>depends_on</th></tr></thead><tbody>
${rows}
</tbody></table></section>
<section aria-labelledby="sources-title"><h2 id="sources-title">sources</h2>
<a href="task-graph.json"><strong>task-graph.json</strong></a>
</section>
</main>
</body></html>
`;
}

function renderRepositoryGraph(nodes) {
  const path = '.dev-graph/render/graph.html';
  const html = readText(path);
  const payloadPattern = /(<script type="application\/json" id="graph-data">)([\s\S]*?)(<\/script>)/;
  const match = html.match(payloadPattern);
  if (!match) throw new Error('tracked graph render graph-data payload is absent');
  const existing = JSON.parse(match[2]);
  const previous = new Map(
    existing.filter((entry) => entry.parent_feature === feature).map((entry) => [entry.id, entry]),
  );
  const featureNodes = nodes.map((node) => ({
    ...(previous.get(node.id) ?? {}),
    depends_on: node.depends_on,
    id: node.id,
    kind: 'task',
    parent_feature: feature,
    progress: previous.get(node.id)?.progress ?? null,
    status: previous.get(node.id)?.status ?? 'active',
    title: node.title,
  }));
  const allNodes = [...existing.filter((entry) => entry.parent_feature !== feature), ...featureNodes];
  return html.replace(payloadPattern, `$1${JSON.stringify(allNodes)}$3`);
}

function buildProjections() {
  const projected = new Map();
  const graphPath = `${plan}/task-graph.json`;
  const graph = readJson(graphPath);
  const graphViolations = validateCanonicalGraph(graph.nodes ?? []);
  if (graphViolations.length)
    throw new Error(`canonical task graph is invalid: ${graphViolations.join('; ')}`);
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  projected.set('.dev-graph/render/graph.html', Buffer.from(renderRepositoryGraph(nodes)));

  const goalPath = `${plan}/goal-spec.json`;
  const goal = deriveGoalSpec(readText(`features/${feature}.md`), readJson(goalPath));
  projected.set(goalPath, Buffer.from(encode(goal)));

  for (const [index, name] of taskNames.entries()) {
    const node = nodes.find((candidate) => candidate.phase_ref === `P${String(index + 1).padStart(2, '0')}`);
    if (!node) throw new Error(`canonical node is absent for phase ${index + 1}`);
    const specPath = `${plan}/task-specs/phase-${String(index + 1).padStart(2, '0')}-${name}.md`;
    const taskPath = `tasks/${feature}/${node.id.toLowerCase()}.md`;
    projected.set(specPath, Buffer.from(projectTaskText(readText(specPath), node)));
    projected.set(taskPath, Buffer.from(projectTaskText(readText(taskPath), node)));
  }

  const inventoryPath = `${plan}/workstream-inventory.json`;
  const inventory = readJson(inventoryPath);
  inventory.tasks = (inventory.tasks ?? []).map((task) => {
    const node = byId.get(task.id);
    if (!node) throw new Error(`inventory contains non-canonical task: ${task.id}`);
    const { lifecycle_role: _legacyProjectionField, ...compatibleTask } = task;
    return {
      ...compatibleTask,
      depends_on: node.depends_on,
      title: node.title,
    };
  });
  projected.set(inventoryPath, Buffer.from(encode(inventory)));

  const planMarkdownPath = `${plan}/plan-structure.md`;
  projected.set(planMarkdownPath, Buffer.from(renderPlanMarkdown(nodes)));
  const planStatusPath = `${plan}/plan-structure-status.json`;
  const previousStatus = readJson(planStatusPath);
  projected.set(
    planStatusPath,
    Buffer.from(
      encode({
        ...previousStatus,
        _generated: 'regenerate-design-system-delivery.mjs (task-graph.json projection)',
        nodes: nodes.map((node) => ({
          id: node.id,
          title: node.title,
          phase_ref: node.phase_ref,
          lifecycle_role: node.lifecycle_role,
          depends_on: node.depends_on,
          entity_ref: previousStatus.nodes?.find((entry) => entry.id === node.id)?.entity_ref ?? null,
          state: previousStatus.nodes?.find((entry) => entry.id === node.id)?.state ?? 'pending',
        })),
      }),
    ),
  );
  projected.set(`${plan}/plan-structure-report.html`, Buffer.from(renderPlanReport(nodes)));

  const contentAt = (relativePath) =>
    projected.get(`${plan}/${relativePath}`) ?? read(`${plan}/${relativePath}`);
  const handoffPath = `${plan}/system-build-handoff.json`;
  const handoff = readJson(handoffPath);
  handoff.execution_tasks = (handoff.execution_tasks ?? []).map((task) => {
    const node = byId.get(task.task_id);
    if (!node) throw new Error(`handoff contains non-canonical task: ${task.task_id}`);
    const { lifecycle_role: _legacyProjectionField, ...compatibleTask } = task;
    return { ...compatibleTask, depends_on: node.depends_on };
  });
  handoff.source_inputs = baseSourcePaths.map((path) => ({ path, sha256: sha256(contentAt(path)) }));
  handoff.source_manifest = {
    ...(handoff.source_manifest ?? {}),
    canonical_digest_before_handoff: canonicalDigest(
      new Map(baseSourcePaths.map((path) => [path, contentAt(path)])),
    ),
  };
  projected.set(handoffPath, Buffer.from(encode(handoff)));

  const stagedContents = new Map(stagedSourcePaths.map((path) => [path, contentAt(path)]));
  const staging = {
    schema_version: '2.0.0',
    canonical_source: 'task-graph.json',
    canonical_digest: canonicalDigest(stagedContents),
    files: Object.fromEntries([...stagedContents].map(([path, bytes]) => [path, sha256(bytes)])),
    handoff_contract: {
      schema_version: '1.0.0',
      path: 'system-build-handoff.json',
      sha256: sha256(stagedContents.get('system-build-handoff.json')),
      source_canonical_digest: canonicalDigest(
        new Map(baseSourcePaths.map((path) => [path, contentAt(path)])),
      ),
      manifest_is_commit_point: true,
      self_reference_policy: 'handoff hash and final digest are manifest-only',
    },
  };
  projected.set(`${plan}/staging-manifest.json`, Buffer.from(encode(staging)));
  return { projected, graph, staging };
}

function writeAtomic(path, bytes) {
  const target = join(root, path);
  const temporary = `${target}.phase3-tmp`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, target);
}

function main() {
  const apply = process.argv.includes('--apply');
  if (process.argv.includes('--restore-registered') || process.argv.includes('--recover')) {
    throw new Error('inverse import is isolated in recover-design-system-delivery.mjs');
  }
  const { projected, graph, staging } = buildProjections();
  const changes = [...projected]
    .filter(([path, bytes]) => !read(path).equals(bytes))
    .map(([path]) => path)
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (!apply) {
    process.stdout.write(
      `${JSON.stringify({
        status: 'preview',
        mode: 'canonical-to-projections',
        canonical_source: `${plan}/task-graph.json`,
        external_write_count: 0,
        ignored_local_write_count: 0,
        changes,
        canonical_edge_count: graph.nodes.reduce((total, node) => total + node.depends_on.length, 0),
        staging_digest: staging.canonical_digest,
      })}\n`,
    );
    return;
  }
  for (const path of changes) writeAtomic(path, projected.get(path));
  const strict = inspectDesignSystemDelivery(root, { requireTracked: false });
  if (strict.status !== 'pass')
    throw new Error(`shared delivery verification failed: ${strict.violations.join('; ')}`);
  process.stdout.write(
    `${JSON.stringify({
      status: 'regenerated',
      mode: 'canonical-to-projections',
      canonical_source: `${plan}/task-graph.json`,
      external_write_count: 0,
      ignored_local_write_count: 0,
      changes,
      staging_digest: staging.canonical_digest,
      freshness: 'worktree-content-pass',
      repository_tracking: strict.shared_inputs.status,
    })}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

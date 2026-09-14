#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveGoalSpec,
  validateCanonicalGraph,
  verifySharedInputs,
} from './design-system-delivery-core.mjs';

const FEATURE = 'feat-design-system-foundation';
const PACKAGE = `feature-package/${FEATURE}`;
const PLAN = `.dev-graph/plans/feature-package-${FEATURE}`;
const EXPECTED_SOURCE_PATHS = [
  'feature-package.json',
  'goal-spec.json',
  'system-build-handoff.json',
  'task-graph.json',
  ...Array.from(
    { length: 13 },
    (_, index) =>
      `task-specs/phase-${String(index + 1).padStart(2, '0')}-${
        [
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
        ][index]
      }.md`,
  ),
  'workstream-inventory.json',
].sort();
export const SHARED_REQUIRED_PATHS = [
  `features/${FEATURE}.md`,
  `${PLAN}/task-graph.json`,
  `${PLAN}/goal-spec.json`,
  ...EXPECTED_SOURCE_PATHS.map((path) => `${PLAN}/${path}`),
  ...Array.from(
    { length: 13 },
    (_, index) => `tasks/${FEATURE}/sys-dsfound-p${String(index + 1).padStart(2, '0')}.md`,
  ),
  '.dev-graph/render/graph.html',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sorted = (values) => [...values].sort((left, right) => left.localeCompare(right, 'en'));

export function canonicalEdgeMap(nodes, identity) {
  return new Map(
    nodes.map((node) => [identity(node), sorted(Array.isArray(node.depends_on) ? node.depends_on : [])]),
  );
}

export function compareEdgeProjection(expected, nodes, identity) {
  const actual = canonicalEdgeMap(nodes, identity);
  const violations = [];
  const missing = sorted([...expected.keys()].filter((id) => !actual.has(id)));
  const extra = sorted([...actual.keys()].filter((id) => !expected.has(id)));
  if (missing.length || extra.length) {
    violations.push(`node exact set differs: missing [${missing.join(',')}], extra [${extra.join(',')}]`);
  }
  for (const [id, dependencies] of expected) {
    if (!actual.has(id)) continue;
    const got = actual.get(id);
    if (JSON.stringify(dependencies) !== JSON.stringify(got)) {
      violations.push(
        `${id} depends_on differs: expected [${dependencies.join(',')}], actual [${got.join(',')}]`,
      );
    }
  }
  return violations;
}

export function parsePlanReportProjection(html) {
  const relationshipsAt = html.indexOf('id="rel-title"');
  const relationshipSectionAt = html.lastIndexOf('<section', relationshipsAt);
  const relationshipSectionEnd = html.indexOf('</section>', relationshipsAt);
  if (relationshipsAt < 0 || relationshipSectionAt < 0 || relationshipSectionEnd < 0) {
    throw new Error('plan report relationship section is absent');
  }
  const relationshipSection = html.slice(relationshipSectionAt, relationshipSectionEnd);
  const nodes = [...relationshipSection.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].flatMap((row) => {
    const cells = [...(row[1] ?? '').matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) => cell[1] ?? '');
    if (cells.length !== 4) return [];
    const id = cells[0]?.match(/<code>([^<]+)<\/code>/)?.[1];
    if (!id) return [];
    const dependsOn = [...(cells[3] ?? '').matchAll(/<code>([^<]+)<\/code>/g)].map(
      (dependency) => dependency[1],
    );
    return [{ id, depends_on: sorted(dependsOn) }];
  });
  const sourcesAt = html.indexOf('id="sources-title"');
  const sourcesSectionAt = html.lastIndexOf('<section', sourcesAt);
  const sourcesSectionEnd = html.indexOf('</section>', sourcesAt);
  if (sourcesAt < 0 || sourcesSectionAt < 0 || sourcesSectionEnd < 0) {
    throw new Error('plan report source section is absent');
  }
  const sourcesSection = html.slice(sourcesSectionAt, sourcesSectionEnd);
  const canonicalSourceHref = sourcesSection.match(
    /<a[^>]+href="([^"]+)"[^>]*><strong>task-graph\.json<\/strong>/,
  )?.[1];
  if (!canonicalSourceHref) throw new Error('plan report canonical source link is absent');
  return { nodes, canonical_source_href: canonicalSourceHref };
}

export function verifyStagingHashes(manifest, contents) {
  const recorded = new Map(Object.entries(manifest.files ?? {}));
  const expectedPaths = sorted(contents.keys());
  const recordedPaths = sorted(recorded.keys());
  const missing = expectedPaths.filter((path) => !recorded.has(path));
  const extra = recordedPaths.filter((path) => !contents.has(path));
  const violations = [];
  if (missing.length || extra.length) {
    violations.push(
      `staging manifest exact path set differs: missing [${missing.join(',')}], extra [${extra.join(',')}]`,
    );
  }
  for (const path of expectedPaths) {
    if (recorded.has(path) && recorded.get(path).replace(/^sha256:/, '') !== sha256(contents.get(path))) {
      violations.push(`staging hash differs: ${path}`);
    }
  }
  return violations;
}

function json(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function frontmatterTask(root, path) {
  const source = readFileSync(join(root, path), 'utf8');
  const id = source.match(/^graph_node_id:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim();
  const raw = source.match(/^depends_on:\s*(\[[^\n]*\])\s*$/m)?.[1];
  if (!id || !raw) throw new Error(`task frontmatter identity/dependency is absent: ${path}`);
  return { id, depends_on: JSON.parse(raw) };
}

export function renderNodes(root) {
  const html = readFileSync(join(root, '.dev-graph/render/graph.html'), 'utf8');
  const raw = html.match(/<script type="application\/json" id="graph-data">([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new Error('render graph-data payload is absent');
  return JSON.parse(raw).filter((node) => node.parent_feature === FEATURE);
}

export function inspectRepositoryTracking(root, paths) {
  const requested = sorted(new Set(paths));
  const tracked = new Set(
    execFileSync('git', ['ls-files', '-z', '--', ...requested], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean),
  );
  const ignored = new Set(
    requested.filter(
      (path) =>
        spawnSync('git', ['check-ignore', '--no-index', '-q', '--', path], { cwd: root }).status === 0,
    ),
  );
  const untracked = requested.filter((path) => !tracked.has(path) && !ignored.has(path));
  return {
    status: ignored.size ? 'blocked-ignored' : untracked.length ? 'pending-untracked' : 'tracked',
    tracked: sorted(tracked),
    untracked,
    ignored: sorted(ignored),
  };
}

function canonicalDigest(contents) {
  const hash = createHash('sha256');
  for (const path of sorted(contents.keys())) {
    hash.update(path);
    hash.update('\0');
    hash.update(contents.get(path));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

export function inspectDesignSystemDelivery(root, { requireTracked = true } = {}) {
  const violations = [];
  const graph = json(root, `${PLAN}/task-graph.json`);
  violations.push(...validateCanonicalGraph(graph.nodes ?? []).map((detail) => `canonical graph: ${detail}`));
  const expected = canonicalEdgeMap(graph.nodes ?? [], (node) => node.id);
  if (expected.size !== 13) violations.push(`canonical task count must be 13, got ${expected.size}`);
  const expectedDigest = `sha256:${sha256(JSON.stringify(Object.fromEntries(expected)))}`;
  const compare = (label, nodes, identity) => {
    for (const detail of compareEdgeProjection(expected, nodes, identity)) {
      violations.push(`${label}: ${detail}`);
    }
  };

  const taskDocs = sorted([...expected.keys()]).map((id) =>
    frontmatterTask(root, `tasks/${FEATURE}/${id.toLowerCase()}.md`),
  );
  compare('task docs', taskDocs, (node) => node.id);

  const handoff = json(root, `${PLAN}/system-build-handoff.json`);
  compare(
    'system handoff',
    (handoff.execution_tasks ?? []).map((node) => ({ id: node.task_id, depends_on: node.depends_on })),
    (node) => node.id,
  );

  const inventory = json(root, `${PLAN}/workstream-inventory.json`);
  compare('workstream inventory', inventory.tasks ?? [], (node) => node.id);
  compare('tracked graph render', renderNodes(root), (node) => node.id);

  const goalSpec = json(root, `${PLAN}/goal-spec.json`);
  const featureSource = readFileSync(join(root, `features/${FEATURE}.md`), 'utf8');
  const derivedGoal = deriveGoalSpec(featureSource, goalSpec);
  for (const field of ['purpose', 'goal', 'scope_in', 'scope_out', 'acceptance']) {
    if (JSON.stringify(goalSpec[field]) !== JSON.stringify(derivedGoal[field])) {
      violations.push(`goal spec semantic field differs from feature source: ${field}`);
    }
  }

  const planMarkdown = readFileSync(join(root, `${PLAN}/plan-structure.md`), 'utf8');
  const edgeCount = [...expected.values()].reduce((total, deps) => total + deps.length, 0);
  if (!planMarkdown.includes(`全 13 タスク・${edgeCount} 依存エッジ`)) {
    violations.push(`plan structure does not declare the canonical ${edgeCount} dependency edges`);
  }
  const planMarkdownIds = [...planMarkdown.matchAll(/^- [✓▶✗☐] `([^`]+)`/gm)].map((match) => match[1]);
  const expectedIds = sorted(expected.keys());
  if (JSON.stringify(sorted(planMarkdownIds)) !== JSON.stringify(expectedIds)) {
    violations.push('plan structure markdown node exact set differs');
  }

  const planStatus = json(root, `${PLAN}/plan-structure-status.json`);
  const planStatusIds = (planStatus.nodes ?? []).map((node) => node.id);
  if (JSON.stringify(sorted(planStatusIds)) !== JSON.stringify(expectedIds)) {
    violations.push('plan structure status node exact set differs');
  }

  const planReportPath = `${PLAN}/plan-structure-report.html`;
  const planReport = parsePlanReportProjection(readFileSync(join(root, planReportPath), 'utf8'));
  compare('plan structure report', planReport.nodes, (node) => node.id);
  if (planReport.canonical_source_href !== 'task-graph.json') {
    violations.push(`plan structure report canonical source differs: ${planReport.canonical_source_href}`);
  } else if (!existsSync(join(root, PLAN, planReport.canonical_source_href))) {
    violations.push('plan structure report canonical source is absent');
  }

  const manifest = json(root, `${PLAN}/staging-manifest.json`);
  const contents = new Map(EXPECTED_SOURCE_PATHS.map((path) => [path, readFileSync(join(root, PLAN, path))]));
  violations.push(...verifyStagingHashes(manifest, contents));
  const digest = canonicalDigest(contents);
  if (manifest.canonical_digest !== digest) {
    violations.push(
      `staging canonical digest differs: expected ${digest}, actual ${manifest.canonical_digest}`,
    );
  }
  const tracking = inspectRepositoryTracking(root, SHARED_REQUIRED_PATHS);
  if (tracking.ignored.length) {
    violations.push(...tracking.ignored.map((path) => `shared input is ignored: ${path}`));
  }
  if (requireTracked && tracking.untracked.length) {
    violations.push(...tracking.untracked.map((path) => `shared input is untracked: ${path}`));
  }

  return {
    status: violations.length === 0 ? 'pass' : 'fail',
    canonical_edge_digest: expectedDigest,
    staging_digest: digest,
    shared_inputs: tracking,
    violations,
  };
}

/** Ignored local graph/external tracker parity is informative and never contributes to the shared PASS. */
export function inspectMaintainerParity(root) {
  const shared = inspectDesignSystemDelivery(root);
  const expected = canonicalEdgeMap(json(root, `${PLAN}/task-graph.json`).nodes ?? [], (node) => node.id);
  const checks = [
    {
      label: 'local graph state',
      path: '.dev-graph/state/graph.json',
      nodes: (payload) => (payload.nodes ?? []).filter((node) => node.feature_package_id === PACKAGE),
      identity: (node) => node.graph_node_id ?? node.id,
    },
    {
      label: 'beads desired projection',
      path: `.dev-graph/state/beads-projection-${FEATURE}.json`,
      nodes: (payload) => payload.children ?? [],
      identity: (node) => node.graph_node_id,
    },
    {
      label: 'beads parity',
      path: `.dev-graph/state/beads-parity-${FEATURE}.json`,
      nodes: (payload) => payload.nodes ?? [],
      identity: (node) => node.graph_node_id,
    },
  ];
  const details = [];
  for (const check of checks) {
    if (!existsSync(join(root, check.path))) {
      details.push(`${check.label}: pending (local/ignored input absent)`);
      continue;
    }
    for (const violation of compareEdgeProjection(
      expected,
      check.nodes(json(root, check.path)),
      check.identity,
    )) {
      details.push(`${check.label}: stale (${violation})`);
    }
  }
  const registration = json(root, `${PLAN}/dev-graph-registration.json`);
  for (const violation of compareEdgeProjection(
    expected,
    registration.nodes ?? [],
    (node) => node.graph_node_id ?? node.id,
  )) {
    details.push(`historical registration receipt: stale (${violation})`);
  }
  return {
    status: details.length === 0 ? 'fresh' : 'pending-or-stale',
    shared_status: shared.status,
    contributes_to_shared_gate: false,
    details,
  };
}

const root = join(fileURLToPath(import.meta.url), '..', '..');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.includes('--maintainer')) {
      const result = inspectMaintainerParity(root);
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'fresh') process.exitCode = 1;
      process.exit();
    }
    const contentOnly = process.argv.includes('--worktree-content');
    const result = inspectDesignSystemDelivery(root, { requireTracked: !contentOnly });
    if (result.status === 'pass') {
      console.log(
        `check-design-system-delivery: 13 canonical nodes, graph render, goal spec, and 18 staging hashes match; repository tracking=${result.shared_inputs.status}.`,
      );
    } else {
      for (const violation of result.violations) console.error(`check-design-system-delivery: ${violation}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`check-design-system-delivery: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

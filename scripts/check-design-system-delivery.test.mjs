import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  SHARED_REQUIRED_PATHS,
  canonicalEdgeMap,
  compareEdgeProjection,
  inspectRepositoryTracking,
  parsePlanReportProjection,
  verifyStagingHashes,
} from './check-design-system-delivery.mjs';

test('shared gate has a clean-checkout input set with no ignored/local provenance dependency', () => {
  assert.equal(
    SHARED_REQUIRED_PATHS.some((path) => path.startsWith('.dev-graph/state/')),
    false,
  );
  assert.equal(SHARED_REQUIRED_PATHS.includes('.dev-graph/render/graph.html'), true);
  assert.equal(
    SHARED_REQUIRED_PATHS.some((path) => path.startsWith('design/FINAL-UI/')),
    false,
  );
  assert.ok(
    SHARED_REQUIRED_PATHS.includes(
      '.dev-graph/plans/feature-package-feat-design-system-foundation/goal-spec.json',
    ),
  );
});

test('repository tracking is queried from git and never fabricated by a caller array', () => {
  const root = mkdtempSync(join(tmpdir(), 'kanjo-delivery-tracking-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Delivery Test'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), 'ignored.json\n');
    writeFileSync(join(root, 'tracked.json'), '{}\n');
    writeFileSync(join(root, 'untracked.json'), '{}\n');
    writeFileSync(join(root, 'ignored.json'), '{}\n');
    execFileSync('git', ['add', '.gitignore', 'tracked.json'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
    assert.deepEqual(inspectRepositoryTracking(root, ['tracked.json', 'untracked.json', 'ignored.json']), {
      status: 'blocked-ignored',
      tracked: ['tracked.json'],
      untracked: ['untracked.json'],
      ignored: ['ignored.json'],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const canonical = {
  nodes: [
    { id: 'P01', depends_on: [] },
    { id: 'P02', depends_on: ['P01'] },
    { id: 'P03', depends_on: ['P01'] },
  ],
};

test('projection comparison uses exact semantic node/dependency sets', () => {
  const expected = canonicalEdgeMap(canonical.nodes, (node) => node.id);
  assert.deepEqual(
    compareEdgeProjection(expected, canonical.nodes, (node) => node.id),
    [],
  );
  assert.deepEqual(
    compareEdgeProjection(
      expected,
      [
        { graph_node_id: 'P01', depends_on: [] },
        { graph_node_id: 'P02', depends_on: ['P01'] },
        { graph_node_id: 'P03', depends_on: ['P02'] },
      ],
      (node) => node.graph_node_id,
    ),
    ['P03 depends_on differs: expected [P01], actual [P02]'],
  );
});

test('staging manifest rejects missing, extra, and stale hashes', () => {
  const contents = new Map([
    ['a.json', Buffer.from('a')],
    ['b.json', Buffer.from('b')],
  ]);
  const good = {
    files: {
      'a.json': 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      'b.json': '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
    },
  };
  assert.deepEqual(verifyStagingHashes(good, contents), []);
  assert.deepEqual(verifyStagingHashes({ files: { ...good.files, 'b.json': '0'.repeat(64) } }, contents), [
    'staging hash differs: b.json',
  ]);
  assert.deepEqual(verifyStagingHashes({ files: { 'a.json': good.files['a.json'] } }, contents), [
    'staging manifest exact path set differs: missing [b.json], extra []',
  ]);
});

test('plan report comparison reads exact semantic edges and its live canonical source', () => {
  const html = `
    <section aria-labelledby="rel-title">
      <h2 id="rel-title">relationships</h2>
      <table><tbody>
        <tr><td><code>P01</code></td><td>one</td><td>—</td><td><span>root</span></td></tr>
        <tr><td><code>P02</code></td><td>two</td><td>—</td><td><code>P01</code></td></tr>
        <tr><td><code>P03</code></td><td>three</td><td>—</td><td><code>P02</code></td></tr>
      </tbody></table>
    </section>
    <section aria-labelledby="sources-title">
      <h2 id="sources-title">sources</h2>
      <a href="task-graph.json"><strong>task-graph.json</strong></a>
    </section>`;
  const projection = parsePlanReportProjection(html);
  assert.deepEqual(projection.nodes, [
    { id: 'P01', depends_on: [] },
    { id: 'P02', depends_on: ['P01'] },
    { id: 'P03', depends_on: ['P02'] },
  ]);
  assert.equal(projection.canonical_source_href, 'task-graph.json');

  const expected = canonicalEdgeMap(canonical.nodes, (node) => node.id);
  assert.deepEqual(
    compareEdgeProjection(expected, projection.nodes, (node) => node.id),
    ['P03 depends_on differs: expected [P01], actual [P02]'],
  );
});

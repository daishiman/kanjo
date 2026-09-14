import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveGoalSpec,
  validateCanonicalGraph,
  verifySharedInputs,
} from './design-system-delivery-core.mjs';

const node = (id, depends_on, lifecycle_role) => ({ id, depends_on, lifecycle_role });

test('canonical graph rejects dangling, self, cycle, and semantic order violations', () => {
  const valid = [
    node('P05', [], 'mutation'),
    node('P06', ['P05'], 'final-verification'),
    node('P09', ['P06'], 'quality-assurance'),
    node('P07', ['P09'], 'acceptance'),
    node('P10', ['P07'], 'independent-review'),
    node('P11', ['P10'], 'evidence'),
    node('P13', ['P11'], 'release'),
  ];
  assert.deepEqual(validateCanonicalGraph(valid), []);
  assert.match(
    validateCanonicalGraph([...valid, node('P99', ['missing'], 'mutation')]).join('\n'),
    /dangling/,
  );
  assert.match(validateCanonicalGraph([node('SELF', ['SELF'], 'mutation')]).join('\n'), /self/);
  assert.match(
    validateCanonicalGraph([node('A', ['B'], 'mutation'), node('B', ['A'], 'mutation')]).join('\n'),
    /cycle/,
  );
  assert.match(
    validateCanonicalGraph([node('P06', [], 'final-verification'), node('P05', ['P06'], 'mutation')]).join(
      '\n',
    ),
    /must precede final-verification/,
  );
});

test('goal spec semantic fields are derived deterministically from the feature source', () => {
  const feature = `---\npurpose: "one"\ngoal: "two"\nscope_in: ["a"]\nscope_out: ["b"]\nacceptance: ["S1"]\n---\n`;
  const previous = { run_id: 'run', feature_id: 'feature', purpose: 'stale', acceptance: [] };
  const first = deriveGoalSpec(feature, previous);
  const second = deriveGoalSpec(feature, previous);
  assert.deepEqual(first, second);
  assert.equal(first.purpose, 'one');
  assert.deepEqual(first.scope_in, ['a']);
  assert.deepEqual(first.acceptance, ['S1']);
});

test('shared input verification does not require ignored provenance or local graph state', () => {
  assert.deepEqual(
    verifySharedInputs({
      trackedPaths: ['task-graph.json', 'goal-spec.json'],
      requiredTrackedPaths: ['goal-spec.json', 'task-graph.json'],
      ignoredLocalPaths: [],
      externalProvenancePaths: [],
    }),
    [],
  );
});

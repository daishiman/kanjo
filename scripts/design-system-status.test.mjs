import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateDesignSystemStatus,
  inspectDeploymentApprovalBinding,
  inspectFullEvidence,
} from './design-system-status.mjs';

const fullCommand = {
  id: 'acceptance-worktree-full-s6-gate',
  executable: 'pnpm',
  args: ['run', 'verify:full'],
};

function passingFullEvidence() {
  return inspectFullEvidence({
    freshness: { status: 'fresh', reasons: [] },
    configuredCommands: [fullCommand],
    verification: { command_receipt_ids: [fullCommand.id] },
    commandReceipts: [{ ...fullCommand, exit_code: 0, spawn_error: null }],
  });
}

function passingInputs() {
  return {
    fullEvidence: passingFullEvidence(),
    tokenIntegrity: {
      status: 'pass',
      approval_subject_digest: 'a'.repeat(64),
      details: [],
    },
    humanApproval: {
      status: 'approved-external',
      authority: 'independent-maintainer',
    },
    repositoryTracking: {
      status: 'tracked',
      tracked: ['features/feat-design-system-foundation.md'],
      untracked: [],
      ignored: [],
    },
    maintainerState: { status: 'fresh', details: [] },
    deploymentBinding: {
      status: 'bound',
      workflow_path: '.github/workflows/deploy.yml',
      approval_subject_digest_bound: true,
      external_approval_bound: true,
      status_gate_bound: true,
    },
  };
}

test('full evidence requires a fresh exact pnpm run verify:full receipt and verification identity', () => {
  assert.equal(passingFullEvidence().status, 'pass');

  const fastOnly = inspectFullEvidence({
    freshness: { status: 'fresh', reasons: [] },
    configuredCommands: [
      {
        id: 'acceptance-worktree-fast-gate',
        executable: 'pnpm',
        args: ['run', 'design-system:fast'],
      },
    ],
    verification: { command_receipt_ids: ['acceptance-worktree-fast-gate'] },
    commandReceipts: [
      {
        id: 'acceptance-worktree-fast-gate',
        executable: 'pnpm',
        args: ['run', 'design-system:fast'],
        exit_code: 0,
        spawn_error: null,
      },
    ],
  });

  assert.equal(fastOnly.status, 'fail');
  assert.equal(fastOnly.command_identity, 'fail');
});

test('release readiness stays blocked when the deploy workflow does not bind external approval', () => {
  const result = aggregateDesignSystemStatus({
    ...passingInputs(),
    deploymentBinding: {
      status: 'absent',
      workflow_path: '.github/workflows/deploy.yml',
      approval_subject_digest_bound: false,
      external_approval_bound: false,
      status_gate_bound: false,
    },
  });

  assert.equal(result.release_readiness, 'blocked');
  assert.deepEqual(
    result.blockers.map(({ id }) => id),
    ['DEPLOYMENT_APPROVAL_BINDING_ABSENT'],
  );
  assert.match(result.next_actions[0].action, /承認対象digest/);
});

test('pending inputs become explicit blockers with deterministic next actions', () => {
  const result = aggregateDesignSystemStatus({
    fullEvidence: {
      status: 'fail',
      freshness: 'stale',
      command_identity: 'fail',
      receipt_status: 'fail',
      reasons: ['configured full gate receipt is absent'],
    },
    tokenIntegrity: {
      status: 'fail',
      approval_subject_digest: 'b'.repeat(64),
      details: ['token digest differs'],
    },
    humanApproval: {
      status: 'pending-external',
      authority: 'independent-maintainer',
    },
    repositoryTracking: {
      status: 'pending-untracked',
      tracked: [],
      untracked: ['docs/design-system.md'],
      ignored: [],
    },
    maintainerState: {
      status: 'pending-or-stale',
      details: ['external tracker parity is pending'],
    },
    deploymentBinding: {
      status: 'absent',
      workflow_path: '.github/workflows/deploy.yml',
      approval_subject_digest_bound: false,
      external_approval_bound: false,
      status_gate_bound: false,
    },
  });

  assert.equal(result.release_readiness, 'blocked');
  assert.deepEqual(
    result.blockers.map(({ id }) => id),
    [
      'FULL_EVIDENCE_NOT_CURRENT',
      'TOKEN_INTEGRITY_FAILED',
      'EXTERNAL_HUMAN_APPROVAL_PENDING',
      'REPOSITORY_TRACKING_INCOMPLETE',
      'MAINTAINER_EXTERNAL_STATE_PENDING',
      'DEPLOYMENT_APPROVAL_BINDING_ABSENT',
    ],
  );
  assert.equal(result.next_actions.length, result.blockers.length);
  assert.equal(result.checks.repository_tracking.untracked_count, 1);
});

test('release readiness is ready only when every machine and external boundary passes', () => {
  const result = aggregateDesignSystemStatus(passingInputs());

  assert.equal(result.release_readiness, 'ready');
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.next_actions, []);
});

test('deployment binding rejects a generic production environment and requires all three bindings', () => {
  const currentShape = inspectDeploymentApprovalBinding({
    workflowSource: 'environment: production\nrun: pnpm test\n',
    workflowPath: '.github/workflows/deploy.yml',
  });
  assert.equal(currentShape.status, 'absent');

  const bound = inspectDeploymentApprovalBinding({
    workflowSource: `
      - name: Verify external design-system approval
        env:
          APPROVAL_SUBJECT_DIGEST_PATH: docs/design-system/token-approval.json
          EXTERNAL_APPROVAL_RECEIPT: \${{ secrets.DESIGN_SYSTEM_APPROVAL_RECEIPT }}
        run: pnpm run design-system:status
    `,
    workflowPath: '.github/workflows/deploy.yml',
  });
  assert.deepEqual(bound, {
    status: 'bound',
    workflow_path: '.github/workflows/deploy.yml',
    approval_subject_digest_bound: true,
    external_approval_bound: true,
    status_gate_bound: true,
  });
});

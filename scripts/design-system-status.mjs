#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { verifyChangedPathManifest } from './changed-path-manifest.mjs';
import {
  SHARED_REQUIRED_PATHS,
  inspectMaintainerParity,
  inspectRepositoryTracking,
} from './check-design-system-delivery.mjs';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FULL_GATE = Object.freeze({ executable: 'pnpm', args: ['run', 'verify:full'] });

function sameCommand(left, right) {
  return (
    left?.executable === right.executable && JSON.stringify(left?.args ?? []) === JSON.stringify(right.args)
  );
}

export function inspectFullEvidence({
  freshness,
  configuredCommands = [],
  verification = {},
  commandReceipts = [],
}) {
  const reasons = [...(freshness?.reasons ?? [])];
  const configured = configuredCommands.find((command) => sameCommand(command, FULL_GATE));
  const configuredIds = configuredCommands.map((command) => command.id);
  const verificationIds = Array.isArray(verification.command_receipt_ids)
    ? verification.command_receipt_ids
    : [];
  const receipt = configured
    ? commandReceipts.find((candidate) => candidate.id === configured.id)
    : undefined;

  if (freshness?.status !== 'fresh') reasons.push('changed-path evidence is not fresh');
  if (!configured) reasons.push('configured pnpm run verify:full command is absent');
  if (JSON.stringify(configuredIds) !== JSON.stringify(verificationIds)) {
    reasons.push('verification command ids differ from configured commands');
  }
  if (!receipt || !sameCommand(receipt, FULL_GATE)) {
    reasons.push('configured full gate receipt is absent or has a different command identity');
  }
  if (receipt && (receipt.exit_code !== 0 || receipt.spawn_error !== null)) {
    reasons.push('configured full gate receipt did not pass');
  }

  const commandIdentityPass =
    Boolean(configured) &&
    Boolean(receipt && sameCommand(receipt, FULL_GATE)) &&
    JSON.stringify(configuredIds) === JSON.stringify(verificationIds);
  const receiptPass = Boolean(receipt && receipt.exit_code === 0 && receipt.spawn_error === null);

  return {
    status: freshness?.status === 'fresh' && commandIdentityPass && receiptPass ? 'pass' : 'fail',
    freshness: freshness?.status === 'fresh' ? 'fresh' : 'stale',
    command_identity: commandIdentityPass ? 'pass' : 'fail',
    receipt_status: receiptPass ? 'pass' : 'fail',
    required_command: FULL_GATE,
    configured_command_id: configured?.id ?? null,
    reasons: [...new Set(reasons)].sort((left, right) => left.localeCompare(right, 'en')),
  };
}

export function inspectDeploymentApprovalBinding({ workflowSource, workflowPath }) {
  const approvalSubjectDigestBound = /approval[_-]subject[_-]digest/i.test(workflowSource);
  const externalApprovalBound = /external[_-]approval[_-](receipt|attestation)/i.test(workflowSource);
  const statusGateBound = /pnpm\s+(?:run\s+)?design-system:status\b/.test(workflowSource);
  return {
    status: approvalSubjectDigestBound && externalApprovalBound && statusGateBound ? 'bound' : 'absent',
    workflow_path: workflowPath,
    approval_subject_digest_bound: approvalSubjectDigestBound,
    external_approval_bound: externalApprovalBound,
    status_gate_bound: statusGateBound,
  };
}

function blocker(id, message, action) {
  return { id, message, action };
}

export function aggregateDesignSystemStatus({
  fullEvidence,
  tokenIntegrity,
  humanApproval,
  repositoryTracking,
  maintainerState,
  deploymentBinding,
}) {
  const blockers = [];
  if (fullEvidence.status !== 'pass') {
    blockers.push(
      blocker(
        'FULL_EVIDENCE_NOT_CURRENT',
        '現在のS6 full証跡が無いか古いか、別のコマンドに結び付いています。',
        'pnpm run evidence:acceptance を実行し、pnpm run verify:full の最新receiptを保持する。',
      ),
    );
  }
  if (tokenIntegrity.status !== 'pass') {
    blockers.push(
      blocker(
        'TOKEN_INTEGRITY_FAILED',
        '機械検証でtoken値・export・projection・由来のいずれかに差分があります。',
        'token integrityの差分を修正し、pnpm run design-system:status を再実行する。',
      ),
    );
  }
  if (humanApproval.status !== 'approved-external') {
    blockers.push(
      blocker(
        'EXTERNAL_HUMAN_APPROVAL_PENDING',
        `承認対象digest ${tokenIntegrity.approval_subject_digest} の独立承認は ${humanApproval.status ?? 'absent'} です。`,
        '独立maintainerが外部の信頼境界で正確な承認対象digestを承認する。',
      ),
    );
  }
  if (repositoryTracking.status !== 'tracked') {
    blockers.push(
      blocker(
        'REPOSITORY_TRACKING_INCOMPLETE',
        `共有入力の厳密な追跡状態は ${repositoryTracking.status} です。`,
        '許可された共有入力だけを通常のレビュー可能な変更に含める。無視・保護パスを強制追加しない。',
      ),
    );
  }
  if (maintainerState.status !== 'fresh') {
    blockers.push(
      blocker(
        'MAINTAINER_EXTERNAL_STATE_PENDING',
        `maintainer専用のlocal/external parityは ${maintainerState.status} です。`,
        '権限を持つmaintainerがlocal graphと外部tracker projectionを再同期する。',
      ),
    );
  }
  if (deploymentBinding.status !== 'bound') {
    blockers.push(
      blocker(
        'DEPLOYMENT_APPROVAL_BINDING_ABSENT',
        'リポジトリの配信workflowが外部承認と承認対象digestを結び付けていません。',
        '配信workflowで外部承認receiptと承認対象digestを結び、公開前にこのstatus gateを実行する。',
      ),
    );
  }

  return {
    schema_version: '1.0.0',
    release_readiness: blockers.length === 0 ? 'ready' : 'blocked',
    approval_subject_digest: tokenIntegrity.approval_subject_digest,
    checks: {
      full_evidence: fullEvidence,
      machine_token_integrity: tokenIntegrity,
      external_human_approval: humanApproval,
      repository_tracking: {
        status: repositoryTracking.status,
        tracked_count: repositoryTracking.tracked?.length ?? 0,
        untracked_count: repositoryTracking.untracked?.length ?? 0,
        ignored_count: repositoryTracking.ignored?.length ?? 0,
        untracked: repositoryTracking.untracked ?? [],
        ignored: repositoryTracking.ignored ?? [],
      },
      maintainer_external_state: maintainerState,
      deployment_approval_binding: deploymentBinding,
    },
    blockers: blockers.map(({ action: _action, ...entry }) => entry),
    next_actions: blockers.map(({ id, action }) => ({ blocker_id: id, action })),
  };
}

function json(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function collectTokenIntegrity(root, tokenManifest) {
  const result = spawnSync(process.execPath, ['scripts/check-design-tokens.mjs'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const details = [result.stderr, result.error?.message]
    .filter(Boolean)
    .flatMap((value) => value.trim().split('\n'))
    .filter(Boolean);
  return {
    status: result.status === 0 && !result.error ? 'pass' : 'fail',
    approval_subject_digest: tokenManifest?.integrity?.approval_subject_digest ?? null,
    details,
  };
}

export function collectDesignSystemStatus(root = REPOSITORY_ROOT) {
  const manifestPath = join(root, 'docs/design-system/changed-path-manifest.json');
  const commands = json(root, 'scripts/design-system-validation-commands.json');
  const manifest = json(root, 'docs/design-system/changed-path-manifest.json');
  const verification = json(root, 'docs/design-system/verification-run.json');
  const tokenManifest = json(root, 'docs/design-system/token-approval.json');
  const freshness = verifyChangedPathManifest({ repoRoot: root, manifestPath, commands });
  const fullEvidence = inspectFullEvidence({
    freshness,
    configuredCommands: commands,
    verification,
    commandReceipts: manifest.command_receipts,
  });
  const repositoryTracking = inspectRepositoryTracking(root, SHARED_REQUIRED_PATHS);
  let maintainerState;
  try {
    maintainerState = inspectMaintainerParity(root);
  } catch (error) {
    maintainerState = {
      status: 'pending-or-stale',
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
  const workflowPath = '.github/workflows/deploy.yml';
  const deploymentBinding = inspectDeploymentApprovalBinding({
    workflowSource: readFileSync(join(root, workflowPath), 'utf8'),
    workflowPath,
  });
  return aggregateDesignSystemStatus({
    fullEvidence,
    tokenIntegrity: collectTokenIntegrity(root, tokenManifest),
    humanApproval: tokenManifest.humanApproval,
    repositoryTracking,
    maintainerState,
    deploymentBinding,
  });
}

function renderHumanStatus(status) {
  const lines = [
    `Design system 公開準備: ${status.release_readiness === 'ready' ? '完了' : '未完了'}`,
    `承認対象digest: ${status.approval_subject_digest ?? 'absent'}`,
  ];
  if (status.blockers.length === 0) return [...lines, '阻害要因: なし'].join('\n');
  lines.push('阻害要因:');
  for (const entry of status.blockers) lines.push(`- ${entry.id}: ${entry.message}`);
  lines.push('次の対応:');
  for (const [index, entry] of status.next_actions.entries()) {
    lines.push(`${index + 1}. ${entry.action}`);
  }
  return lines.join('\n');
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  try {
    const status = collectDesignSystemStatus();
    process.stdout.write(
      process.argv.includes('--json')
        ? `${JSON.stringify(status, null, 2)}\n`
        : `${renderHumanStatus(status)}\n`,
    );
    if (status.release_readiness !== 'ready') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`design-system-status: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

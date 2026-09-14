import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRunReferenceDocuments } from './check-design-system-run-references.mjs';

const reference = {
  run_id: 'run-current',
  changed_path_manifest: 'manifest.json',
  human_approval: 'pending-external',
  repository_tracking: 'tracked',
};
const verification = {
  run_id: 'run-current',
  changed_path_manifest: 'manifest.json',
  command_receipt_ids: ['fast'],
};
const commands = [{ id: 'fast' }];
const tokenManifest = {
  integrity: { approval_subject_digest: 'subject' },
  humanApproval: { status: 'pending-external' },
};
reference.approval_subject_digest = 'subject';

test('all lifecycle documents derive the run from one reference', () => {
  assert.deepEqual(
    validateRunReferenceDocuments({
      reference,
      verification,
      commands,
      tokenManifest,
      documents: { 'one.md': 'Run reference: `docs/design-system/run-reference.json`\n' },
    }),
    [],
  );
});

test('stale embedded run ids and command drift are rejected', () => {
  const violations = validateRunReferenceDocuments({
    reference,
    verification: { ...verification, command_receipt_ids: ['full'] },
    commands,
    tokenManifest,
    documents: { 'one.md': 'run dsfound-phase3-20260913T234600+0900' },
  });
  assert.match(violations.join('\n'), /canonical run reference/);
  assert.match(violations.join('\n'), /embeds a run id/);
  assert.match(violations.join('\n'), /configured commands/);
});

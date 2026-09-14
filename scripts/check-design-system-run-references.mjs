#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUN_REFERENCE_DOCUMENTS = [
  'docs/design-system/assurance.md',
  'docs/design-system/acceptance.md',
  'docs/design-system/test-run.md',
  'docs/design-system/final-review.md',
  'docs/design-system/evidence.md',
  'docs/design-system/close-out.md',
];

export function validateRunReferenceDocuments({
  reference,
  verification,
  documents,
  commands,
  tokenManifest,
}) {
  const violations = [];
  if (reference.run_id !== verification.run_id)
    violations.push('verification run_id differs from run reference');
  if (reference.changed_path_manifest !== verification.changed_path_manifest) {
    violations.push('changed-path manifest reference differs');
  }
  if (reference.human_approval !== 'pending-external')
    violations.push('human approval is not pending-external');
  if (reference.approval_subject_digest !== tokenManifest.integrity.approval_subject_digest) {
    violations.push('token approval subject differs from run reference');
  }
  if (reference.human_approval !== tokenManifest.humanApproval.status) {
    violations.push('token human approval state differs from run reference');
  }
  if (!['tracked', 'pending-untracked'].includes(reference.repository_tracking)) {
    violations.push('repository tracking status is invalid');
  }
  const commandIds = commands.map((command) => command.id);
  if (JSON.stringify(commandIds) !== JSON.stringify(verification.command_receipt_ids)) {
    violations.push('verification command ids differ from configured commands');
  }
  for (const [path, source] of Object.entries(documents)) {
    if (!source.includes('Run reference: `docs/design-system/run-reference.json`')) {
      violations.push(`${path} does not use the canonical run reference`);
    }
    if (/dsfound-phase3-\d|design-system-foundation-elegant-review-\d/.test(source)) {
      violations.push(`${path} embeds a run id instead of using the canonical reference`);
    }
  }
  return violations.sort((left, right) => left.localeCompare(right, 'en'));
}

export function inspectRunReferences(root) {
  const reference = JSON.parse(readFileSync(join(root, 'docs/design-system/run-reference.json'), 'utf8'));
  const verification = JSON.parse(readFileSync(join(root, reference.verification_run), 'utf8'));
  const commands = JSON.parse(readFileSync(join(root, reference.validation_commands), 'utf8'));
  const tokenManifest = JSON.parse(
    readFileSync(join(root, 'docs/design-system/token-approval.json'), 'utf8'),
  );
  const documents = Object.fromEntries(
    RUN_REFERENCE_DOCUMENTS.map((path) => [path, readFileSync(join(root, path), 'utf8')]),
  );
  return validateRunReferenceDocuments({ reference, verification, documents, commands, tokenManifest });
}

const root = join(fileURLToPath(import.meta.url), '..', '..');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = inspectRunReferences(root);
  if (violations.length) {
    for (const violation of violations) console.error(`run-reference: ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(
      `run-reference: ${RUN_REFERENCE_DOCUMENTS.length} documents use the canonical run reference.`,
    );
  }
}

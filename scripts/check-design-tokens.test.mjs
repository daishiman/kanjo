import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  computeDesignTokenIntegrity,
  validateDesignTokenIntegrityManifest,
  validateDisplayExportCoverage,
} from './check-design-tokens.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('integrity boundary includes token values, export surface, projection policy, and tracked provenance content', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kanjo-token-integrity-'));
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'tracked.md'), 'tracked provenance\n');
    const integrity = computeDesignTokenIntegrity({
      tokenValues: { color: { ink: '#000000' } },
      displayExports: { COLOR: { ink: '#000000' } },
      projectionPolicySource: 'export const adapter = true;\n',
      repoRoot: root,
      provenanceInputs: ['docs/tracked.md'],
      externalReferences: [
        {
          path: 'external.md',
          recordPath: 'docs/tracked.md',
          recordDigest: `sha256:${sha256('tracked provenance\n')}`,
        },
      ],
    });
    assert.equal(integrity.token_values_digest, sha256('{"color":{"ink":"#000000"}}'));
    assert.equal(integrity.projection_policy_digest, sha256('export const adapter = true;\n'));
    assert.match(integrity.display_export_surface_digest, /^[0-9a-f]{64}$/);
    assert.match(integrity.provenance_content_digest, /^[0-9a-f]{64}$/);
    assert.match(integrity.external_reference_digest, /^[0-9a-f]{64}$/);
    assert.match(integrity.approval_subject_digest, /^[0-9a-f]{64}$/);

    const manifest = {
      schemaVersion: 3,
      boundaryVersion: '3.0.0',
      algorithm: 'sha256',
      integrity,
      provenance: {
        contentInputs: ['docs/tracked.md'],
        externalReferences: ['design/FINAL-UI/spec/DESIGN-SYSTEM.md'],
      },
      humanApproval: { status: 'pending-external', authority: 'independent-maintainer' },
    };
    assert.deepEqual(validateDesignTokenIntegrityManifest({ manifest, actual: integrity }), []);
    assert.equal(readFileSync(join(root, 'docs', 'tracked.md'), 'utf8'), 'tracked provenance\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('external provenance is an explicit maintainer reference, not a shared-gate file dependency', () => {
  const integrity = {
    token_values_digest: '1'.repeat(64),
    projection_policy_digest: '2'.repeat(64),
    provenance_content_digest: '3'.repeat(64),
    display_export_surface_digest: '4'.repeat(64),
    external_reference_digest: '5'.repeat(64),
    approval_subject_digest: '6'.repeat(64),
  };
  const manifest = {
    schemaVersion: 3,
    boundaryVersion: '3.0.0',
    algorithm: 'sha256',
    integrity,
    provenance: { contentInputs: ['tracked.md'], externalReferences: ['missing/external.md'] },
    humanApproval: { status: 'pending-external', authority: 'independent-maintainer' },
  };
  assert.deepEqual(validateDesignTokenIntegrityManifest({ manifest, actual: integrity }), []);
});

test('self-asserted human approval is rejected by the machine integrity manifest', () => {
  const actual = {
    token_values_digest: '1'.repeat(64),
    projection_policy_digest: '2'.repeat(64),
    provenance_content_digest: '3'.repeat(64),
    display_export_surface_digest: '4'.repeat(64),
    external_reference_digest: '5'.repeat(64),
    approval_subject_digest: '6'.repeat(64),
  };
  const manifest = {
    schemaVersion: 3,
    boundaryVersion: '3.0.0',
    algorithm: 'sha256',
    integrity: actual,
    provenance: { contentInputs: ['tracked.md'], externalReferences: [] },
    humanApproval: { status: 'approved', decisionRef: 'self-asserted' },
  };
  assert.match(validateDesignTokenIntegrityManifest({ manifest, actual }).join('\n'), /pending-external/);
});

test('provenance order and new display exports outside the registry are rejected', () => {
  const color = { ink: '#000000' };
  assert.deepEqual(
    validateDisplayExportCoverage({ tokenValues: { color }, displayExports: { COLOR: color } }),
    [],
  );
  assert.deepEqual(
    validateDisplayExportCoverage({
      tokenValues: { color },
      displayExports: { COLOR: color, NEW_DISPLAY_EXPORT: { ink: '#000000' } },
    }),
    ['NEW_DISPLAY_EXPORT is not an identity alias of DESIGN_TOKEN_INTEGRITY_VALUES'],
  );
  const actual = {
    token_values_digest: '1'.repeat(64),
    projection_policy_digest: '2'.repeat(64),
    provenance_content_digest: '3'.repeat(64),
    display_export_surface_digest: '4'.repeat(64),
    external_reference_digest: '5'.repeat(64),
    approval_subject_digest: '6'.repeat(64),
  };
  const manifest = {
    schemaVersion: 3,
    boundaryVersion: '3.0.0',
    algorithm: 'sha256',
    integrity: actual,
    provenance: { contentInputs: ['z.md', 'a.md'], externalReferences: [] },
    humanApproval: { status: 'pending-external', authority: 'independent-maintainer' },
  };
  assert.match(validateDesignTokenIntegrityManifest({ manifest, actual }).join('\n'), /unique and sorted/);
});

test('repository integration owns the token/CSS/provenance checker process', () => {
  const output = execFileSync(process.execPath, ['scripts/check-design-tokens.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  assert.match(output, /integrity boundary/);
  assert.match(output, /human approval=pending-external/);
});

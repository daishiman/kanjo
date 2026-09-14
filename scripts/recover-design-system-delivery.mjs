#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCanonicalGraph } from './design-system-delivery-core.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const plan = '.dev-graph/plans/feature-package-feat-design-system-foundation';
const graphPath = `${plan}/task-graph.json`;
const inventoryPath = `${plan}/workstream-inventory.json`;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function repositoryPath(path) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`receipt must be a repository-relative file: ${path}`);
  }
  return rel.split(sep).join('/');
}

try {
  const graphSource = readFileSync(join(root, graphPath), 'utf8');
  const inventorySource = readFileSync(join(root, inventoryPath), 'utf8');
  const graph = JSON.parse(graphSource);
  const inventory = JSON.parse(inventorySource);
  const recovery = new Map((inventory.tasks ?? []).map((task) => [task.id, task]));
  const recovered = {
    ...graph,
    nodes: (graph.nodes ?? []).map((node) => {
      const task = recovery.get(node.id);
      if (!task) throw new Error(`recovery inventory is missing ${node.id}`);
      return { ...node, title: task.title, depends_on: task.depends_on };
    }),
  };
  const violations = validateCanonicalGraph(recovered.nodes ?? []);
  const next = encode(recovered);
  if (!process.argv.includes('--apply')) {
    console.log(
      JSON.stringify({
        status: 'preview',
        operation: 'disaster-recovery-inverse-import',
        acknowledgement_required: '--acknowledge-disaster-recovery',
        receipt_required: '--receipt PATH',
        would_change: next !== graphSource,
        inventory_digest: digest(inventorySource),
        recovered_graph_digest: digest(next),
        validity: violations.length === 0 ? 'valid' : 'blocked-invalid',
        violations,
      }),
    );
  } else {
    if (violations.length) throw new Error(`recovered graph is invalid: ${violations.join('; ')}`);
    if (!process.argv.includes('--acknowledge-disaster-recovery')) {
      throw new Error('--acknowledge-disaster-recovery is required for inverse import');
    }
    const receiptOption = option('--receipt');
    if (!receiptOption) throw new Error('--receipt PATH is required for inverse import');
    const receiptPath = repositoryPath(receiptOption);
    const graphTemp = `${join(root, graphPath)}.recovery-tmp`;
    writeFileSync(graphTemp, next);
    renameSync(graphTemp, join(root, graphPath));
    const receipt = {
      schema_version: '1.0.0',
      operation: 'disaster-recovery-inverse-import',
      applied_at: new Date().toISOString(),
      source: inventoryPath,
      target: graphPath,
      inventory_digest: digest(inventorySource),
      previous_graph_digest: digest(graphSource),
      recovered_graph_digest: digest(next),
      normal_regeneration_used: false,
    };
    const receiptTarget = join(root, receiptPath);
    const receiptTemp = `${receiptTarget}.recovery-tmp`;
    writeFileSync(receiptTemp, encode(receipt));
    renameSync(receiptTemp, receiptTarget);
    console.log(JSON.stringify({ status: 'recovered', receipt: receiptPath }));
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

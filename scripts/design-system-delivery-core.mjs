/** Pure invariants shared by the design-system delivery producer and checker. */

const ORDERED_LIFECYCLE = [
  'mutation',
  'documentation-sync',
  'final-verification',
  'quality-assurance',
  'acceptance',
  'independent-review',
  'evidence',
  'release',
];

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, 'en'));
}

export function validateCanonicalGraph(nodes) {
  const violations = [];
  const byId = new Map();
  for (const node of nodes) {
    if (!node?.id || typeof node.id !== 'string') {
      violations.push('node id is absent');
      continue;
    }
    if (byId.has(node.id)) violations.push(`duplicate node: ${node.id}`);
    byId.set(node.id, node);
  }

  for (const node of byId.values()) {
    const dependencies = Array.isArray(node.depends_on) ? node.depends_on : [];
    for (const dependency of dependencies) {
      if (dependency === node.id) violations.push(`self dependency: ${node.id}`);
      else if (!byId.has(dependency)) violations.push(`dangling dependency: ${node.id} -> ${dependency}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id, trail) => {
    if (visiting.has(id)) {
      violations.push(`cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    const node = byId.get(id);
    for (const dependency of node.depends_on ?? []) visit(dependency, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of sorted(byId.keys())) visit(id, []);

  const ancestors = (id, seen = new Set()) => {
    for (const dependency of byId.get(id)?.depends_on ?? []) {
      if (seen.has(dependency) || !byId.has(dependency)) continue;
      seen.add(dependency);
      ancestors(dependency, seen);
    }
    return seen;
  };
  const ranked = [...byId.values()].filter((node) => ORDERED_LIFECYCLE.includes(node.lifecycle_role));
  for (const later of ranked) {
    const laterRank = ORDERED_LIFECYCLE.indexOf(later.lifecycle_role);
    const dependencies = ancestors(later.id);
    for (const earlier of ranked) {
      const earlierRank = ORDERED_LIFECYCLE.indexOf(earlier.lifecycle_role);
      if (earlierRank >= laterRank) continue;
      if (!dependencies.has(earlier.id)) {
        const wording =
          earlier.lifecycle_role === 'mutation' && later.lifecycle_role === 'final-verification'
            ? 'mutation must precede final-verification'
            : `${earlier.lifecycle_role} must precede ${later.lifecycle_role}`;
        violations.push(`${wording}: ${earlier.id} -> ${later.id}`);
      }
    }
  }
  return sorted(new Set(violations));
}

function parseFrontmatter(source) {
  const body = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!body) throw new Error('feature frontmatter is absent');
  const result = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!['purpose', 'goal', 'scope_in', 'scope_out', 'acceptance'].includes(key)) continue;
    try {
      result[key] = JSON.parse(raw);
    } catch {
      throw new Error(`feature frontmatter field is not JSON-compatible: ${key}`);
    }
  }
  return result;
}

export function deriveGoalSpec(featureSource, previous) {
  const semantic = parseFrontmatter(featureSource);
  for (const key of ['purpose', 'goal', 'scope_in', 'scope_out', 'acceptance']) {
    if (!(key in semantic)) throw new Error(`feature semantic field is absent: ${key}`);
  }
  return { ...previous, ...semantic };
}

export function verifySharedInputs({ trackedPaths, requiredTrackedPaths }) {
  const tracked = new Set(trackedPaths);
  return sorted(requiredTrackedPaths)
    .filter((path) => !tracked.has(path))
    .map((path) => `required tracked input is absent: ${path}`);
}

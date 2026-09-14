import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_POLICY_HEADINGS = Object.freeze([
  '色の役割',
  'タイポグラフィ',
  '余白と寸法',
  'シェル',
  'ボタン',
  'チャート',
]);

const CHART_DECISION_ID = 'dec-chart-series-contrast';
const CHART_DECISION_LINK =
  '../docs/design-system/architecture-decision.md#dec-chart-series-contrast-チャート系列色';
const CANONICAL_POLICY_LINK = 'docs/design-system.md';

const h2Sections = (source) => {
  const sections = new Map();
  const matches = [...source.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];
  for (const [index, match] of matches.entries()) {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const title = match[1].trim();
    const contents = sections.get(title) ?? [];
    contents.push(source.slice(start, end));
    sections.set(title, contents);
  }
  return sections;
};

const decisionIds = (source) => new Set([...source.matchAll(/`(dec-[a-z0-9-]+)`/g)].map((match) => match[1]));

const hasCanonicalMarkdownLink = (source) => {
  const targets = [...source.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
  return targets.includes(CANONICAL_POLICY_LINK);
};

export function validateDesignSystemDocumentContract({
  specification,
  policy,
  readme,
  agents,
  tokenApproval,
}) {
  const violations = [];
  const policySections = h2Sections(policy);

  for (const heading of REQUIRED_POLICY_HEADINGS) {
    const count = policySections.get(heading)?.length ?? 0;
    if (count !== 1) {
      violations.push(`docs/design-system.md: FR-005 H2「${heading}」は1つ必要です (現在 ${count})`);
    }
  }

  if (!hasCanonicalMarkdownLink(readme)) {
    violations.push(`README.md: 正規リンク ${CANONICAL_POLICY_LINK} が必要です`);
  }
  if (!hasCanonicalMarkdownLink(agents)) {
    violations.push(`AGENTS.md: 正規リンク ${CANONICAL_POLICY_LINK} が必要です`);
  }

  const hasMachineIntegrityBoundary = policy.includes('pnpm lint') && policy.includes('機械的整合');
  const hasExternalApprovalBoundary = policy.includes('リリース') && policy.includes('外部の人間による承認');
  const hasPendingExternalState = policy.includes('`humanApproval`') && policy.includes('`pending-external`');
  if (!hasMachineIntegrityBoundary) {
    violations.push('docs/design-system.md: pnpm lintは機械的整合だけを証明すると明記してください');
  }
  if (!hasExternalApprovalBoundary) {
    violations.push('docs/design-system.md: リリースには外部の人間による承認が必要です');
  }
  if (!hasPendingExternalState) {
    violations.push('docs/design-system.md: humanApprovalはpending-externalのまま保つと明記してください');
  }

  const specificationSections = h2Sections(specification);
  const unresolvedSections = specificationSections.get('未決事項') ?? [];
  const confirmedSections = specificationSections.get('確定意思決定') ?? [];
  if (unresolvedSections.length !== 1 || confirmedSections.length !== 1) {
    violations.push(
      'specs/spec-design-system-foundation.md: 「未決事項」と「確定意思決定」のH2を1つずつ必要です',
    );
  } else {
    const unresolved = unresolvedSections[0];
    const confirmed = confirmedSections[0];
    const unresolvedIds = decisionIds(unresolved);
    const confirmedIds = decisionIds(confirmed);
    for (const id of unresolvedIds.intersection(confirmedIds)) {
      violations.push(`${id}: 同じ意思決定IDを未決と確定の両方に置けません`);
    }

    if (/\u30c1\u30e3\u30fc\u30c8系列色/.test(unresolved)) {
      violations.push(`${CHART_DECISION_ID}: 確定済みのチャート系列色を未決事項に置けません`);
    }
    if (!confirmedIds.has(CHART_DECISION_ID)) {
      violations.push(`${CHART_DECISION_ID}: 確定意思決定に安定IDが必要です`);
    }
    if (!confirmed.includes(CHART_DECISION_LINK)) {
      violations.push(`${CHART_DECISION_ID}: 確定記録への正規リンクが必要です`);
    }
  }

  if (tokenApproval?.humanApproval?.status !== 'pending-external') {
    violations.push('token-approval.json: humanApproval.status はpending-externalである必要があります');
  }

  return violations;
}

export function validateDesignSystemDocumentContractAtRoot(repoRoot) {
  return validateDesignSystemDocumentContract({
    specification: readFileSync(join(repoRoot, 'specs/spec-design-system-foundation.md'), 'utf8'),
    policy: readFileSync(join(repoRoot, 'docs/design-system.md'), 'utf8'),
    readme: readFileSync(join(repoRoot, 'README.md'), 'utf8'),
    agents: readFileSync(join(repoRoot, 'AGENTS.md'), 'utf8'),
    tokenApproval: JSON.parse(readFileSync(join(repoRoot, 'docs/design-system/token-approval.json'), 'utf8')),
  });
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const rootArgumentIndex = process.argv.indexOf('--root');
  const repoRoot =
    rootArgumentIndex === -1
      ? resolve(dirname(fileURLToPath(import.meta.url)), '..')
      : resolve(process.argv[rootArgumentIndex + 1]);
  const violations = validateDesignSystemDocumentContractAtRoot(repoRoot);
  if (violations.length > 0) {
    console.error(violations.map((violation) => `- ${violation}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `design-system document contract: ${REQUIRED_POLICY_HEADINGS.length} headings, 2 entry links, decision state, and external approval boundary are valid`,
    );
  }
}

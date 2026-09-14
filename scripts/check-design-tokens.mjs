#!/usr/bin/env node
/**
 * デザイントークンの写しがズレていないかの検査 (FR-002)。
 *
 * 正本: packages/core/src/design-tokens.ts
 * 写し: packages/web/src/styles.css の「design-tokens:begin 〜 end」ブロック
 *
 * 1. 写しのブロックが正本から生成した CSS と1文字も違わないこと
 * 2. packages/web/src(テスト以外)に色の直書き(hex/rgb/hsl/color-mix)が残っていないこと
 *    生値が1つでも残ると、正本を変えても画面の一部だけ古い色のままになる。
 * 3. 表示に影響する値が、版・外部承認状態・由来を持つ integrity manifest の fingerprint と一致すること
 *    この lint は machine integrity だけを検証し、release に必要な外部人間承認を生成・推定しない。
 *
 *   node scripts/check-design-tokens.mjs          検査のみ(ずれたら exit 1)
 *   node scripts/check-design-tokens.mjs --write  写しのブロックを正本から書き戻す
 *   node scripts/check-design-tokens.mjs --approval-manifest <path>  承認境界の回帰テスト用
 *
 * 正本の .ts は package.json が要求する Node 22.18 以降の型除去で直接 import する。
 * CSS 媒体固有の整形は scripts/design-token-css.mjs に分離する。
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderHighContrastCss, renderRootCss } from './design-token-css.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const tokensPath = join(root, 'packages/core/src/design-tokens.ts');
const stylesPath = join(root, 'packages/web/src/styles.css');
const webSrc = join(root, 'packages/web/src');
const approvalOptionIndex = process.argv.indexOf('--approval-manifest');
const approvalPath =
  approvalOptionIndex >= 0
    ? process.argv[approvalOptionIndex + 1]
    : join(root, 'docs/design-system/token-approval.json');

const BEGIN = '/* design-tokens:begin — packages/core/src/design-tokens.ts から生成。手編集しない */';
const END = '/* design-tokens:end */';

/** オブジェクトの宣言順に依存せず、同じ値から必ず同じ入力文字列を作る。 */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const digest = (value) => createHash('sha256').update(value).digest('hex');

export function computeDesignTokenIntegrity({
  tokenValues,
  displayExports,
  projectionPolicySource,
  repoRoot,
  provenanceInputs = [],
  trackedProvenance = provenanceInputs,
  externalReferences = [],
}) {
  const orderedExternalReferences = [...externalReferences].sort((left, right) =>
    stableJson(left).localeCompare(stableJson(right), 'en'),
  );
  for (const reference of orderedExternalReferences) {
    if (
      !reference ||
      typeof reference.path !== 'string' ||
      typeof reference.recordPath !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(reference.recordDigest ?? '') ||
      !trackedProvenance.includes(reference.recordPath)
    ) {
      throw new Error(
        `external reference is not content-addressed by a provenance input: ${stableJson(reference)}`,
      );
    }
    const recorded = digest(readFileSync(resolve(repoRoot, reference.recordPath)));
    if (reference.recordDigest !== `sha256:${recorded}`) {
      throw new Error(`external reference record digest differs: ${reference.recordPath}`);
    }
  }
  const provenanceHash = createHash('sha256');
  for (const entry of [...trackedProvenance].sort((left, right) => left.localeCompare(right, 'en'))) {
    if (typeof entry !== 'string' || !entry || isAbsolute(entry))
      throw new Error(`invalid tracked provenance: ${entry}`);
    const absolute = resolve(repoRoot, entry.split('#')[0]);
    const rel = relative(resolve(repoRoot), absolute);
    if (!rel || rel === '..' || rel.startsWith('../'))
      throw new Error(`tracked provenance escapes repository: ${entry}`);
    provenanceHash.update(entry);
    provenanceHash.update('\0');
    provenanceHash.update(readFileSync(absolute));
    provenanceHash.update('\0');
  }
  const integrity = {
    token_values_digest: digest(stableJson(tokenValues)),
    display_export_surface_digest: digest(stableJson(displayExports)),
    projection_policy_digest: digest(projectionPolicySource),
    provenance_content_digest: provenanceHash.digest('hex'),
    external_reference_digest: digest(stableJson(orderedExternalReferences)),
  };
  return { ...integrity, approval_subject_digest: digest(stableJson(integrity)) };
}

export function validateDisplayExportCoverage({ tokenValues, displayExports }) {
  const values = new Set(Object.values(tokenValues));
  return Object.entries(displayExports)
    .filter(([, value]) => !values.has(value))
    .map(([name]) => `${name} is not an identity alias of DESIGN_TOKEN_INTEGRITY_VALUES`);
}

export function validateDesignTokenIntegrityManifest({ manifest, actual }) {
  const violations = [];
  const hex = /^[0-9a-f]{64}$/;
  if (manifest?.schemaVersion !== 3) violations.push('schemaVersion must be 3');
  if (typeof manifest?.boundaryVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.boundaryVersion)) {
    violations.push('boundaryVersion must be semver');
  }
  if (manifest?.algorithm !== 'sha256') violations.push('algorithm must be sha256');
  for (const key of [
    'token_values_digest',
    'display_export_surface_digest',
    'projection_policy_digest',
    'provenance_content_digest',
    'external_reference_digest',
    'approval_subject_digest',
  ]) {
    if (!hex.test(manifest?.integrity?.[key] ?? '')) violations.push(`${key} must be sha256`);
    else if (manifest.integrity[key] !== actual[key]) violations.push(`${key} differs`);
  }
  if (!Array.isArray(manifest?.provenance?.contentInputs) || manifest.provenance.contentInputs.length === 0) {
    violations.push('provenance contentInputs are required');
  } else if (
    JSON.stringify(manifest.provenance.contentInputs) !==
    JSON.stringify(
      [...new Set(manifest.provenance.contentInputs)].sort((left, right) => left.localeCompare(right, 'en')),
    )
  ) {
    violations.push('provenance contentInputs must be unique and sorted');
  }
  if (!Array.isArray(manifest?.provenance?.externalReferences)) {
    violations.push('externalReferences must be an array');
  } else if (
    JSON.stringify(manifest.provenance.externalReferences) !==
    JSON.stringify(
      [
        ...new Map(
          manifest.provenance.externalReferences.map((entry) => [stableJson(entry), entry]),
        ).values(),
      ].sort((left, right) => stableJson(left).localeCompare(stableJson(right), 'en')),
    )
  ) {
    violations.push('externalReferences must be unique and sorted');
  }
  const approval = manifest?.humanApproval;
  if (
    approval?.status !== 'pending-external' ||
    approval?.authority !== 'independent-maintainer' ||
    'decisionRef' in (approval ?? {})
  ) {
    violations.push('humanApproval must remain pending-external for an independent-maintainer');
  }
  return violations;
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 18)) {
    console.error(`Node 22.18.0 以降が必要です（現在 ${process.versions.node}）`);
    process.exit(1);
  }

  const tokens = await import(pathToFileURL(tokensPath).href);
  const displayExports = Object.fromEntries(
    Object.entries(tokens)
      .filter(
        ([name, value]) =>
          /^[A-Z][A-Z0-9_]*$/.test(name) &&
          value &&
          typeof value === 'object' &&
          name !== 'DESIGN_TOKEN_INTEGRITY_VALUES',
      )
      .sort(([left], [right]) => left.localeCompare(right, 'en')),
  );
  const generated = `${renderRootCss(tokens)}\n\n${renderHighContrastCss(tokens)}`;

  const failures = [];

  let approval;
  if (!approvalPath) {
    failures.push('--approval-manifest の後ろに manifest path が必要');
  } else {
    try {
      approval = JSON.parse(readFileSync(approvalPath, 'utf8'));
    } catch (error) {
      failures.push(`トークン承認 manifest を読めない: ${approvalPath} (${error.message})`);
    }
  }
  if (approval) {
    let actualIntegrity;
    try {
      actualIntegrity = computeDesignTokenIntegrity({
        tokenValues: tokens.DESIGN_TOKEN_INTEGRITY_VALUES,
        displayExports,
        projectionPolicySource: readFileSync(join(root, 'scripts/design-token-css.mjs'), 'utf8'),
        repoRoot: root,
        provenanceInputs: approval?.provenance?.contentInputs ?? [],
        externalReferences: approval?.provenance?.externalReferences ?? [],
      });
    } catch (error) {
      failures.push(`integrity 入力を読めない: ${error.message}`);
    }
    if (actualIntegrity) {
      const integrityViolations = validateDesignTokenIntegrityManifest({
        manifest: approval,
        actual: actualIntegrity,
      });
      failures.push(...integrityViolations.map((violation) => `トークン integrity manifest: ${violation}`));
      failures.push(
        ...validateDisplayExportCoverage({
          tokenValues: tokens.DESIGN_TOKEN_INTEGRITY_VALUES,
          displayExports,
        }).map((violation) => `トークン export coverage: ${violation}`),
      );
    }
  }
  const css = readFileSync(stylesPath, 'utf8');
  const begin = css.indexOf(BEGIN);
  const end = css.indexOf(END);

  if (begin < 0 || end < begin) {
    failures.push('styles.css に design-tokens:begin / end のマーカーが見つからない');
  } else {
    const current = css.slice(begin + BEGIN.length + 1, end - 1);
    if (current !== generated) {
      if (process.argv.includes('--write')) {
        writeFileSync(stylesPath, `${css.slice(0, begin + BEGIN.length + 1)}${generated}\n${css.slice(end)}`);
        console.log('styles.css の生成ブロックを正本から書き戻した');
      } else {
        failures.push(
          'styles.css の生成ブロックが design-tokens.ts と一致しない(正本を直して --write で作り直す)',
        );
      }
    }
  }

  /** 改行だけを残して消す(報告する行番号を元ファイルとずらさないため) */
  const blankOut = (chunk) => chunk.replace(/[^\n]/g, '');

  /** コメントを落とす。説明文の中の色見本まで直書きと数えないため */
  function stripComments(text, isCss) {
    const block = text.replace(/\/\*[\s\S]*?\*\//g, blankOut);
    return isCss ? block : block.replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  }

  function sourceFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === 'test-support' ? [] : sourceFiles(full);
      return /\.(ts|tsx|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
    });
  }

  const RAW_COLOR =
    /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\bhwb\([^)]*\)|\b(?:ok)?lab\([^)]*\)|\b(?:ok)?lch\([^)]*\)|\bcolor(?:-mix)?\([^)]*\)/g;
  const hardcoded = [];
  const scanned = sourceFiles(webSrc);
  for (const file of scanned) {
    let text = readFileSync(file, 'utf8');
    const isCss = file.endsWith('.css');
    if (file === stylesPath && begin >= 0 && end > begin) {
      text =
        text.slice(0, begin) + blankOut(text.slice(begin, end + END.length)) + text.slice(end + END.length);
    }
    const lines = stripComments(text, isCss).split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(RAW_COLOR)) {
        hardcoded.push(`${relative(root, file)}:${index + 1} ${match[0]}`);
      }
    });
  }
  if (hardcoded.length > 0) {
    failures.push(
      `色の直書きが ${hardcoded.length} 件ある(役割トークンの var() か core の COLOR/EFFECT_COLOR を使う)\n  ${hardcoded.join('\n  ')}`,
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`差分: ${failure}`);
    process.exit(1);
  }
  console.log(
    `デザイントークン: machine integrity boundary ${approval.boundaryVersion} (${approval.integrity.token_values_digest.slice(0, 12)})、正本・全display export・写しが一致し、hex/rgb/hsl/color-mix の直書きは 0 件(${scanned.length} ファイルを検査)。human approval=${approval.humanApproval.status}`,
  );
}

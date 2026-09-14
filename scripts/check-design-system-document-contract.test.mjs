import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_POLICY_HEADINGS,
  validateDesignSystemDocumentContract,
} from './check-design-system-document-contract.mjs';

const canonicalLink = '[design system](docs/design-system.md)';
const validSources = {
  specification: `
## 未決事項

- \`human-design-token-approval\`: 外部の人間承認待ち。

## 確定意思決定

- [\`dec-chart-series-contrast\`](../docs/design-system/architecture-decision.md#dec-chart-series-contrast-チャート系列色): confirmed。
`,
  policy: `${REQUIRED_POLICY_HEADINGS.map((heading) => `## ${heading}\n\n本文`).join(
    '\n\n',
  )}\n\npnpm lintが証明するのは機械的整合だけで、リリースには外部の人間による承認が必要。\n\n\`humanApproval\` は \`pending-external\` のまま保つ。`,
  readme: canonicalLink,
  agents: canonicalLink,
  tokenApproval: {
    humanApproval: { status: 'pending-external', authority: 'independent-maintainer' },
  },
};

test('同じ意思決定IDを未決と確定の両方に置くと拒否する', () => {
  const specification = validSources.specification.replace(
    '`human-design-token-approval`',
    '`dec-chart-series-contrast`',
  );

  assert.match(
    validateDesignSystemDocumentContract({ ...validSources, specification }).join('\n'),
    /dec-chart-series-contrast.*未決.*確定/,
  );
});

test('FR-005の6つのH2見出しをそれぞれ必須とする', async (t) => {
  for (const heading of REQUIRED_POLICY_HEADINGS) {
    await t.test(heading, () => {
      const policy = validSources.policy.replace(`## ${heading}`, `### ${heading}`);
      assert.match(
        validateDesignSystemDocumentContract({ ...validSources, policy }).join('\n'),
        new RegExp(`H2.*${heading}`),
      );
    });
  }
});

test('READMEとAGENTSの両方に正規リンクを必須とする', () => {
  assert.match(
    validateDesignSystemDocumentContract({ ...validSources, readme: 'リンクなし' }).join('\n'),
    /README\.md.*docs\/design-system\.md/,
  );
  assert.match(
    validateDesignSystemDocumentContract({ ...validSources, agents: 'リンクなし' }).join('\n'),
    /AGENTS\.md.*docs\/design-system\.md/,
  );
});

test('トークンマニフェスト内の自己承認を受理しない', () => {
  const tokenApproval = { humanApproval: { status: 'approved', authority: 'self' } };
  assert.match(
    validateDesignSystemDocumentContract({ ...validSources, tokenApproval }).join('\n'),
    /humanApproval.*pending-external/,
  );
});

test('lintと外部の人間承認の境界を規約に必須とする', () => {
  const policy = validSources.policy.replace('外部の人間による承認', 'リポジトリ内の自己承認');
  assert.match(
    validateDesignSystemDocumentContract({ ...validSources, policy }).join('\n'),
    /リリース.*外部の人間による承認/,
  );
});

test('正規の文書契約は通過する', () => {
  assert.deepEqual(validateDesignSystemDocumentContract(validSources), []);
});

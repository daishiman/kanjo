# 証跡の索引 (SYS-DSFOUND-P11)

Run reference: `docs/design-system/run-reference.json`

Changed-path aggregate digest: 9c598ddcdc352e97001344f0a7befa675192225da6c1f56b62907a57710ca8a8

`changed-path-manifest.json` は真正性の証明ではなく、`pnpm run evidence:acceptance` が設定済みコマンドを再実行した再現snapshotである。stdout/stderrを保持し、`pnpm evidence:check` はコマンドidentity・ログbytes・digest・changed paths・本書とverification-runのaggregate参照を再計算する。任意入力の `status: pass` や、この文書の成功文言は実行証跡として扱わない。独立した信頼や人間承認はローカルファイルから推論しない。

| 条件 | 根拠 |
|---|---|
| S1 | `scripts/check-design-tokens.mjs`、full gateのlint receipt |
| S2 | `components/charts.ts`、AST chart color contract、repository-owned rendered checks |
| S3 | `packages/core/src/design-tokens.ts`、pure core invariant、root integration check |
| S4 | contrast、font scale、Button/native AST境界 |
| S5 | route registry、PageShell、common-shell route contract |
| S6 | `acceptance-worktree-full-s6-gate` が実行する現行 `verify:full` のexit code・時刻・runtime・保持したoutput digest |

共有gateはtracked projectionだけを参照する。外部provenanceの確認、ignored local graph、Beads/GitHub、過去registration receiptはmaintainer-onlyで、stale/pendingを共有PASSへ混ぜない。

工程要件の正本は `specs/spec-design-system-foundation.md`、設計判断の正本は `architecture-decision.md`、利用規約は `../design-system.md`、Phase 3実装結果はeval-logの `phase3-implementation.json`。

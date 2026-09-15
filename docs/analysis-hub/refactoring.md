# 支出分析ハブ previousPeriod 重複実装の除去 (SYS-ANHUB-P08)

- 実施日: 2026-09-15
- 決定の出所: architecture/analysis-hub-backend.md qa-analysis-hub-decision-002/003 (前期間の判定を packages/core に置く)
- Entry gate: `docs/analysis-hub/acceptance.md` で AC-003 / AC-004 が pass

## 変更内容

| 項目 | 変更前 | 変更後 |
|---|---|---|
| `packages/api/src/ai/dataset.ts` の `previousPeriod` | api 内に独自実装 (`addMonths` と `rangeLength` で n か月ずらす) を export | 削除し、`@kanjo/core` の `previousPeriod` を import |
| 同ファイルの import | `./contract.js` から `rangeLength` を import | 使われなくなったため除去 (`addMonths` は `yearAgoPeriod` とプリセット期間でまだ使う) |
| 呼出し | `buildAgentData` 内の 1 か所 (`const prev = previousPeriod(period)`) | 同じ 1 か所。呼出し側は無変更 |

api 側の `previousPeriod` を import していた箇所は repo 内に 0 件だったため (`grep -rn previousPeriod packages`)、export を消しても他に壊れる呼出しは無い。`yearAgoPeriod` など previousPeriod 以外のロジックは変えていない (スコープ外)。

置換後の `grep -n 'previousPeriod' packages/api/src/ai/dataset.ts`:

```
20:  previousPeriod,
174:  const prev = previousPeriod(period);
```

定義行 (`export function previousPeriod`) は無く、import と呼出しだけが残る。

## 同じ振る舞いである根拠

1. 型: api の `Period` と core の `PeriodRange` はどちらも `{ from: string; to: string }` ('YYYY-MM') で、構造的に同一。
2. 計算: どちらも「両端を含む月数 n を数え、開始・終了をそれぞれ n か月前へずらす」。月の通し番号化 (`年×12 + 月 − 1`) も同じ。
3. 総当たり比較 (一時スクリプト、repo 外): 開始月 2000-01〜2030-12 × 長さ 1〜61 か月 (api が受け付ける最長 `MAX_RANGE_MONTHS`) の 22,692 通りで、旧実装と core 版の `from` / `to` の不一致 0 件。比較が差を見逃さないことは、旧実装の開始月を 1 か月ずらした対照で 22,692 件すべて不一致になることで確認した。
4. `@kanjo/core` は `exports: { ".": "./src/index.ts" }` でソースを直接解決するため、api のテスト・型検査・Workers ビルドは置換後の core 実装を実際に通る (ビルド済みの別物を見ていない)。

## 検証結果

| コマンド | exit | 結果 |
|---|---|---|
| `pnpm --filter @kanjo/api test` | 0 | 40 files / 529 tests passed (置換前と同数) |
| `pnpm typecheck` | 0 | core / api / web Done |
| `biome check .` | 0 | 389 files, No fixes applied |
| `grep -n 'previousPeriod' packages/api/src/ai/dataset.ts` | 0 | 上記 2 行 (import と呼出しのみ) |

core 側の前期間規則は `packages/core/src/analysis-hub.test.ts` の「BR-004 前期間比」(年またぎ・前Nか月・欠け 0/1 か月・全期間 null・0 除算) が境界値付きで固定している。

## 見つけた穴 (follow-up)

api の既存テストは、AI 用データの前期間の「窓」(どの月からどの月か) を固定していない。`src/ai/catalog.test.ts` は前期間の合計と寄与チャートの値を同じ出力どうしで突き合わせるため、窓が 1 か月ずれても一致したまま緑になる (core の previousPeriod を一時的に 1 か月ずらしても catalog.test.ts は 6 件緑のままだったことで確認し、確認後に元へ戻した)。

本 task の write scope は `dataset.ts` だけのため api テストは追加していない。上の総当たり比較で置換の等価性は確認済みだが、今後 api 側で窓を変える変更を検出するには、`buildAgentData` の `period.previous` (from/to) を固定する api テストを別 task で足すのがよい。

## Rollback

`packages/api/src/ai/dataset.ts` を本 task 直前 (HEAD `2162fd2` と同一内容) へ戻せば、api 独自の `previousPeriod` が復活する。D1 migration・API 契約の変更は無いため、戻す対象はこの 1 ファイルだけ。

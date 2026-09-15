# 支出分析ハブ 設計レビュー (SYS-ANHUB-P03)

> 注記: これは初回導入時のレビュー記録。当時未決だった staleTime と invalidate は現行の `architecture-decision.md` で解消済み。

- 対象: `docs/analysis-hub/architecture-decision.md`
- 照合先: `docs/analysis-hub/requirements-baseline.md`、`architecture/analysis-hub-security.md`、`architecture/analysis-hub-auth.md`

## 観点別の判定

| 観点 | 判定 | 根拠 |
|---|---|---|
| C1 集計は core の純関数 | 適合 | BR-001..005 の適用は `analysisHub` と名前付き関数に閉じ、route は DB 読取りと受け渡しだけ。前期間計算も core |
| C3 非表示タブの API を呼ばない | 適合 (例外 1 件) | ハブは 5 タブ API を呼ばず集約 API 1 本。集約 API をサイドバーでも使う点は明示の例外で、P12 で ui-decisions.md に記す |
| C4 総収支は freee 正本 | 適合 | 収支サマリーは `totalCashflowReport` の months を合計し、要確認件数も `report.review.length` を再利用する。独自に数え直さない |
| 認証 (auth) | 適合 | `/api/*` の既存ゲート配下にマウント。401 / 403 は既存応答を踏襲 |
| テナント境界 (security) | 適合 | 全読取りを userId で絞る。focus は API に渡さず、URL には id しか載らない |
| 入力検証 (security) | 適合 | 期間は既存 resolvePeriodQuery。focus は許可リスト |
| FR-001 / AC-001 | 判定可能 | DOM テストでハブ要素 (見出し・URL コピー・タブ・サマリー・一覧 5 行・パネル・読み順 5 段・下部バー) を検査 |
| FR-002 / AC-002 | 判定可能 | ?focus= の再現・replace・不正値・クリップボード書込をテスト。/analysis/:tab と旧 URL テストは維持 |
| FR-003 / AC-003 | 判定可能 | core 単体、API 統合 (200・period・401・403)、DOM で既存 5 API 0 件 |
| FR-004 / AC-004 | 判定可能 | 境界値テスト (要確認 0/1、未記録月 0/1、候補 0 件、前期間の欠け 0/1) |
| FR-005 / AC-005 | 判定可能 | 既存 3 DOM テストの文言更新とバッジ件数の検査 |
| FR-006 | 判定可能 | 右パネルの 3 項目 (わかること・主なデータソース・対象外のデータ) を DOM テスト |
| AC-006 | 判定可能 | P06 / P09 で test・typecheck・lint・check 系を実行 |

## 指摘事項

1. (軽微・P02 へ反映済み) 期間未指定 (全期間) 時の前期間は、全期間を p とすると必ず欠けて null になる。仕様の「1 か月でも欠ければ null」と矛盾しないため採用し、決定記録に明記した。
2. (軽微・既知の制約として受容) invalidate の追加先 (総収支の判定・freee 除外・取込) は write scope 外。staleTime を固定しない (既定 0) ことで遷移時に再取得されるため、不整合は遷移までに限られる。未決として P02 に記録済み。
3. (軽微・P05 で対応) `@kanjo/core` の公開面は `src/index.ts` の再輸出で決まるため、新モジュールの輸出行を 1 行加える必要がある。write scope に index.ts が無いので、P05 の報告で逸脱として明記する。
4. (軽微・P12 で対応) タブ名の短縮で、P12 の対象 3 テストに加え `common-shell.dom.test.tsx` の現在地表示 ('トータル収支') も文言が変わる。P12 で同時に更新し、逸脱として報告する。

## 再オープン要否

不要。指摘はいずれも決定を覆さず、P02 への注記または実装時の報告で閉じる。P04 に進んでよい。

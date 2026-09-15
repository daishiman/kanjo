# 概況画面 最終レビュー (SYS-OVERVIEW-P10)

- 対象: P01..P09 の成果物全体 (core `overview.ts`、API `routes/analytics.ts`・`routes/imports.ts`、web `pages/Overview.tsx`・`components/ReviewQueue.tsx`・`styles.css`、テスト、`docs/overview-screen/`)
- 基準: `specs/spec-overview-screen.md` の FR / BR / AC、`architecture/overview-screen-*.md`、[`acceptance.md`](acceptance.md)、[`assurance.md`](assurance.md)
- 方法: 実装を読み、仕様の文と 1 件ずつ突き合わせて指摘を起こし、是正後に「是正前の実装なら落ちるテスト」があるかを確かめた。テストを書き換えて緑にした指摘は、仕様の文言に照らして書き換え側が正しいことを確認した。

## 1. 指摘と是正

| # | 重大度 | 指摘 | 是正 | 状態 |
|---|---|---|---|---|
| F1 | 中 | 優先確認の表が期間に関係なく全期間の明細を並べ、1年表示でも 3 年前の明細が出る | `PriorityTable` を `period.applied` の範囲で絞る。件数 (バッジ・カード・バー) は全期間のまま (BR-002)。範囲内が 0 件なら「件数は全期間で数えています」と添える | 是正済み (DOM テスト: 1年で 2023-01 の明細が消え、件数は 4 のまま) |
| F2 | 中 | 「後で確認」を取り消す UI が無く、FR-003 の解除ができない | `GET /api/review-queue` が `snoozedItems` を返し、カードに「後で確認にした明細」と解除ボタンを置く。解除は `['review-queue']` を invalidate して 3 か所を同時に戻す | 是正済み (DOM テスト: 3→4 件、DELETE 送信、一覧が消える) |
| F3 | 中 | 月次レビューの `reviewed_by_user_id` にテナント鍵 `'default'` が入り、誰がレビューしたか残らない | `c.get('actor').id` を保存。バックアップ schema で `reviewedByUserId` を必須にし、欠けた行の復元は 400 (既定値で埋めない) | 是正済み (API テスト: 往復後に `TEST_ADMIN.id`) |
| F4 | 中 | 防衛ラインの caution が role=alert を持たず、FR-006 に反する。既存テストも「割り込まない」を期待していた | caution / warn とも `role="alert"`。強さは見出しと色で伝える。テストの期待を仕様側へ直す | 是正済み (DOM テスト 3 件) |
| F5 | 中 | 狭幅ドロワーで「後で確認」に成功すると、開いた元の行が消えてフォーカスが body へ落ちる | 成功時も `closeDialog` を通し、`focusAfterSnooze` で「未処理の内訳」見出し (`tabIndex=-1`) へ移す | 是正済み (DOM テスト: matchMedia 狭幅で見出しにフォーカス) |
| F6 | 中 | 月次クローズの「取込」ステップが、committed の取込が無くても (手入力の現金だけで) 完了になる | `monthlyCloseStatus` に `hasCommittedImport` を渡し、`imports.status='committed'` が無ければ未完了 | 是正済み (core 判定表に行を追加) |
| F7 | 低 | 0 件のとき「未処理 0 件」と出て、終わったことが伝わりにくい | `reviewTotalText` で「未処理なし」に統一 (カードとアクションバー) | 是正済み (DOM テスト) |
| F8 | 低 | `<tr aria-selected>` は grid 以外の表で無効な ARIA | 行内ボタンに `aria-current="true"`、`aria-selected` を除去 | 是正済み (DOM テスト: `[aria-selected]` 0 件) |
| F9 | 低 | 選んだ明細を替えても、前の明細の「後で確認にできませんでした」が残る | 選択キーが変わったら `snooze.reset()` | 是正済み |
| F10 | 低 | 期間だけが空のときも「まだデータがありません (取込へ)」と出て、取込が必要と誤解させる | 全期間にはデータがある場合は「選んだ期間には収支データがありません。期間を切り替えてください。」 | 是正済み |
| F11 | 低 | 年次比較の前期を「直前の k 要素」で取るため、途中に欠けた月があると k か月より長い期間と比べる | 暦で連続した k か月のときだけ前期を出し、揃わなければ null | 是正済み (core テスト: 欠けた月で null) |
| F12 | 低 | 概況の「仕分けの確認」件数が、仕分け画面の「未確認」件数と一致しない | 意図した差として記録する (下記 §2)。core の該当箇所にも理由をコメントで残した | 是正済み (文書化) |
| F13 | 低 | DOM テストの mock が期間クエリを無視し、期間で件数が変わる実装でも緑になる | mock が `span` に応じて `period.applied` を変える。件数は全期間のまま、表だけが変わることを検査 | 是正済み |

## 2. F12: 仕分け件数の差は意図したもの

概況の件数は「利用者が直す対象の明細」を 1 件ずつ数えます。仕分け画面の「未確認 (clsSrc=既定)」とは母数が次の 3 点で違います。

1. 現金の記帳は取込値ではなく利用者が入力したものなので、直す対象に含めません。
2. 分割した明細は、射影ではなく親の 1 件として数えます。
3. 照合待ちに載っている明細は「照合の確認」側で 1 件と数え、仕分け側では数えません (同じ明細を二重に数えない)。

画面間で数字がずれて見えたときの切り分けは [`../runbooks/overview-review-queue-mismatch.md`](../runbooks/overview-review-queue-mismatch.md) にあります。

## 3. 文書の是正

- `architecture-decision.md` §5: レビュー者を `c.get('userId')` と書いていた誤りを `c.get('actor').id` に直した (F3)。取込ステップの完了条件に `imports.status='committed'` を加えた (F6)。
- `refactoring.md`: バックアップ schema の `reviewedByUserId` 必須化と、テスト件数 (api 549) を反映した。

## 4. 是正の検算

F1・F5・F7 の是正を一時的に元へ戻すと、対応する DOM テスト 3 件がちょうど落ち、戻すと緑に戻ることを確認しました。
テストが「是正を検出できる」ことの確認で、件数だけを見て緑にしたものではありません。

## 5. 結論

このレビューで扱った指摘 13 件はすべて是正済みです。ただし当時の確認は画像正本との表示順・広幅グリッド比較を含んでいません。追加の視覚受入は [`acceptance.md`](acceptance.md) の AC-005、全体ゲートは AC-007 を正とし、本書だけで完了判定しません。

---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-classify-bulk-decision-070。裏付け質疑 (`qa_refs`): `qa-classify-bulk-infrastructure-web-002`, `qa-classify-bulk-infrastructure-web-evidence-001`, `qa-classify-bulk-infrastructure-web-evidence-002`, `qa-classify-bulk-decision-005`, `qa-classify-bulk-decision-033`, `qa-classify-bulk-delegated-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路と、一括保存 API の版に合わせてアプリを更新する順序を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路と、一括保存 API の版に合わせてアプリを更新する順序を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路と、一括保存 API の版に合わせてアプリを更新する順序を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路と、一括保存 API の版に合わせてアプリを更新する順序を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路と、一括保存 API の版に合わせてアプリを更新する順序を決める必要があった。対象を web のみとする利用者決定 (qa-classify-bulk-decision-067) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 一括保存の 1 要求で D1 へ出すクエリを、読み込みと書き込みの合計で 49 本以内に抑える形へ反映した。無料枠の上限は 1 回の Worker 起動で合計 50 本で、batch 内の文も 1 本ずつ数える既存の規則 (scheduled-maintenance-budget.ts) に従い、1 本を余らせる。書き込みは json_each で束ねた 1 回の batch で、書く前に 1 回の batch の文が 50 本を超えるか、束ねた JSON が 2MB を超えると分かった要求は、413 too_many_classify_changes で返して書かない (qa-classify-bulk-decision-055)。選択の読み出しは txId を 1 文に 50 件まで束ね、bound parameter の上限 100 の内に収める。一覧の応答が表示中のページの行だけになるので、Worker が 1 回で運ぶ JSON も小さくなる。初期 JS 予算 110KiB は check:js-budget で守る。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 一括保存・選択の読み出し・勘定科目の対応表の API のために新しい cron・binding・環境変数を足さず、既存の api Worker の経路として配備する形へ反映した。wrangler.jsonc の DB と ASSETS の binding は変えない。勘定科目の対応表の migration は既存の配備の流れで本番の D1 に当て、そのうち設定の変更履歴の種類の制約を表の作り直しで改める破壊的な migration は、既存の承認の仕組み (migration-approvals.json を PR で足し、merge を承認とする) を通してから当てる (C2)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G4

#### 主たる接地根拠: `qa-classify-bulk-decision-070`

**問**

要件の土台のうち、取込直後の提案と勘定科目の対応表を書いた 9 項目 (G2・O3・S2・I4・I8・範囲に含む 6・11・C2・C4) を、『承認する』の preview の今の文面で承認しますか。要件の土台 (U1〜U9) の文面は、以前の承認の後に続いた決定で書き換わっていて、今の全文を逐語で示して承認を得た記録がありません。以前の問 (decision-060) の (b)『要件の土台 U1〜U9 の全文を逐語で示し、承認し直す』に当たります。土台を 6 つに分け、この回と次の回で 3 つずつ伺います。今の全文は『承認する』の preview に、改める項目と変えない項目に分けて置きます。文中の括弧内の id は、その文面のもとになった決定です。9 項目とも、以前の承認 (decision-016) の後の決定で文面が変わり、そのうち I8 と範囲に含む 11 は新しく足す項目です。主な変化: 事業の明細にも、勘定科目の対応表で大項目から引いた勘定科目を、由来『MF の分類 (対応表)』で提案する (decision-040・049〜052)。勘定科目の対応表に行の無い大項目と、MF の大項目が空か『未分類』の明細には付けない (decision-050・039)。集計ルールが当たる個人の明細は、ルールを当てた後の値を提案する (decision-028)。勘定科目の対応表の表を migration で 1 つ足し、API・設定画面・設定の変更履歴・設定の JSON (版 2)・バックアップに加える。変更履歴の種類の制約の作り直しは破壊的な migration なので、PR で承認する (I8・範囲に含む 11・C2)。C2 は『表と列は足さない』から『表の追加は勘定科目の対応表の 1 つに限り、既存の表に列は足さない』に変わります。以前の問 (decision-016) は、『承認しない』にだけ結果を書いていて選択肢の書き方が片寄っていたので、各選択肢に利点と不利な点を書いて問い直します。承認すると、この問の記録を、仕様の database と infrastructure の章の主な根拠にします。今の 2 つの章の主な根拠は、migration を足さないとした以前の回答で、この点が今の文面と食い違っています。

**答**

承認する。preview の項目を、今の文面のまま要件の土台として承認する。利点: 土台と仕様の各章が同じ文面に揃い、承認の記録から今の文面を辿れる。不利な点: preview は約 4200 字あり、読み落とした細部も、この文面のまま計画と実装へ渡る。 回答に自由記述は付いていない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「土台・提案と対応表」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-024)。利用者はこの問で「承認する」を選択し、自由記述は付けていない。answered_at は回答受領時刻 (2026-10-01T09:12:13.849Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-016 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T09:12:14Z)

#### 裏付け質疑: `qa-classify-bulk-infrastructure-web-002`

**問**

C4 の訂正 (1 起動あたりの D1 クエリ上限) と決定 qa-classify-bulk-decision-005 を受けて、一括保存と選択の読み出しを、どの実行基盤と制約の中で動かすか。

**答**

既存の Cloudflare Worker (api)・静的アセット配信・D1 のまま動かし、binding・cron・環境変数・migration は足さない。Cloudflare 無料枠では 1 回の Worker 起動で D1 へ出すクエリは合計 50 本までで、batch 内の文も 1 本ずつ数える既存の規則に従う。一括保存の 1 要求は、読み込みと書き込みの合計を 49 本以内にする (書き込みは json_each で束ねる。qa-classify-bulk-decision-005)。初期 JS 予算 110KiB を守る。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-10-01T09:47:30Z` — answer の『migration は足さない』は、qa-classify-bulk-decision-049 で改まった。勘定科目の対応表の表を作る migration と、設定の変更履歴の種類の制約を表の作り直しで改める migration が加わる。後者は破壊的な migration なので、既存の承認の仕組み (migration-approvals.json を PR で足し、merge を承認とする) に従って本番へ届ける。既存の Cloudflare Worker (api)・静的アセット配信・D1 のまま動かし、binding・cron・環境変数を足さないこと、1 回の起動で D1 へ出すクエリを合計 50 本までに保つ規則 (一括保存の 1 要求は 49 本以内)、初期 JS 予算 110KiB は変わらない。一括保存・一覧・選択の読み出しで提案を算出するために勘定科目の対応表を読む 1 本は、この 49 本の内訳に含める。これは agent の読みで、利用者は未確認である。
> - `2026-10-01T10:08:23Z` — answer の qa-classify-bulk-decision-005 は、qa-classify-bulk-decision-033 で問い直して置き換わった (superseded_by)。利用者は qa-classify-bulk-decision-033 で選定を agent に委ね、agent は qa-classify-bulk-delegated-001 で旧と同じ案 (書き込みを json_each で束ねる) を選んだ。一括保存の 1 要求を 49 本以内にすることは変わらない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion で要件定義の訂正差分を提示し (2026-09-30T11:15:06.659Z)、その『C4 (訂正)』と『3 章の確定内容』の infrastructure 行 (既存の Worker・静的アセット・D1 のまま。binding・cron・環境変数・migration は足さない) を、利用者が『この内容で承認 (推奨)』で承認した (受領 2026-09-30T11:22:17.468Z)。answered_at は受領時刻を秒へ切り上げた値で、承認時刻の上界である。qa-classify-bulk-infrastructure-web-001 の『D1 batch は 1 回 50 文までに分ける』を置き換える。 / 回答時刻: 2026-09-30T11:22:18Z)

#### 裏付け質疑: `qa-classify-bulk-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、現行実装について何を観測したか。

**答**

api は Cloudflare Worker (packages/api/wrangler.jsonc:4 の main=src/index.ts)、静的アセットは ASSETS binding (wrangler.jsonc:8-10)、D1 は DB binding (wrangler.jsonc:15-17)。一括保存は D1 batch を 1 回 50 文までに分け (MAX_BATCH_STATEMENTS=50、packages/api/src/routes/classify-bulk.ts:44、分割は 177 行)、超えたら例外にする (classify-bulk.ts:191)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-30T07:53:11Z)

#### 裏付け質疑: `qa-classify-bulk-infrastructure-web-evidence-002`

**問**

infrastructure 章の裏付けとして、一括保存 1 要求の D1 クエリ数と Cloudflare の上限について何を観測したか。

**答**

Cloudflare の D1 limits は『Queries per Worker invocation (read subrequest limits) | 1000 (Workers Paid) / 50 (Free)』とし、上限は batch ごとではなく 1 回の Worker 起動の合計である。batch 内の文を 1 本ずつ数えるかは公式に明記が無く、リポジトリは『batch() も中の statement 数で数える』安全側の規則を採り、上限 50 から 1 本以上を残す (packages/api/src/scheduled-maintenance-budget.ts:4-6, 13-14)。現行の一括保存 1 要求は、読み込みが約 19 本 (authGuard のセッション検証と利用者の読み出し、loadDataset の 12〜14 本 packages/api/src/store.ts:524、取引先の記憶 1 本 store.ts:231、候補の算出 2 本)、書き込みが明細ごとに tx_edits の delete と insert の 2 文 (store.ts:278) と変更した項目ごとに tx_history の insert 1 文 (packages/api/src/classify-history.ts:128, 178)、batch ごとに 3 文である。classify-bulk.ts は batch を 1 回 50 文までに分ける (packages/api/src/routes/classify-bulk.ts:44, 177, 191) が、分けた batch もすべて同じ起動の本数に数えられるため、50 件の保存で 200 本を超え、無料枠の上限を超える。json_each に 1 パラメータで行を渡し、行数によらず INSERT を 1 文に保つ前例が store.ts:1937-1953 (aggregateReplacementQueries) にある。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) と、Cloudflare の公式ページ (fetched-references.json の cloudflare-d1-limits) を読んで記録した観測。クエリ数は各関数が組み立てる文を数えた値で、実行時の計測ではない。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-30T11:13:25Z)

#### 裏付け質疑: `qa-classify-bulk-decision-005` — 旧版（置き換え先: `qa-classify-bulk-decision-033`）

> **旧版** — この問答は `qa-classify-bulk-decision-033` で置き換えられた (`2026-10-01T01:43:48Z`)。
> 下の問・答は凍結された記録の逐語で、現行の接地根拠ではない。現行の問答は置き換え先を参照すること。
> - 置き換えの理由: 旧い問は選択肢に推奨の印があった (N1 の違反)。同じ論点を、印を外し、各選択肢の利点と不利な点を対称に書き、保留の道を残して問い直した。提示の逐語は qa-classify-bulk-presented-options-014。利用者は選択肢を選ばず、無料枠の範囲で最善の慣行を選ぶよう agent に委ねた。agent の選定は qa-classify-bulk-delegated-001 に記録した。

**問**

```text
一括保存の 1 要求が、Cloudflare 無料プランの「1 起動あたり合計 50 クエリ」を超えます（50 件で 200 本超）。どう解きますか？
```

**答**

```text
書き込みを束ねる (推奨)。明細ごとの編集・履歴の書き込みを json_each で 1 文ずつに束ねる (前例: 集計の置き換え aggregateReplacementQueries)。1 要求は明細数によらず約 25 本で、50 件も 100 件も 1 回で保存でき、上限と無料プランはそのまま。書き込みは 1 つの batch になるため、失敗すると保存対象の全件が write_failed になり、明細ごとの部分成功は無くなる。store と履歴の書き込み関数を変える。
```

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 2 問を 1 回で提示し、各問の先頭に推奨案を置いた (提示の逐語は qa-classify-bulk-presented-options-002)。利用者はこの問で「書き込みを束ねる (推奨)」を選択。answered_at は回答受領時刻 (2026-09-30T11:03:43.026Z) を秒へ切り上げた値で、選択時刻の上界である。完成度評価 1 周目の指摘 (1 起動あたりの D1 クエリ上限を batch 単位と取り違えていた) を受けて問い直した。 / 回答時刻: 2026-09-30T11:03:44Z)

#### 裏付け質疑: `qa-classify-bulk-decision-033`

**問**

一括保存の 1 要求が、Cloudflare 無料プランの「1 回の起動で D1 へ出すクエリは合計 50 本まで」を超えます (今の書き方では 50 件で 200 本を超えます)。どう解きますか。以前の問では選択肢に推奨の印が付いていたので、印を外して問い直します。以前と違う案を選ぶと、仕様の該当箇所を改めます。4 案のどれも選ばずに保留するときは、『その他』にその旨を書いてください。

**答**

自由記述で回答 (4 つの選択肢のどれも選んでいない):『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 4 問のうち「クエリの上限」の問を提示し、推奨の印は付けていない (提示の逐語は qa-classify-bulk-presented-options-014)。利用者はこの問で選択肢を選ばず、自由記述を回答した。answered_at は回答受領時刻 (2026-10-01T01:36:46.980Z) を秒へ切り上げた値で、回答時刻の上界である。qa-classify-bulk-decision-005 と同じ論点を問い直したもの。 / 回答時刻: 2026-10-01T01:36:47Z)

#### 裏付け質疑: `qa-classify-bulk-delegated-001`

**問**

qa-classify-bulk-decision-033 で利用者が選定を委ねた問「クエリの上限」について、agent はどの案を選んだか。

**答**

選んだ案: (1) 書き込みを束ねる — 明細ごとの編集・履歴の書き込みを json_each で 1 文ずつに束ねる (前例: 集計の置き換え aggregateReplacementQueries)。1 要求は明細数によらず約 25 本になる。利点: 50 件も 100 件も 1 回で保存でき、上限と無料プランはそのまま。不利な点: 書き込みが 1 つの batch になるため、失敗すると保存対象の全件が write_failed になり、明細ごとの部分成功は無くなる。store と履歴の書き込み関数を変える。 無料枠の条件から外れた案: (4)『Workers Paid にする』は月額の固定費がかかり、無料枠で動かすという条件から外れる。 選んだ理由: (2)『画面から小分けに順送り』は無料枠で動くが、途中で止まると一部だけ保存され、50 件で 10〜17 往復かかる。(3)『サーバの上限を下げる』は範囲外にした一括保存の上限の変更に当たり、50 件を一度に保存できない。(1) は、D1 の batch が 1 つのトランザクションとして実行されるため、全件が保存されるか全件が保存されないかのどちらかになり、途中まで書かれた状態が残らない。集計の置き換え (aggregateReplacementQueries) と同じ書き方で、1 要求のクエリは明細数によらず約 25 本となり、無料プランの上限 50 本に収まる。 これは利用者の委任 (qa-classify-bulk-decision-033) を受けた agent の選定で、利用者が選択肢から選んだ案ではない。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: 利用者は qa-classify-bulk-decision-033 で、選択肢を選ばずに『無料枠でできる上で、ベストプラクティスな内容を選定して進めてください。』と回答した。agent はこの委任を受けて、qa-classify-bulk-presented-options-014 の問1 の選択肢から選んだ。前回の選択と同じ案である (qa-classify-bulk-decision-005)。 / 回答時刻: 2026-10-01T01:43:48Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 一括保存を、提案が無くても使えるようにする。一括バーに区分・カテゴリ (大/中)・所有者・支払い方法の一括指定欄を置く (qa-classify-bulk-decision-041)。指定した項目は選択した全件に当てる。指定しない項目は、未整理の明細では各行の下書き→提案の順、確定済みの明細では下書き→今の値の順で埋め、手で決めた値を提案で置き換えない (qa-classify-bulk-decision-036・qa-classify-bulk-delegated-004)。区分とカテゴリは 1 組で決める。カテゴリ (大) を指定したらカテゴリ (中) も一括指定の値 (指定が無ければ空) にし、区分だけを指定したときは、埋める値のうち区分が同じものからカテゴリの組を取る (qa-classify-bulk-decision-035・qa-classify-bulk-delegated-003)。区分に合うカテゴリの組が、埋める値 (下書き・提案・今の値) のどこにも無い明細は、カテゴリを『カテゴリなし』にして保存する (qa-classify-bulk-decision-037・qa-classify-bulk-decision-048)。『カテゴリなし』は予約の値で持ち (qa-classify-bulk-decision-045)、集計では未分類と同じに数え (qa-classify-bulk-decision-046)、分類の状態は手動とする (qa-classify-bulk-decision-047)。一括指定の欄と編集パネルでは選べない (qa-classify-bulk-decision-048)。保存の前に、何件をどの値の出所で保存し、そのうち何件を『カテゴリなし』で保存するか、何件をどの理由で外すか (埋める値が無い行、確定済みで変わる値が無い行) を示し、外した行は失敗に数えない。再試行は書き込みの失敗 (write_failed) を返した明細にだけ出し、押せば必ずその明細だけを送り直す (qa-classify-bulk-decision-018)。書き込みの batch が失敗したときは、保存対象の全件が write_failed になる (qa-classify-bulk-decision-057)。見つからない・値が不正・分割がある明細には、再試行の代わりに理由を出す。要求全体が失敗したときは、選択を残し、文言を role=alert で出す。通信の失敗と 5xx は、書き込まれたかどうかが分からないので一覧と選択の読み出しを読み直し、『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』と出す (qa-classify-bulk-decision-054)。409 (取込みか別の更新が進行中) はサーバの文言を出す (qa-classify-bulk-decision-056)。通信の失敗・5xx・409 の後には『同じ内容で再試行』を出し、押すと直前の要求の本文をそのまま送る (qa-classify-bulk-decision-054・qa-classify-bulk-decision-056)。一括保存は同じ要求を送り直しても最終の状態が変わらないので、二重には保存されない。自動では送り直さない。400・403・413 は送り直しても結果が変わらないので、再試行を出さずにサーバの文言を出す (qa-classify-bulk-decision-055)。
- **G4**: 取引一覧を 13-classify.png どおりに読めるようにする。『取引先 / 内容』を 2 段の 1 列にまとめた 6 列 (選択・日付・取引先/内容・金額・提案カテゴリ・信頼度) にし、表示件数の選択 (25 / 50 / 100 件) と全 N 件のページ送りを置く。編集パネルは明細を開いたときだけ幅を取り、閉じている間は一覧へ幅を渡す。それでも足りない幅では表の中だけを横スクロールし、1264px 幅でも文字を 1 字ずつ折り返さない (qa-classify-bulk-decision-044)。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 提案の無い明細を一括指定で保存できる。 | DOM テストで、提案なしの 3 件を選び区分とカテゴリを指定して保存すると、要求に 3 件が入り、通知『選択した3件を保存しました。』が出る。core の単体テストで、指定しない項目が、未整理の明細では下書き→提案、確定済みの明細では下書き→今の値の順で埋まること、区分だけを指定したときは区分が同じ値からカテゴリの組を取り、組が無い明細は『カテゴリなし』で保存の対象に入って保存前の内訳にその件数が出ることを固定する。埋める値が無い行と、確定済みで変わる値が無い行は要求に入らず、保存前の内訳に外す件数と理由が出て、失敗に数えない。core の単体テストで、『カテゴリなし』の明細が、家計の集計と総収支の内訳では未分類に入り、説明可能率では説明できない側に数えられ、分類の状態が手動になることを固定し、いずれも通る。 |
| O2 | 失敗の種類ごとに、再試行の有無と理由が正しく出る。 | DOM テストで、保存前に外した行と、見つからない・値が不正・分割がある明細に再試行が出ないこと、書き込みの失敗 (write_failed) を返した 1 件の再試行でその 1 件だけが送られることを確かめる。要求全体の失敗について、通信の失敗と 5xx の後に一覧と選択の読み出しが読み直されて選択が残り、role=alert の文言が出て、『同じ内容で再試行』が直前の要求の本文をそのまま送ること、409 の後にもサーバの文言と同じボタンが出ること、400・403・413 の後にはサーバの文言が出て選択が残り、再試行が出ないことを確かめ、いずれも通る。 |
| O5 | 1264px 幅で取引一覧が崩れない。 | DOM テストで 6 列 (取引先/内容が 2 段)・表示件数の選択・ページ送りを確かめる。headless Chrome の画面検査に明細仕分けの範囲を新設し、1264px と 1280px で一覧の各列が最小幅以上・本体の横はみ出し 0、編集パネルを閉じると一覧が広がることを確かめ、通る。 |
| O7 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |
| O8 | 一括保存が無料枠の 1 起動の上限に収まる。 | API テストで D1 へのクエリを数え、50 件・100 件の保存がどちらも 49 本以内であること、書き込みの batch が失敗すると要求が 2xx で返って保存対象の全件が write_failed になることを確かめる。書き込む前に、1 回の batch の文が 50 本を超えるか、束ねた JSON が 2MB を超えると分かった要求は、413 too_many_classify_changes を返して明細ごとの結果を持たず、write_failed にならないことを確かめ、いずれも通る。 |
| O9 | 同じ要求を送り直しても二重に保存されない。 | API テストで、同じ一括保存の要求を 2 回送ると、2 回とも全件が ok で saved と各明細の status が同じであり、明細の値 (更新時刻を除く) と月次集計が 1 回目の後と同じで、履歴の行数が増えないことを確かめ、通る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: 一括操作バーに一括指定欄 (区分・カテゴリ大/中・所有者・支払い方法) を足し、保存の前に内訳 (保存する件数と値の出所、そのうち『カテゴリなし』で保存する件数、外す件数と理由) を出す。
- **I2**: POST /api/transactions/bulk を拡張し、一括指定と各明細の下書きを受け取る。サーバは明細を引き直し、core の解決関数で、未整理の明細は 一括指定→下書き→提案、確定済みの明細は 一括指定→下書き→今の値 の順に値を決める。区分に合うカテゴリの組がどこにも無い明細は、明細の編集の大項目の欄に『カテゴリなし』の予約の値を入れて保存する (『カテゴリなし』のための表と列は足さない。qa-classify-bulk-decision-045)。予約の値は core の 1 か所で定め、一括指定と編集の値としては受け付けない (qa-classify-bulk-decision-048)。値を決められない明細と、区分とカテゴリの組が候補に合わない明細は、明細単位の失敗として返す (画面は保存前に外すので、通常は届かない)。書き込みは json_each で束ねた 1 回の batch で行い (qa-classify-bulk-delegated-001)、batch が失敗したら要求を 2xx で返して保存対象の全件を write_failed にする (qa-classify-bulk-decision-057)。同じ要求を送り直しても、明細の値 (更新時刻を除く)・提案との一致 (done か manual か)・月次集計・履歴は 1 回目の後と変わらない。書き込む前に予算 (1 回の batch の文 50 本・束ねた JSON 2MB) を超えると分かった要求は、明細ごとの結果を持たない 413 で返す。
- **I6**: 取引一覧を 6 列 (取引先/内容の 2 段) にし、表示件数の選択とページ送りを置く。編集パネルを明細を開いたときだけの可変幅にし、表の中だけを横スクロールさせる。画面検査に 1264px と 1280px の明細仕分けを足す。
- **I7**: 再試行を、書き込みの失敗 (results の ok=false かつ code=write_failed) を返した明細にだけ出し、押すとその txId だけを送る。ほかの失敗には理由を出す。要求全体の失敗は、ApiError の status を 1 つの関数で分け、文言と再試行の有無をそこから引く。通信の失敗と 5xx は一覧を読み直し、通信の失敗・5xx・409 には直前の要求の本文をそのまま送る『同じ内容で再試行』を出し、400・403・413 にはサーバの文言を出す。401 は既存のログイン切れの扱いに従う。
- **I9**: 『カテゴリなし』の予約の値を core の 1 か所で定め、家計の集計・総収支の内訳・説明可能率・分類の状態・候補の検査・履歴・バックアップで、予約の値を未分類と同じ扱いに通す。予約の値と同じ名前のカテゴリの候補は作れなくする。

### 本章に効く確定意思決定

- **decision-005-d1-query-budget**: 一括保存の 1 要求が、Cloudflare 無料プランの「1 起動あたり合計 50 クエリ」を超えます（50 件で 200 本超）。どう解きますか？
  - 採択: 書き込みを束ねる (`bundle-writes`)
  - 目的適合: 明細ごとの編集と履歴を json_each で 1 文ずつに束ね、1 要求は明細数によらず約 25 本になる。選択 50 件も一括 100 件も 1 回で保存でき (G1・G5)、上限と無料プランはそのまま (C4)。
  - 採択の接地根拠: `qa-classify-bulk-decision-033`

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。一括保存・選択の読み出し・勘定科目の対応表の API を既存の api Worker と D1 binding (DB) に載せ、binding・環境変数・cron を足さない判断と、D1 の上限 (bound parameter 100・1 回の Worker 起動あたりのクエリ 50 本) の中に収める判断と、勘定科目の対応表の migration の当て方は、Reliability と Operations の上流指針 (doctrine) の側で記録した。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-10-01T10:34:37Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-09-30T11:31:00Z | 2026-10-01T00:25:20Z |
| cloudflare-d1-json | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/sql-api/query-json/ | 2026-09-30T12:07:03Z | 2026-09-30T12:07:03Z |
| cloudflare-workers-pricing | 2026-08-28 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/platform/pricing/ | 2026-10-01T00:25:20Z | 2026-10-01T00:25:20Z |

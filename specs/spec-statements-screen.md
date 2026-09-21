---
graph_node_id: "spec-statements-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api"]
title: "決算書画面 再現仕様 (11-statements.png)"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["statements", "analysis"]
file_path: "specs/spec-statements-screen.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/11-statements.png"
route: "/statements"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "2af46bb99cd65cf2b623bf5a6be167b7561e83457f4d939342c2bbc199c3c56c"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "2af46bb99cd65cf2b623bf5a6be167b7561e83457f4d939342c2bbc199c3c56c", "imported_at": "2026-09-19T23:36:20Z"}
created_at: "2026-09-19T12:06:39Z"
updated_at: "2026-09-19T23:36:20Z"
depends_on: []
related_nodes: ["arch-statements-ui-ux", "arch-statements-frontend", "arch-statements-backend", "arch-statements-database", "arch-statements-auth", "arch-statements-security", "arch-statements-infrastructure", "arch-statements-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations", "docs/data-schema.md", "docs/ui-decisions.md", "design/FINAL-UI/images/11-statements.png"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "11-statements.png の読み取りと利用者決定 (qa-statements-decision-001〜007・appr-foundation-statements-001/002) から画面構成・文言・検算済みフィクスチャ・データ契約を確定した画面仕様であり、実装 (web / core / api) が参照する正本。agent が具体化した値は qa-statements-detail-parameters-001 ほかで agent-inference と区分した。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-statements-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T12:06:39Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 決算書画面 再現仕様

`design/FINAL-UI/images/11-statements.png` を読み取り、**同じ画面を再現できる**粒度まで
要素・文言・状態・データ契約・保存を確定した仕様。実装 (`packages/web/src/pages/Statements.tsx`
と `packages/web/src/pages/statements/` 配下の部品、core の `statementsScreen`、api の
`GET /api/statements` と `PUT /api/balances/liabilities`、`migrations/0046_liability_status.sql`) はこの文書を実装契約とする。

## 正本の分担 (最初に読む)

| 何の正本か | 正本 | 備考 |
|---|---|---|
| 構成・文言・配置・状態の見た目 | `design/FINAL-UI/images/11-statements.png` | sha256 は `design/FINAL-UI/manifest.json` の 11-statements を正とする |
| 数値 | 本書「検算済みフィクスチャ」と core の `statementsScreen()` の出力 | 画像の月次表は `（万円）` と書かれているが、`950`〜合計 `12,480` は千円値として上部の `12,480,000円` と整合する。さらに列見出しは `5月` が 2 回あり `8月` 列が空欄である (C5)。画像の単位ラベルと月見出しは写さない |
| 区分の対応表・計算式 | `packages/core/src/statements-screen.ts` の固定表と `docs/data-schema.md` | 利用者は上書きできない (scope.out) |
| 上位概念 | `system-spec/00-requirements-definition.md` (U1-U9) | G1-G5 / O1-O5 / S1-S5 / C1-C5 |

画面の外枠 (サイドバー・ヘッダーの『税務ライン』『未処理』『最終更新』・フッター・月次クローズの進捗・『改善を送る』) は
既存の `Layout.tsx` をそのまま使い、本サイクルでは変えない (scope.out)。

## 1. 画面構成 (上から)

### 1.1 期間バー

- 既存の期間 UI (`usePeriod`、`1年 / 2年 / 3年 / 任意` の切替) を使う。右に `‹ 2025年9月 - 2026年8月 ›` の範囲表示と前後移動を置く。
- 前後移動は「同じ長さだけずらす」。全期間 (`applied=null`) のときは前後移動を無効にする。

### 1.2 問いの見出し

- 見出し (h1): `損益・資金・残高は、整合していますか？`
- 説明文: `損益計算書・キャッシュフロー計算書・貸借対照表のつながりを確認し、決算の整合性をチェックしましょう。`
- `PageHeader` の title / lead 上書き (Page.tsx) で出す。パンくずは `確認 / 決算書`、ナビ名は `決算書` のまま。

### 1.3 KPI 4 枚

| 枚 | ラベル | 値 | 前期比 | 出典 | 期間の行 |
|---|---|---|---|---|---|
| 1 | 売上高 | 期間の売上高合計 | 金額と % (`+¥1,240,000 (+11.0%)`) | `出典：仕訳データ` | `対象期間：2025年9月 - 2026年8月` |
| 2 | 営業利益 | 期間の営業利益 | 金額と % | `出典：損益計算書` | 対象期間 |
| 3 | 現金増減 | CF が集計できるとき営業 CF 概算の期間合計、できないとき `—` | 金額のみ (% は出さない。現金増減は符号が反転しうるため率に意味が無い) | `出典：現金収支/キャッシュフロー` | 対象期間 |
| 4 | 負債残高 | 基準月の負債合計 (状態が `金額` の項目の和。`0円` は 0 として足す) | 金額と % (前月末比。行のラベルも `前月末比` とする) | `出典：貸借対照表（要入力）` | `基準日：2026年8月末` |

- 各ラベルの右に `?` (説明のツールチップ。計算式を 1 文で示す)。
- 増減は符号と矢印を必ず併記し、色だけに頼らない。負債残高の増加は注意色、減少は良化色 (他の 3 枚と向きが逆。qa-statements-decision-005)。画像は負債の減少を赤で `前期比` と表示しているが、利用者決定により文言と色を変える (§8)。
- 現金増減の前期比は金額だけで % を出さない (画像の `前期比 +¥120,000` のとおり)。
- 前期が 0 のとき % は出さず `前期比 +¥X (—)` とする。前期のデータが無いとき (期間の前に月が無い) は `前期比 —` とする。
- 負債残高で必須 3 項目のいずれかが `未入力` のときは値を `未入力あり` と出し、合計を出さない (0 と取り違えない)。
- 負債残高だけ前期比を「前月末比」にするのは、負債残高が期間の流量ではなく基準日時点の残高 (ストック) だからである。売上高・営業利益・現金増減は期間の合計なので直前の同じ長さの期間と比べるが、残高を 12 か月前の残高と比べても今月の入力漏れや急増に気づけない。前月末の負債に必須項目の `未入力` があるとき、または前月末の行が 1 件も無いときは `前期比 —` とする。

### 1.4 ページ内ナビ (画像のタブの見た目)

- `損益計算書 / キャッシュフロー計算書 / 貸借対照表` の 3 項目を、タブの見た目のページ内ナビとして出す (qa-statements-decision-006)。`<nav aria-label="計算書">` の中に `?tab=pl|cf|bs` のリンクを並べ、現在位置の項目に `aria-current="location"` を付ける。WAI-ARIA の tablist / tab / tabpanel は使わない (3 節は隠さずすべて描画するため、パネル切替の意味論と一致しない)。
- 3 節はすべて縦に描画する (画像どおり、PL の下に CF・BS が続く)。項目を選ぶと該当節へスクロールし、フォーカスを節の見出し (`tabIndex=-1`) へ移す。
- 選んだ項目は URL の `?tab=pl|cf|bs` に保ち、再読込・共有時は該当節へスクロールする。既定 `pl`。スクロール位置による `aria-current` の自動更新はしない (選択した項目だけを示す)。

### 1.5 損益計算書 (PL) カード

- 見出し `損益計算書（PL）`、説明 `当期と前期の比較で、損益の状況を確認できます。`、右上に `エクスポート` (共通 Button、メニューで `CSV`)。
- 表の列: `勘定科目 / 当期 (2025/9-2026/8) / 前期 (2024/9-2025/8) / 差額 / 構成比 ?`。
- 行は 5 行固定: `売上高 / 売上原価 / 売上総利益 / 販管費 / 営業利益`。売上高・売上総利益・営業利益は太字。
- 各行は `›` で展開でき、展開すると内訳の勘定科目 (当期・前期・差額・構成比) を出す。売上総利益・営業利益の展開は計算式の行を出す。
- 行の選択で右の『項目の詳細』を切り替える。選択は勘定科目セル内の共通 Button (見た目は科目名のテキスト) で行い、`aria-pressed` で選択状態を示す (表の行に `aria-selected` は使わない。`aria-selected` は grid / listbox 等の役割でしか意味を持たないため)。展開の `›` は別の Button (`aria-expanded`)。選択は `?row=sales|cogs|gross|sga|operating`。既定は `sales`。選択行は背景色でも示す。
- 構成比は売上高を 100.0% とする比 (小数 1 桁)。売上高が 0 のとき `—`。
- 差額は `当期 − 前期` で符号つき。

### 1.6 項目の詳細パネル (右)

- 見出し `項目の詳細`、右上 `×` (閉じると PL 表が全幅になる。`?row=` を消す)。
- 選択行の名前と当期金額 (大)。
- `計算式`: 例 `売上高 ＝ 売上に関する収益の合計` / `売上総利益 ＝ 売上高 − 売上原価` / `営業利益 ＝ 売上総利益 − 販管費`。
- `主な内訳の勘定科目`: 当期金額の多い順に最大 3 科目 (売上高なら `売上高（本業収入） / サービス収入 / その他の営業収入` のように実データの科目名)。計算行 (売上総利益・営業利益) は構成要素の区分名を出す。
- `月別の推移`: 期間内の月ごとの棒 (万円)。
- `データの出典`: `仕訳データ（収益科目の合計）` のように区分ごとの固定文言。
- `関連データ`: `明細を開く ↗` (Link、className=btn)。遷移先は `/classify?category=<科目>&month=<期間の最終月>`。計算行は無効化し理由を title に出す。

### 1.7 月別の損益推移グラフ

- 見出し `月別の損益推移`、凡例 `売上高 (棒) / 売上原価 (棒) / 営業利益 (線)`、縦軸 `(万円)`。
- 既存 `FinancialCharts.tsx` の系列規約 (chart-series-contract) に乗せ、色はトークン。

### 1.8 月次の損益計算書 (PL) 表

- 見出し `月次の損益計算書（PL）`、単位 `(万円)` を右上に。
- 列: 期間の各月 (`9月 … 8月`) と `合計`。行: PL の 5 行。
- 万円への丸めは表示だけで行い (四捨五入・桁区切り)、合計列は円で合算してから丸める (丸めた値を足さない)。
- 列が多いときは表だけ横スクロールする (ページ本体は横スクロールしない)。

### 1.9 キャッシュフロー計算書 (CF)

- 見出し `キャッシュフロー計算書（CF）`。
- **集計できないとき** (core の `cf.status='unavailable'`):
  - 情報バナー `キャッシュフロー計算書は、現在集計できていません。` / `現金の入出金を分類するための取込データが不足しています。` / `正しく表示するには、すべての入出金取引の仕訳を完了してください。`、右に `取引データを確認 ↗` (→ `/classify`)。
  - `主な原因` (該当するものだけ、件数つき。0 件・偽の原因は出さない): `未仕訳の取引が残っている（N件）` / `現金口座データが一部取り込まれていない（N か月）` / `取引の勘定科目が正しく設定されていない（N件）`。2 番目の原因は、月の欠け (N か月) に加えて決済方法の列が無い取込しか無いとき (`settlementUnknown`) にも出し、そのときは件数の代わりに `（決済方法の列が無い取込があります）` と添える。月欠けと決済列の欠如が両方あれば `（N か月・決済方法の列なし）`。
  - `解決方法` の 3 手順 (番号つき): `データ取込で最新の取引データを取り込む` / `明細仕分けで仕訳を完了する` / `再度この画面を開いて確認する`。
  - 表とグラフは描画しない。
- **集計できるとき**: `pages/statements/StatementsCf.tsx` が既存の `CashFlowCharts` を使って営業 CF 概算の表とグラフを出す。投資 CF・財務 CF は出さない (scope.out)。

### 1.10 貸借対照表 (BS)

- 見出し `貸借対照表（BS）`。
- 基準月に必須 3 項目のいずれかが `未入力` のとき、警告バナー `負債残高のデータが入力されていません。` / `貸借対照表を作成するには、各項目の残高を入力してください。` / `入力された値は決算書の整合性確認に使用されます。`、右に `入力フォームを閉じる ⌃` (開閉。閉じているときは `入力フォームを開く ⌄`)。未入力が無ければ BS 表 (資産・負債・純資産) を出し、フォームは閉じた状態で始める。
- 未入力がある月は純資産を出さず `データ不足` と出す。
- 入力フォーム:
  - `基準月` の月ピッカー (期間内の月だけ選べる。既定は期間の最終月)。右に `✓ 下書きを自動保存しました 10:23` (下書きがあるときだけ)。
  - 行: `借入金 必須` / `未払金 必須` / `クレジット未払 必須` / `その他の負債` (任意)。
  - 各行は 3 択のラジオ `未入力 / 0円 / 金額を入力`。`金額を入力` を選んだときだけ金額欄 (¥・桁区切り表示、整数、0 以上 上限以下) を出す。保存済みで `金額` の行は画像のように金額欄を直接出す。
  - 必須行で何も選ばれていないときのエラー `<項目名>の入力方法を選択してください。` (項目の直下、role=alert)。
  - 注記 `0円と未入力は区別されます`。
  - `リセット` (保存済みの値へ戻し下書きを消す) と `負債残高を保存` (主ボタン)。
- 表示名と保存カテゴリの対応 (保存カテゴリは既存 `LIABILITY_CATEGORIES` を変えない):

  | 表示名 | 保存カテゴリ | 必須 |
  |---|---|---|
  | 借入金 | `借入金` | 必須 |
  | 未払金 | `未払金・買掛金` | 必須 |
  | クレジット未払 | `クレジットカード未払金` | 必須 |
  | その他の負債 | `その他の負債` | 任意 |

### 1.11 未保存バー (下部固定)

- 未保存の項目 (保存済みの値と下書きの値が違う項目) が 1 件以上あるとき、画面下部に固定表示: `未保存の項目が N 件あります` / `入力内容を確認し、保存してください。` / `リセット` / `負債残高を保存`。
- セーフエリアの下余白を足す。0 件で消える。ページ離脱時に未保存があれば `beforeunload` で確認する。

## 2. 状態

| 状態 | 表示 |
|---|---|
| 読込中 | KPI・表・パネルの骨組み (skeleton)。見出しと期間バーは出す |
| 空 (取引 0 件) | `この期間の取引がありません` と `データ取込へ` (Link)。KPI は `—` |
| 失敗 | 既存の ErrorState と `再読み込み` |
| 前期欠損 | 前期列 `—`、前期比 `—` |
| CF 集計不能 | 1.9 の不能表示 |
| 負債未入力 | 1.10 の警告と `データ不足` |
| 保存中 / 保存失敗 | ボタンを無効化し `保存中…`。失敗は role=alert で理由を出し、下書きは残す |

## 3. データ契約

### 3.1 core `statementsScreen(input)` (新設 `packages/core/src/statements-screen.ts`)

入力: `{ current: Dataset, previous: Dataset | null, deals, balances, referenceMonth, navigation? }`。
`previous` は api が `applyPeriod(all, previousRange(applied))` で切る (分析関数に期間を配らず Dataset を切る方針)。

出力 (JSON):

```ts
interface StatementsScreen {
  period: {
    from: string; to: string; label: string;
    previous: { from: string; to: string; label: string } | null;
    navigation: { applied: { from: string; to: string } | null; full: { from: string; to: string } | null; years: string[]; monthCount: number };
  };
  kpis: {
    sales: Kpi; operatingProfit: Kpi; cashChange: Kpi; liabilities: Kpi & { referenceMonth: string; incomplete: boolean };
  };
  pl: {
    rows: Array<{
      key: 'sales' | 'cogs' | 'gross' | 'sga' | 'operating';
      label: string; current: number; previous: number | null; diff: number | null;
      ratio: number | null;            // 売上高比。売上高 0 で null
      formula: string; source: string;
      accounts: Array<{ account: string; current: number; previous: number | null; ratio: number | null }>; // 金額降順
      monthly: Array<{ month: string; amount: number }>;
    }>;
  };
  cf: { status: 'available'; months: CashFlowMonth[]; cumulative: number[]; total: number; limits: string[] }
    | { status: 'unavailable'; causes: { unclassified: number; missingCash: { months: number; settlementUnknown: boolean }; accountUnset: number }; limits: string[] };
  bs: {
    referenceMonth: string; asOf: string; partial: boolean;
    lines: Array<{ category: string; label: string; required: boolean; status: 'unset' | 'zero' | 'amount'; amount: number | null }>;
    complete: boolean;
    assets: Array<{ category: string; amount: number }>; assetTotal: number;
    liabilities: Array<{ category: string; amount: number }> | null;
    liabilityTotal: number | null; netAssets: number | null; sources: string[];
  };
}
interface Kpi { value: number | null; previous: number | null; diff: number | null; diffRate: number | null; source: string; periodLabel: string }
```

- 区分の固定対応表: 青色申告決算書の「売上原価」欄に載る仕入系の科目 (`仕入高` `期首商品棚卸高` `期末商品棚卸高`。期末棚卸は減算) を売上原価 (外注工賃は決算書では経費欄なので販管費)、売上系 (`売上高` と収入系) を売上高、それ以外の経費を販管費、未知の科目は販管費。表は core の定数 1 か所に置き、docs とテストで固定する。
- 恒等式: 全月と合計で `gross = sales − cogs`、`operating = gross − sga`。
- 前期比: `diff = current − previous`、`diffRate = diff / |previous|` (previous=0 または null で null)。
- CF の不能判定: 原因 3 種のどれかが立つとき、かつそのときだけ `unavailable`。すなわち `unclassified > 0` または `missingCash.months > 0` または `missingCash.settlementUnknown` または `accountUnset > 0`。どれも立たなければ `available` (原因の無い不能表示を出さない)。
  - `unclassified`: 期間内の取引のうち明細仕分けが済んでいない件数。
  - `missingCash.months`: 期間内で取込が無い月 (`Dataset.unrecordedExpMonths` と期間の積) の数。
  - `missingCash.settlementUnknown`: 既存 `cashFlow().settlementUnknown` (決済列を持つ取引が 1 件も無い)。
  - `accountUnset`: 期間内の取引のうち勘定科目が空の件数。
  - 件数はすべて core がこの 1 か所で数え、web は数え直さない。

### 3.2 `GET /api/statements`

- 応答は `{ screen: StatementsScreen }` だけを返す。旧 `pl / cf / bs / liabilityCategoryOptions / balanceSheetSources / period` は同じ数値の二重契約になるため返さない。
- クエリ: 既存の期間クエリ + `ref=YYYY-MM` (基準月。期間外・不正は期間の最終月に丸め、応答の `bs.referenceMonth` に丸めた後の月を返す。web は URL をその値へ置き換える)。

### 3.3 `PUT /api/balances/liabilities` (項目単位の upsert へ変更)

```json
{ "month": "2026-08", "lines": [ { "category": "借入金", "status": "amount", "amount": 2000000 }, { "category": "クレジットカード未払金", "status": "unset" } ] }
```

- zod strict。`status` は `unset | zero | amount`。`amount` は `status=amount` のときだけ必須で整数・0 以上・上限 `1_000_000_000_000` (1 兆円) 以下。`zero` は amount=0 で保存する。`unset` は行を消す (未入力 = 行が無い)。
- **送られた項目だけ**を upsert / 削除し、送られていない項目には触らない (現行の「月の manual 負債を全削除して挿入」をやめ、データ消失を直す)。`source='mf'` の行には触らない。
- 本文上限 8 KiB (`bodyLimit`)、行数上限は `LIABILITY_CATEGORIES.length`。
- 既存の認証 (authGuard)・JSON Content-Type 検証・取込との直列化 (canonical-mutation-fence) を通す。
- 保存ごとに監査ログを 1 件書く (3.4)。応答は保存後の `bs` (3.1 の bs 形)。

### 3.4 migration `0046_liability_status.sql` (追加だけ)

- `ALTER TABLE balance_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'amount' CHECK (status IN ('zero','amount'))`。既存行は `amount` のまま (C4)。`unset` は行を持たないことで表す。
- 監査は新表 `liability_audit_log` (`id, user_id, actor_user_id, month, changed_json, occurred_at`) を `CREATE TABLE` で足す。既存 `audit_log` の action は CHECK 制約で閉じており、拡張には表の再構築 (INSERT…SELECT と DROP) が要る。これは Deploy の自動適用判定 (`plan-auto-migration.mjs`) で止まり、C4 の「破壊的な行書き換えをしない」に反するため採らない。`changed_json` には項目ごとの状態遷移 (`{"借入金":"amount→amount"}`) と件数だけを残し、金額は残さない。
- `0045_owner_labels.sql` が先に存在したため、計画時の 0045 から 0046 へ繰り下げた。schema guard と運用参照も 0046 に合わせる。
- 状態列の追加前に保存された手入力行で金額 0 のものは、適用後 `status='amount'`・`amount=0` になる。core はこの組を `zero` と同じ扱いで表示・完了判定する (利用者が値を入れた項目であり、未入力ではない)。行は書き換えない (C4)。次にその項目が保存されたとき `status='zero'` で上書きされる。
- 列の意味が変わるのは `amount` が 0 の行だけで、金額のある既存行は `amount` のまま意味も変わらない。

## 4. 下書き (ブラウザ内)

- キー `kanjo.statements.liabilityDraft.<userId>.<YYYY-MM>`、値 `{ savedAt, lines }`。`period.tsx` の localStorage の書き方 (try/catch) に倣う。
- 入力の変更から 800ms 後に保存し、`下書きを自動保存しました HH:mm` を出す。
- 保存成功・リセットで消す。ログアウト時に `kanjo.statements.liabilityDraft.` で始まるキーを全て消す。
- サーバへは送らない (C3)。

## 5. セキュリティ

- 既存: authGuard、SameSite=Strict の Cookie、JSON の Content-Type 検証、取込との直列化。変えない。
- 追加: 金額の上限、本文上限、監査 (3.4)、下書きキーに userId、ログアウトで消去。
- エクスポートの CSV は数式注入を防ぐため (OWASP ASVS 5.0 の 1.2.10)、文字列セルが `= + - @`・タブ・NUL で始まるときは先頭に `'` を付け、RFC 4180 の 2.6/2.7 に従って `,` `"` 改行を含むセルを二重引用符で囲み `"` を `""` にする。金額のセルは数値として書き出し `'` を付けない (負の差額 `-200000` を文字列にしない)。科目名は利用者データ由来なので必ずこの処理を通す。
- 外部送信なし。

## 6. 検算済みフィクスチャ

期間 2025-09〜2026-08 (12 か月)、前期 2024-09〜2025-08。単位は円。

| 区分 | 当期 | 前期 | 差額 | 構成比 |
|---|---:|---:|---:|---:|
| 売上高 | 12,480,000 | 11,240,000 | +1,240,000 | 100.0% |
| 売上原価 | 7,860,000 | 7,120,000 | +740,000 | 63.0% |
| 売上総利益 | 4,620,000 | 4,120,000 | +500,000 | 37.0% |
| 販管費 | 2,800,000 | 2,620,000 | +180,000 | 22.4% |
| 営業利益 | 1,820,000 | 1,500,000 | +320,000 | 14.6% |

- 前期比: 売上高 +11.0%、営業利益 +21.3%。恒等式は当期・前期とも閉じる。
- 月次 (千円。core fixture の正本であり、各値を `× 1,000` して円にする):

| | 9月 | 10月 | 11月 | 12月 | 1月 | 2月 | 3月 | 4月 | 5月 | 6月 | 7月 | 8月 | 合計 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 売上高 | 950 | 980 | 1,020 | 1,180 | 1,120 | 1,060 | 1,200 | 1,080 | 1,040 | 1,080 | 1,200 | 570 | 12,480 |
| 売上原価 | 600 | 620 | 640 | 760 | 720 | 680 | 760 | 700 | 660 | 680 | 760 | 280 | 7,860 |
| 売上総利益 | 350 | 360 | 380 | 420 | 400 | 380 | 440 | 380 | 380 | 400 | 440 | 290 | 4,620 |
| 販管費 | 210 | 220 | 240 | 260 | 230 | 220 | 260 | 240 | 220 | 230 | 260 | 210 | 2,800 |
| 営業利益 | 140 | 140 | 140 | 160 | 170 | 160 | 180 | 140 | 160 | 170 | 180 | 80 | 1,820 |

web の表は `（万円）` 表示なので、core が返す円を `÷ 10,000` して丸める。たとえば売上高は
9月 `950,000円 → 95万円`、期間合計 `12,480,000円 → 1,248万円` となる。画像にある
`950`〜合計 `12,480` を万円として表示してはならない。

- 負債 (基準月 2026-08): 借入金 `amount` 2,000,000 / 未払金 `amount` 300,000 / クレジット未払 `unset` / その他 なし → KPI は `未入力あり`、BS は `データ不足`。クレジット未払を `zero` で保存すると負債残高 2,300,000 (前月 2,500,000 から −200,000、−8.0%)。
- CF: 未仕訳 12 件・現金口座の欠け 1 か月・科目未設定 3 件・決済列あり → `unavailable`。原因をすべて 0 にしたフィクスチャ → `available` で概算表を出す。

## 7. 受入 (O1-O5 の具体)

- DOM: 1.2-1.11 の要素と文言がフィクスチャで描画される。ページ内ナビは `nav` のリンクで、選んだ項目だけ `aria-current="location"`、3 節すべてが描画されたまま該当節の見出しへフォーカスが移る (`role=tab` が無いこと)。ナビと行の選択が URL に残る。行の選択ボタンの `aria-pressed`。負債 KPI の比較ラベルが `前月末比` で、減少が良化色、現金増減の KPI に % が無いこと。3 状態の選択とエラー文。下書きの復元・リセット・未保存バーの件数。
- core: 恒等式・前期比 (前期 0 で null)・未知科目は販管費・構成比・CF 不能の原因件数と「原因が 1 つも無ければ available」・`settlementUnknown` 単独でも unavailable・負債の `unset` と `zero` の区別・状態列追加前の金額 0 の行 (`amount`, 0) が `zero` と同じ扱いになること・負債 KPI の前月末比 (前月末に未入力があれば null)。
- API: 1 項目だけ保存しても他項目が残る。`unset` で行が消える。上限超過の金額・8 KiB 超の本文は 400/413。未認証は 401。保存で監査 1 件。取込中は既存どおり 409。
- 既存テスト (`statements-balance-sheet.dom.test.tsx` ほか) は新しい文言・本文形へ更新する (契約を緩めない。旧実装で落ちることを確かめる)。
- docs/ui-decisions.md に §8 の差と根拠が記録されている。
- 834px 幅で基準画像と overlay し、動的な金額・日付・グラフ値と §8 の 6 件を除く配置・余白・文字階層・色の差が 0 件である。一律の pixel 差分率で未説明差を許容しない。この証跡が無い間、画像忠実度は未達とする。

## 8. 画像との意図的な差 (実装時に docs/ui-decisions.md へも記録する)

| 箇所 | 画像 | 本仕様 | 根拠 |
|---|---|---|---|
| 負債残高 KPI の比較 | `前期比`・減少を赤 | `前月末比`・減少を良化色 (増加を注意色) | 利用者決定 qa-statements-decision-005。残高は時点の値で、期間の比較より前月末との比較が意味を持つ。負債の減少は良い変化 |
| 上部の 3 項目 | タブの見た目 | 見た目はタブのまま、意味論はページ内ナビ (`nav` + `aria-current`) | 利用者決定 qa-statements-decision-006。3 節を隠さず描画するので tablist の意味と合わない |
| 行の選択 | 行の背景色 | 背景色 + 勘定科目セルのボタン (`aria-pressed`) | agent 判断 (qa-statements-agent-decisions-001)。表の行は `aria-selected` を持てない |
| 月次の損益計算書 | `（万円）` のラベルに対して `950`〜合計 `12,480` は千円値。月見出しも `5月` が重複し `8月` が空欄 | §6 の千円 fixture を core で円にし、web では正しく万円へ換算した `95`〜合計 `1,248` と 12 か月の見出しを表示 | 観察事実の訂正 (qa-statements-image-observations-001 / qa-statements-monthly-pl-unit-001) |
| CF 原因の 2 番目 | 月数のみ | 決済方法の列が無い取込も同じ原因として添える | agent 判断 (qa-statements-agent-decisions-001)。既存の概算が見られない条件を落とさない |
| 監査 | 画面に出ない | 保存ごとに `liability_audit_log` へ状態遷移と件数 (金額なし) | 利用者決定 qa-statements-decision-007 |

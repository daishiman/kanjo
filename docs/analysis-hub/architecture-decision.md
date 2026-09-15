# 支出分析ハブ 設計決定記録 (SYS-ANHUB-P02)

- 入力: `docs/analysis-hub/requirements-baseline.md`、`architecture/analysis-hub-{frontend,backend,ui-ux,security,auth}.md` (8 件すべて confirmed / pass)
- 本書は 8 件の architecture に分散した ADR を 1 か所へ集めた現行の正本。2026-09-15 の再改善で、初回導入時の未決事項も本書で確定した。

## 制約

| ID | 制約 | 出典 |
|---|---|---|
| C1 | 集計は `packages/core` の依存ゼロの純関数に置き、api は読取りと受け渡しだけ、web は表示だけ | backend / security |
| C2 | 色・余白・部品はトークンと共通 Button / PageShell 経由。`--aside-panel-w` 320px。WCAG AA | ui-ux / frontend |
| C3 | 表示していないタブの API は呼ばない。role=tab を手組みしない。現在地は 1 件。ハブ API は例外として `docs/ui-decisions.md` に明記 | frontend / ui-ux / security |
| C4 | 総収支は freee 正本の消し込み済みの値。未判断の重複候補は 4 区分の合計に入れない | backend |

## 決定一覧

### qa-analysis-hub-decision-001 — /analysis をハブにし ?focus= で選択を持つ

- 決定: `/analysis` (tab パラメータ無し) はハブを描く。`/analysis/:tab` は既存のタブ表示のまま。綴りの違う `:tab` は従来どおり既定タブへ `replace` で転送する。
- `?focus=` は `ANALYSIS_TABS` の id の許可リストで検証し、外れた値は既定 (`reconciliation`) として扱う。行選択は `setSearchParams(..., { replace: true })` で履歴を積まない。
- URL コピーは `location.origin + '/analysis?focus=<id>'` だけを書く。期間・金額は載せない。書込の成否 (NotAllowedError を含む) を `role="status"` で表示し、例外を握りつぶさない。

### qa-analysis-hub-decision-002 — core 純関数 + 集約 API

- 決定: `packages/core/src/analysis-hub.ts` に `analysisHub(input)` と期間ヘルパ `previousPeriod` を置く。
- `GET /api/analysis/hub` を `packages/api/src/routes/analysis-hub.ts` に置き、`/api/*` の authGuard → mustChangePasswordFence → runtimeSchemaGuard の後ろにマウントする。読取りは loadScoped と freee_deals / duplicate_verdicts / freee_deal_exclusions をすべて userId で絞る。
- 応答形 (型は core が所有する `AnalysisHubReport`):
  - `period`: 既存 `PeriodMeta`
  - `summary`: `{ income, expense, net, previous: { label, months, income, expense, net } | null, change: { income, expense, net } | null }`。change は比率 (0.1 = +10%)。前期間の値が 0 の項目は null
  - `views`: 5 視点ごとに `{ id, priority, count, ... }`。照合 `reviewCount`、総収支 `reviewCount`、マトリクス `unrecordedMonths` と `normal`、推移 `expenseChange`、診断 `annualSavings` と `candidateCount`
- 前期間は loadScoped が期間で切ったデータではなく `all` から切り出す。

### qa-analysis-hub-decision-003 — 規則を単純に定義し docs とテストで固定

- 決定: BR-001..003 を core の名前付き関数 (`hubPriority` / `matrixIsNormal` / `annualSavings`) にし、境界値テスト (要確認 0/1、未記録月 0/1、候補 0 件) で固定する。

### qa-analysis-hub-decision-004 — 分析まわりだけ短縮形

- 決定: `ANALYSIS_TABS[].label` を 照合 / 総収支 / マトリクス / 推移 / 診断 にする。サイドバー子行・タブ・現在地表示は label を共有するので同時に変わる。支出分析以外の文言は変えない。

### qa-backend-web-ah-decision-003 — 前期間は直前の同じ長さ

- 決定: `previousPeriod({from, to})` は月数 n を保ったまま n か月前へずらす。ラベルは `前${n}か月`。前期間の月が `all.months` に 1 か月でも無ければ `summary.previous` と `change` と推移の `expenseChange` を null にする。期間未指定 (全期間) のときは全期間を p として扱う (結果は常に欠けて null)。
- AI 側 (`packages/api/src/ai/dataset.ts`) の同名関数は P08 で core 版の呼出しへ置き換える。P05 では削除しない。

### qa-frontend-web-ah-decision-003 — queryKey 共有と C3 の例外

- 決定: Layout (サイドバーの件数バッジ) とハブが `['analysis-hub', 期間 key]` を共有する。Layout 側は `enabled: !locked` とし未認証画面では張らない。バッジは要確認 1 件以上の視点 (照合・総収支) だけに出し、リンクの外の兄弟要素に置いてリンクの accessible name を変えない。
- ハブ API は C3 の例外として `docs/ui-decisions.md` に明記する (P12)。
- `staleTime` は `30_000ms` とし、アプリ共通の値と合わせる。ハブと Layout は `ANALYSIS_HUB_STALE_TIME_MS` と `analysisHubQueryKey` を共有し、同一期間の重複取得を 1 本へまとめる。
- 分類・分割・予算など分析の入力を変える成功 mutation は `invalidateAnalysisDerived` を通す。総収支の重複判断・freee 除外は詳細を自前更新したうえで `invalidateAnalysisHub` を呼ぶ。期間を問わず `['analysis-hub']` 配下を無効化し、保存後の古い判定を残さない。

### qa-ui-ux-web-ah-decision-005 — 情報の優先順位

- 決定: 縦の並びは 見出しと URL コピー → 5 タブ → 3 KPI + 純収支説明 → 6 列ルート一覧 + 選択中パネル → 5 段の読み順 → 選択中 CTA。「説明を見る」は `?focus=` の置換、「○○を開く」は詳細への PUSH とし、一つの操作に混ぜない。
- `ANALYSIS_TABS` は label / path だけでなく、一覧の要約・目的、読み順、選択中パネルの要約・わかること・アイコン付きデータソース・対象外データを持つ唯一の正本とする。パネル内 CTA も同じ path から導出し、表示側で説明文を分割・再定義しない。
- 配置は `pages/analysis-hub/analysis-hub.css` に閉じ、値はデザイントークンから生成される CSS 変数だけを使う。1199px 以下は同じ `ANALYSIS_TABS` を入力とするカード表示に切り替える。1024〜1199px は常設サイドバーで本文が狭まるため summary と workspace も 1 列にし、ページ全体の横溢れや KPI の省略を作らない。
- 選択中はタブのティール下線、一覧の背景と左 accent、`aria-pressed`、読み順の `aria-current="step"` を同期する。状態は文言・異なるアイコン・意味色の 3 符号、優先度は「高」「中」の文字と意味色 badge で表す。
- 下部 CTA は通常フローに置く。画面内の一覧や右パネルを覆う sticky 表示にはしない。狭幅でもパネル内 CTA と下部 CTA は同じ選択先を示すが、どちらも常時固定しない。
- 表では行の分析視点・目的・状態・優先度を一つの選択面とし、カードでは余白も同じ選択面にする。行は単一の keyboard focus target とし、Enter / Space でも選べる。内側の詳細 CTA は選択を発火させず PUSH だけを担い、文字選択中のポインタ操作は横取りしない。
- 6 列表の操作列は最長ラベル「マトリクスを開く」を基準に 150px を確保し、CTA は 138px 以上・44px 以上・1 行で表示する。1199px 以下のカードも同じ CTA 部品を使い、極狭コンテナでは選択と詳細の操作を縦積みにする。

### qa-navigation-web-ah-decision-006 — SPA 遷移をページ遷移として扱う

- 詳細への PUSH では先頭へスクロールし、lazy 描画後の `h1` (無ければ `main`) へフォーカスを移す。Back / Forward の POP はブラウザのスクロール復元を上書きしない。タイトルは route metadata から導出する。
- 直接 deep link、リロード、Back / Forward のいずれでも `/analysis/:tab` を同じ詳細として描画する。

### qa-state-web-ah-decision-007 — 未取得と 0 を分ける

- loading / error / empty / success を別状態にする。error は「取得できません」と局所再試行、empty は取込導線を示し、0 円とは表示しない。どちらの状態でも詳細リンクは利用可能に保つ。

### qa-visual-web-ah-decision-008 — 実描画を11条件と操作で固定する

- `packages/web/scripts/check-analysis-hub-visuals.mjs` は匿名レスポンスだけで `/analysis?focus=total-cashflow` を実 Chrome 描画し、共通 viewport 正本から 320 / 375 / 390 / 430 / 768 / 820 / 1024 / 1180 / 1280 / 1600px と 375px の 200% 拡大を検査する。
- 横溢れ、表とカードの切替、選択中 1 件、KPI の前期間額、状態アイコン、優先度 badge、パネルの構造化リストと CTA、読み順の現在段階、全操作の 44px 高、下部ナビとの非重複を固定する。全5件の詳細 CTA は表示文字の順序・1行表示・内容幅内への収まりも測る。
- 目的・状態・優先度セル、行の keyboard focus、カード余白を実操作し、panel / tab / journey / 下部 CTA の同期を確認する。詳細 CTA は pathname だけを PUSH し、選択用 query を同時発火させない。詳細描画後の scroll=0 と h1 focus、Back / Forward も同じ検査で確認する。スクリーンショットは実行ごとの一時ディレクトリへ出し、実データや成果物をリポジトリへ保存しない。

## Entry gate (P05 着手条件)

- [x] 決定 7 件が本書にある
- [x] staleTime 値・invalidate 範囲・遷移境界・空/失敗状態を現行実装と一致させた
- [x] C1..C4 と各決定の対応がある

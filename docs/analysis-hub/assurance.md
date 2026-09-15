# 支出分析ハブ 品質保証 (SYS-ANHUB-P09)

- 実施日: 2026-09-15
- Entry gate: `docs/analysis-hub/refactoring.md` (P08) が存在する
- 対象: `packages/web/src/pages/Analysis.tsx`、`packages/web/src/components/Layout.tsx` (サイドバーのバッジ)、`packages/api/src/routes/analysis-hub.ts`
- 結論: 6 観点すべて基準内。品質基準未達による P05 / P08 への差し戻しは無し。既存 check 系が `/analysis` ハブを対象に含まない点は follow-up (下記 6)。

## 判定一覧

| 観点 | 判定 | 根拠節 |
|---|---|---|
| WCAG AA (色だけに頼らない・コントラスト) | pass | 1 |
| URL に金額・取引・期間を載せない | pass | 2 |
| 未認証で 200 を返さない | pass | 3 |
| D1 読取り本数が既存予算内 | pass | 4 |
| CSP (`_headers`)・デプロイ経路の無変更、js-budget | pass | 5 |
| check:mobile-layout / check:financial-routes / check:js-budget | pass (exit 0。ハブ本体は実描画検査で補完) | 6 |

## 1. アクセシビリティ (WCAG 2.2 AA)

### 色だけに頼らない

| 表示 | 色以外の手がかり | 根拠 |
|---|---|---|
| 分析ルート一覧の優先度 | 「高」「中」の文字をバッジに出し、読み上げ用に「優先度」を visually-hidden で前置 (`Analysis.tsx` の `badge` / `badge danger`) | `analysis-hub.dom.test.tsx`「/analysis はタブへ転送せず、ハブの構成要素を描く」 |
| サイドバーの件数バッジ | 「要確認」を visually-hidden で前置し、数値と「件」を文字で出す。バッジはリンクの外に置き、リンク名はタブ名のまま | 同「照合と総収支の子行に、集約応答の要確認件数をそのまま出す」 |
| 選択中の行 | `aria-pressed` と右パネルの見出しで伝える | 同「?focus=total-cashflow で…選択状態になる」「不正な focus は既定 (照合) として扱う」 |
| 前期間比の増減 | 符号付きの数値と「前期間比」の visually-hidden ラベル。比較データが無いときは「比較データなし」の文字 | core「BR-004 前期間比」、hub dom テスト |
| URL コピーの成否 | `<output aria-live="polite">` (暗黙 role=status) に「URLをコピーしました」「URLをコピーできませんでした。アドレスバーから手動でコピーしてください」の文字 | 同「URL コピーは focus だけを載せ…」「クリップボードへ書けないときは…」 |

### コントラスト

色の値は `packages/core/src/design-tokens.ts` が正本で、`styles.css` の custom property はそこから生成される。比は同ファイルの `contrastRatio` (WCAG 2.2 の相対輝度) で計算した。

| 組 (文字 / 地) | 比 | 基準 |
|---|---|---|
| `--danger` / `--danger-soft` (優先度「高」とサイドバーのバッジ) | 5.38 | 4.5 |
| `--danger` / `--surface` | 5.86 | 4.5 |
| `--ink` / `--surface` (本文) | 15.62 | 4.5 |
| `--ink-soft` / `--surface` (補足文) | 5.08 | 4.5 |
| `--ink-soft` / `--bg` | 4.77 | 4.5 |
| `--good` / `--surface` (純収支の増) | 5.28 | 4.5 |
| `--accent` / `--surface` | 4.86 | 4.5 |
| `--on-primary` / `--primary` (「開く」の主ボタン) | 13.07 | 4.5 |
| `--danger-soft` / `--primary` (サイドバー地の上のバッジ面) | 12.01 | 3 (部品) |

既存の `packages/web/src/design-tokens-contrast.test.ts` も、文字用トークン全件の 4.5:1、部品枠の 3:1、「同じ規則で塗りと文字色をトークン指定した組は 4.5:1 以上」(`.badge.danger` を含む) を検査しており緑 (web テスト全件緑)。ハブは新しい色を足しておらず、`packages/web/src` の直書き色は 0 件 (acceptance.md AC-001)。

### 操作

- 下部バーの「〇〇を開く」はリンク (`Link`) で高さ 44px (`--tap-target-min`)。320〜1600px の実描画で、最下部までスクロールしても中心点が他の要素に覆われない (acceptance.md AC-006 の狭幅検査)。
- 行選択と URL コピーは共通 `Button` (native button) で、キーボード操作とフォーカス表示は共通部品の既存規則に従う。

## 2. URL に財務情報を載せない

- コピーする URL は `Analysis.tsx` で `${window.location.origin}/analysis?focus=${encodeURIComponent(focus)}` の固定形。組み立てに使う値は origin と focus だけで、金額・取引・期間の変数を参照していない。
- `focus` は許可リスト (`ANALYSIS_HUB_VIEW_IDS` の 5 値) で検証し、それ以外は既定値 `reconciliation` に落とす。任意文字列が URL やパネルに流れない。
- テスト: 「URL コピーは focus だけを載せ…」が `writeText` の引数を完全一致 (`/analysis?focus=trends`) で検査。「不正な focus は既定 (照合) として扱う」。
- 行選択は `replace` で履歴を積まない (「行を選ぶと URL の focus が置き換わる」が navigation type `REPLACE` を検査)。

## 3. 認証境界

- `GET /api/analysis/hub` は `/api/*` 共通の `authGuard` → `mustChangePasswordFence` → `runtimeSchemaGuard` の後ろにマウントされ、専用の抜け道は無い。
- `packages/api/src/analysis-hub.test.ts`: Cookie なしで 401、一時パスワード変更前で 403 `password_change_required`、他の利用者 (`other-user`) の freee 取引・MF 明細を集計に混ぜない。いずれも緑。

## 4. D1 読取り量

architecture/analysis-hub-infrastructure.md は「ハブ API の D1 読取りを既存 /total-cashflow と同程度に保ち、Free 50 / Paid 1000 クエリ/invocation の上限内」を求める。

| ルート | ルート固有の D1 文 | 内訳 |
|---|---|---|
| `GET /api/analysis/hub` | 15 | `loadScoped` → `loadDataset` 12 (monthly_agg・restored_monthly_agg・mf_transactions・ルール・tx_edits・budgets・cash_overrides・unrecorded_months・institution_owners・sub_vendors・cash entries・tx_splits) + freee_deals・duplicate_verdicts・freee_deal_exclusions の 3 |
| `GET /api/total-cashflow` (比較対象) | 15 | 同じ `loadScoped` + 同じ 3 テーブル |

- 数え方: ソースの静的読取り。`loadDataset` の `Promise.all` 12 要素がそれぞれ 1 文 (`loadOrderedRuleRows` / `loadSubVendors` / `loadCashEntries` も各 1 文) で、ルート本体の `Promise.all` が 3 文。前後に追加の読取りは無い。
- 認証・スキーマ検査 (30 秒キャッシュ) の分は全 `/api/*` ルート共通で、ハブ固有の増分ではない。
- 前期間比のために別クエリを発行せず、読み込み済みの `all` から core が計算する (期間で切る前のデータを渡す)。
- 画面側: サイドバーのバッジとハブ本文は同じ queryKey (`analysisHubQueryKey`) を共有するため、ハブ表示中の要求は 1 本 (acceptance.md AC-003)。
- 実行時の文数計測は一時テストファイルを repo に置く必要があり本 task では行っていない。上の数は静的読取りによる。

## 5. 配信構成・バンドル予算

| 確認 | 結果 |
|---|---|
| `packages/web/public/_headers` (CSP) の差分 | なし |
| `.github/workflows/ci.yml` / `deploy.yml` / `migrate.yml` の差分 | なし |
| `packages/api/wrangler.jsonc`・`migrations/` の差分 | なし |
| `pnpm --filter @kanjo/web run build:bundle` の直後に `check:js-budget` | exit 0。初期 JS 107.24KiB / 110KiB |

`check:js-budget` は `build:bundle` 直後の manifest を読むため、この順で実行した (`build` 全体の後だと manifest が消える)。

## 6. check 系

| コマンド | exit | 備考 |
|---|---|---|
| `pnpm --filter @kanjo/web run check:mobile-layout` | 0 | 「スマホ幅レイアウトの実描画検査: すべて合格」 |
| `pnpm --filter @kanjo/web run check:financial-routes` | 0 | 「財務画面の実描画検査: すべて合格」。本 worktree の vite を 127.0.0.1:4185 で起動し `KANJO_VISUAL_BASE_URL` で指定 (既定の 4175 は別 worktree の vite が使用中) |
| `pnpm --filter @kanjo/web run check:js-budget` | 0 | 上記 |

注意 (follow-up): `check:financial-routes` が巡回するのは `/analysis/matrix`・`/analysis/trends` などタブ側で、ハブ本体 `/analysis` は含まれない。`check:mobile-layout` は静的フィクスチャを描くためハブの実画面を見ない。architecture/analysis-hub-maintenance-ops.md は両 check の対象に `/analysis` を加えることを求めているが、`scripts/` は本 feature のどの task の write scope にも入っていないため追加していない。代わりに同じ方式 (headless Chrome + API 差し替え、匿名データ) でハブを 320 / 360 / 375 / 390 / 375 zoom200 / 768 / 1280 / 1600px で実描画し、横スクロール 0・下部バーの操作可能を確認した (acceptance.md AC-006)。check 系への `/analysis` 追加は別 task で行う。

# T4. リリース判定 — 確定申告の準備

**判定**: ローカルリリース候補 Go / 本番 No-Go / **判定日**: 2026-08-29

## ゲート結果

| ゲート | 結果 | 証拠・残条件 |
|---|---|---|
| 型・lint・テスト・build | ✅ | core 449（skip 6）、API全体238、Web 251、追加後のheader 6・tax API 11・Tax UI/性能/狭幅Export契約、Wrangler dry-run |
| 脆弱性・secret・アクセス制御 | ✅ | `pnpm audit` 0件、scheme/URL認証情報拒否、他ユーザー分離、共通security headers |
| preview smoke | ✅ | 一時D1/R2へ全migration、SPA/auth/cash/attachment往復 |
| 体験QA | ⚠️ | DOM/mobile CSS/空・部分・エラーを検証。Chrome 375px・3G emulation・200%相当はPASS。実端末の通信回線、2タブ操作は未実施 |
| UX心理 | ✅ | 要対応優先、既定継承、状態可視化、ダークパターンなし |
| 性能 | ⚠️ | Slow 3G・CPU 4xでTaxReturn直列chunk除去前 LCP 8,919ms → 除去後 7,915ms（-1,004ms / -11.3%）、CLS 0.00。メニュー操作はinput 6ms+処理5msだが、labの描画待ち込みINP 414ms。初期JS 100.76/110KiB |
| アクセシビリティ・日本語 | ✅ | Mobile Lighthouse Accessibility/Best Practices 100/100、label、aria-live、focus、375px、44px操作領域、200%相当のnav/action sheetで横overflowなし |
| リスク・回復 | ⚠️ | backup→restoreとロールバック手順は検証済み。本番0027/0028は未適用 |

Blocker/Criticalはコード候補内0件。4条件は「矛盾なし・漏れなし・整合性あり・依存関係整合」すべてPASS。

## 本番No-Goの理由

| 項目 | 条件 |
|---|---|
| D1 migration | 0027/0028を承認済みmanifestでコードより先に適用する |
| 受け入れ | 依頼者がpreviewで主要ジャーニーを確認する |
| 実測 | 本番相当でLCP/INP/CLS、3G、200%拡大を確認する |

本番URLは変更していない。R2が停止または原本を返さない場合はserver側readiness/streamを失敗させ、欠損ZIPを完成物として返さない。アプリrollbackとD1 Time Travelは [`docs/ci-cd-operations.md`](../../ci-cd-operations.md) に従う。

Apple基準: ローカルデモは **Yes**。本番公開は上記3条件が未充足のため **No-Go**。

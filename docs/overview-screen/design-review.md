# 概況画面 設計レビュー (SYS-OVERVIEW-P03)

- 対象: `docs/overview-screen/architecture-decision.md` (P02)
- 基準: `specs/spec-overview-screen.md` の BR-001..BR-007・API契約節・セキュリティ確認、`architecture/overview-screen-*.md`
- 方法: P02 の各決定を BR と spec の制約文へ 1 件ずつ突き合わせ、矛盾・未定義・既存コードとの衝突を指摘として起こし、P02 を是正して閉じる。レビュー時点で既存コード (store.ts のバックアップ SQL、imports.ts の復元、import-lifecycle.ts の write-set、canonical-mutation-fence.ts) を読み、実装上の衝突も対象にした。

## 1. BR 突合

| BR | P02 の該当決定 | 判定 |
|---|---|---|
| BR-001 4 要素は同じ月別系列から | §2: `ScopeMonth[]` 1 本から kpi/trend/yearComparison/breakdown を出し、core テストで総額差 0 を固定 | 適合 |
| BR-002 件数は全期間 | §3: review-queue はクエリを受けない。`month` を返し表示だけ画面で絞る | 適合 |
| BR-003 範囲は 4 要素だけ | §2: `closeStatus` は scope/期間非依存。review-queue は scope を受けない | 適合 |
| BR-004 指紋一致の間だけ有効・月境界で解除しない | §4: GET 時に再計算して一致のみ除外。時刻による失効なし | 適合 |
| BR-005 保留はステップ判定では未完了 | §5: 仕分け・照合のステップは保留を含む全件で数える | 適合 |
| BR-006 根拠の順序と決定論 | §3: vendor_memory → rules → MF中項目 → なし。乱数・時刻を使わない | 適合 |
| BR-007 kind/itemKey/month を core とルートの双方で検証 | §1 エラーコード表・§4・§5: core validator をルートが呼び、D1 CHECK でも同じ制約 | 適合 |

## 2. 指摘と是正

| # | 重大度 | 指摘 | 是正 (P02 反映箇所) | 状態 |
|---|---|---|---|---|
| R1 | 高 | 当初案の指紋 `amount|date|content` をそのまま保存すると、spec セキュリティ確認「新テーブルに明細本文の写しを持たない」に反する | 指紋を `sha256Hex(canonicalEncode([amount,date,content]))` の 64 桁に変更し、CHECK `length(fingerprint)=64` で平文の混入を DB でも拒む (§4・§6) | 是正済み |
| R2 | 高 | 復元の重複判定は write-set 全体の指紋で行う。新テーブルを write-set に入れないと「保留だけ違う」バックアップが duplicate としてスキップされ、O3 を満たせない | write-set 指紋に両テーブルの行を含める (§6) | 是正済み |
| R3 | 中 | PUT snooze はサーバで指紋を計算する決定だが、対象明細がキューに無い場合の応答が未定義 | 404 `review_item_not_found` を追加 (§1・§4)。spec の taxonomy (400/401/409/503/500) からの追加だが、spec は「エラー形は plan で確定」としており矛盾しない | 是正済み |
| R4 | 中 | 取込キューの出典が `import_runs` と `imports` で揺れうる。`imports` 行単位で数えると 1 run の複数ファイル失敗が複数件になり、履歴の破棄 (run 単位) と件数がずれる | spec どおり `import_runs.status='failed'` を run 単位で数える (§3) | 是正済み |
| R5 | 中 | 既存 `defenseForecast.level` は `'watch'` で、spec/arch は `caution` と書く。core の型を変えると他画面 (Tradeoff 等) の分岐を壊す | API 境界でだけ `watch → caution` に写す (§2) | 是正済み |
| R6 | 低 | scope の未知値を 400 にすると、期間の「壊れた指定は全期間に倒す」既存方針と非対称になる | 期間は古いブックマーク互換のための例外で、scope は新設パラメータのため spec の「違反は 400」を優先する。analytics-period.test の scope 検証は期間解決と分けて書く (§2) | 是正済み (方針明記) |
| R7 | 低 | 明細の削除・全件初期化で新テーブルを消すかが未定義 | 消さない。判断の記録であり、明細が消えれば指紋が計算できず件数に影響しない (§6) | 是正済み |
| R8 | 低 | 月次レビュー PUT の再実行で `reviewed_at` を更新すると冪等の定義 (同じ結果) が曖昧になる | 既存行があれば初回の値を保つ (§5) | 是正済み |

## 3. 横断確認

- 外部送信: 新規の fetch 先・外部 SDK なし。CSP `connect-src 'self'` は index.test.ts の CSP 検査で固定されたまま (w3c-csp3 再照合は P01 §5)。
- 認証: 4 エンドポイントは `/api/*` 配下で authGuard を必ず通る。未認証 401 は P04 の API テストで固定する。
- 直列化: PUT/DELETE の 4 経路を `CANONICAL_MUTATION_ROUTES` に追加し、409 `canonical_write_busy` は既存 fence の形に従う。書込は JSON snapshot の復元 write-set を変えるので `JSON_SNAPSHOT_MUTATION_CONSUMERS` に `review_snoozes` / `monthly_close_reviews` を足し、ハンドラで invalidate する。
- スキーマ版: migration 0040 と `EXPECTED_D1_MIGRATION` を同じ差分で更新する (更新漏れは runtimeSchemaGuard の 503 と deletion-schema.test の失敗で検出される)。
- 性能: GET /api/overview と review-queue はそれぞれ既存の `loadDataset` + 付随テーブル数本の読み取りで、新規の N+1 は無い。

## 4. 結論

是正未了の指摘 0 件。P04 (red テスト) に進んでよい。

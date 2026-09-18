# サブス画面 — query 最適化実装・テスト案

## 現状の証拠

[`baseline-audit.json`](baseline-audit.json) の初回表示から詳細開閉までに、画面本体の `/api/subscriptions?span=1` に加えて `/api/sub-vendors` と `/api/sub-vendors/candidates` が詳細未選択でも取得される。行を開くと `/api/subscriptions/vendors/:key` が追加される。

API 側は詳細取得で `subscriptionVendorDetail()` が `screenWithContext(ctx)` を通し、一覧行だけでなく KPI・カバー率・推移・比較まで再計算する。更新後はすべての mutation が常に `subscriptions / review-queue / sub-vendors / sub-candidates / summary` を無条件で invalidate する。

## 最小縦切り

1. **初回表示の過剰取得を止める**
   - `sub-vendors` と `sub-candidates` は少なくとも `enabled: Boolean(activeRow)` にする。
   - 次段階で詳細 tab を controlled にし、登録済みは「関連データ」tab、未登録は統合先が必要になったときだけ vendor 設定を取得する。
   - 画面が `/sub-vendors/candidates` から使うのは `excluded` だけなので、候補再集計を含む endpoint を呼ばず、軽量な exclusions 専用 endpoint へ分ける。

2. **詳細で画面全体を再集計しない**
   - core に `rowsWithContext(ctx)` 相当を 1 本抽出し、`screenWithContext()` はその行から KPI・推移・比較を構築、`subscriptionVendorDetail()` は対象行と明細だけを構築する。
   - まずはカバー率・推移・比較の再計算を除去する。expense projection 自体の部分化は照合意味を壊すリスクがあるため、別の計測を通してから行う。
   - `/review-queue` のバッジ算出も full screen ではなく、同じ行構築結果から pending 件数だけを得る関数へ変更する。

3. **mutation ごとに invalidate する依存先を固定する**

| mutation | invalidate する query | invalidate しない query |
|---|---|---|
| 候補の確認 / 除外 / 取消 | `subscriptions` root, `review-queue` | `sub-vendors`, `sub-candidates`, `summary` |
| カテゴリ上書き | `subscriptions` root, `sub-vendors` | `review-queue`, `sub-candidates`, `summary` |
| 最終見直し日 | `subscriptions` root, `sub-vendors`, `review-queue` | `sub-candidates`, `summary` |
| 未登録の候補除外 / 取消 | `subscriptions` root, exclusions, `review-queue` | `sub-vendors`, `summary` |
| 登録・削除・名称/別名/対象科目 | `subscriptions` root, `sub-vendors`, candidates/exclusions, `review-queue`, `summary` | 無関係な analysis query |

`subscriptions` root の invalidate は、表示中の screen と detail を同じ依存として再取得できるため残す。ただし影響セットを mutation の種類で分け、全 mutation 共通の定数は廃止する。

## 依存順序

1. core で行構築と full-screen 派生を分離し、既存数値契約を固定する。
2. API の詳細と review count を軽量関数へ接続し、従来と同じ JSON と判断結果を保つ。
3. exclusions の軽量読取 endpoint を追加し、web の未使用 candidate 応答依存を外す。
4. web の lazy query と mutation 別 invalidation を実装する。
5. DOM/API/CDP の要求トレースで回帰確認する。

## 検証計画

- core: screen の行と detail の行が同一になる contract test。候補指紋、overlap、未登録、全期間/1年の境界を含める。
- API: detail が screen と同じ月額・年換算・明細数を返す統合 test。exclusions endpoint は別 user を返さず `private, no-store` を保つ。
- web: 詳細未選択で `/sub-vendors` と candidates/exclusions を呼ばない。詳細/tab の必要時に 1 回だけ呼ぶ。
- web: 各 mutation の直後に、上表の対象だけが再取得されることを fetch call 数で固定する。
- browser: 初回表示、行の開閉、tab 切替、候補判断、別名統合の request path を収集し、無関係な `/summary` ・ candidate 再集計が発生しないことを確認する。
- 最終: `pnpm typecheck`、関連 vitest、実ブラウザの console 0、1024/1280/375/768/1600 の画面比較。

## 非目標

- D1 からの部分的な明細取得だけで expense projection を作り直す大幅変更は、今回の最小縦切りに含めない。freee / MF の二重計上防止と照合意味を優先する。
- 実データによる性能測定は行わない。匿名 fixture の request 数と決定的な出力で固定する。

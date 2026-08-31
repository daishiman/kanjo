---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed`

## U1 本質的目的 (essential_purpose)

本番環境のデータベーススキーマを、デプロイ済みアプリケーションコードが前提とする版へ確実に一致させ続けることで、利用者が「取込を実行できませんでした: サーバーエラーが発生しました」に遭遇せず日々の記帳を完了できる状態を保つ。

## U2 背景 (background)

事故観測時、本番D1 (kanjo-db / fe9e732c-687c-4507-b704-1955b5367547) の d1_migrations は 0005_sub_vendors.sql までしか記録されておらず、migrations/0006〜0014 の9本が未適用だった。一方 Worker のコードは 0014 相当のスキーマを前提としており、POST /api/imports は acquireImportWriter が参照する import_writer_claims テーブル不在で、GET /api/imports は import_active_targets 参照で、いずれも D1 の no such table により 500 を返した。現在の repository head には 0015 も存在するため、0006〜0014 は事故時の事実に限定し、実際の適用対象は作業開始時の remote list から決める。原因はアプリのロジック不具合ではなく、デプロイ運用にスキーマ適用工程が組み込まれていないこと (人手依存で適用漏れが検出されないこと) である。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 本番D1のスキーマをコードが前提とする最新版へ復旧し、データ取込と取込履歴が正常に動作する状態へ戻す |
| G2 | Migrate の人間承認による適用と Deploy の fail-closed 検査を分離し、コード配信とスキーマ適用が乖離したまま本番へ到達しない状態を構造的に保証する |
| G3 | 万一乖離した場合でも、利用者と開発者が原因を即座に特定できる検知と説明可能なエラー応答を備える |
| G4 | 復旧作業を通じて本番の既存データを一件も失わない |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | 作業開始時の remote list と repository head から確定した承認済み pending manifest を本番 D1 へ適用完了する | manifest の全項目が適用済みで、同じ repository head / ordered migrations digest に対する未適用が 0 件 |
| O2 | 取込実行と取込履歴のエンドポイントが正常応答へ戻る | POST /api/imports と GET /api/imports が本番で 5xx を返さず、画面のサーバーエラー表示が消える |
| O3 | CI/CD の Deploy が Worker 配信前に migration 状態を読み取り検査する | 未適用が 1 件以上、または判定不能なら非ゼロ終了し、Worker 配信へ進まない。Deploy は migration を適用しない |
| O4 | スキーマ版数の不一致を実行時に検知する | 期待版と実際の適用版が不一致のとき、原因を示す専用エラーコードで応答し、汎用のサーバーエラー表示にしない |
| O5 | 適用前バックアップから復元可能な状態を確保する | 適用直前のバックアップが取得済みで、行数比較により適用前後のデータ件数が保全されている |

## U5 成功基準 (success_criteria)

- 承認済み pending manifest の全項目が本番の d1_migrations に記録され、同じ repository head / ordered migrations digest に対する未適用が 0 件である
- 本番画面でファイルを選び「取込を実行」してサーバーエラーが発生しない
- 取込履歴が「サーバー側で処理に失敗しました」を出さず一覧表示される
- 適用前後で mf_transactions / freee_deals / imports の行数が減少していない
- デプロイパイプラインで未適用がある、または状態を判定できない場合、Worker の新版が配信されない
- スキーマ版数不一致時のエラー応答が、汎用サーバーエラーではなく原因を特定できる内容である

## U6 ステークホルダー (stakeholders)

- {'id': 'S1', 'role': '利用者 (個人事業の記帳担当)', 'need': '月次のCSV/ZIP取込を止めずに完了したい。エラー時は次に何をすべきか分かること'}
- {'id': 'S2', 'role': '開発兼運用者 (daishiman)', 'need': 'デプロイのたびにスキーマ適用を手動で思い出さなくてよいこと。乖離を即座に検知できること'}
- {'id': 'S3', 'role': '税務上の記録の正確性を担保する立場', 'need': '復旧作業で既存の会計データが失われないこと'}

## U7 スコープ (scope)

- **対象 (in)**: 作業開始時の remote list と repository head から承認済み pending manifest を作る手順と検証, 適用前バックアップとデータ保全の確認手順, CI/CD Deploy への読み取り専用 fail-closed 検査の組み込み, 実行時のスキーマ版数不一致検知と原因を特定できるエラー応答, 取込実行・取込履歴の本番動作確認
- **対象外 (out)**: 取込パイプラインそのもののロジック変更 (パース/正規化/集計の仕様変更), マイグレーションファイル自体の追加・変更, Deploy による migration 自動適用, D1以外のストア (R2/KV) のスキーマ運用, 認証方式の変更

## U8 制約 (constraints)

- 実行基盤は Cloudflare Workers + D1 + R2 で、wrangler.jsonc の migrations_dir は ../../migrations である
- 本番D1への適用コマンドの実行主体は利用者本人とし、AIは手順の提示と検証までを担う (不可逆操作の承認を人間が握る)
- 適用対象は番号上限で固定せず、作業開始時と適用直前に `wrangler d1 migrations list kanjo-db --remote` と repository の `migrations/` を突合して得た ordered pending list を、人間が Migrate で承認した manifest に限る
- manifest は repository head、ordered migrations digest、remote applied head、ordered pending files、取得日時、人間の承認日時を持つ。承認後に repository head、ordered migrations digest、remote list のいずれかが変わった場合は承認を無効化して再取得する
- 本番には既存データが存在し、データ喪失ゼロが必須である
- 0007/0010/0011 は cash_entries / attachments を再定義するため、適用順序の逸脱や部分適用を許さない
- D1 には1リクエストあたりのクエリ本数上限があり、取込処理は既存の query budget 設計 (上限未満50) を壊さない
- 明細内容や金額をログ・エラー応答へ含めない既存のセキュリティ方針を維持する

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | 本番D1の適用済みマイグレーションと migrations/ 配下の差分を機械的に列挙する | G1, G3 |
| I2 | 適用前バックアップの取得と、適用後の行数比較によるデータ保全確認を手順化する | G4 |
| I3 | remote list と repository head から作った承認済み pending manifest を順序どおり本番へ適用する手順を、dry-run と結果確認込みで提示する | G1, G4 |
| I4 | デプロイワークフローに読み取り専用の migration 検査ステップを追加し、未適用または判定不能なら Worker 配信へ進ませない | G2 |
| I5 | 期待スキーマ版と実適用版の不一致を実行時に検知し、専用エラーコードで返す | G3 |
| I6 | スキーマ不一致時の画面表示を、汎用サーバーエラーではなく次の行動が分かる文言にする | G3 |
| I7 | 適用後に取込実行と取込履歴が正常動作することを本番で確認する | G1 |

## 意思決定支援 (decisions)

恒久 policy と通常の D1 変更手順の SSOT は `docs/ci-cd-operations.md` とする。incident runbook は、恒久手順を複製せず、当該 incident の remote baseline、承認済み pending manifest、行数突合、証跡へのリンクだけを保持する。

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| D1-migration-gate | コード配信とスキーマ適用の乖離を構造的に防ぐために、未適用マイグレーションの扱いをデプロイ工程へどう組み込むか。既存の migrate.yml による手動分離を保つ検査ゲート方式と、Deploy 内での自動適用方式のどちらを採るか。 | confirmed | opt-gate:Deploy ジョブの先頭に未適用マイグレーション検査ゲートを置き、未適用があれば配信前に停止する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '既存の GitHub Actions ジョブへ1ステップ追加するのみで追加費用は発生しない。実行時間の増分は数秒。'} / free=GitHub Actions の既存無料枠内で完結し、Cloudflare 側も wrangler d1 migrations list の読み取りのみで課金対象の書込を伴わない / fit=G2 の乖離防止を満たしつつ、G4 のデータ保全と不可逆操作の人手承認を維持する。今回のように9世代の乖離が本番へ到達する事態を配信前に必ず検出できる / pros=既存 migrate.yml の安全設計 (不可逆変更は人間が承認) を壊さない, 検査は読み取りのみで、ゲート自体がデータを変更しない, 停止時にエラーメッセージで次の行動 (Migrate を APPLY で実行) を示せる / cons=適用そのものは自動化されないため、開発者が Migrate を明示実行する手間が残る, Deploy が止まるため、適用を忘れているとリリースが一時的にブロックされる / risks=Cloudflare API 障害で検査ステップが失敗した場合に配信が止まる (fail-closed の意図した副作用として受容する) / lock-in=wrangler d1 migrations list の出力形式に依存するのみで、他基盤へ移す際の固定化は小さい / ops=低い。追加の常設インフラや監視対象を持たず、失敗時の対処手順が一本に定まる / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-auto:Deploy ジョブ内で Worker 配信の前に migration を自動適用する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。ただし事故時の復旧コスト (Time Travel からの復元と検証) を潜在的に抱える。'} / free=GitHub Actions の既存無料枠内で完結する / fit=乖離は原理的に発生しないが、既存の『DB変更は分離して手動』という設計方針を放棄する / pros=人手の介在を完全に排せる, 適用忘れという失敗モード自体が消える / cons=破壊的変更を含むマイグレーションでも無確認で本番へ走る, 既存 migrate.yml の確認文字列 APPLY による歯止めが実質無効化される / risks=誤ったマイグレーションが main にマージされた瞬間に本番データが失われ得る, 適用と配信が同一ジョブに同居するため、障害時に原因の切り分けが難しくなる / lock-in=低い / ops=平常時は最小だが、事故時の負荷が大きい / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-hybrid:検査ゲートを置いたうえで、追加のみの安全なマイグレーションだけ自動適用する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用はないが、破壊的変更を判定するロジックの実装と継続的な保守コストが発生する。'} / free=GitHub Actions の既存無料枠内で完結する / fit=G2 を満たすが、判定ロジックの誤りが G4 のデータ保全を直接損なう / pros=日常的な追加系マイグレーションでは人手が不要になる, 破壊的変更に対しては承認を残せる / cons=SQL の静的解析で破壊性を判定する必要があり実装が重い, テーブル再作成を伴う移行 (本件の 0007/0010/0011 が該当) の分類が曖昧になる / risks=安全と誤判定された破壊的変更が無確認で適用される, 判定ロジック自体がテスト対象として増え、保守されないまま形骸化する / lock-in=判定ロジックが自作資産となり、移植時の負債になる / ops=中程度。判定ロジックの信頼性検証が恒常的に必要 / evidence=https://developers.cloudflare.com/d1/reference/migrations/ | opt-gate — 既存 migrate.yml の分離は『本番DBの不可逆変更は人間が承認する』という妥当な安全設計であり、今回の障害はその設計が悪かったからではなく、乖離を検出する門が無かったことに起因する。検査ゲートは Deploy の入口に読み取り1ステップを足すだけで、未適用があれば配信前に fail-closed で停止するため、安全設計を保ったまま欠けていた検出を補える。公式ドキュメントのとおり適用済み状態は d1_migrations テーブルが正本であり、wrangler の list コマンドで未適用分を機械的に判定できる。 (注意: 検査は wrangler d1 migrations list の未適用件数を判定源とし、d1_migrations テーブルを直接書き換える運用を作らない, ゲートが停止した際に開発者が何をすべきか (Migrate ワークフローを APPLY で実行する) をエラーメッセージへ明示する, 検査ステップ自体が Cloudflare API 障害で失敗した場合も fail-closed とし、検査不能を成功と扱わない; confidence=high; checked=2026-08-27T02:45:59Z) | opt-gate @ 2026-08-27T02:45:59Z | G2, G4 |
| D2-pre-apply-backup | 本番D1へ承認済みpending manifestを適用する直前に、データ喪失ゼロ (G4) を担保するバックアップをどの方式で取得するか。 | confirmed | opt-export:適用直前に wrangler d1 export --remote で全件を SQL ダンプとしてローカルへ取得する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。エクスポートは D1 の読み取り操作で、保管先は開発者のローカルのため保管コストも発生しない。所要は数十秒。'} / free=D1 の読み取り行数として計上されるのみで、現行の利用規模では無料枠内に収まる / fit=G4 のデータ喪失ゼロを、現物のダンプという最も直接的な形で担保する。ダンプ内の行数をそのまま適用後の行数比較の基準に使えるため O5 の測定手段も同時に満たす / pros=取得物を目視でき、復元可能であることを事前に確認できる, 適用前後の行数比較の基準値をダンプから直接得られる, Cloudflare 側の状態に依存せず手元に現物が残る / cons=明細を含むファイルをローカルに置くため、作業後の削除まで含めた取り扱いが要る, データ量が増えると取得時間が伸びる / risks=エクスポート中にデータが更新されると、ダンプと適用直前の状態がわずかにずれる (作業時間帯を利用者が使わない時間に限ることで回避する) / lock-in=出力は標準的な SQL のため、他の SQLite 系基盤へも持ち出せる。固定化はほぼない / ops=低い。1コマンドで完結し、常設インフラを増やさない / evidence=https://developers.cloudflare.com/d1/best-practices/import-export-data/<br>opt-time-travel:D1 Time Travel のブックマークだけを控え、事故時はそこへ復元する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。Time Travel は D1 に標準で備わる。'} / free=保持期間の範囲内であれば追加課金なく利用できる / fit=復元は可能だが、適用前の中身を事前に確認できないため G4 の担保が『Cloudflare 側が正しく保持していること』への信頼に依存する / pros=追加操作がほぼ不要で、手順が最短になる, 明細を含むファイルを手元に作らない / cons=適用前の中身を事前に検証できない, 行数比較の基準値を別途取得する必要がある / risks=保持期間を過ぎた後に問題が発覚すると復元できない, 復元操作自体が本番DBの上書きであり、それ自体が不可逆 / lock-in=Cloudflare D1 固有機能のため、他基盤では同等の手段を作り直す必要がある / ops=低い / evidence=https://developers.cloudflare.com/d1/reference/time-travel/<br>opt-both:export と Time Travel ブックマークの両方を取得する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。手順が1ステップ増えるのみ。'} / free=両方とも無料枠内で完結する / fit=G4 を二重に担保する。手元の現物と基盤側の復元点の両方を持つ / pros=片方が使えない事態でももう一方で復旧できる, 検証手段と復元手段を分離できる / cons=手順が増え、作業の所要時間が伸びる, 今回の規模では冗長になりやすい / risks=手順が増えることで、作業者が一部を飛ばす余地が生まれる / lock-in=opt-export と同等 / ops=低い / evidence=https://developers.cloudflare.com/d1/best-practices/import-export-data/ | opt-export — 本件で最も重要なのは『適用前に何があったかを後から確認できること』である。取込データの正確性は税務上の記録に直結し、行数が減っていないという事後検証 (O5 の測定基準) には基準値の現物が要る。Time Travel は復元手段としては有効だが、適用前の中身を事前に確認できず、行数比較の基準を別途取らねばならない。加えて既存の夜間 cron バックアップは cash_entries / attachments / restored_monthly_agg を参照する SQL を持ち、これらのテーブルが本番に存在しないため毎晩失敗し続けており、復旧前のバックアップ手段として当てにできない。したがって適用直前の明示的な export を基本線に据える。 (注意: 取得したダンプは明細と金額を含むため、作業完了後に削除するところまでを手順に含める, エクスポート中の書き込みを避けるため、利用者がアプリを操作しない時間帯に実施する, 既存の夜間バックアップは本番で失敗し続けているため、復旧完了後に正常化を確認する; confidence=high; checked=2026-08-27T03:38:13Z) | opt-export @ 2026-08-27T04:28:22Z | G4, G1 |
| D3-runtime-schema-guard | デプロイ済みコードが前提とするスキーマ版と、本番D1に実際に適用済みの版が食い違ったとき、実行時のどこでそれを検知するか。 | confirmed | opt-entry-middleware:session/token 認証後の共通 middleware で期待版と d1_migrations の最新版を照合し、不一致なら専用エラーコードで返す / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。照合結果を isolate 内に期限付きでキャッシュすれば D1 への問い合わせはキャッシュ有効期間あたり1回に収まる。'} / free=D1 の読み取り1行の問い合わせがキャッシュ有効期間ごとに1回増えるのみで、現行規模では無料枠に影響しない / fit=G3 の『乖離を即座に特定できる』を認証済みの全 D1 利用エンドポイントで満たす。今回のように取込と取込履歴の両方が同時に落ちる事態でも、どちらも同じ原因を名指しで返せる / pros=乖離が起きた瞬間から認証済みの全 D1 利用経路で確実に検知できる, 利用者向けの説明可能なエラー応答と、開発者向けのログを同じ判定点から出せる, 検知漏れの経路が原理的に存在しない / cons=認証済みの全 D1 利用リクエストが判定を通るため、キャッシュ設計を誤ると D1 への問い合わせが増える, middleware の順序を誤ると認証前に DB へ触れる経路が生まれる / risks=照合自体が失敗した場合も認証済み業務 API は fail-closed 503 となる。一時的な可用性低下を受容し、判定不能な schema への業務アクセスを防ぐ / lock-in=d1_migrations テーブルの読み取りに依存するのみで、固定化は小さい / ops=低い。判定点が一箇所に集まるため、挙動の確認とテストが容易 / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-heavy-endpoints:取込など、スキーマ依存が強い重い処理の直前でだけ照合する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。判定回数が最小になる。'} / free=問い合わせ回数が最も少なく、無料枠への影響は無視できる / fit=取込は救えるが、取込履歴や他の一覧系で起きた乖離は素通りして汎用サーバーエラーのままになる。今回の障害は両方で起きているため G3 を部分的にしか満たさない / pros=オーバーヘッドが最小, 影響範囲が限定的で導入しやすい / cons=判定を入れ忘れた経路の乖離は検知できない, 新しいエンドポイントを追加するたびに判定の要否を判断し続ける必要がある / risks=判定箇所の網羅が人手の注意力に依存し、時間とともに形骸化する / lock-in=小さい / ops=中程度。判定箇所の網羅を維持し続ける手間が残る / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-cron-monitor:既存の夜間 cron ジョブで照合し、不一致をログへ残す / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。既存 cron へ1処理追加するのみ。'} / free=1日1回の問い合わせのため無料枠への影響はない / fit=検知が最大24時間遅れ、利用者の画面表示は汎用サーバーエラーのまま変わらない。G3 の利用者側の要求を満たさない / pros=リクエスト経路への影響がゼロ, 実装が最も小さい / cons=利用者は依然として原因不明のサーバーエラーに遭遇する, 検知が最大1日遅れる / risks=既存の夜間ジョブ自体が現在 cash_entries 不在で失敗し続けており、そこへ相乗りすると検知処理も同時に失われる / lock-in=小さい / ops=低いが、ログを見に行く運用が前提になる / evidence=https://developers.cloudflare.com/d1/reference/migrations/ | opt-entry-middleware — 今回の障害は取込 (POST /api/imports) と取込履歴 (GET /api/imports) の両方で同時に起きており、特定のエンドポイントに閉じた検知では取りこぼす実例がすでに出ている。session/token 認証後の共通入口で照合すれば、認証前 DB access を増やさず業務 D1 経路の検知漏れを防げる。d1_migrations は公式ドキュメントのとおり適用済み状態の正本であり、その最新レコードとビルド時に確定する期待版を突き合わせるだけで判定できる。照合結果を isolate 内に期限付きでキャッシュすれば、毎リクエストの問い合わせも避けられる。 (注意: 照合結果は isolate 内に期限付きでキャッシュし、毎リクエストで D1 へ問い合わせない, 照合そのものが失敗した場合も専用 503 として業務 D1 アクセスへ進めない。public auth は対象外とし、guard は認証後に置く, 応答にはテーブル名やスキーマ構造を含めず、専用コードと利用者向け文言だけを返す; confidence=high; checked=2026-08-27T03:38:13Z) | opt-entry-middleware @ 2026-08-27T04:28:22Z | G3 |
| D4-schema-mismatch-user-message | スキーマ版数の不一致を検知したとき、利用者の画面へどこまでの情報を、どういう表現で示すか。 | confirmed | opt-actionable-wait:復旧作業中である旨と、利用者が取るべき行動 (時間をおいて再試行) を示す文言を表示する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。フロントのエラー分岐に1件追加するのみ。'} / free=該当なし (クライアント側の表示分岐のみ) / fit=G3 の『利用者が原因を即座に特定できる』を、利用者にとって意味のある粒度で満たす。原因の技術的中身ではなく『自分の操作の誤りではない』『待てば直る』という判断材料を渡す / pros=利用者が同じ操作を無駄に繰り返したり、自分のファイルを疑ったりしなくて済む, 内部構造を露出しない, 既存の汎用サーバーエラー表示と明確に区別できる / cons=開発者が画面だけを見て原因を特定することはできず、ログか専用コードを見る必要がある / risks=『しばらく待てば直る』と示す以上、実際に復旧されない状態が続くと文言が嘘になる (検知と復旧手順が対で運用されることが前提) / lock-in=なし / ops=低い / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-technical-detail:未適用マイグレーションが存在する旨と参照コードを画面へ併記する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。'} / free=該当なし / fit=開発者が画面だけで原因を特定できる。ただし本アプリの利用者は記帳担当であり、技術的詳細は行動の判断材料にならない / pros=開発者が原因を最短で特定できる, 問い合わせのやり取りが減る / cons=利用者にとって意味のない情報が前面に出る, 内部構造の露出が増える / risks=画面のスクリーンショットを外部へ共有した際に内部運用状態が漏れる / lock-in=なし / ops=低い / evidence=https://developers.cloudflare.com/d1/reference/migrations/<br>opt-log-only:画面表示は汎用サーバーエラーのまま変えず、ログとエラーコードだけを区別する / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '追加費用なし。実装が最小。'} / free=該当なし / fit=開発者側の特定は速くなるが、利用者は今回と同じ『サーバーエラーが発生しました』に留まる。G3 の利用者側の要求を満たさない / pros=実装が最小, 既存のエラー表示を一切変えない / cons=利用者の体験は今回の障害時と変わらない, 本件の出発点である『次に何をすべきか分からない』が解消しない / risks=対策したつもりで利用者側の課題が残り続ける / lock-in=なし / ops=低い / evidence=https://developers.cloudflare.com/d1/reference/migrations/ | opt-actionable-wait — 本件の出発点は、利用者が『取込を実行できませんでした: サーバーエラーが発生しました』を見て次に何をすべきか分からない状態に置かれたことである。利用者 (S1) にとって必要なのは未適用マイグレーションという内部事情ではなく、自分のファイルや操作が悪いのではないこと、そして待てば解決することの2点である。専用エラーコードで開発者向けの識別は確保しつつ、画面には行動可能な文言だけを出すことで、既存のセキュリティ方針を崩さずに G3 を満たせる。 (注意: 画面文言にテーブル名・スキーマ版数・スタックトレースを含めない, 専用エラーコードは応答とログの双方に載せ、開発者はそちらで特定する, 『しばらく待てば直る』と示す以上、検知時に開発者へ届く経路 (ログ) を必ず併設する; confidence=high; checked=2026-08-27T03:38:13Z) | opt-actionable-wait @ 2026-08-27T04:28:22Z | G3 |

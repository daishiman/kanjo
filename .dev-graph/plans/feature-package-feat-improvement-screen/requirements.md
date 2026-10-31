# 実装要件: feat-improvement-screen

- graph snapshot: `4095cbf141041cf9b63278474045ef84ab178f08af0d18a1da03d90604c4dc4e` (revision 3)
- plan validated digest: `sha256:976a9b89b575cd1d9a781fdd04237f7188cc0c2eb04daba7784139187fb2c144`
- handoff 先: task-graph (実装コードは本文書では生成しない)

## 目的

改善リクエスト画面を、利用者 (個人事業主とその家族の家計を 1 人で管理する本人) が、使っていて困ったことを、そのとき見えていた画面 (個人情報を伏せた画像) と診断情報ごと 1 画面で送り、送った依頼の状態・履歴・関連する依頼を同じ画面で追い、Claude Code / Codex がそのまま着手できる指示文として取り出せる場にする。送る前に何が伏せられるかを確かめられ、送った後も誤って消した依頼を戻せることで、改善の経路から個人情報と記録の欠けを無くす。

## 到達状態

/improvement が 20-improvement.png の構成 (問いの見出しと説明・使い方リンク・共通の期間・作成フォーム (スクリーンショットと撮り直し/差し替え/削除・本文 0/1000・プライバシー確認 2 つ・自動マスキングの説明・送信)・一覧 (検索・すべて/受付/対応中/完了/再確認の件数タブ・選択・表・10 件ずつのページング)・詳細パネル (IMP 番号と状態・本文・添付画像と拡大・マスク済み診断・アクティビティ・関連する依頼・状態変更・再発行・Claude Code 用 / Codex 用のコピー・削除)・空状態・読み込み失敗と再読み込み・画面キャプチャの浮動パネル・選択中バー・コピー完了トースト) を共通シェルの文言を除いてトークンと共通部品で描画し、状態・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core の improvement-screen (とマスクを拡張した improvement.ts) 1 か所で導かれて API と web が写すだけになり、migration 0053 (状態の CHECK 張り替えと wontfix→完了の移し替え・利用者ごとの連番・論理削除の列・件名の NULL 許容・アクティビティの表) と削除・復元の経路で削除した依頼が同じ番号のまま戻り、削除中の行が全ての読み取り経路から外れ、30 日後に夜間の improvement_retention で行・履歴・R2 の画像が消え (夜間予算 49 は audit_header_retention の読み取り 1 本を回して維持、D-imp-008)、画像・本文・診断から個人情報がブラウザとサーバの両方で伏せられた状態。

## 受入基準

- S1 (G1): /improvement で 20-improvement.png の構成要素 (共通シェルの文言を除く) がすべて描画され、色・余白・部品はトークンと共通部品経由で、直書き色の lint が 0 件、読込 / 空 / 失敗の各状態とプライバシー確認 2 つが未チェックのとき送信不可であることが DOM テストで固定されている。
- S2 (G2): 送信された画像・本文・診断情報に、口座情報・取引先名・金額・個人名・メールアドレス・電話番号・住所・秘匿値が 1 件も残らず、クライアントのマスクを飛ばした投稿にもサーバで同じ規則が掛かることが core・DOM・API のテストで固定されている。
- S3 (G3): 状態・概要・番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core だけで計算され、API と web はその結果を写すだけで、web と api に同じ計算の重複が無い (grep で 0 件)。
- S4 (G4): 他の利用者の依頼の取得・変更・削除・復元が 404、不正な入力 (空の本文、1000 字超、プライバシー確認の欠け、候補外の状態、形式外・2MB 超の画像) が 400 になり、削除した依頼は『元に戻す』で同じ id と番号のまま戻り、削除中の行が一覧と件数に 0 件、30 日経過の完全消去で R2 の画像と履歴が消える。
- S5 (全体): migration 0053 の適用で既存の行・R2 の画像・トークンが失われず (wontfix は完了へ移り理由が履歴に残る)、夜間予算テストが total === PLAN_MAX (49) を固定し、BACKUP_SNAPSHOT_SQL に改善リクエストの表が無く、pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0 で、旧 Improvement.tsx とモーダルにあった操作がすべて新しい構成から実行できる。受入は実行済みの最新のテスト証跡だけで判定する。

## スコープ外

- 共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)
- 改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)
- 関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)
- 複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する
- モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)
- 新しい Cron・新しい資格情報の種類・R2 のキーの形の変更

## 持ち越し事項と解決担当

- OI-01 migration 番号 0053 → SYS-IMPSCR-P05: main の head は 0052。並行ブランチと衝突しうるため P05 の着手時に origin/main を fetch して確定する
- OI-02 一覧と共通の期間の関係 → SYS-IMPSCR-P01: spec は一覧を期間で絞らないとした (FR-2、agent 推定)。P01 で利用者確認の要否を仕分け、P03 で期待値を固定する
- OI-03 ブラウザ側での辞書マスク → SYS-IMPSCR-P02: 取引先名・個人名の辞書をブラウザへ渡す経路が無ければ、ブラウザの層は data-capture-mask と辞書を使わない規則だけになる。P02 で経路の有無を決める
- OI-04 『画像を差し替え』の意味とコピーと再発行の関係 → SYS-IMPSCR-P01: 端末のファイルを受け付けない (agent 推定)。後日のコピーは再発行を伴い前の指示文を失効させる。P01 で利用者確認の要否を仕分け、P03 で API の契約を固定する
- OI-05 関連ページの画面名の置き場所 → SYS-IMPSCR-P02: routeMetadata.ts の対応を core へ移すか core に同じ表を持つか。P02 で決め、P08 で重複が 0 件であることを監査する
- OI-06 削除中のトークンと agentGuard の応答 → SYS-IMPSCR-P03: トークンは残して agent 経路を 404 にする (spec)。現行の agentGuard は行が無いとき 401 を返すため、P03 で 404 と 401 のどちらに揃えるかをレビューする
- OI-07 夜間予算の枠の回し方 → SYS-IMPSCR-P05: audit_header_retention の読み取りを 1 本減らし improvement_retention に完全消去を足す (D-imp-008)。P04 で total === PLAN_MAX (49) のテストを先に書き、P05 で入れ替える
- OI-08 agent 推定・利用者未確認の値 → SYS-IMPSCR-P01: 遷移表・経路名・URL キー・アクティビティの種類名・表名と列名・409 invalid_transition・check:improvement-screen の追加など。P01 で一覧にし確認の担当 phase を決める

## 実行単位 (P01→P13 単鎖)

| phase | task | domain | 文書 |
|---|---|---|---|
| P01 | SYS-IMPSCR-P01 要件ベースライン確定と持ち越し事項・推定値の確認担当の割り当て | documentation | tasks/feat-improvement-screen/sys-impscr-p01.md |
| P02 | SYS-IMPSCR-P02 improvement-screen 純関数・マスクの 2 境界・migration 0053・削除と復元・夜間消去・画面分割のワークストリーム設計決定記録 | documentation | tasks/feat-improvement-screen/sys-impscr-p02.md |
| P03 | SYS-IMPSCR-P03 削除と復元の契約・読取経路・マスクの 2 境界・入力検証・URL 契約の独立レビュー | quality | tasks/feat-improvement-screen/sys-impscr-p03.md |
| P04 | SYS-IMPSCR-P04 core 境界値・マスク・API 契約・migration 0053・夜間予算・DOM の失敗テスト先行作成 | quality | tasks/feat-improvement-screen/sys-impscr-p04.md |
| P05 | SYS-IMPSCR-P05 improvement-screen 純関数・マスクの拡張・migration 0053・削除と復元・夜間の完全消去・改善リクエスト画面の分割と撮影パネルの最終実装 | frontend | tasks/feat-improvement-screen/sys-impscr-p05.md |
| P06 | SYS-IMPSCR-P06 全テストと型検査と lint と skill テストの実行記録 | quality | tasks/feat-improvement-screen/sys-impscr-p06.md |
| P07 | SYS-IMPSCR-P07 受入基準 S1 から S5 の検証 | quality | tasks/feat-improvement-screen/sys-impscr-p07.md |
| P08 | SYS-IMPSCR-P08 導出とマスクの重複・削除中の行の読取漏れ・旧参照の読取専用監査 | quality | tasks/feat-improvement-screen/sys-impscr-p08.md |
| P09 | SYS-IMPSCR-P09 アクセシビリティ・マスク・入力検証・他人の依頼の拒否・撮影のブラウザ内完結・JS バンドル予算の保証確認 | quality | tasks/feat-improvement-screen/sys-impscr-p09.md |
| P10 | SYS-IMPSCR-P10 独立最終レビュー | quality | tasks/feat-improvement-screen/sys-impscr-p10.md |
| P11 | SYS-IMPSCR-P11 再現可能な証跡索引の作成 | documentation | tasks/feat-improvement-screen/sys-impscr-p11.md |
| P12 | SYS-IMPSCR-P12 状態・番号・マスク・削除と復元・夜間消去の規則表と docs/improvement-request.md・runbook の最終同期 | documentation | tasks/feat-improvement-screen/sys-impscr-p12.md |
| P13 | SYS-IMPSCR-P13 単一 PR での配信と migration 0053 の適用とクローズアウト | operations | tasks/feat-improvement-screen/sys-impscr-p13.md |

## 出典

- arch-improvement-screen-ui-ux (architecture): system-spec/ui-ux.md
- arch-improvement-screen-frontend (architecture): system-spec/frontend.md
- arch-improvement-screen-backend (architecture): system-spec/backend.md
- arch-improvement-screen-database (architecture): system-spec/database.md
- arch-improvement-screen-auth (architecture): system-spec/auth.md
- arch-improvement-screen-security (architecture): system-spec/security.md
- arch-improvement-screen-infrastructure (architecture): system-spec/infrastructure.md
- arch-improvement-screen-maintenance-ops (architecture): system-spec/maintenance-ops.md
- spec-improvement-screen (specification): system-spec/00-requirements-definition.md
- system-spec/completeness-findings.json (C08: complete)

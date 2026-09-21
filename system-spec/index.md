---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 明細仕分け画面を、『未整理の明細を、根拠を見ながら確定しますか？』という問いに 1 画面で答え切る場にする。利用者が期間 (1年 / 2年 / 3年 / 任意) を選ぶと、未整理・要確認・手動変更・完了の件数を最初に掴み、絞り込みで片付ける対象を選び、一覧で提案カテゴリと信頼度を見比べ、右の編集パネルで信頼度の根拠と取引の履歴を読んだうえで確定できる。複数件はまとめて保存し、一部が失敗しても失敗した明細だけを再試行でき、繰り返し現れる取引はその場でルールにして、今後どの明細にどう適用されるかをプレビューで確かめてから適用できる。分割は合計が元の金額に一致することを確かめて適用でき、削除は元に戻せ、入力中の下書きは画面を離れても失われない。未整理・手動変更・完了の件数は排他で和が全件に一致し、要確認は未整理の内訳として数え、ナビのバッジと月次クローズの『仕分け』と同じ定義から導く。取込データは外部へ送信しない。
- **ゴール (U3)**: G1=/classify を 13-classify.png どおりの画面にする。問いの見出し『未整理の明細を、根拠を見ながら確定しますか？』と説明文、期間タブ (usePeriod の 1年 / 2年 / 3年 / 任意と期間送り)、件数 KPI 4 枚 (未整理・要確認・手動変更・完了)、左の絞り込みパネル (対象月・分類ステータスのチェックと件数・カテゴリ・所有者・支払方法・手動変更のみ・キーワード検索・保存したフィルタ・現在の条件を保存・フィルタをクリア・折りたたみ)、中央の取引一覧 (選択チェック・日付の並べ替え・取引先 / 内容・金額・提案カテゴリ・信頼度・表示件数 50 件とページ送り)、右の取引の編集パネル (未保存の表示・クイック仕分け 事業 / 個人 / リセット・カテゴリ・所有者・支払方法・メモ 200 字と字数・取引の履歴・信頼度の根拠・編集 / 分割 / 削除・この条件をルールにする・該当する既存のルール)、一括操作バー (N 件選択中・選択をクリア・選択した N 件を保存)、結果の通知 (一括保存の部分失敗と失敗分だけ再試行・削除の元に戻す)、下段の分割明細の編集とルール適用プレビュー、下書きの自動保存時刻を、既存のデザイントークン・共通部品 (PageHeader・KpiCard・Button・ConfirmDialog・PeriodPicker) の上に組み、一括操作バーはサブスク・診断と同じく画面専用の部品として pages/classify に置く。証憑欄は置かず、その位置に『証憑は freee 側で管理します』の案内を出す。読込・空・失敗の各状態を持つ。, G2=分類ステータスと提案を core の純関数 1 か所に集める。各明細を 未整理 (利用者・ルール・MF 中項目のどれもまだ決めていない明細。提案の有無と信頼度は問わない) / 手動変更 (利用者が提案と異なる値で確定した明細。提案が無いまま利用者が決めた明細と、この変更より前の手入力の明細を含む) / 完了 (利用者が提案どおりに確定した明細と、ルール・MF 中項目が決めた明細) の 3 区分に排他で振り分け、和が全件に一致する。要確認は区分ではなく未整理の内訳で、提案の信頼度が 80% 未満・提案どうしの衝突・区分と名義の矛盾のいずれかがある未整理の明細を数える。ナビのバッジは未整理の件数、月次クローズの『仕分け』は同じ判定の未整理から照合側で数える明細を除いた件数とし (現行の clsSrc=既定 と同じ意味)、同じ関数から導かれることをテストで固定する。提案カテゴリ・信頼度・根拠の文は recommendationFor を拡張し、過去の同取引先・ルール・MF 中項目のどの由来にも決定論の信頼度を付け、/transactions の応答にも載せる。外部の LLM は呼ばず、表示は『自動提案』とする。, G3=選択した複数の明細を 1 回の要求で保存する一括保存を設ける。明細ごとの成否を返し、画面は『N 件のうち M 件を保存、K 件はエラー』と失敗した明細だけの再試行を示す。成功分は取り消されない。削除は既存の取消 (undo) で元に戻せる。一括保存・ルール作成・ルール適用・保存フィルタの変更は既存の canonicalMutationFence の内側に置く。, G4=『この条件をルールにする』で取引先・キーワード・適用範囲 (一致する明細すべて / 未確定の明細だけ) を選んでルールを作り、作成前に該当する明細と適用後の仕訳 (カテゴリ・分割の内訳) の一覧と件数をプレビューで確かめてから適用できるようにする。分割の内容もルールにでき、固定額の行と残額の行で同じ条件の明細を同じ形に分ける。該当する既存のルールと、そのルールの対象件数を編集パネルに示す。手動変更した明細はルールで上書きしない。, G5=仕分けの作業状態を失わない。保存したフィルタは D1 に新しい表を追加のみの migration で設け、名前付きで保存・呼出・削除できる。取引の履歴は D1 に明細の変更履歴表を追加のみで設け、いつ・何が (区分・カテゴリ・所有者・支払方法・メモ・分割)・どの由来 (自動提案 / 手動 / ルール / 一括保存) で変わったかを残し、編集パネルに新しい順で出す。編集パネルの下書きは端末の localStorage に明細単位で自動保存し、最終保存時刻を表示し、保存に成功したら消し、次回に『下書きを復元』できる。未保存のまま離れるときは確認する。

- **G2 Q-1 明確化 (2026-09-21)**: 取込時に vendor_memory が materialize した手当ては、`matched_proposal` が NULL でも `done`（完了）とし、要確認には数えない。詳細の正本は [要件定義書](./00-requirements-definition.md) G2 / O2。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G4 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G3 G4 G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 G3 G5 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)

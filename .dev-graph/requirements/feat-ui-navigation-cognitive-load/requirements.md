# 共通ナビゲーションと認知負荷改善 — 実装要件

- Feature: `feat-ui-navigation-cognitive-load`
- Package: `feature-package/feat-ui-navigation-cognitive-load`
- Handoff target: `task-graph`
- Snapshot: `sha256:90aee26caa05b5c72a070661be81cbdceb2f9044c14bd8c9c955ea45fb7d5185`
- System plan: `sha256:be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd`
- Readiness: **PASS**（missing sections 0）

## 目的

収支管理に不慣れな利用者が、現在地・重要情報・次の操作・編集対象を短時間で判断できるよう、全ページ共通のナビゲーションと情報階層を整える。税務2画面の二重 active を解消し、意味的アイコンと一貫した間隔、段階的開示、安全な編集面を共通契約にする。

## 実装要件

### REQ-NAV-001 現在地は常に一意

`/tax` と `/tax/receipts` を含む全ルートで active は1件だけとし、`aria-current=page` を現在ページだけに付与する。

- 担当 task: `SYS-UINAV-P02`、`SYS-UINAV-P05`、`SYS-UINAV-P07`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-NAV-002 全ルートの意味的アイコン

17 route 全てに重複しない意味の icon key と可視ラベルを持たせ、アイコン単独で意味を伝えない。

- 担当 task: `SYS-UINAV-P02`、`SYS-UINAV-P05`、`SYS-UINAV-P07`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-NAV-003 読みやすい間隔

icon-label、nav row、group separator、sidebar width を共通 token で整え、長い日本語ラベルを崩さない。

- 担当 task: `SYS-UINAV-P02`、`SYS-UINAV-P05`、`SYS-UINAV-P09`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-NAV-004 色以外の状態手掛かり

current は色に加えて形状・indicator・aria-current で識別でき、hover と focus-visible を分離する。

- 担当 task: `SYS-UINAV-P03`、`SYS-UINAV-P05`、`SYS-UINAV-P09`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-UX-005 初期表示の情報優先度

各ページで目的、重要状態、主操作を先に見せ、補足や低頻度操作を同じ強度で並べない。

- 担当 task: `SYS-UINAV-P01`、`SYS-UINAV-P05`、`SYS-UINAV-P07`、`SYS-UINAV-P08`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-UX-006 文脈を保つ段階的開示

詳細は inline disclosure、drawer、必要な modal を用途で使い分け、通常の画面遷移を modal で遮らない。

- 担当 task: `SYS-UINAV-P03`、`SYS-UINAV-P05`、`SYS-UINAV-P07`、`SYS-UINAV-P08`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-EDIT-007 安全な編集面

編集面で対象、変更内容、保存、取消、危険性、処理中、成功・失敗を識別でき、閉じる前に未保存変更を守る。

- 担当 task: `SYS-UINAV-P03`、`SYS-UINAV-P05`、`SYS-UINAV-P07`、`SYS-UINAV-P09`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

### REQ-QA-008 回帰と視覚検証

unit、DOM、typecheck、build、主要 viewport、200%相当、keyboard、reduced motion を検証し、匿名化証跡を残す。

- 担当 task: `SYS-UINAV-P04`、`SYS-UINAV-P06`、`SYS-UINAV-P09`、`SYS-UINAV-P10`、`SYS-UINAV-P11`、`SYS-UINAV-P13`
- Source: `features/feat-ui-navigation-cognitive-load.md`、`specs/ui-navigation-cognitive-load.md`

## 非機能要件

- 可視ラベルを保持し、装飾アイコンは assistive technology から隠す。
- focus-visible、keyboard、200%相当、狭幅、reduced motion を壊さない。
- API、会計計算、保存データ、認証、インフラの契約を変更しない。
- 実データ、口座明細、金額、local secret をコード・テスト・証跡へ含めない。
- 新規ライブラリを前提にせず、既存 React/CSS の共有部品へ閉じる。

## 受入と証跡

- P05 が共通実装、P06 が自動検証、P07 が主要導線受入、P09 が a11y/responsive、P10 が最終レビュー、P11 が証跡索引、P13 が PR 直前確認を担う。
- 全8要件は1件以上の confirmed system task と source lineage に追跡できる。
- commit、push、PR作成、本番 deploy はこの handoff のスコープ外。

## Readiness

C11 snapshot、C02保存状態、system-dev-planner validator は同一 source/plan digest で PASS。feature と13 task は confirmed / pass / complete、missing sections は0。task markdown の graph path への投影は実装要件生成ではなく次の `/dev-graph node` の責務とし、plan producer の確定 task spec bytes を入力にする。


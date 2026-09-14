# task-progress (canonical projection)

> task-graph.json から生成する派生ビュー。手編集しない。

- 全 13 タスク・12 依存エッジ
- ☐ `SYS-DSFOUND-P01` FINAL-UI 抽出値による要件ベースライン確定 (depends_on: none; role: preparation)
- ☐ `SYS-DSFOUND-P02` トークン正本配置とワークストリーム設計の決定記録 (depends_on: SYS-DSFOUND-P01; role: preparation)
- ☐ `SYS-DSFOUND-P03` トークン設計の独立レビュー (depends_on: SYS-DSFOUND-P02; role: design-review)
- ☐ `SYS-DSFOUND-P04` トークン値・コントラスト・共通シェルの失敗テスト先行作成 (depends_on: SYS-DSFOUND-P03; role: test-design)
- ☐ `SYS-DSFOUND-P05` design-tokens.ts 正本の実装と styles.css / charts.ts / 共通部品への反映 (depends_on: SYS-DSFOUND-P04; role: mutation)
- ☐ `SYS-DSFOUND-P06` 全テスト・型検査・lint の実行記録 (depends_on: SYS-DSFOUND-P12; role: final-verification)
- ☐ `SYS-DSFOUND-P07` S1-S6 受入検証 (depends_on: SYS-DSFOUND-P09; role: acceptance)
- ☐ `SYS-DSFOUND-P08` COLOR_FALLBACKS と重複トークン値の除去 (depends_on: SYS-DSFOUND-P05; role: mutation)
- ☐ `SYS-DSFOUND-P09` アクセシビリティ・セキュリティ・パフォーマンスの保証確認 (depends_on: SYS-DSFOUND-P06; role: quality-assurance)
- ☐ `SYS-DSFOUND-P10` 独立最終レビュー (depends_on: SYS-DSFOUND-P07; role: independent-review)
- ☐ `SYS-DSFOUND-P11` 再現可能な証跡索引の作成 (depends_on: SYS-DSFOUND-P10; role: evidence)
- ☐ `SYS-DSFOUND-P12` デザインシステム規約文書と README / AGENTS.md 参照の同期 (depends_on: SYS-DSFOUND-P08; role: documentation-sync)
- ☐ `SYS-DSFOUND-P13` 単一 PR での配信とクローズアウト (depends_on: SYS-DSFOUND-P11; role: release)

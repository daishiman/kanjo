# feat-tradeoff-screen task 投影

このディレクトリの `sys-tradeoff-p*.md` は、`specs/spec-tradeoff-screen.md` から生成した実行計画の投影であり、規則・契約・受入条件の正本ではない。

- 規則を変えるときは spec を先に更新し、feature・architecture・task・`.dev-graph` を再生成または同期する。
- task 内の重複記述が spec と異なる場合は spec を優先し、task 側を新たな正本として手修正しない。
- frontmatter の `active` / `in_progress` / `implementation_readiness` は計画・実行の管理状態であり、公開・本番適用・最新検証の完了を示さない。
- 日時・コマンド・実行結果は `docs/tradeoff-screen/evidence.md`、判断理由と差分は `docs/tradeoff-screen/design-decisions.md` を参照する。

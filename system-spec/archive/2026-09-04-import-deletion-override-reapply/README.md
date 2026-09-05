# アーカイブ: 取込データの削除・上書き・再取込 (2026-09-04 退避)

このディレクトリは、`system-spec/` が旧テーマ「取込データの削除・上書き・再取込と、利用者の手当ての継続再適用」で
全8カテゴリ確定していた時点の仕様書一式である。

## 経緯

2026-09-04、新機能「家計と事業を横断したトータル収支トレンド」の仕様を構築するにあたり、
`system-spec/` はリポジトリに1テーマぶんの正本しか持たない構造のため、
利用者承認のうえで旧テーマをここへ退避し、`spec-state.json` を新テーマで再 bootstrap した。

退避前に、8カテゴリの `web` セルは正規 writer (`apply-spec-transition.py` の `action=reopen`) で
根拠付きに再オープンしてある (確定の直接巻き戻しは行っていない)。

## 収録物

- `00-requirements-definition.md` — 旧テーマの要件定義書 (上位概念 U1-U9)
- `index.md` — 旧テーマの章 index と集約状態
- `database.md` / `auth.md` / `ui-ux.md` / `security.md` / `infrastructure.md` / `backend.md` / `frontend.md` / `maintenance-ops.md` — 旧テーマの技術章
- `completeness-findings.json` — 旧テーマの完成度 evaluator 結果
- `fetched-references.json` — 旧テーマで取得した公式ドキュメント出典

## spec-state.json を同梱していない理由

旧テーマの `spec-state.json` (196KB) は git に保全済みであり、次で復元できる。

```
git show 7a7dc66:system-spec/spec-state.json
```

正本 `system-spec/spec-state.json` は `guard-confirmed-chapter-overwrite.py` が
`cp` / `mv` を含む全ての動的書換を fail-closed で遮断する。この遮断は確定の巻き戻しを
防ぐための防御層であり、複製のために迂回しない。git が同じ内容を保持しているため、
ここへ複製する実益もない。

退避時点の状態は 8カテゴリ web セルが `action=reopen` 済み (`reopen_log` に根拠あり) で、
その差分は本コミットに含まれる。


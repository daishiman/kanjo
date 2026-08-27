# dev-graph artifact templates

このディレクトリは、導入先リポジトリへ `dev-graph init` が配置する編集可能なテンプレート群である。

共有 harness code は plugin source から読めるが、content/config/state は常に呼出し元 repository が正本である。`repo-config.example.json` を導入先 `.dev-graph/config.json` へ初回だけ配置し、保存 path は全て repository 相対とする。

repo-local config は二段階で構成する。dev-graph が基底 section を配置し、system-dev-planner が同じ config へ `plan_roots` の不足キーだけを非破壊で追記する。既存値は上書きしない。

`content_roots.system_spec` は system-spec-harness が生成・確定する成果物を参照する reference-only root である。dev-graph はその内容を再生成せず、登録・依存投影だけを担う。

## 選択規則

1. `artifact_kind` に対応する基底テンプレートは `template-contract.json` の `artifacts.<artifact_kind>.template` だけから選ぶ。この map は `issue` / `task` / `document` / `specification` / `architecture` / `feature` を網羅する唯一の選択規則である。
2. `architecture` は内容から `frontend` / `backend` / `infrastructure` / `data` / `security` を複数選択できる。該当 subtype のテンプレートを基底テンプレートへ合成する。
3. API を公開・変更する仕様では `api-contract.md` を `specification.md` の API 契約へ合成する。
4. 利用者へ保存先やテンプレート名を質問しない。分類 confidence が閾値未満の場合だけ、分類候補と生成予定 path を確認する。
5. 空見出し、`TBD`、`TODO`、`未定` は充足と数えない。非該当は `N/A: <理由>` を必須とする。
6. システム計画では system-dev-planner が1 featureにつきP01..P13のexact 13件の実行task仕様書を生成する。dev-graph は runtime task spec や別の lifecycle 文書を生成せず、登録・投影・完了収束のみを担う。極端に大きい計画は13件を増減せず、上流で feature を単一価値単位へ分割する。
7. project rootは`--repo-root`、trusted project env、`git rev-parse --show-toplevel`、cwd markerの順で候補を解決する。候補のrealpathがhost宣言`$CLAUDE_PROJECT_DIR`と一致する場合だけ採用し、symlinkの物理source pathをcontent rootに使わない。

## 最初の成果物

1. `artifact_kind` を決め、`common-frontmatter.md` と `template-contract.json` が示す基底テンプレートを合成する。
2. `graph_projection.root_map` の保存先へ置き、placeholderを実値または `N/A: <理由>` に置換する。
3. hostのdev-graph workflow経由で登録し、`.dev-graph/state/graph.json` を直接編集しない。
4. graph schema検証を実行し、追加nodeの`file_path`、参照先、readinessがPASSしたことを証跡に残す。

## 検証規則

- `template-contract.json` が種別ごとの必須セクションと subtype 合成規則の正本である。
- `common-frontmatter.md` が全 Markdown 成果物の共通メタデータ正本である。
- common frontmatterの`required`は存在要件であり、値の適用性はdev-graph pluginの`schemas/graph-node.schema.json`にある`artifact_kind`条件分岐を正本とする。
- `system-task-spec.md` と `system-phase-spec.md` は旧参照名を維持する compatibility stub であり、runtime のテンプレート選択・合成対象ではない。
- `validate-graph-schema.py` は frontmatter、見出し、placeholder、参照先、`file_path` parity を fail-closed で検証する。
- `implementation_readiness` は必須セクションの `complete / incomplete / not_applicable` と不足一覧から算出する。単なる文字数では判定しない。
- テンプレートの変更は `template_version` を更新し、既存文書は自動全書換せず migration preview を生成する。
- システム開発task planはplugin固有のcomponent_kind/build_targetを流用せず、system workstreamと実装対象pathへ置換する。
- system planは評価前にdraft stagingし、同一digestの決定論検証+独立4条件評価PASS後だけactive/confirmed/passへatomic promotionする。
- realpathがrepository root外へ出る設定、content symlink、`..` traversal、repository_id不一致、shared cache/lock pathはfail-closedにする。
- `repository_id`はcanonical GitHub remoteから`github:<owner>/<repo>`を再導出して比較する。remoteがない場合はgit common-dir realpathをSHA-256化した`local:sha256:<64hex>`を用い、repo移動時は明示的rebind確認を要求する。
- C24は起動後に検査できるcontent symlinkの壊れ/移動を診断する。harness自身のsymlinkが壊れるとC24を起動できないため、host launcher/installerがentrypoint実在性を起動前検査する。
- 最初のfeature package完了後と`template_version`更新時に、依存DAG、completion evidence、template bundle digest、利用時の再作業を再監査する。

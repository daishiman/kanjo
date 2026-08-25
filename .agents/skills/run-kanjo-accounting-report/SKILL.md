---
name: run-kanjo-accounting-report
description: kanjo(収支管理コンソール)の「AI分析」画面が発行した指示文(取得URLと送信URLと使い捨てトークンを含む)を貼り付けられたとき、取り込み済みの実績データを会計の実務家として読み、事実→解釈→次の一手の要点・図表カタログの読み解き・固定5節からなる第3版レポートを生成してアプリへ返したいときに使う。
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash(curl *), Bash(python3 *)
kind: run
prefix: run
effect: external-mutation
version: 3.0.0
owner: daishiman
since: 2026-08-25
last-audited: 2026-08-25
audit-trigger: on-change
source: packages/api/src/ai/contract.ts
source-tier: internal
aliases:
  - kanjo-accounting-report
runtime_root_policy: host-skill-path
prompt_creator_policy: skip
completeness_exempt:
  - manifest: 単一責務(取得→分析→検査→送信)の1周ループで phase 分割が無く、workflow-manifest.json を置く対象の宣言的リソースが無い
goal_seek:
  engine: inline
  fork: inline
  max_loops: 3
  progress_file: ${TMPDIR:-/tmp}/kanjo-ai-progress.json
feedback_contract:
  contract_version: 1
  max_iterations: 3
  criteria:
    - id: IN1
      loop_scope: inner
      text: 送信JSONが scripts/validate-report.py --data <取得JSON> で exit 0(5節の最低行数・要点の4欄・図表カタログ参照と「図N」の照合・上限下限・プレーンテキスト)になっている
      verify_by: script
      derived_from: [CL-3, CL-4]
    - id: IN2
      loop_scope: inner
      text: 本文・keyFindings の金額・科目・ベンダー名が取得データ(またはそこからの計算)に由来し、判定は analysis-guide §8 の閾値だけを使い、図の数値を自分で作っていない。無いものは dataGaps と本文に「データ不足」、解消操作は needs に書かれている。stats.available が false の手法・axes に無い軸・BS(bs.available=false)の数字を書いていない
      verify_by: verification-obligation
      derived_from: [CL-2]
    - id: IN3
      loop_scope: inner
      text: 一時ファイルとトークンがリポジトリ・ログ・会話要約に残っていない
      verify_by: verification-obligation
      derived_from: [CL-6]
    - id: OUT1
      loop_scope: outer
      text: POST が 201 で受理され reportId が利用者に示された(または送信不能環境では貼り付け用JSONが提示された)
      verify_by: live-trial
      derived_from: [CL-5]
    - id: OUT2
      loop_scope: outer
      text: Claude Code と Codex のどちらから起動しても同じ手順・同じ成果物になる(環境固有パス・ツールに依存しない)
      verify_by: human
      derived_from: [CL-1]
rubric_refs:
  - /Users/dm/dev/dev/個人開発/harness/plugins/harness-creator/skills/ref-skill-design-rubric/references/rubric.json
script_refs:
  - scripts/validate-report.py
  - scripts/test_validate_report.py
reference_refs:
  - references/analysis-guide.md
  - references/report-schema.md
  - references/chart-catalog.md
  - references/chart-catalog.json
rubric_hash: sha256:6e1843e5204accb8c76c96bf0d8189dafff6d51f2d182096424fcb6c6bfd3d0d
---

# run-kanjo-accounting-report

## Runtime root contract

- この Skill はプロジェクト同梱(正本 `skills/run-kanjo-accounting-report/`、配布先 `.claude/skills/` と `.agents/skills/` は `pnpm run skills:sync` で生成)。Claude Code と Codex のどちらでも、ホストが提示した **この SKILL.md の絶対パスの親ディレクトリ** を `$SKILL_DIR` とし、同梱資産は `$SKILL_DIR/references/...` `$SKILL_DIR/scripts/...` で参照する。cwd やリポジトリ相対位置から推測しない。
- 一時ファイルは OS の一時ディレクトリ(`${TMPDIR:-/tmp}`)にだけ置く。リポジトリ内には作らない。

## 目的と出力契約

### Purpose & Output Contract

アプリ「AI分析」画面が発行した指示文(対象期間とレポートの型 / データ取得URL / 結果送信URL / `Authorization: Bearer kjo_…` / 有効期限。再分析なら前回レポートID、任意で利用者の補足情報)を受け取り、**データ取得 → 分析 → 送信前検査 → 送信** を1回で完了する。送信前の形式検査は必ず `scripts/validate-report.py` で行い、推測の数字を書くことは禁止。

- **入力**: 貼り付けられた指示文(上記5項目 + 任意2項目)。
- **出力**: アプリへ POST した第3版レポート = `summary` + `keyFindings`(改善すべき点 / 無駄なコスト / すぐ効く対策。**1件 = 事実(数値+計算根拠) → 解釈 → 次のアクション(期待効果)**) + `charts`(図表カタログの id と読み解きだけ。**図の数値はアプリが計算する**) + 固定5節(`spend` / `change` / `reduction` / `split` / `subscriptions`。節ごとの最低行数あり) + `needs`(精度を上げるために利用者がアプリで行う操作) + `followUp`(前回レポートがあるときの追跡) + `dataGaps`。受理時に返る `reportId`。形の正本は `references/report-schema.md`(APIの `reportInputSchema` を写したもの)、図は `references/chart-catalog.md`。
- **レポートの型**: 期間の長さで決まる(1ヶ月=月次 / 2〜13ヶ月=年次 / 14ヶ月以上=長期)。5節と8図は固定し、型ごとの重心と主役にする図は `references/analysis-guide.md` §2。
- **完了条件**: `201` を受け取り `reportId` を利用者へ示す。送信不能環境では検査済みJSONをそのまま提示し、画面の「結果を貼り付ける」へ誘導する。

## 境界

- 数字・科目・ベンダー名は取得データに由来するものだけ。差額・比率・年換算は計算式が言える範囲だけ使う。判定の閾値は `references/analysis-guide.md` §8 に固定(独自の閾値を作らない)。
- 図の数値・形は作らない。取得データの `charts`(カタログ8枚・計算済み)を読み解くだけで、`axes` に無い切り口(例: 決済状況)を持ち出さない。
- データを保存しない。取得JSON・送信JSONはリポジトリ外の一時ファイルに置き、終了時に消す。
- トークンは指示文の中と curl の引数にだけ使う。ファイル・ログ・要約へ書き写さない。
- アプリ側のスキーマ(`packages/api/src/ai/contract.ts`)を変える提案はしない。形が合わないときはレポート側を直す。
- 分析に使う観点は `references/analysis-guide.md` の範囲。税務判断の断定・法的助言はしない。

## 主要ルール

### Key Rules

1. **数字は取得したデータにある値だけ**。推測で金額・科目・ベンダーを作らない。
2. **無いものは「データ不足」と書く**(例: 前年同月の個人支出が無い)。埋めない・ぼかさない。`dataGaps` にも1件1行で列挙する。
3. **5節を毎回すべて出し、節ごとの最低行数(`items`: spend 3 / change 1 / reduction 2 / split 2 / subscriptions 1)を満たす**。満たせないときは `gap` に「何があれば出せるか」を10字以上で書く。`summary` は 60〜1,200字で、出せた図を「図N」で参照する。
4. 本文は**プレーンテキスト**(改行と「- 」の箇条書きだけ)。HTML・Markdownの表・見出し記号は使わない。
5. **送信前に必ず `python3 "$SKILL_DIR/scripts/validate-report.py" <送信JSON> --data <取得JSON>` を通し、exit 0 になってから POST する**(fail-closed。`--data` で図の available と「図N」参照まで照合する)。
6. `401` は期限切れか使用済み。**自分で推測して続けず、利用者に指示文の再発行を依頼する**。
7. **統計・PL・BS はできることだけ書く**。`stats.available` が false の手法は「この手法には N ヶ月以上必要(あと M ヶ月分で分析可能)」と書く。`bs.available` が false の間は資産・負債・残高の数字を一切書かず `bs.reason` の1行だけ書く(`analysis-guide.md` §4)。
8. **足りない情報は `needs` に「アプリでの操作」として書く**(画面 id は `report-schema.md` の表から)。`previousReports` があれば `followUp` に前回指摘の行方(解消 / 未実施 / 悪化)を書く。
9. 立場は税理士・管理会計の実務家。**事実(数字) → 解釈 → 打ち手** の順、1文は短く、金額は「123,456円」、比率は「12.3%」、増減は「+12,000円(+8.1%)」。断定できないことは「〜の可能性(根拠: …)」。専門用語は括弧で言い換える(例: 固定費(毎月ほぼ同額で出るもの))。
10. **要点は 事実(数値+`basis` に計算根拠)→ 解釈 → 次のアクション(`expectedEffect` に期待効果)の4欄をすべて埋める**。0件の区分は `notes` に理由。
11. **図は取得データの `charts` で `available=true` のものだけ**。すべて本文で「図N」と参照し、`charts` に `{catalogId, caption}`(caption 15字以上・図から言えること)を付けて送る。出せない図は参照せず `dataGaps` に「図N はあと◯ヶ月分で出せる」。`status=app_missing` の図は「アプリ側の不備」と書く。

## 評価・改善ループ契約

frontmatter `feedback_contract.criteria` が評価基準の正本。inner(IN1〜IN3)は送信前に自分で検査し、未達なら局面へ戻る。outer(OUT1〜OUT2)は送信結果と利用環境で判定する。周回上限は `max_iterations: 3`。3周で IN1 が exit 0 にならない場合は、検査結果の NG 行をそのまま利用者へ示して止める(形を偽装して送らない)。

## ゴールシーク実行

> 固定手順ではなく、下記ゴールへ向けて完了チェックリストの未達項目を埋める局面を都度選ぶ。局面の一覧は「局面カタログ」。

### ゴール (Goal)

指示文の対象期間と型について、取得した実績データだけを根拠にした第3版レポート(4欄の要点・カタログ図の読み解き・最低行数を満たす固定5節・needs)が `validate-report.py` exit 0 を経てアプリに `201` で受理され、`reportId` が利用者に示されている。

### 目的・背景 (Why)

このレポートはアプリの「AI分析」画面にそのまま保存・表示される。節が欠ける・推測の数字が混ざる・HTMLが混ざると、表示が崩れるか、誤った打ち手を利用者に渡す。Claude Code と Codex のどちらから実行しても同じ形になるよう、検査を人の注意力ではなくスクリプトに固定している。

### 完了チェックリスト (Checklist)

- [ ] 指示文から 対象期間と型 / GET URL / POST URL / トークン / 有効期限(+ 再分析の前回ID・補足情報)を読み取った <!-- CL-1 -->
- [ ] 本文・keyFindings・charts の金額・科目・ベンダーが取得JSON(または計算式を示せる派生値)に由来し、無いものは「データ不足」と本文・`dataGaps` に書き、解消操作を `needs` に書いた。`stats.available=false` の手法・BS の数字を書いていない <!-- CL-2 -->
- [ ] `summary`(図N参照つき) + `keyFindings`(3区分・各件 fact/basis/interpretation/action・0件は notes) + `charts`(available=true の全図に catalogId+caption) + 5節(最低行数か gap) + `needs`(+ 前回があれば `followUp`)を含む送信JSONを組み立てた <!-- CL-3 -->
- [ ] `validate-report.py --data <取得JSON>` が exit 0 を返した <!-- CL-4 -->
- [ ] POST が `201` を返し `reportId` を利用者へ示した(送信不能環境ではJSONを提示し貼り付け先を案内した) <!-- CL-5 -->
- [ ] 一時ファイルを削除し、トークンをファイル・ログ・要約に残していない <!-- CL-6 -->

### ゴールシークループ

1. 現状評価: 上のチェックリストで未達の項目を挙げる。
2. 局面選択: 未達項目に対応する局面を「局面カタログ」から選ぶ(順序固定なし。通常は 取得 → 分析 → 組立 → 検査 → 送信 → 後片付け の流れになる)。
3. 実行 → 検証: 検証は決定論的なもの(HTTPステータス、`validate-report.py` の exit code)を優先する。
4. 反復: 未達が残れば 1 へ戻る。上限 3 周。超えたら NG 行を示して止める。

### ゴールシーク配線

- 周回状態は必要なら `${TMPDIR:-/tmp}/kanjo-ai-progress.json` に記録する(リポジトリ内 `eval-log/` へは書かない)。持つのは `original_goal`(上のゴール文)と `merged_directive_for_next`(次周回への指示)だけで、`intermediate.jsonl` は使わない。
- 検証は `required_keys`(5節 id)の充足を `validate-report.py` が行う。`original_goal_hash` / `hashlib.sha256` による目標固定は 1周が短いこの Skill では省略する。

## 局面カタログ (順序は都度判断)

### 局面: 取得

```bash
curl -sS -H "Authorization: Bearer <token>" "<データ取得URL>" -o "${TMPDIR:-/tmp}/kanjo-ai-data.json"
```

- `401` → 期限切れ/使用済み。利用者に指示文の再発行を依頼して止める。
- `404 no_data` → 取込済みデータが無い。その旨を伝えて止める。
- ネットワーク不可 → 利用者に「AI分析」画面の「データを表示」からJSONを貼り付けてもらい、それを入力にする。

### 局面: 分析

`references/analysis-guide.md` §1 でデータの読み方(各キーの意味)、§2 で型(月次/年次/長期)の重心と主役にする図を確認し、§3 の観点チェックリストを上から順に当てる。判定は §8 の閾値(アプリ計算済み)だけを使う。図は取得JSONの `charts` を `references/chart-catalog.md` と照らして読み、`available=true` の図ごとに「この図から言えること」を1〜2文にまとめる(これが `caption` になる)。比較対象(`summary.previous` / `summary.yearAgo`)が `null` の観点は「データ不足」で確定させ、`dataGaps` と `needs` へ積む。統計・PL・BS は §4、前回レポートと補足情報は §5 に従う。`dataRange` が指示文の期間より狭ければ、本文冒頭に「実データは○〜○の○ヶ月分」と書く。

### 局面: 組立

`references/report-schema.md` の形で送信JSONを `${TMPDIR:-/tmp}/kanjo-ai-report.json` に書く。節の役割と必ず含めるもの:

| id | 節の役割 | 必ず含めるもの |
|---|---|---|
| `spend` | 何にいくらかかっているか | 対象期間の事業経費・個人支出の合計と上位科目(金額・構成比)。`items` に上位科目 **3行以上**。図2・図7 を参照 |
| `change` | 前年・前月との増減と要因 | 合計と主要科目の差額・率(`items` **1行以上**)。図3・図5 を参照。比較対象が無ければ `gap` に「データ不足(何ヶ月分あれば出せるか)」。未記帳月は増減と混同しない |
| `reduction` | 削減余地と根拠・優先順位 | 候補ごとに 金額(年換算)・根拠・`priority`(high/mid/low)。`items` に候補 **2行以上** |
| `split` | 事業/個人・本人/妻の別 | 事業と個人の収支、名義別の収入・支出(`items` **2行以上**)。名義未設定の金融機関があれば明記。個人データが無ければ `gap` |
| `subscriptions` | サブスクの整理候補 | 直近月の合計・年換算、重複/急増アラート、見直し候補と理由(`items` **1行以上**)。図8 を参照 |

5節の外側に置くもの: `keyFindings`(各区分1〜5件・4欄と `priority` 必須・0件は `notes`)、`charts`(`available=true` の図すべてに `{catalogId, caption}`。数値は送らない)、`needs`(`gap` / `action` / `screen`)、`followUp`(`previousReports` があるときだけ)。

### 局面: 検査

```bash
python3 "$SKILL_DIR/scripts/validate-report.py" "${TMPDIR:-/tmp}/kanjo-ai-report.json" --data "${TMPDIR:-/tmp}/kanjo-ai-data.json"
```

exit 0 で次へ。exit 1 は NG 行(節不足・最低行数未満・要点の4欄不足・文字数の下限/上限・HTML混入・未定義の `catalogId`・出せる図の参照漏れ・出せない図の参照・未定義の画面 id など)を直して再検査。exit 2 はJSONが壊れているので組立へ戻る。`--data` を省くと図の available 照合はアプリ側の保存時検査(`400`)に回る。

### 局面: 送信

```bash
curl -sS -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  --data @"${TMPDIR:-/tmp}/kanjo-ai-report.json" "<結果送信URL>"
```

- `201` → `reportId` を利用者に示す(「AI分析」画面で閲覧できる)。
- `400 missing_sections` → 不足節を足して**同じトークンで再送**(未受理ならトークンは使用済みにならない)。
- `400`(その他) → `error.message` に従って直し、検査へ戻る。
- `401` → 再発行を依頼して止める。
- 送信不能環境 → 検査済みJSONを提示し、「AI分析」画面の「結果を貼り付ける」へ案内する。

### 局面: 後片付け

`${TMPDIR:-/tmp}/kanjo-ai-*.json` を削除し、応答に貼ったトークンが無いことを確認する。

## 検証

| 対象 | 方法 | 合格条件 |
|---|---|---|
| 送信JSONの形 | `scripts/validate-report.py` | exit 0 |
| 検査スクリプト自体 | `python3 -B -m unittest discover -s "$SKILL_DIR/scripts" -p 'test_*.py'`(`pnpm run skills:test`) | 全件 OK |
| アプリ側の受理 | POST の応答 | `201` + `reportId` |
| 配布先の同期 | `pnpm run skills:check` | 差分なし |

## 注意点

### Gotchas

- `sections` の順序は問わない(保存時に固定順へ並ぶ)が、**id の綴りは固定**。`subscription`(単数)などは `400` になる。
- `amount` は円の整数。小数・文字列・`true` は検査で落ちる。不明なら `null`。
- 検査スクリプトはローカルの写しで、アプリ側の上限・下限(`summary` 60〜1,200字 / `body` 80〜6,000字 / `caption` 15〜400字 / `items` 60件 / `dataGaps` 40件)を先取りして落とす。API側で `400` が出たら `error.message` を優先して直す。
- `401` を「もう一度 GET すれば直る」と誤解しない。トークンは使い捨てで、再発行は利用者の画面操作でしかできない。
- 未記帳の月(取込が無い月)を「支出が減った」と読まない。`change` では未記帳を先に切り分ける。
- 期間が取込済みデータより広い(例: 過去5年を指定したが2年分しか無い)ときは、無い年を推測で埋めず `dataRange` を冒頭に書く。
- `charts` に第2版の形(`kind` / `labels` / `series`)を送らない。図の数値はアプリが計算済みで、AI が送るのは `catalogId` と `caption` だけ。
- 「図N」の番号はカタログで固定(図1 推移 … 図8 サブスク)。出せない図の番号を本文に書くと `400`。
- BS(資産・負債・残高)は取得データに存在しない。「現預金が○円」のような文は書かない。

## 変数化契約

| 変数 | 由来 | 既定 |
|---|---|---|
| `<データ取得URL>` / `<結果送信URL>` / `<token>` / 対象期間 | 指示文 | なし(指示文に無ければ利用者へ再発行を依頼) |
| `$SKILL_DIR` | ホストが提示した SKILL.md の親ディレクトリ | なし(推測しない) |
| `${TMPDIR:-/tmp}` | OS の一時ディレクトリ | `/tmp` |
| `generatedBy` | 実行環境名(`claude-code` / `codex`) | 実行環境から判断 |

## 追加リソース

- `references/analysis-guide.md` — データの読み方(各キーの意味)、型ごとの重心、分析観点のチェックリスト、統計・PL・BS の扱い、前回レポートの追跡
- `references/report-schema.md` — 送信JSONの形(第3版: 要点4欄 / charts はカタログ参照 / 節の最低行数と gap)・上限下限・画面 id・応答コード
- `references/chart-catalog.md` — 図表カタログ8枚と必要データ・切り口・粒度・出せない理由の区別・検査規則の対応表。`chart-catalog.json` は機械可読の正本(`pnpm catalog:export` 生成)
- `scripts/validate-report.py` — 送信前の形式検査(標準ライブラリのみ)。`scripts/test_validate_report.py` が機能テスト
- 契約の正本: `packages/api/src/ai/contract.ts`(`reportInputSchema` / `SKILL_NAME`)。`docs/spec-v1.1.md` §16 が仕様

## セキュリティと権限

- `effect: external-mutation`: 結果送信URLへの POST がアプリのデータを1件作る。書き込み先はこの1エンドポイントだけで、他の外部サービスへ送らない。
- `allowed-tools` は `Read` / `Bash(curl *)` / `Bash(python3 *)` に限定。git 操作・ファイルのリポジトリ内保存は行わない。
- 取得データには金額・取引先が含まれる。応答・要約・ログへ明細行を貼らない(レポート本文に集計値として書く範囲は可)。

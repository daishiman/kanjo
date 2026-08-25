---
name: run-kanjo-accounting-report
description: kanjo(収支管理コンソール)の「AI分析」画面が発行した指示文(取得URLと送信URLと使い捨てトークンを含む)を貼り付けられたとき、取り込み済みの実績データを会計の実務家として読み、固定5節のレポートを生成してアプリへ返したいときに使う。
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash(curl *), Bash(python3 *)
kind: run
prefix: run
effect: external-mutation
version: 1.0.0
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
      text: 送信JSONが scripts/validate-report.py で exit 0(5節揃い・上限内・プレーンテキスト)になっている
      verify_by: script
      derived_from: [CL-3, CL-4]
    - id: IN2
      loop_scope: inner
      text: 本文中の金額・科目・ベンダー名が取得データ(またはそこからの計算)に由来し、無いものは dataGaps と本文に「データ不足」と書かれている
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
rubric_hash: sha256:6e1843e5204accb8c76c96bf0d8189dafff6d51f2d182096424fcb6c6bfd3d0d
---

# run-kanjo-accounting-report

## Runtime root contract

- この Skill はプロジェクト同梱(正本 `skills/run-kanjo-accounting-report/`、配布先 `.claude/skills/` と `.agents/skills/` は `pnpm run skills:sync` で生成)。Claude Code と Codex のどちらでも、ホストが提示した **この SKILL.md の絶対パスの親ディレクトリ** を `$SKILL_DIR` とし、同梱資産は `$SKILL_DIR/references/...` `$SKILL_DIR/scripts/...` で参照する。cwd やリポジトリ相対位置から推測しない。
- 一時ファイルは OS の一時ディレクトリ(`${TMPDIR:-/tmp}`)にだけ置く。リポジトリ内には作らない。

## 目的と出力契約

### Purpose & Output Contract

アプリ「AI分析」画面が発行した指示文(対象期間 / データ取得URL / 結果送信URL / `Authorization: Bearer kjo_…` / 有効期限)を受け取り、**データ取得 → 分析 → 送信前検査 → 送信** を1回で完了する。送信前の形式検査は必ず `scripts/validate-report.py` で行い、推測の数字を書くことは禁止。

- **入力**: 貼り付けられた指示文(上記5項目)。
- **出力**: アプリへ POST した固定5節レポート(`spend` / `change` / `reduction` / `split` / `subscriptions` + `summary` + `dataGaps`)と、受理時に返る `reportId`。形の正本は `references/report-schema.md`(APIの `reportInputSchema` を写したもの)。
- **完了条件**: `201` を受け取り `reportId` を利用者へ示す。送信不能環境では検査済みJSONをそのまま提示し、画面の「結果を貼り付ける」へ誘導する。

## 境界

- 数字・科目・ベンダー名は取得データに由来するものだけ。差額・比率・年換算は計算式が言える範囲だけ使う。
- データを保存しない。取得JSON・送信JSONはリポジトリ外の一時ファイルに置き、終了時に消す。
- トークンは指示文の中と curl の引数にだけ使う。ファイル・ログ・要約へ書き写さない。
- アプリ側のスキーマ(`packages/api/src/ai/contract.ts`)を変える提案はしない。形が合わないときはレポート側を直す。
- 分析に使う観点は `references/analysis-guide.md` の範囲。税務判断の断定・法的助言はしない。

## 主要ルール

### Key Rules

1. **数字は取得したデータにある値だけ**。推測で金額・科目・ベンダーを作らない。
2. **無いものは「データ不足」と書く**(例: 前年同月の個人支出が無い)。埋めない・ぼかさない。`dataGaps` にも1件1行で列挙する。
3. **5節を毎回すべて出す**。該当が無い節も「該当なし(理由)」を書いて節は残す。`summary` は3〜5行。
4. 本文は**プレーンテキスト**(改行と「- 」の箇条書きだけ)。HTML・Markdownの表・見出し記号は使わない。
5. **送信前に必ず `python3 "$SKILL_DIR/scripts/validate-report.py" <送信JSON>` を通し、exit 0 になってから POST する**(fail-closed)。
6. `401` は期限切れか使用済み。**自分で推測して続けず、利用者に指示文の再発行を依頼する**。
7. 立場は税理士・管理会計の実務家。**事実(数字) → 解釈 → 打ち手** の順、1文は短く、金額は「123,456円」、比率は「12.3%」、増減は「+12,000円(+8.1%)」。断定できないことは「〜の可能性(根拠: …)」。専門用語は括弧で言い換える(例: 固定費(毎月ほぼ同額で出るもの))。

## 評価・改善ループ契約

frontmatter `feedback_contract.criteria` が評価基準の正本。inner(IN1〜IN3)は送信前に自分で検査し、未達なら局面へ戻る。outer(OUT1〜OUT2)は送信結果と利用環境で判定する。周回上限は `max_iterations: 3`。3周で IN1 が exit 0 にならない場合は、検査結果の NG 行をそのまま利用者へ示して止める(形を偽装して送らない)。

## ゴールシーク実行

> 固定手順ではなく、下記ゴールへ向けて完了チェックリストの未達項目を埋める局面を都度選ぶ。局面の一覧は「局面カタログ」。

### ゴール (Goal)

指示文の対象期間について、取得した実績データだけを根拠にした固定5節のレポートが `validate-report.py` exit 0 を経てアプリに `201` で受理され、`reportId` が利用者に示されている。

### 目的・背景 (Why)

このレポートはアプリの「AI分析」画面にそのまま保存・表示される。節が欠ける・推測の数字が混ざる・HTMLが混ざると、表示が崩れるか、誤った打ち手を利用者に渡す。Claude Code と Codex のどちらから実行しても同じ形になるよう、検査を人の注意力ではなくスクリプトに固定している。

### 完了チェックリスト (Checklist)

- [ ] 指示文から 対象期間 / GET URL / POST URL / トークン / 有効期限 の5項目を読み取った <!-- CL-1 -->
- [ ] 本文の金額・科目・ベンダーが取得JSON(または計算式を示せる派生値)に由来し、無いものは「データ不足」と本文・`dataGaps` に書いた <!-- CL-2 -->
- [ ] 5節(`spend` `change` `reduction` `split` `subscriptions`)と `summary` を全て含む送信JSONを組み立てた <!-- CL-3 -->
- [ ] `validate-report.py` が exit 0 を返した <!-- CL-4 -->
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

`references/analysis-guide.md` §1 でデータの読み方(各キーの意味)を確認し、§2 の観点チェックリストを上から順に当てる。比較対象(前月・前年同月)が無い観点は「データ不足」で確定させ、`dataGaps` へ積む。

### 局面: 組立

`references/report-schema.md` の形で送信JSONを `${TMPDIR:-/tmp}/kanjo-ai-report.json` に書く。節の役割と必ず含めるもの:

| id | 節の役割 | 必ず含めるもの |
|---|---|---|
| `spend` | 何にいくらかかっているか | 対象期間の事業経費・個人支出の合計と上位科目(金額・構成比)。`items` に上位科目 |
| `change` | 前年・前月との増減と要因 | 合計と主要科目の差額・率。比較対象が無ければ「データ不足」。未記帳月は増減と混同しない |
| `reduction` | 削減余地と根拠・優先順位 | 候補ごとに 金額(年換算)・根拠・`priority`(high/mid/low)。`items` に候補 |
| `split` | 事業/個人・本人/妻の別 | 事業と個人の収支、名義別の収入・支出。名義未設定の金融機関があれば明記 |
| `subscriptions` | サブスクの整理候補 | 直近月の合計・年換算、重複/急増アラート、見直し候補と理由 |

### 局面: 検査

```bash
python3 "$SKILL_DIR/scripts/validate-report.py" "${TMPDIR:-/tmp}/kanjo-ai-report.json"
```

exit 0 で次へ。exit 1 は NG 行(節不足・上限超過・HTML混入・priority不正など)を直して再検査。exit 2 はJSONが壊れているので組立へ戻る。

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
- 検査スクリプトはローカルの写しで、アプリ側の上限(`summary` 3,000字 / `body` 12,000字 / `items` 60件 / `dataGaps` 40件)を先取りして落とす。API側で `400` が出たら `error.message` を優先して直す。
- `401` を「もう一度 GET すれば直る」と誤解しない。トークンは使い捨てで、再発行は利用者の画面操作でしかできない。
- 未記帳の月(取込が無い月)を「支出が減った」と読まない。`change` では未記帳を先に切り分ける。

## 変数化契約

| 変数 | 由来 | 既定 |
|---|---|---|
| `<データ取得URL>` / `<結果送信URL>` / `<token>` / 対象期間 | 指示文 | なし(指示文に無ければ利用者へ再発行を依頼) |
| `$SKILL_DIR` | ホストが提示した SKILL.md の親ディレクトリ | なし(推測しない) |
| `${TMPDIR:-/tmp}` | OS の一時ディレクトリ | `/tmp` |
| `generatedBy` | 実行環境名(`claude-code` / `codex`) | 実行環境から判断 |

## 追加リソース

- `references/analysis-guide.md` — データの読み方(各キーの意味)と分析観点のチェックリスト
- `references/report-schema.md` — 送信JSONの形・項目・応答コード
- `scripts/validate-report.py` — 送信前の形式検査(標準ライブラリのみ)。`scripts/test_validate_report.py` が機能テスト
- 契約の正本: `packages/api/src/ai/contract.ts`(`reportInputSchema` / `SKILL_NAME`)。`docs/spec-v1.1.md` §16 が仕様

## セキュリティと権限

- `effect: external-mutation`: 結果送信URLへの POST がアプリのデータを1件作る。書き込み先はこの1エンドポイントだけで、他の外部サービスへ送らない。
- `allowed-tools` は `Read` / `Bash(curl *)` / `Bash(python3 *)` に限定。git 操作・ファイルのリポジトリ内保存は行わない。
- 取得データには金額・取引先が含まれる。応答・要約・ログへ明細行を貼らない(レポート本文に集計値として書く範囲は可)。

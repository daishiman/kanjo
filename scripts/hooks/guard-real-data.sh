#!/bin/bash
# PreToolUse フック: 実データの誤コミットを止める第二の防壁。
# Claude Code と Codex の両方から呼ばれる (呼び出し元は --host で自分を名乗る)。
#
# このリポジトリは public であり、freee / マネーフォワードのエクスポートや
# 口座明細などの実データを絶対に含めてはならない。.gitignore が一次防壁だが、
# `git add -f` は素通りする。ここで git 系コマンドを検査する。
#
# 入出力契約:
#   stdin  : {"tool_name":"...","tool_input":{"command":"..."}, ...}
#            Codex は toolInput / cmd 表記になる場合があるため両方を見る。
#   stdout : 何も出さなければ許可。ブロックするときだけ JSON を1つ出す。
#   exit   : 許可は 0、ブロックは 2。Claude Code は stdout の
#            permissionDecision を、Codex は終了コードを主に見るため両方返す。

set -u

HOST="claude"
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:-claude}"; shift 2 ;;
    *) shift ;;
  esac
done

payload=$(cat)

# Claude: tool_input.command / Codex: toolInput.command または cmd
command=$(printf '%s' "$payload" | jq -r '
  (.tool_input // .toolInput // {}) as $i
  | ($i.command // $i.cmd // "")
')

# git を含まないコマンドは対象外。何も出力せずに抜ける = 許可。
case "$command" in
  *git\ *) ;;
  *) exit 0 ;;
esac

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  printf 'ブロック (%s): %s\n' "$HOST" "$1" >&2
  exit 2
}

# 危険なコマンドかを判定する。危険なら deny "理由" を呼ぶ。
# 何も呼ばなければ、この関数を抜けた時点で許可となる。
inspect_git_command() {
  local cmd="$1"
  local tok has_add=0 has_force=0

  # 空白区切りのトークンとして見る。部分文字列で判定すると
  # parse-freee.ts のような普通のファイル名が -f に誤マッチする。
  for tok in $cmd; do
    case "$tok" in
      add) has_add=1 ;;
      --force) has_force=1 ;;
      --*) : ;;
      -*f*) has_force=1 ;;                    # -f / -fv などの短縮フラグ
    esac

    # 実データの置き場所・ファイル名パターンを引数に含む git 操作を止める
    case "$tok" in
      *.dev.vars.example) : ;;                # テンプレートは実 secrets ではない
      *Downloads/*|*収入・支出詳細*|*freee_journals*|*.dev.vars*)
        deny "実データ (Downloads のエクスポート等) や secrets を git 操作に含めることは禁止: $tok" ;;
    esac
  done

  # .gitignore を素通りする強制追加を止める。
  # サブコマンド位置を厳密に取らず add と -f の共起で見るのは、
  # `git -C dir add -f` のような形も逃さないため（fail-safe側に倒す）。
  if [ "$has_add" = 1 ] && [ "$has_force" = 1 ]; then
    deny "git add の強制フラグは .gitignore を無効化するため禁止 (実データ混入防止)"
  fi
}

inspect_git_command "$command"
exit 0

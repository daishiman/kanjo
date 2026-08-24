#!/bin/bash
# PreToolUse(Bash) フック: 実データの誤コミットを止める第二の防壁。
#
# このリポジトリは public であり、freee / マネーフォワードのエクスポートや
# 口座明細などの実データを絶対に含めてはならない。.gitignore が一次防壁だが、
# `git add -f` や想定外のファイル名は素通りする。ここで git 系コマンドを検査する。
#
# 入出力契約 (Claude Code hooks):
#   stdin  : {"tool_name":"Bash","tool_input":{"command":"..."}, ...}
#   stdout : 何も出さなければ許可。deny するときだけ JSON を1つ出す。
#   exit   : 常に 0。非0はフック自体のエラー扱いになり、判断として伝わらない。

set -u

payload=$(cat)
command=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')

# git 以外は対象外。何も出力せずに抜ける = 許可。
case "$command" in
  git\ *|*\;\ git\ *|*\&\&\ git\ *) ;;
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
  exit 0
}

# 危険なコマンドかを判定する。危険なら deny "理由" を呼ぶ。
# 何も呼ばなければ、この関数を抜けた時点で許可となる。
inspect_git_command() {
  local cmd="$1"

  # TODO(human): ここに判定を書く。
  # 例: case "$cmd" in ... esac で $cmd を検査し、
  #     該当したら deny "..." を呼ぶ。
}

inspect_git_command "$command"
exit 0

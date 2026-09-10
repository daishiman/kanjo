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
MODE="hook"
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:-claude}"; shift 2 ;;
    --scan-public-docs) MODE="scan-public-docs"; shift ;;
    *) shift ;;
  esac
done

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)

# 公開候補で明らかに危険な参照だけを検査する。
# CSV という語や samples/ の架空ファイルまで止めると仕様書が書けなくなるため、
# 個人ホームの絶対パスと、Downloads/data 配下の具体的なデータファイルに限定する。
scan_public_docs() {
  local file
  local -a public_files=()

  [ -n "$repo_root" ] || return 0

  while IFS= read -r -d '' file; do
    public_files[${#public_files[@]}]="$file"
  done < <(
    find "$repo_root" -maxdepth 1 -type f \
      \( -name '*.md' -o -name '*.json' -o -name '*.html' \) -print0
    for dir in docs architecture system-spec specs features tasks .dev-graph; do
      [ -d "$repo_root/$dir" ] || continue
      find "$repo_root/$dir" -type f \
        \( -name '*.md' -o -name '*.json' -o -name '*.html' \) -print0
    done
  )

  [ "${#public_files[@]}" -gt 0 ] || return 0

  # 値や一致行を出力せず、全候補を1プロセスで走査する。
  # PreToolUse の10秒枠内で完了させるため、ファイルごとの grep 起動は行わない。
  LC_ALL=C awk -v root="$repo_root" '
    {
      line = $0

      if (line ~ /\/Users\/[^\/[:space:]]+\// ||
          line ~ /\/home\/[^\/[:space:]]+\// ||
          line ~ /[A-Za-z]:[\\\/]+Users[\\\/]+[^\\\/[:space:]]+[\\\/]+/) {
        unsafe = 1
        exit
      }

      if (line ~ /(Downloads|ダウンロード)[\\\/][^[:space:]`]+[.](csv|tsv|xlsx|xls|json|ofx|qif)/ ||
          line ~ /(^|[^[:alnum:]_.-])(data|private|raw-data|raw_data)\/[^[:space:]`]+[.](csv|tsv|xlsx|xls|json|ofx|qif)/) {
        unsafe = 1
        exit
      }

      without_samples = line
      gsub(/samples\/[^[:space:]"`<>]+/, "", without_samples)
      if (without_samples ~ /[^\/[:space:]"`<>]*[12][0-9][0-9][0-9][-_][01][0-9][-_][0-3][0-9][^\/[:space:]"`<>]*[.](csv|tsv|xlsx|xls|ofx|qif)/) {
        unsafe = 1
        exit
      }

      if (FILENAME == root "/system-spec/spec-state.json" ||
          FILENAME ~ /mf-business-classification/) {
        premise = "(実CSV|実測値|実測|実データ|実明細|実入力|実ファイル|実取引|実口座)"
        quantity = "(([^[:digit:]])[[:digit:]]{1,3}(,[[:digit:]]{3})+|[[:digit:]]+[[:space:]]*(件|行|円))"
        if (line ~ premise ".*" quantity || line ~ quantity ".*" premise) {
          unsafe = 1
          exit
        }
      }
    }
    END { exit(unsafe ? 1 : 0) }
  ' "${public_files[@]}"
}

if [ "$MODE" = "scan-public-docs" ]; then
  if ! scan_public_docs; then
    printf '公開文書にローカル絶対パスまたは実データファイル参照があります。値を表示せず匿名化してください。\n' >&2
    exit 2
  fi
  printf '公開文書の実データ参照チェック: OK\n'
  exit 0
fi

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
  local tok has_add=0 has_commit=0 has_push=0 has_force=0

  # 空白区切りのトークンとして見る。部分文字列で判定すると
  # parse-freee.ts のような普通のファイル名が -f に誤マッチする。
  for tok in $cmd; do
    case "$tok" in
      add) has_add=1 ;;
      commit) has_commit=1 ;;
      push) has_push=1 ;;
      --force) has_force=1 ;;
      --*) : ;;
      -*f*) has_force=1 ;;                    # -f / -fv などの短縮フラグ
    esac

    # 実データの置き場所・ファイル名パターンを引数に含む git 操作を止める
    case "$tok" in
      *.dev.vars.example) : ;;                # テンプレートは実 secrets ではない
      *Downloads/*|*収入・支出詳細*|*freee_journals*|*.dev.vars*)
        deny "実データ (Downloads のエクスポート等) や secrets を git 操作に含めることは禁止" ;;
    esac
  done

  # .gitignore を素通りする強制追加を止める。
  # サブコマンド位置を厳密に取らず add と -f の共起で見るのは、
  # `git -C dir add -f` のような形も逃さないため（fail-safe側に倒す）。
  if [ "$has_add" = 1 ] && [ "$has_force" = 1 ]; then
    deny "git add の強制フラグは .gitignore を無効化するため禁止 (実データ混入防止)"
  fi

  # add/commit/push の直前だけ公開文書を走査する。diff/status などの読み取り操作は
  # 止めず、フック自身も一致した値や行を出力しない。
  if [ "$has_add" = 1 ] || [ "$has_commit" = 1 ] || [ "$has_push" = 1 ]; then
    if ! scan_public_docs; then
      deny "公開文書にローカル絶対パスまたは実データファイル参照があります。値を表示せず匿名化してください"
    fi
  fi
}

inspect_git_command "$command"
exit 0

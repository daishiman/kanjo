#!/usr/bin/env bash
# gitフックを設置する。cloneした直後に1度だけ実行する。
#
# .git/hooks は全worktreeで共有される(git-common-dir配下)ため、
# ここで1回置けば以降のworktreeすべてでフックが効く。worktreeごとの設置は要らない。
set -eu

hooks_dir="$(git rev-parse --git-common-dir)/hooks"
mkdir -p "$hooks_dir"

# このマーカーを持つフックだけを上書きする。
# 手で書いたフックや他のツールが置いたフックを黙って壊さないため。
MARKER='# 自動生成: scripts/setup-git-hooks.sh'

# post-checkout: checkout / switch / clone / worktree add の直後。worktreeを作る場面。
# post-merge:    pull(merge)の直後。既存worktreeを更新する場面。
#                pullはcheckoutではないのでpost-checkoutは走らず、こちらが要る。
for hook in post-checkout post-merge; do
  target="$hooks_dir/$hook"

  if [ -e "$target" ] && ! grep -qF "$MARKER" "$target"; then
    echo "setup-git-hooks: $target は自動生成物ではないので触りません" >&2
    continue
  fi

  cat > "$target" <<HOOK
#!/usr/bin/env bash
$MARKER
# 直接編集せず、scripts/link-design.sh の側を直すこと。
set -eu
root=\$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -x "\$root/scripts/link-design.sh" ] || exit 0
"\$root/scripts/link-design.sh" || true
HOOK

  chmod +x "$target"
  echo "setup-git-hooks: $target を設置しました" >&2
done

#!/usr/bin/env bash
# gitフックを設置する。cloneした直後に1度だけ実行する。
#
# .git/hooks は全worktreeで共有される(git-common-dir配下)ため、
# ここで1回置けば以降のworktreeすべてでフックが効く。worktreeごとの設置は要らない。
set -eu

hooks_dir="$(git rev-parse --git-common-dir)/hooks"
mkdir -p "$hooks_dir"

# post-checkout は checkout / switch / clone / worktree add の直後に、
# 対象worktreeの中で実行される。デザイン画像のsymlinkはここで張る。
cat > "$hooks_dir/post-checkout" <<'HOOK'
#!/usr/bin/env bash
# 自動生成: scripts/setup-git-hooks.sh
# 直接編集せず、scripts/link-design.sh の側を直すこと。
set -eu
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -x "$root/scripts/link-design.sh" ] || exit 0
"$root/scripts/link-design.sh" || true
HOOK

chmod +x "$hooks_dir/post-checkout"
echo "setup-git-hooks: $hooks_dir/post-checkout を設置しました" >&2

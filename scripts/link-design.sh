#!/usr/bin/env bash
# 正式デザイン画像(PNG 200枚超・約300MB)を各worktreeから参照できるようにする。
#
# このリポジトリはpublicで、画像をコミットすると全cloneが300MB重くなり履歴からも消せない。
# そのため実体はリポジトリ外の1箇所に置き、各worktreeからはsymlinkで参照する。
# worktreeを作るたびに手で張り直さなくて済むよう、post-checkoutフックから呼ばれる。
# 手で実行してもよい(冪等)。
#
# 実体の場所は KANJO_DESIGN_STORE で上書きできる。
set -eu

DESIGN_STORE="${KANJO_DESIGN_STORE:-$HOME/dev/dev/個人開発/kanjo-design}"
LINK_NAME="design"

# フックからも手動でも呼ばれるので、常にworktreeのルートを基準にする。
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root"

# 実体が無い環境(CI、他の人のclone)では黙って何もしない。
# ここで失敗させるとcheckoutやworktree addごと止まってしまう。
if [ ! -d "$DESIGN_STORE" ]; then
  exit 0
fi

# symlinkかどうかを最初に見る。-L はリンク先が消えていても真になるので、
# 壊れたリンクもここで拾える(-d や -e はリンク先を追うため偽になる)。
if [ -L "$LINK_NAME" ]; then
  if [ "$(readlink "$LINK_NAME")" = "$DESIGN_STORE" ]; then
    exit 0 # 既に正しい。checkoutのたびに張り直す必要はない
  fi
  # 実体の置き場所を変えた後や、リンク先が消えた場合。
  # -L で確認済みなのでリンク自体しか消えない。末尾スラッシュを付けないこと。
  rm "$LINK_NAME"
elif [ -e "$LINK_NAME" ]; then
  # 実ディレクトリかファイル。画像の実体そのものである可能性があり、
  # 消すとgit履歴にも無いまま失われる。触らずに知らせるだけにする。
  echo "link-design: $root/$LINK_NAME はsymlinkではないので触りません。" >&2
  echo "link-design: 中身を確認し、実体なら $DESIGN_STORE へ移してから再実行してください。" >&2
  exit 0
fi

ln -s "$DESIGN_STORE" "$LINK_NAME"
echo "link-design: $LINK_NAME -> $DESIGN_STORE を張りました" >&2

import { useEffect, useId, useRef, useState } from 'react';

/**
 * 取り返しのつかない操作の確認を、アプリ内の <dialog> で行うためのフック。
 *
 * window.confirm を使わない理由。ブラウザには「このページでこれ以上ダイアログを
 * 表示しない」抑止があり、一度でも選ばれると window.confirm は即座に false を返す。
 * 呼び出し側は抑止を知る手立てが無く、押しても何も起きないボタンになる。
 * 取込の月単位洗い替えのように取り返しがつかない操作ほど、確認をブラウザ任せに
 * できない(利用者からは壊れて見え、しかも原因が画面に出ない)。
 *
 * 開いている間の busy=true は「実行中で閉じさせない」意思表示。Esc とやめるの
 * 両方をここで塞ぎ、閉じる経路を1つにする。
 */
export function useConfirmDialog({ busy = false }: { busy?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    // 下端のボタンへ初期フォーカスすると、短い画面ではdialogが自動スクロールして
    // 「何をする確認か」が隠れる。見出しを起点にし、文脈を上から読める状態を保つ。
    titleRef.current?.focus({ preventScroll: true });
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
  }, [open]);

  /** <dialog ref={bind}> に渡す。jsdom には showModal が無いので open 属性で代替する。 */
  const bind = (node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
  };

  const close = () => {
    if (busy) return;
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    setOpen(false);
    triggerRef.current?.focus();
  };

  return { open, setOpen, bind, close, titleRef, triggerRef, titleId, busy };
}

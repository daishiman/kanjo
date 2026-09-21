import type { KeyboardEvent, ReactNode } from 'react';

/**
 * 表の行全体をマウス・Enter・Space で開ける共通部品。行内ボタンは stopPropagation して固有操作を保つ。
 *
 * 行に「選択中」の状態は持たせない。押した行はその場で開く (専用URLへ移る) ので、
 * 一覧に選択が残る余地がない。
 */
export function AiSelectableRow({
  id,
  onSelect,
  children,
}: {
  id?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onSelect();
  };
  return (
    <tr id={id} tabIndex={0} onClick={onSelect} onKeyDown={onKeyDown}>
      {children}
    </tr>
  );
}

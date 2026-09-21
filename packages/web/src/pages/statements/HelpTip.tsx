/**
 * ラベル右の `?`。押すと計算式を 1 文で出す (spec §1.3 / §1.5)。
 * hover だけの title はキーボードとタッチで読めないので、開閉ボタン (aria-expanded) にする。
 */
import { useId, useState } from 'react';

export function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="stmt-help-host">
      <button
        data-native-control="disclosure"
        type="button"
        className="stmt-help"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}の説明`}
        title={text}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {/* aria-controls の参照先を常に置き、閉じている間は hidden で隠す */}
      <span id={id} className="stmt-help-text" role="note" hidden={!open}>
        {text}
      </span>
    </span>
  );
}

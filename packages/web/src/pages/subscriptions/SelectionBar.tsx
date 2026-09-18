import { Button } from '../../components/Button.js';
import { UiIcon } from '../../components/UiIcon.js';
import { SOURCE_LABEL, rawNameKey } from './format.js';
import type { RawSelection } from './types.js';

/**
 * 下部の選択中バー (spec §10)。詳細パネルで生の取引名を 1 件以上選んだときだけ出す。
 * 名称統合の CTA はここだけに置き、統合先は画面側が決めて渡す。
 */
export function SelectionBar({
  selection,
  busy,
  canMerge,
  onRemove,
  onClear,
  onMerge,
}: {
  selection: readonly RawSelection[];
  busy: boolean;
  /** 統合先が決まっているか (未登録の候補で統合先を選んでいない間は押せない) */
  canMerge: boolean;
  onRemove: (raw: RawSelection) => void;
  onClear: () => void;
  onMerge: () => void;
}) {
  if (!selection.length) return null;
  return (
    // 名前付きの section は region として読まれる (画面下端の固定バー)
    <section className="subs-selection" aria-label="選択中の取引">
      <p aria-live="polite">{selection.length}件の取引を選択中</p>
      <ul className="subs-selection-chips">
        {selection.map((raw) => (
          <li key={rawNameKey(raw.name, raw.source)}>
            {raw.name}
            <Button
              variant="text"
              size="mini"
              aria-label={`${raw.name}（${SOURCE_LABEL[raw.source]}）の選択を外す`}
              onClick={() => onRemove(raw)}
            >
              <UiIcon name="close" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="subs-selection-actions">
        <Button variant="primary" disabled={busy || !canMerge} onClick={onMerge}>
          選択した{selection.length}件を統合
        </Button>
        <Button onClick={onClear}>選択を解除</Button>
      </div>
    </section>
  );
}

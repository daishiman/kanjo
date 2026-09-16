import type { ReactNode } from 'react';
import { UiIcon, type UiIconName } from '../../../components/UiIcon.js';
import { yen } from '../../../format.js';
import type { ReconciliationResponse } from './api.js';

export function ReconciliationKpis({ kpi }: { kpi: ReconciliationResponse['kpi'] }) {
  return (
    <section className="recon-kpis" aria-label="照合の概況">
      <KpiTile
        icon="wallet"
        label="事業支出"
        value={yen(kpi.businessExpense)}
        note="対象期間の銀行・カード支出"
      />
      <KpiTile
        icon="info"
        label="MFのみの支出（対応不要）"
        value={
          <>
            {kpi.mfOnlyCount}件 <span className="recon-kpi-sub">{yen(kpi.mfOnlyAmount)}</span>
          </>
        }
        note="MFの金額で総収支に計上済み・対応不要"
      />
      <KpiTile
        icon="wand-sparkles"
        label="対応が必要"
        value={`${kpi.actionRequiredCount}件`}
        note={`要確認・未処理（うち一致候補 ${kpi.reviewCount}件）`}
      />
      <ResolutionTile rate={kpi.resolutionRate} resolved={kpi.resolvedCount} total={kpi.resolvableCount} />
    </section>
  );
}

function KpiTile({
  icon,
  label,
  value,
  note,
}: {
  icon: UiIconName;
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset の form 用スタイルを持ち込まず KPI のまとまりを読み上げる。
    <div className="kpi recon-kpi" role="group" aria-label={label}>
      <UiIcon name={icon} className="ui-icon recon-kpi-icon" />
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        <div className="note">{note}</div>
      </div>
    </div>
  );
}

function ResolutionTile({ rate, resolved, total }: { rate: number | null; resolved: number; total: number }) {
  const percent = rate === null ? null : Math.round(rate * 100);
  const circumference = 2 * Math.PI * 16;
  const progress = rate === null ? 0 : circumference * Math.max(0, Math.min(1, rate));
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset の form 用スタイルを持ち込まず KPI のまとまりを読み上げる。
    <div className="kpi recon-kpi recon-kpi--donut" role="group" aria-label="解消済み">
      <svg className="recon-donut" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle className="recon-donut-track" cx="20" cy="20" r="16" />
        <circle
          className="recon-donut-value"
          cx="20"
          cy="20"
          r="16"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div>
        <div className="label">解消済み</div>
        <div className="value">{percent === null ? '対象なし' : `${percent}%`}</div>
        <div className="note">
          {percent === null ? '照合が必要な取引はありません' : `照合済みの割合 (${resolved} / ${total}件)`}
        </div>
      </div>
    </div>
  );
}

/**
 * KPI 4 枚 (spec §1.3)。値・前期比・出典・期間の文言はすべて core の kpis から出す。
 * 負債残高だけは「前月末比」で、増加を注意色・減少を良化色にする (他の 3 枚と向きが逆)。
 */
import type { StatementsKpi, StatementsScreen } from '@kanjo/core';
import { KpiCard } from '../../components/Page.js';
import { UiIcon, type UiIconName } from '../../components/UiIcon.js';
import { yen, yenS } from '../../format.js';
import { HelpTip } from './HelpTip.js';
import { type KpiKind, arrowOf, kpiComparison, kpiDiffClass } from './view-model.js';

const HELP: Record<string, string> = {
  売上高: '売上高 ＝ 期間中の売上に関する収益の合計です。',
  営業利益: '営業利益 ＝ 売上高 − 売上原価 − 販管費です。',
  現金増減: '現金増減 ＝ 期間中の営業キャッシュフロー概算の合計です。',
  負債残高: '負債残高 ＝ 基準月末の借入金・未払金・クレジット未払・その他の負債の合計です。',
};

function Kpi({
  label,
  kpi,
  kind,
  value,
  icon,
}: {
  label: string;
  kpi: StatementsKpi;
  kind: KpiKind;
  value: string;
  icon: UiIconName;
}) {
  return (
    <KpiCard
      label={
        <span className="stmt-kpi-label">
          {label}
          <HelpTip label={label} text={HELP[label] ?? ''} />
        </span>
      }
      value={value}
      icon={<UiIcon name={icon} />}
      note={
        <span className="stmt-kpi-note">
          <span className={`stmt-kpi-diff ${kpiDiffClass(kpi.diff, kind)}`} data-kpi-comparison={kind}>
            {arrowOf(kpi.diff)}
            {kpiComparison(kpi, kind)}
          </span>
          <span>{kpi.source}</span>
          <span>{kpi.periodLabel}</span>
        </span>
      }
    />
  );
}

export function StatementsKpis({ kpis }: { kpis: StatementsScreen['kpis'] }) {
  const liabilities = kpis.liabilities;
  return (
    <div className="kpis stmt-kpis">
      <Kpi label="売上高" kpi={kpis.sales} kind="flow" value={yen(kpis.sales.value)} icon="brand-bars" />
      <Kpi
        label="営業利益"
        kpi={kpis.operatingProfit}
        kind="flow"
        value={yenS(kpis.operatingProfit.value)}
        icon="up"
      />
      <Kpi
        label="現金増減"
        kpi={kpis.cashChange}
        kind="cash"
        value={yenS(kpis.cashChange.value)}
        icon="wallet"
      />
      <Kpi
        label="負債残高"
        kpi={liabilities}
        kind="stock"
        // 必須項目に未入力があるときは合計を出さない (0 と取り違えない)
        value={liabilities.incomplete ? '未入力あり' : yen(liabilities.value)}
        icon="book-open"
      />
    </div>
  );
}

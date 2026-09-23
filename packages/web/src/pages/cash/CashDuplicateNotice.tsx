import type { CashDealDuplicate, CashEntry } from '../../api.js';
import { Term } from '../../components/Term.js';
import { yen } from '../../format.js';

/**
 * 現金の記帳と freee の仕訳が同じ支払いを指している疑い。
 * 候補を知らせるだけで、どちらも消さない (この画面は数え直さない)。
 */
export function CashDuplicateNotice({
  duplicates,
  entries,
}: {
  duplicates: CashDealDuplicate[];
  entries: CashEntry[];
}) {
  if (!duplicates.length) return null;
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (
    <div className="card cash-duplicates">
      <h2>
        <Term id="doubleCount" />
        の疑い {duplicates.length}件
      </h2>
      <p className="sub">
        現金で記帳した支払いと同じ内容の仕訳が freee 側にもあります。現金払いを後から freee
        にも登録すると、同じ支払いが経費として2回数えられます。どちらか一方だけを残してください(この画面は数え直しません)。
      </p>
      <ul>
        {duplicates.map((d) => {
          const e = byId.get(d.cashEntryId);
          if (!e) return null;
          return (
            <li key={`${d.cashEntryId}-${d.deal.date}-${d.deal.partner}-${d.deal.amount}`}>
              <span className={`pill ${d.confidence === 'same_day' ? 'warn' : 'neutral'}`}>
                {d.confidence === 'same_day' ? '同日' : `${d.dayGap}日ちがい`}
              </span>{' '}
              現金の記帳「{e.description}」({d.cashDate} / {e.categoryMajor} / {yen(e.amount)}) と、freee
              の仕訳「{d.deal.partner}」({d.deal.date} / {d.deal.accountNorm} / {yen(d.deal.amount)})
            </li>
          );
        })}
      </ul>
    </div>
  );
}

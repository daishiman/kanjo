/**
 * P15 決算書: 損益計算書(PL)・キャッシュフロー・貸借対照表(BS)の取込元。
 *
 * 3つを1画面に並べるのは、経営で見る順番がこの順だから。
 *   PL   … 儲かったか(期間の話)
 *   CF   … 現金が回っているか(同じ期間を現金で見た話)
 *   BS   … いま何を持っているか(時点の話)
 * PLとCFは今のデータで出せる。BSは残高が要るのでまだ出せないので、
 * 空欄を出す代わりに「何を取り込めば作れるか」を出す。
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type StatementsResponse, api } from '../api.js';
import { HowTo } from '../components/HowTo.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { gainCls, monthShort, ratio, yen, yenS } from '../format.js';
import { usePeriod } from '../period.js';

export function StatementsPage() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['statements', key],
    queryFn: () => api<StatementsResponse>(withPeriod('/statements')),
  });
  /** 経費グループのうち、中の科目まで開いているもの */
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

  if (q.isLoading)
    return (
      <>
        <PageHeader route="statements" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="statements" />
        <PageState status="error" error={q.error} />
      </>
    );

  const { pl, cf, balanceSheetSources } = q.data;

  if (!pl.months.length)
    return (
      <>
        <PageHeader route="statements" />
        <StatementsIntro />
        <PageState
          status="empty"
          message="freee仕訳が未取込です。決算書は取り込んだ仕訳から作ります。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
        <BalanceSheetSources sources={balanceSheetSources} />
      </>
    );

  const toggle = (group: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  const months = pl.months;

  return (
    <>
      <PageHeader route="statements" />

      <StatementsIntro />

      <div className="kpis">
        <KpiCard label="売上" value={yen(pl.revenue.total)} note={`${months.length}ヶ月の合計`} />
        <KpiCard label="経費" value={yen(pl.expense.total)} note="家事按分の前の金額" />
        <KpiCard
          label="利益"
          value={<span className={gainCls(pl.profit.total)}>{yenS(pl.profit.total)}</span>}
          note="売上 − 経費(決算整理の前)"
        />
        <KpiCard label="利益率" value={ratio(pl.profitRate)} note="利益 ÷ 売上" />
      </div>

      <section className="card">
        <h2>
          <Term id="pl" />
        </h2>
        <HowTo id="statementsPl" />
        <p className="sub lines">
          経費は確定申告で使う分類でまとめています。
          <br />
          グループ名を押すと、中の科目まで開きます。
        </p>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">科目</th>
                {months.map((m) => (
                  <th key={m} scope="col">
                    {monthShort(m)}
                  </th>
                ))}
                <th scope="col">合計</th>
                <th scope="col">構成比</th>
              </tr>
            </thead>
            <tbody>
              <tr className="total">
                <th scope="row">売上</th>
                {pl.revenue.monthly.map((v, i) => (
                  <td key={months[i]} className="num">
                    {yen(v)}
                  </td>
                ))}
                <td className="num">{yen(pl.revenue.total)}</td>
                <td className="num">—</td>
              </tr>
              {pl.groups.map((g) => {
                const open = opened.has(g.group);
                return [
                  <tr key={g.group} className="stmt-group">
                    <th scope="row">
                      <button type="button" className="mini" onClick={() => toggle(g.group)}>
                        {open ? '▾' : '▸'} {g.group}
                      </button>
                    </th>
                    {g.monthly.map((v, i) => (
                      <td key={months[i]} className="num">
                        {yen(v)}
                      </td>
                    ))}
                    <td className="num">{yen(g.total)}</td>
                    <td className="num">{ratio(g.share)}</td>
                  </tr>,
                  ...(open
                    ? g.rows.map((r) => (
                        <tr key={`${g.group}/${r.account}`}>
                          <th scope="row" className="stmt-account">
                            {r.account}
                          </th>
                          {r.monthly.map((v, i) => (
                            <td key={months[i]} className="num">
                              {yen(v)}
                            </td>
                          ))}
                          <td className="num">{yen(r.total)}</td>
                          <td className="num">{ratio(r.share)}</td>
                        </tr>
                      ))
                    : []),
                ];
              })}
              <tr className="total">
                <th scope="row">経費計</th>
                {pl.expense.monthly.map((v, i) => (
                  <td key={months[i]} className="num">
                    {yen(v)}
                  </td>
                ))}
                <td className="num">{yen(pl.expense.total)}</td>
                <td className="num">100.0%</td>
              </tr>
              <tr className="total">
                <th scope="row">利益</th>
                {pl.profit.monthly.map((v, i) => (
                  <td key={months[i]} className={`num ${gainCls(v)}`}>
                    {yenS(v)}
                  </td>
                ))}
                <td className={`num ${gainCls(pl.profit.total)}`}>{yenS(pl.profit.total)}</td>
                <td className="num">{ratio(pl.profitRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Limits items={pl.limits} />
      </section>

      <section className="card">
        <h2>
          <Term id="cashFlow" />
        </h2>
        <HowTo id="statementsCf" />
        {cf.settlementUnknown ? (
          <p className="notice warn lines">
            決済日の列を持つ仕訳がありません。
            <br />
            入金待ち・支払待ちのズレが見られないため、利益と同じ数字になります。
            <br />
            freeeの取引エクスポートに「支払日」を含めて取り込み直してください。
          </p>
        ) : (
          <p className="sub lines">
            利益から、まだ入金されていない売上を引きます。
            <br />
            まだ払っていない経費は足し戻します。
          </p>
        )}
        {cf.months.length === 0 ? (
          <p className="sub">記帳のある月がありません。</p>
        ) : (
          <div className="scroll-x">
            <table className="data stack-sm">
              <thead>
                <tr>
                  <th scope="col">月</th>
                  <th scope="col">利益</th>
                  <th scope="col">入金待ち(増)</th>
                  <th scope="col">支払待ち(増)</th>
                  <th scope="col">営業キャッシュフロー</th>
                  <th scope="col">累計</th>
                </tr>
              </thead>
              <tbody>
                {cf.months.map((m, i) => (
                  <tr key={m.month}>
                    <th scope="row">{monthShort(m.month)}</th>
                    <td className={`num ${gainCls(m.profit)}`} data-label="利益">
                      {yenS(m.profit)}
                    </td>
                    <td className="num" data-label="入金待ち(増)">
                      {yen(m.receivableIncrease)}
                    </td>
                    <td className="num" data-label="支払待ち(増)">
                      {yen(m.payableIncrease)}
                    </td>
                    <td className={`num ${gainCls(m.operating)}`} data-label="営業キャッシュフロー">
                      {yenS(m.operating)}
                    </td>
                    <td className={`num ${gainCls(cf.cumulative[i])}`} data-label="累計">
                      {yenS(cf.cumulative[i])}
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <th scope="row">合計</th>
                  <td className="num" data-label="利益">
                    —
                  </td>
                  <td className="num" data-label="入金待ち(増)">
                    —
                  </td>
                  <td className="num" data-label="支払待ち(増)">
                    —
                  </td>
                  <td className={`num ${gainCls(cf.total)}`} data-label="営業キャッシュフロー">
                    {yenS(cf.total)}
                  </td>
                  <td className={`num ${gainCls(cf.total)}`} data-label="累計">
                    {yenS(cf.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <Limits items={cf.limits} />
      </section>

      <BalanceSheetSources sources={balanceSheetSources} />
    </>
  );
}

/**
 * 3つの表が何を答える表なのかを、数字を出す前に置く。
 * 「PLとCFで数字が違う」を後から説明すると、どちらかが間違っていると読まれる。
 */
function StatementsIntro() {
  return (
    <section className="card">
      <h2>この画面で分かること</h2>
      <p className="sub lines">
        経営で見る3つの表を、上から順に並べています。
        <br />
        同じ期間を「儲け」「現金」「残高」の3通りで見る形です。
      </p>
      <dl className="howto">
        <div className="howto-row">
          <dt>
            <Term id="pl">PL</Term>
          </dt>
          <dd>
            儲かったか。期間中の売上から経費を引いた表です。
            <br />
            まずここで、利益が出ているかを確かめます。
          </dd>
        </div>
        <div className="howto-row">
          <dt>
            <Term id="cashFlow">CF</Term>
          </dt>
          <dd>
            現金が回っているか。同じ期間を現金で見た表です。
            <br />
            利益が黒字でも、入金待ちが多いと手元は減ります。
          </dd>
        </div>
        <div className="howto-row">
          <dt>
            <Term id="bs">BS</Term>
          </dt>
          <dd>
            いま何を持っているか。ある一日の残高の表です。
            <br />
            残高のCSVがまだ無いので、下に取り方を出しています。
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** この表で見えていないもの。数字の下に置いて「無いことに気づかない」を防ぐ */
function Limits({ items }: { items: string[] }) {
  return (
    <p className="sub lines">
      {items.map((text, i) => (
        <span key={text}>
          {i === 0 ? 'この表に入っていないもの: ' : null}
          {text}
          <br />
        </span>
      ))}
    </p>
  );
}

function BalanceSheetSources({ sources }: { sources: StatementsResponse['balanceSheetSources'] }) {
  return (
    <section className="card">
      <h2>
        <Term id="bs" />
        はまだ作れません
      </h2>
      <HowTo id="statementsBs" />
      <p className="sub lines">
        BSは「ある時点の残高」の表です。
        <br />
        取引をいくら足しても、期首の残高が無いと出せません。
        <br />
        下のCSVを取り込めるようにすると作れるようになります。
      </p>
      <p className="notice info lines">
        銀行口座の残高は、1番のCSVだけでそろいます。
        <br />
        MFに全口座を連携していれば、月末残高が1ファイルで出ます。
        <br />
        途中でやめても、手前の番号まででは形になります。
      </p>
      <div className="scroll-x">
        <table className="data stack-sm">
          <thead>
            <tr>
              <th scope="col">順</th>
              <th scope="col">CSV</th>
              <th scope="col">元</th>
              <th scope="col">書き出す場所</th>
              <th scope="col">要る列</th>
              <th scope="col">これで分かること</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={`${s.service}/${s.name}`}>
                <th scope="row">{s.step}</th>
                <td data-label="CSV">{s.name}</td>
                <td data-label="元">
                  <span className={`pill ${s.service === 'freee' ? 'biz' : 'per'}`}>{s.service}</span>
                </td>
                <td data-label="書き出す場所">{s.where}</td>
                <td data-label="要る列">{s.columns.join(' / ')}</td>
                <td data-label="これで分かること">
                  {s.use}
                  {/* 注意は use と同じセルに置く。列を増やすと、読む前に横スクロールが要る */}
                  {s.note ? <span className="sub stmt-note">{s.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub lines">
        手元資金が何ヶ月もつか(
        <Term id="runway" />
        )も、BSがそろえば出せます。
        <br />
        これは
        <Term id="bcp" />
        で最初に見る数字です。
      </p>
    </section>
  );
}

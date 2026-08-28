/**
 * 科目の選択(分類 → 科目の2クリック)。
 *
 * 長い <select> をやめた理由: 科目は確定申告の標準科目まで広げると30を超える。
 * 一列に並べるとスクロールが要り、名前だけでは「どれを選べばいいか」が分からない。
 * 分類タブを1段だけ挟んで、どの科目にも2クリックで届き、
 * 押す前に「いつ選ぶか」と具体例が同じ画面に出るようにする。
 *
 * 候補(Candidates)にある名前だけを出す。ここに出る = サーバの科目ガードを必ず通る、を保つため。
 */
import {
  HOUSEHOLD_GROUPS,
  HOUSEHOLD_GUIDE,
  type HouseholdCategory,
  TAX_ACCOUNT_GROUPS,
  TAX_ACCOUNT_GUIDE,
  TAX_ACCOUNT_PRINCIPLE,
  type TaxAccount,
  commonHouseholdCategories,
  commonTaxAccounts,
  householdCategoriesByGroup,
  householdCategoryByName,
  suggestTaxAccounts,
  taxAccountByName,
  taxAccountsByGroup,
} from '@kanjo/core';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { type CandidateMajor, type Candidates, type Cls, SCOPE_SHORT, api } from '../api.js';
import { useInvalidateClassification } from './classification-invalidate.js';

interface Tab {
  id: string;
  label: string;
  /** この分類に出す科目名(候補に無い名前は描画前に落とす) */
  names: string[];
  /** 分類そのものの説明。科目に触れていないときに出す */
  hint: string;
}

const SOURCE_NOTE: Record<CandidateMajor['source'], string> = {
  freee: 'freeeの仕訳に実在する科目',
  mf: 'MF明細に実在する大項目',
  custom: '自分で追加した科目',
  standard: '最初から用意してある標準の費目',
};

/** 事業の分類タブ。実績 → よく使う → 用途別、の順で「考えずに済む」ほうから並べる */
function bizTabs(list: CandidateMajor[]): Tab[] {
  const used = list.filter((m) => m.source === 'freee' || m.source === 'custom').map((m) => m.name);
  const tabs: Tab[] = [];
  if (used.length) {
    tabs.push({
      id: 'used',
      label: '使ったことがある',
      names: used,
      hint: '過去の仕訳や、自分で追加した科目。同じ支出は毎月同じ科目に入れるのが基本。',
    });
  }
  tabs.push({
    id: 'common',
    label: 'よく使う',
    names: commonTaxAccounts().map((a) => a.name),
    hint: 'コンサル・AI導入支援・サブスクの支払いで出番が多い科目。',
  });
  for (const g of TAX_ACCOUNT_GROUPS) {
    tabs.push({
      id: g,
      label: g,
      names: taxAccountsByGroup(g).map((a) => a.name),
      hint: `${g}に払ったときの科目。`,
    });
  }
  return tabs;
}

/**
 * 家計の分類タブ。確定申告の科目は入れない(事業と家計でマスタを分ける)。
 * 事業と同じく 実績 → よく使う → 用途別 の順に並べる。
 */
function perTabs(list: CandidateMajor[]): Tab[] {
  const used = list.filter((m) => m.source === 'mf' || m.source === 'custom').map((m) => m.name);
  const tabs: Tab[] = [];
  if (used.length) {
    tabs.push({
      id: 'used',
      label: '使ったことがある',
      names: used,
      hint: '取り込んだMF明細と、自分で追加した大項目。',
    });
  }
  tabs.push({
    id: 'common',
    label: 'よく使う',
    names: commonHouseholdCategories().map((c) => c.major),
    hint: '毎月かならず出る費目。',
  });
  for (const g of HOUSEHOLD_GROUPS) {
    tabs.push({
      id: g,
      label: g,
      names: householdCategoriesByGroup(g).map((c) => c.major),
      hint: `${g}に使ったお金。`,
    });
  }
  return tabs;
}

/** 触れている費目の説明。事業と家計でマスタが違うので、系統で引き分ける */
interface Described {
  name: string;
  when: string;
  examples: string[];
}
function describe(scope: Cls, name: string): Described | null {
  if (scope === 'biz') {
    const a: TaxAccount | null = taxAccountByName(name);
    return a ? { name: a.name, when: a.when, examples: a.examples } : null;
  }
  const c: HouseholdCategory | null = householdCategoryByName(name);
  return c ? { name: c.major, when: c.when, examples: c.examples } : null;
}

export function CategoryPicker({
  candidates,
  scope,
  big,
  mid,
  onChange,
  placeholderBig = '科目を選ぶ',
  placeholderMid = '中項目を選ぶ',
  allowAdd = true,
  clearLabel,
  hintText = '',
}: {
  candidates: Candidates;
  scope: Cls | null;
  big: string;
  mid: string;
  onChange: (v: { big: string; mid: string }) => void;
  placeholderBig?: string;
  placeholderMid?: string;
  allowAdd?: boolean;
  /** 指定を外せる画面(仕分けの編集など)で、未指定に戻す選択肢の名前 */
  clearLabel?: string;
  /** 内容・支払先の入力。ここから科目を先回りして勧める(事業のみ) */
  hintText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tabId, setTabId] = useState<string | null>(null);
  const [touched, setTouched] = useState<string | null>(null);
  const panelId = useId();
  const box = useRef<HTMLSpanElement>(null);

  // 画面のどこかを押したら閉じる。開いたままだと下の行が隠れて選び直せない
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!scope) {
    return (
      <span className="sub" style={{ margin: 0 }}>
        科目を指定するには先に公私(事業/個人)を選びます
      </span>
    );
  }

  const list = candidates[scope];
  const major = list.find((m) => m.name === big) ?? null;
  const known = new Set(list.map((m) => m.name));
  const tabs = (scope === 'biz' ? bizTabs(list) : perTabs(list))
    .map((t) => ({ ...t, names: t.names.filter((n) => known.has(n)) }))
    .filter((t) => t.names.length);
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0] ?? null;
  const detail = touched ? describe(scope, touched) : null;
  const guide = scope === 'biz' ? TAX_ACCOUNT_GUIDE : HOUSEHOLD_GUIDE;
  // 入力済みの支払先から先回りする。当てはまらなければ何も出さない(推測で決め打ちしない)
  const suggested =
    scope === 'biz'
      ? suggestTaxAccounts(hintText)
          .filter((a) => known.has(a.name))
          .slice(0, 4)
      : [];

  const pick = (name: string) => {
    onChange({ big: name, mid: '' });
    setOpen(false);
    setTouched(null);
  };

  return (
    <span className="cat-picker" ref={box}>
      <button
        type="button"
        className={major ? 'cat-current on' : 'cat-current'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {major ? major.name : placeholderBig}
      </button>

      {scope === 'per' && major && (
        <select value={mid} onChange={(e) => onChange({ big, mid: e.target.value })}>
          <option value="">{placeholderMid}</option>
          {major.mids.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.source === 'custom' ? '(追加)' : ''}
            </option>
          ))}
        </select>
      )}

      {open && (
        <div className="cat-panel" id={panelId}>
          <p className="cat-principle">{TAX_ACCOUNT_PRINCIPLE}</p>

          {suggested.length > 0 && (
            <div className="cat-suggest">
              <span className="cat-guide-head">入力内容から</span>
              {suggested.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className="cat-chip suggest"
                  onMouseEnter={() => setTouched(a.name)}
                  onFocus={() => setTouched(a.name)}
                  onClick={() => pick(a.name)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}

          {clearLabel && (
            <button
              type="button"
              className="mini linklike"
              onClick={() => {
                onChange({ big: '', mid: '' });
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          )}

          <div className="cat-tabs" role="tablist" aria-label="科目の分類">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab?.id === t.id}
                className={tab?.id === t.id ? 'mini on' : 'mini'}
                onClick={() => {
                  setTabId(t.id);
                  setTouched(null);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="cat-grid" role="tabpanel" aria-label={tab?.label ?? '科目'}>
            {(tab?.names ?? []).map((name) => {
              const src = list.find((m) => m.name === name)?.source;
              return (
                <button
                  key={name}
                  type="button"
                  className={name === big ? 'cat-chip on' : 'cat-chip'}
                  title={src ? SOURCE_NOTE[src] : undefined}
                  onMouseEnter={() => setTouched(name)}
                  onFocus={() => setTouched(name)}
                  onClick={() => pick(name)}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* 説明の高さを固定する。触れるたびに枠が伸び縮みすると、狙った科目が逃げる */}
          <div className="cat-detail">
            {detail ? (
              <AccountDetail account={detail} />
            ) : (
              <p className="cat-when">{tab?.hint ?? '科目を選びます。'}</p>
            )}
          </div>

          <div className="cat-guide">
            <span className="cat-guide-head">迷ったら</span>
            <ul>
              {guide.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {allowAdd &&
            (adding ? (
              <AddCategoryInline
                scope={scope}
                defaultMajor={scope === 'per' && major ? major.name : ''}
                onDone={(v) => {
                  setAdding(false);
                  if (v) {
                    onChange(v);
                    setOpen(false);
                  }
                }}
              />
            ) : (
              <button type="button" className="mini linklike" onClick={() => setAdding(true)}>
                候補にない科目を追加
              </button>
            ))}
        </div>
      )}
    </span>
  );
}

/** その場で候補科目を追加する(系統は現在の公私で決まる)。登録後すぐ選択状態にする */
export function AddCategoryInline({
  scope,
  defaultMajor,
  onDone,
}: {
  scope: Cls;
  defaultMajor: string;
  onDone: (v: { big: string; mid: string } | null) => void;
}) {
  const invalidate = useInvalidateClassification();
  const [major, setMajor] = useState(defaultMajor);
  const [mid, setMid] = useState('');
  const add = useMutation({
    mutationFn: () =>
      api('/category-options', {
        method: 'POST',
        body: JSON.stringify({ scope, major: major.trim(), mid: scope === 'per' ? mid.trim() : '' }),
      }),
    onSuccess: () => {
      invalidate();
      onDone({ big: major.trim(), mid: scope === 'per' ? mid.trim() : '' });
    },
  });
  return (
    <span className="editor-form" style={{ display: 'inline-flex' }}>
      <span className="pill neutral">{SCOPE_SHORT[scope]}の科目として追加</span>
      <input
        type="text"
        placeholder={scope === 'biz' ? '勘定科目名(例: 通信費)' : '大項目'}
        value={major}
        onChange={(e) => setMajor(e.target.value)}
        style={{ width: 140 }}
      />
      {scope === 'per' && (
        <input
          type="text"
          placeholder="中項目(任意)"
          value={mid}
          onChange={(e) => setMid(e.target.value)}
          style={{ width: 120 }}
        />
      )}
      <button
        type="button"
        className="primary"
        disabled={!major.trim() || add.isPending}
        onClick={() => add.mutate()}
      >
        追加して選ぶ
      </button>
      <button type="button" onClick={() => onDone(null)}>
        やめる
      </button>
      {add.isError && (
        <span className="notice" style={{ margin: 0 }}>
          {(add.error as Error).message}
        </span>
      )}
    </span>
  );
}

function AccountDetail({ account }: { account: Described }) {
  return (
    <>
      <p className="cat-when">
        <b>{account.name}</b>: {account.when}
      </p>
      <ul className="cat-examples">
        {account.examples.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </>
  );
}

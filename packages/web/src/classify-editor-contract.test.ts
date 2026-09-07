import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  canUseClassificationShortcuts,
  classificationLeaveDecision,
  shouldGuardClassificationLinkClick,
} from './pages/Classify.js';

const PAGE_SOURCE = readFileSync(new URL('./pages/Classify.tsx', import.meta.url), 'utf8');
const STYLE_SOURCE = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('公私仕分け編集パネルの表示契約', () => {
  it('選択行の直下に公私→科目→名義の順で編集項目を開く', () => {
    expect(PAGE_SOURCE).toContain('aria-expanded={editing}');
    expect(PAGE_SOURCE).toMatch(/<EditorRow\s+[\s\S]*?id=\{editorId\}/);

    const gridStart = PAGE_SOURCE.indexOf('className="classification-editor-grid"');
    const publicPrivate = PAGE_SOURCE.indexOf('<span>公私</span>', gridStart);
    const category = PAGE_SOURCE.indexOf('<span>科目</span>', gridStart);
    const owner = PAGE_SOURCE.indexOf('<span>名義</span>', gridStart);
    expect(gridStart).toBeGreaterThan(-1);
    expect(publicPrivate).toBeGreaterThan(gridStart);
    expect(category).toBeGreaterThan(publicPrivate);
    expect(owner).toBeGreaterThan(category);
  });

  it('主要操作とルール追加を別の階層で表示する', () => {
    expect(PAGE_SOURCE).toContain('変更を保存');
    expect(PAGE_SOURCE).toContain('編集を閉じる');
    expect(PAGE_SOURCE).toContain('取込値に戻す');
    expect(PAGE_SOURCE).toContain('<details className="classification-rule-details">');
    expect(PAGE_SOURCE).toContain('<summary>同じ内容にも適用</summary>');
    expect(PAGE_SOURCE).toContain('aria-label="対象月"');
    expect(PAGE_SOURCE).toContain('最優先ルールを追加');
  });

  it('簡易操作は44px以上で、狭幅で編集項目が1列になる', () => {
    expect(STYLE_SOURCE).toMatch(/button\.mini\.classify-quick\s*\{[^}]*min-height:\s*44px;/s);
    expect(STYLE_SOURCE).toMatch(
      /@container \(max-width: 700px\)[\s\S]*?\.classification-editor-grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });

  it('名義フィルターは正本の3区分を使う', () => {
    expect(PAGE_SOURCE).toContain("['business', ownerLabel('business')]");
    expect(PAGE_SOURCE).toContain("['spouse', ownerLabel('spouse')]");
    expect(PAGE_SOURCE).toContain("['family', ownerLabel('family')]");
    expect(PAGE_SOURCE).not.toContain("['self', '本人']");
  });

  it('未保存のまま同じ行を閉じる場合と別行へ移る場合だけ確認する', () => {
    expect(classificationLeaveDecision('tx-1', null, true, false)).toBe('ask');
    expect(classificationLeaveDecision('tx-1', 'tx-2', true, false)).toBe('ask');

    // 同じ行を開き直すだけ / 変更が無い / そもそも開いていない、では失うものが無い
    expect(classificationLeaveDecision('tx-1', 'tx-1', true, false)).toBe('go');
    expect(classificationLeaveDecision('tx-1', null, false, false)).toBe('go');
    expect(classificationLeaveDecision(null, 'tx-2', true, false)).toBe('go');

    // 保存中は確認すら出さない。答えても結果が変わらない問いを出さない
    expect(classificationLeaveDecision('tx-1', null, true, true)).toBe('blocked');
    expect(classificationLeaveDecision('tx-1', null, false, true)).toBe('blocked');
    expect(PAGE_SOURCE).toContain('disabled={busy}');
  });

  it('候補追加フォームも狭幅向けの1列と44px操作領域を使う', () => {
    expect(STYLE_SOURCE).toMatch(
      /\.classification-category-controls \.editor-form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(STYLE_SOURCE).toMatch(
      /\.classification-category-controls \.editor-form input,[\s\S]*?min-height:\s*44px;/,
    );
  });

  // 破棄の確認そのもの(画面内 dialog を通ること・やめると絞り込みが動かないこと・
  // 破棄すると押した操作が実行されること)は classify-discard-guard.dom.test.tsx が
  // 実 DOM で固定する。ここに文字列一致で書くと、宣言があることしか言えない。

  it('フィルター・設定遷移・再読み込みを共通の未保存ガードで守る', () => {
    expect(PAGE_SOURCE).toContain('requestViewChange(() => setMonth(next))');
    expect(PAGE_SOURCE).toContain('requestViewChange(() => setCls(k))');
    expect(PAGE_SOURCE).toContain('requestViewChange(() => setOwner(k))');
    expect(PAGE_SOURCE).toContain('requestViewChange(() => setManualOnly((v) => !v))');
    expect(PAGE_SOURCE).toContain('requestViewChange(() => setQtext(next))');
    expect(PAGE_SOURCE.match(/onClick=\{onSettingsNavigation\}/g)).toHaveLength(2);
    expect(PAGE_SOURCE).toContain("window.addEventListener('beforeunload', preventDraftUnload)");
    expect(PAGE_SOURCE).toContain("window.removeEventListener('beforeunload', preventDraftUnload)");
  });

  it('編集パネルの表示中または保存中はショートカットを無効にする', () => {
    expect(canUseClassificationShortcuts(null, null)).toBe(true);
    expect(canUseClassificationShortcuts('tx-1', null)).toBe(false);
    expect(canUseClassificationShortcuts(null, 'tx-1')).toBe(false);
    expect(PAGE_SOURCE).toContain('if (!canUseClassificationShortcuts(editingId, busyEditingId)) return;');
  });

  it('画面外の通常の内部Linkだけをdraft guardの対象にする', () => {
    const internalLink = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: '',
      download: false,
      routerLink: true,
      insideMain: false,
      sameOrigin: true,
      sameDocumentHash: false,
    };
    expect(shouldGuardClassificationLinkClick(internalLink)).toBe(true);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, insideMain: true })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, sameOrigin: false })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, target: '_blank' })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, metaKey: true })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, ctrlKey: true })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, shiftKey: true })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, altKey: true })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, routerLink: false })).toBe(false);
    expect(shouldGuardClassificationLinkClick({ ...internalLink, sameDocumentHash: true })).toBe(false);
    expect(
      PAGE_SOURCE.match(/document\.addEventListener\('click', guardShellNavigation, true\)/g),
    ).toHaveLength(1);
    expect(
      PAGE_SOURCE.match(/document\.removeEventListener\('click', guardShellNavigation, true\)/g),
    ).toHaveLength(1);
  });
});

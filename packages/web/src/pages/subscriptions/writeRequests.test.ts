/**
 * 積んだ操作から、送る直前に本文と前提の検査を作る純関数 (SM-FE-04)。
 * 押した時点の本文を積む旧実装では、続けて足した対象科目の 2 件目が 1 件目を知らずに上書きしていた。
 * ここでは「最新の一覧に当てて作る」ことと「送っても失敗が分かっている要求を省く」ことを押さえる。
 */
import type { SubscriptionVendorDetail } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import type { SubVendorRow } from '../../api.js';
import type { OperationRecord } from './api.js';
import type { WriteIntent } from './types.js';
import {
  buildRequest,
  checkPrecondition,
  impactOf,
  labelKindOf,
  labelOf,
  needsVendorList,
  vendorUpdateIntent,
} from './writeRequests.js';

const vendor = (id: number, name: string, extra: Partial<SubVendorRow> = {}): SubVendorRow => ({
  id,
  name,
  aliases: [],
  accounts: [],
  mergedIntoId: null,
  ...extra,
});

const mergeIntent = (extra: Partial<Extract<WriteIntent, { kind: 'merge' }>> = {}): WriteIntent => ({
  kind: 'merge',
  targetId: 1,
  targetName: 'Aqua Voice',
  targetKey: 'aquavoice',
  sourceVendorIds: [2],
  sourceKeys: ['aquavoicepro'],
  rawNames: ['AQUA VOICE INC'],
  names: { '1': 'Aqua Voice', '2': 'Aqua Voice Pro' },
  ...extra,
});

const accountChange = (op: 'add' | 'remove', value: string): WriteIntent => ({
  kind: 'vendor_update',
  vendorId: 1,
  vendorName: 'Aqua Voice',
  change: { field: 'accounts', op, value },
  fallback: { aliases: ['旧別名'], accounts: ['通信費'] },
});

const detailOf = (
  related: SubscriptionVendorDetail['related'],
): Pick<SubscriptionVendorDetail, 'row' | 'related'> => ({
  row: {
    vendorKey: 'aquavoice',
    vendorId: 1,
    status: 'registered',
    displayName: 'Aqua Voice',
    normalizedName: 'Aqua Voice',
    matchedNameCount: 1,
    latestAmount: 1_000,
    estimatedMonthly: 1_000,
    annualized: 12_000,
    billing: 'monthly',
    active: true,
    category: 'その他',
    categorySource: 'dictionary',
    review: null,
  },
  related,
});

const record = (extra: Partial<OperationRecord> = {}): OperationRecord => ({
  id: 'op-1',
  kind: 'merge',
  targetVendorName: 'Aqua Voice',
  createdAt: '2026-09-30T00:00:00.000Z',
  actorEmail: 'owner@example.com',
  undoneAt: null,
  undoneByEmail: null,
  undoable: true,
  undoBlockedReason: null,
  ...extra,
});

describe('見出しと取り直す範囲', () => {
  it('別名の追加は「登録内容の変更」として出し、統合は統合先の名前を入れる', () => {
    const aliases: WriteIntent = { kind: 'vendor_aliases_add', vendorId: 1, vendorName: 'A', aliases: ['x'] };
    expect(labelKindOf(aliases)).toBe('vendor_update');
    expect(labelOf(aliases)).toBe('登録内容の変更');
    expect(labelOf(mergeIntent())).toBe('Aqua Voice へ統合');
    expect(labelOf({ kind: 'unmerge', operationId: 'op-1', targetName: 'Aqua Voice' })).toBe(
      '統合の取り消し',
    );
  });

  it('カテゴリだけの変更と見直し日の記録は、候補と合計を取り直さない範囲に絞る', () => {
    const category: WriteIntent = {
      kind: 'vendor_update',
      vendorId: 1,
      vendorName: 'A',
      change: { field: 'category', value: '仕事' },
      fallback: { aliases: [], accounts: [] },
    };
    const name: WriteIntent = { ...category, change: { field: 'name', value: 'B' } } as WriteIntent;
    expect(impactOf(mergeIntent())).toBe('merge');
    expect(impactOf({ kind: 'unmerge', operationId: 'op-1', targetName: null })).toBe('undo');
    expect(impactOf(category)).toBe('category');
    expect(impactOf(name)).toBe('vendorDefinition');
    expect(impactOf({ kind: 'review', vendorId: 1, vendorName: 'A' })).toBe('reviewDate');
    expect(impactOf({ kind: 'exclusion', partner: 'X' })).toBe('exclusion');
    expect(impactOf({ kind: 'vendor_create', name: 'A' })).toBe('vendorDefinition');
    expect(impactOf({ kind: 'vendor_delete', vendorId: 1, vendorName: 'A' })).toBe('vendorDefinition');
    expect(
      impactOf({
        kind: 'review_decision',
        vendorKey: 'a',
        decision: 'confirmed',
        path: '/subscriptions/review',
      }),
    ).toBe('decision');
  });

  it('登録の一覧を必ず取りに行くのは統合だけ', () => {
    expect(needsVendorList(mergeIntent())).toBe(true);
    expect(needsVendorList(accountChange('add', '通信費'))).toBe(false);
  });
});

describe('vendorUpdateIntent', () => {
  it('詳細の正規化名と関連データの別名・対象科目を控え、一覧が無いときの本文はその控えに当てる', () => {
    const detail = detailOf({ aliases: ['AQUA'], accounts: ['通信費'], reviewedAt: null, reviewDue: false });
    const intent = vendorUpdateIntent(detail, 1, { field: 'accounts', op: 'add', value: '広告費' });
    expect(intent).toEqual({
      kind: 'vendor_update',
      vendorId: 1,
      vendorName: 'Aqua Voice',
      change: { field: 'accounts', op: 'add', value: '広告費' },
      fallback: { aliases: ['AQUA'], accounts: ['通信費'] },
    });
    expect(buildRequest(intent, undefined).body).toEqual({ accounts: ['通信費', '広告費'] });
  });

  it('関連データが無い詳細では、控えを空の別名・全科目にする', () => {
    const intent = vendorUpdateIntent(detailOf(null), 1, { field: 'aliases', op: 'remove', value: 'AQUA' });
    expect(intent.fallback).toEqual({ aliases: [], accounts: [] });
    expect(buildRequest(intent, undefined).body).toEqual({ aliases: [] });
  });
});

describe('buildRequest', () => {
  it('統合は統合先・統合元・取引名だけを送り、名前や行のキーは送らない', () => {
    expect(buildRequest(mergeIntent(), undefined)).toEqual({
      path: '/sub-vendors/merge',
      method: 'POST',
      body: { targetId: 1, sourceVendorIds: [2], rawNames: ['AQUA VOICE INC'] },
    });
  });

  it('取り消しは操作 id を path に符号化して入れる', () => {
    expect(buildRequest({ kind: 'unmerge', operationId: 'op/1 2', targetName: null }, undefined)).toEqual({
      path: '/subscription-operations/op%2F1%202/undo',
      method: 'POST',
      body: {},
    });
  });

  it('対象科目の足し外しは、押した時点ではなく送る直前の一覧に当てる', () => {
    // 1 件目の「事業費」が反映された後の一覧。2 件目の本文は 1 件目を含まなければならない
    const latest = [vendor(1, 'Aqua Voice', { accounts: ['通信費', '事業費'] })];
    expect(buildRequest(accountChange('add', '広告費'), latest).body).toEqual({
      accounts: ['通信費', '事業費', '広告費'],
    });
    expect(buildRequest(accountChange('remove', '通信費'), latest).body).toEqual({ accounts: ['事業費'] });
  });

  it('同じ値は二度足さず、無い値の除去はそのまま', () => {
    const latest = [vendor(1, 'Aqua Voice', { accounts: ['通信費'] })];
    expect(buildRequest(accountChange('add', '通信費'), latest).body).toEqual({ accounts: ['通信費'] });
    expect(buildRequest(accountChange('remove', '広告費'), latest).body).toEqual({ accounts: ['通信費'] });
  });

  it('一覧をまだ読んでいなければ、詳細の関連データに当てる', () => {
    expect(buildRequest(accountChange('add', '広告費'), undefined)).toEqual({
      path: '/sub-vendors/1',
      method: 'PUT',
      body: { accounts: ['通信費', '広告費'] },
    });
  });

  it('別名の除去は最新の別名に当て、名前とカテゴリはその値だけを送る', () => {
    const latest = [vendor(1, 'Aqua Voice', { aliases: ['AQUA', 'AQUA VOICE INC'] })];
    const base = {
      kind: 'vendor_update' as const,
      vendorId: 1,
      vendorName: 'Aqua Voice',
      fallback: { aliases: [], accounts: [] },
    };
    expect(
      buildRequest({ ...base, change: { field: 'aliases', op: 'remove', value: 'AQUA' } }, latest).body,
    ).toEqual({
      aliases: ['AQUA VOICE INC'],
    });
    expect(buildRequest({ ...base, change: { field: 'name', value: 'Aqua' } }, latest).body).toEqual({
      name: 'Aqua',
    });
    expect(buildRequest({ ...base, change: { field: 'category', value: null } }, latest).body).toEqual({
      category: null,
    });
  });

  it('判断の取り消しは DELETE、判断は POST で、期間付きの path をそのまま使う', () => {
    const path = '/subscriptions/review-decisions?from=2026-04&to=2026-09';
    expect(
      buildRequest({ kind: 'review_decision', vendorKey: 'a', decision: null, path }, undefined),
    ).toEqual({
      path,
      method: 'DELETE',
      body: { vendorKey: 'a' },
    });
    expect(
      buildRequest({ kind: 'review_decision', vendorKey: 'a', decision: 'confirmed', path }, undefined),
    ).toEqual({ path, method: 'POST', body: { vendorKey: 'a', decision: 'confirmed' } });
  });

  it('除外は id が無ければ追加、あれば取り消し', () => {
    expect(buildRequest({ kind: 'exclusion', partner: 'X 社' }, undefined)).toEqual({
      path: '/sub-vendors/exclusions',
      method: 'POST',
      body: { partner: 'X 社' },
    });
    expect(buildRequest({ kind: 'exclusion', partner: 'X 社', exclusionId: 7 }, undefined)).toEqual({
      path: '/sub-vendors/exclusions/7',
      method: 'DELETE',
      body: {},
    });
  });
});

describe('checkPrecondition', () => {
  it('統合先と統合元がどれも生きていれば送る', () => {
    expect(
      checkPrecondition(mergeIntent(), [vendor(1, 'Aqua Voice'), vendor(2, 'Aqua Voice Pro')], []),
    ).toEqual({
      ok: true,
    });
  });

  it('統合元が他へ統合済みか消えていたら、選んだ時点の名前を挙げて送らない', () => {
    const vendors = [vendor(1, 'Aqua Voice'), vendor(2, 'Aqua Voice Pro', { mergedIntoId: 9 })];
    expect(checkPrecondition(mergeIntent(), vendors, [])).toEqual({ ok: false, stale: ['Aqua Voice Pro'] });
    expect(checkPrecondition(mergeIntent(), [vendor(2, 'Aqua Voice Pro')], [])).toEqual({
      ok: false,
      stale: ['Aqua Voice'],
    });
  });

  it('名前を控えていない id は統合先なら統合先の名前、それ以外は id で挙げる', () => {
    const intent = mergeIntent({ names: {}, sourceVendorIds: [3] });
    expect(checkPrecondition(intent, [], [])).toEqual({ ok: false, stale: ['Aqua Voice', '3'] });
  });

  it('一覧が無ければ統合でも検査せず API に任せる', () => {
    expect(checkPrecondition(mergeIntent(), undefined, undefined)).toEqual({ ok: true });
  });

  it('取り消せない統合は API と同じ理由のコードで止め、記録に無いものは API に任せる', () => {
    const unmerge: WriteIntent = { kind: 'unmerge', operationId: 'op-1', targetName: 'Aqua Voice' };
    expect(checkPrecondition(unmerge, undefined, [record()])).toEqual({ ok: true });
    expect(
      checkPrecondition(unmerge, undefined, [record({ undoable: false, undoBlockedReason: 'undo_expired' })]),
    ).toEqual({ ok: false, blocked: 'undo_expired' });
    expect(checkPrecondition(unmerge, undefined, [record({ id: 'op-2' })])).toEqual({ ok: true });
    expect(checkPrecondition(unmerge, undefined, undefined)).toEqual({ ok: true });
  });

  it('登録の変更は、一覧を読んでいれば統合済み・削除済みの登録へ送らない', () => {
    const intent = accountChange('add', '広告費');
    expect(checkPrecondition(intent, undefined, undefined)).toEqual({ ok: true });
    expect(checkPrecondition(intent, [vendor(1, 'Aqua Voice')], undefined)).toEqual({ ok: true });
    expect(checkPrecondition(intent, [vendor(1, 'Aqua Voice', { mergedIntoId: 4 })], undefined)).toEqual({
      ok: false,
      stale: ['Aqua Voice'],
    });
    expect(
      checkPrecondition({ kind: 'review', vendorId: 1, vendorName: 'Aqua Voice' }, [], undefined),
    ).toEqual({
      ok: false,
      stale: ['Aqua Voice'],
    });
  });

  it('登録・判断・除外は前提を検査しない', () => {
    expect(checkPrecondition({ kind: 'vendor_create', name: 'A' }, [], [])).toEqual({ ok: true });
    expect(checkPrecondition({ kind: 'exclusion', partner: 'X' }, [], [])).toEqual({ ok: true });
  });
});

/**
 * その他の管理の節 (spec-settings-screen §7.11)。
 *
 * 集計ルール・名義・統計・現金上書きの 4 種に入らない既存の管理を、旧画面からそのまま移して並べる。
 * 仕分けルール・取引先の決め事・未記帳月・旧HTML版からの初期移行 (取引まで入れ替わる別経路)。
 * いずれも保存バーとは別に、その場で確定する。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { type LegacyRestoreResponse, type SettingsResponse, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { ClassificationSettings } from '../../components/ClassificationSettings.js';
import { ConfirmDialog, usePendingConfirm } from '../../components/ConfirmDialog.js';
import { Term } from '../../components/Term.js';
import { VendorMemorySettings } from '../../components/VendorMemory.js';
import { readFileText } from '../../file-text.js';
import { LEGACY_RESTORE_CONFIRMATION, LegacyRestoreNotice } from './legacy-restore.js';

const MONTH = /^\d{4}-\d{2}$/;

export function OtherAdminSection() {
  return (
    <section
      className="settings-section settings-group"
      id="other-admin"
      aria-labelledby="other-admin-heading"
    >
      <h2 id="other-admin-heading" className="settings-group-heading">
        その他の管理
      </h2>
      <ClassificationSettings />
      {/* 自動で当たっているものは仕分けの設定の隣に置く。明細から辿ってこられる先でもある */}
      <div id="vendor-memory">
        <VendorMemorySettings />
      </div>
      <UnrecordedMonths />
      <LegacyImport />
    </section>
  );
}

/** 未記帳月 (経費統計から除外する月)。旧 PUT /api/settings の 1 項目だけを送る */
function UnrecordedMonths() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api<SettingsResponse>('/settings') });
  const [text, setText] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (months: string[]) =>
      api('/settings', { method: 'PUT', body: JSON.stringify({ unrecordedExpMonths: months }) }),
    onSuccess: () => {
      setText(null);
      void qc.invalidateQueries();
    },
  });
  const value = text ?? q.data?.unrecordedExpMonths.join(', ') ?? '';
  return (
    <section className="card" aria-labelledby="unrecorded-months-heading">
      <h3 id="unrecorded-months-heading">
        <Term id="unrecordedMonth" />
        (経費統計から除外する月)
      </h3>
      <div className="toolbar">
        <input
          type="text"
          className="settings-unrecorded-input"
          aria-label="未記帳月"
          placeholder="YYYY-MM をカンマ区切り(例: 2026-07)"
          value={value}
          disabled={!q.data}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          variant="primary"
          disabled={text === null || save.isPending}
          onClick={() =>
            save.mutate(
              value
                .split(',')
                .map((v) => v.trim())
                .filter((v) => MONTH.test(v)),
            )
          }
        >
          保存
        </Button>
      </div>
      {q.isError && <p className="sub">未記帳月を読み込めませんでした。</p>}
    </section>
  );
}

/** 旧HTML版の全データJSONからの初期移行 (POST /api/restore)。設定だけの復元とは別の経路 */
function LegacyImport() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const restore = useMutation({
    mutationFn: async (file: File) => {
      const text = await readFileText(file);
      return api<LegacyRestoreResponse>('/restore', { method: 'POST', body: text });
    },
    onSuccess: () => void qc.invalidateQueries(),
  });
  // 確認の間もファイルを持っておく。input の value はここで捨てるので、確認後に読む先が要る
  const confirm = usePendingConfirm<File>({ busy: restore.isPending });
  return (
    <section className="card" aria-labelledby="legacy-import-heading">
      <h3 id="legacy-import-heading">全データの書き出し / 初期移行</h3>
      <p className="sub">
        取引を含む全データの書き出しと、旧HTML版からの初期移行用です。設定だけの書き出し・復元は「データ」の節を使ってください。
      </p>
      <div className="toolbar">
        <a className="btn" href="/api/export/json" download data-settings-internal>
          全データのJSON（取引を含む）
        </a>
        <Button onClick={() => input.current?.click()} disabled={restore.isPending}>
          {restore.isPending ? '移行中…' : 'HTML版JSONから復元(初期移行)'}
        </Button>
        <input
          ref={input}
          type="file"
          aria-label="初期移行用JSONを選ぶ"
          accept=".json"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) confirm.ask(f);
            // 同じファイルを選び直しても change が起きるように、値はここで捨てる
            e.target.value = '';
          }}
        />
      </div>
      {confirm.target && (
        <ConfirmDialog
          dialog={confirm.dialog}
          title="集計・分類・設定データを初期移行しますか？"
          confirmLabel="上書きして移行する"
          busyLabel="移行中…"
          onConfirm={() => restore.mutate(confirm.target as File, { onSuccess: confirm.dismiss })}
          onDismiss={confirm.dismiss}
        >
          <p>{LEGACY_RESTORE_CONFIRMATION}</p>
          <p className="sub">読み込むファイル: {confirm.target.name}</p>
        </ConfirmDialog>
      )}
      {restore.isSuccess && <LegacyRestoreNotice result={restore.data} />}
      {restore.isError && (
        <div className="notice">
          初期移行に失敗しました。データは反映されていません: {(restore.error as Error).message}
        </div>
      )}
    </section>
  );
}

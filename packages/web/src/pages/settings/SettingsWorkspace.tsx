import type { ReactNode } from 'react';

/**
 * 設定画面の空間構造だけを持つ骨格。
 *
 * 共通アプリシェルの内側で、節ナビ・設定本文・選択中ルールの説明を同じ
 * ワークスペースとして並べる。各節の取得状態や編集ロジックは持たない。
 */
export function SettingsWorkspace({
  navigation,
  primary,
  inspector,
  children,
}: {
  navigation: ReactNode;
  /** 集計ルール、またはその読み込み状態。狭幅では説明の直前に置く。 */
  primary: ReactNode;
  inspector: ReactNode;
  /** 名義以降の設定。狭幅では説明の後、広幅では中央列の続きに置く。 */
  children: ReactNode;
}) {
  return (
    <div className="settings-workspace">
      {navigation}
      <section className="settings-content" aria-label="設定内容">
        {primary}
      </section>
      {inspector && <div className="settings-inspector">{inspector}</div>}
      <div className="settings-rest">{children}</div>
    </div>
  );
}

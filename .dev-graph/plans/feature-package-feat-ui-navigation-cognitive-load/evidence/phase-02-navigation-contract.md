# P02 共通ナビゲーション契約

- Task: `SYS-UINAV-P02` / Beads `kanjo-ay0.2`
- Dependency: P01 PASS

## 採用する1案

17 routeの業務順・可視ラベル・既存ブランドを保ち、共通metadataから「公式Lucideの単色stroke icon + label」をdesktop sidebar、mobile drawer、bottom tabへ同じ規則で描画する。現在地は全route完全一致とし、選択中は`aria-current="page"`、太字、境界、左indicatorを併用する。

### 決め手

- 目的適合: 長い日本語一覧で、アイコンを視覚アンカー、文字を確実な識別子として併用できる。
- 安全・一貫性: route path/label/lazy loadingを変えず、`APP_ROUTES → Layout → RouteIcon`の1系統へ閉じる。
- 可逆性: metadata/component/CSSだけで戻せ、API・保存データ・認証へ波及しない。

### 却下

- labelを消すicon rail: 17項目では想起を強制し、可視label要件に反する。
- emoji/頭文字/独自glyph: 字体差・意味の曖昧さ・AIテンプレート感を生む。
- icon runtime依存の追加: bundleと依存面を増やすため、Lucideの公開geometryを型付きinline registryとして固定する。
- 全詳細のmodal化: 通常遷移と文脈を遮り、既存の安全なinline editorを劣化させる。

## route契約

1. `APP_ROUTES`は17件、id/path/iconはそれぞれ一意。
2. `icon`は必須の`RouteIconName`。iconだけで意味を伝えず、labelを常にDOMへ残す。
3. `NavLink`は全routeで`end`を有効にし、現在地は最大1件。
4. currentだけにRouter標準の`aria-current="page"`が付く。
5. 装飾SVGは`aria-hidden="true"`、`focusable="false"`。リンク名は可視labelから得る。
6. desktop、drawer、bottom tabで同じmetadataとicon componentを使う。

## 表示契約

- icon: 20px、`currentColor`、stroke幅2、塗りなし。
- desktop/drawer row: 44px以上、icon-label gapはtoken、短いlabelは折り返さない。
- group: 業務順（見る→整える→申告→運用）を維持し、境界は細線と余白で示す。
- current: surface + strong border + 700〜800 weight + 3px indicator。色だけに依存しない。
- hover: 操作可能なリンクだけsurface変化。focus-visibleは即時2px outline。
- bottom tab: 44px以上、icon+短いlabel。currentは上border、太字、`aria-current`。
- drawer: Escape、route change、backdropで閉じ、開閉の短い移動はreduced-motionで停止。

## 情報と編集面の適用範囲

- 全17ページ: 既存`PageHeader`を目的の正本として保持。PageState、KPI、主操作を先に、長い根拠は既存`details`等のinline disclosureへ置く。
- 長い一覧/入力: 現在地は共通sticky header、保存・取消は対象のeditor内で維持。全画面固定footerへの複製は行わない（同じ操作を二重化するため）。
- 公私仕分け: 既存inline editorを適用。対象、変更内容、保存、閉じる、未保存確認、処理中、失敗を既に満たす。
- 税務/予算/現金/設定: 対象近傍の既存編集を維持。短い編集を新たなmodalで遮らない。
- 読み取り専用ページ: editing surfaceは非適用。適用しないこと自体を一貫させる。

## 判定

- P02 acceptance: PASS
- 高重大度の未解決: 0


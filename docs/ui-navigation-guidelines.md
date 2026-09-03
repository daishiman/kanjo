# UIナビゲーション運用ガイド

route、表示順、label、icon keyは`APP_ROUTES`、公式Lucide geometryとicon型は`RouteIcon`、寸法は`styles.css`のtokenを正本とする。`Layout`はそれらをdesktop/mobileへ描画する。ページ固有のsidebarを増やさず、画面を追加するときは次の契約を同時に満たす。

## Routeを追加・変更するとき

1. `routeMetadata.ts`へ一意の`id`、完全な`path`、短い`label`、目的を1文で示す`task`、意味の異なる`icon`を追加する。
2. 可視labelは必ず残す。アイコンだけ、頭文字、絵文字で画面を表さない。
3. current pageは完全一致を基本とし、同時に`aria-current="page"`になるリンクを1件以下に保つ。親sectionと子pageを両方currentにしない。
4. desktop sidebarとmobile navigationは同じmetadataを使う。mobileは`mobileLabel`を持つ5 routeと、全15 routeを開くメニューで構成する。
5. `navigation-ux.dom.test.tsx`で全15 routeのcurrent一意、icon、可視label、ARIAを固定する。実寸、折返し、overflow、focusは実ブラウザで確認する。
6. `taskDetail`(段階表示の説明文)を必ず書く。`route-task-detail.test.tsx`が用語リンクゼロの単位を許さない。
7. 画面検索(`Cmd+K`)は`SEARCH_ROUTES`を通じて`APP_ROUTES`と`ANALYSIS_TABS`をそのまま引く。検索側に画面一覧を書き足さない(二重管理を作らない)。

## 画面を束ねるとき

出口が同じ(利用者が下す判断が1つ)画面は、独立routeでなくタブへ束ねてよい。ただし次を満たすこと。

- 集計単位が同じで、書き込み操作を持たないこと。サブスク分析を統合しなかったのはこの2条件を満たさないため。
- タブ状態を**URLに持つ**(`/analysis/:tab`)。リンクで組み、`role="tab"`は手組みしない。ボタンで持つとリロードで先頭タブへ戻り、戻る/進むが切り口の移動を追えない。
- 表示中のタブだけを描画し、APIも1本だけ呼ぶ。
- 旧URLは削除せず`LEGACY_ROUTE_REDIRECTS`でタブへ`replace`リダイレクトする。
- 束ねられた側の`taskDetail`を捨てず、タブごとの説明として移す。

## 見た目と読みやすさ

- 行高は`--nav-row-min`で決める。既定は44px、`min-width: 641px`で36pxへ下げ、そのうち`pointer: coarse`だけ44pxへ戻す。`and (pointer: fine)`と書かない理由は、pointerには`none`(ポインタデバイスなし)もあり、`fine`条件だと`none`の環境が緩和から漏れるため。実際CIのLinux headless Chromeは`none`を返して総高が上限超過で落ちた。44pxはWCAG 2.5.5(AAA)の値で、この達成基準はポインタ環境に掛からない。掛かるのはSC 2.5.8(AA)の24pxで、36pxはこれを上回る。タップ環境と640px以下のドロワーは44pxのまま。
- desktop iconは20px、mobile tab iconは18px。アイコンと文字の間隔、group間隔、sidebar幅は`styles.css`の共通tokenで決める。
- currentは色だけで伝えず、`aria-current`と色以外の手掛かりを併用する。ただし**手掛かりを重ねるほど良いわけではない**。背景と識別できない強調(白地に対し1.11:1で、hoverの1.10:1と見分けられない塗りなど)は現在地を伝えず、hoverと混同させる。現行は「文字色+左帯(6.46:1)」の2重で、増やすときは実測してから足す。
- アイコンは単色stroke、装飾扱いの`aria-hidden="true"`とし、リンク名は隣の文字が担う。
- 初期表示は「ページの目的→重要な状態→主操作」の順にする。長い説明や根拠は文脈内の`details`など、要求時にだけ開く。
- 通常のページ移動にmodalを挟まない。狭幅のdrawerはEscape、背景、リンク選択で閉じられる状態にする。

## 編集面の安全性

編集UIは新しい共通modalへ一律置換しない。既存のinline editor、side panel、dialogのうち、作業文脈を保てるものを使い、次を確認する。

- タイトルに編集対象が出ている。
- 変更する項目がfieldsetやlabelで分かる。
- 保存と取消（または閉じる）が近くにある。
- 未保存状態、保存中、保存完了、失敗が分かる。
- 未保存のまま行・filter・pageを移ると確認が出る。
- 削除、復元、書き出しなど影響の大きい操作は対象と結果を明示する。

これらを既に満たす画面は構造を変えない。説明やoverlayを増やすより、現在の文脈と可逆性を維持する。

## リリース前チェック

- `/tax`と`/tax/receipts`でcurrentがそれぞれ1件。
- 15 routeと支出分析の4タブすべてに可視labelとiconがある。アイコンは図形の署名で一意(キー一致では見た目の重複を見逃す)。
- `Cmd+K` / `Ctrl+K`で画面検索が開き、19単位すべてを名前と群名で引ける。Escape・背景クリックで閉じ、矢印キーで候補を移動できる。
- 旧URL `/matrix` `/trends` `/diagnosis` が対応するタブへリダイレクトされる。
- 375 / 768 / 1280 / 1600px、200%相当、keyboard、`prefers-reduced-motion`で操作できる。
- DOM testのPASSは構造契約、実ブラウザ4幅のPASSは視覚・操作契約として分け、片方で代替しない。
- `pnpm --filter @kanjo/web test`、`typecheck`、`build`がPASSする。
- 実データ、`.dev.vars`、secretを証跡へ含めない。

## 検証記録の置き場所

その回のtest件数やPASS数はこのガイドに書かない(testを1本足した瞬間に古くなる)。実行結果は`.dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/`(`phase-06-test-run.json`、`phase-13-pr-readiness.md`)を参照する。

DOM testは構造契約の証跡、実Chrome(CDP)の実描画計測は視覚・操作契約の証跡として分ける。計測は`getBoundingClientRect` / `getComputedStyle`で数値を取るため、スクリーンショットの目視より再現性が高い。CSSの正規表現照合は描画を一切見ていないので使わない(全廃済み)。

ただし計測では次の2点を**カバーできない**。ここは人の目が要る。

- 意匠の妥当性(配色や余白が「美しいか」)。
- Chrome以外のブラウザでの描画差。

## 判断の履歴

ナビゲーションの構成(モバイルタブの本数と選定、アイコンの可否)を変えるときは、`docs/ui-decisions.md`の「決定の更新」へ理由とともに追記する。このガイドは現行の契約だけを書き、なぜそう決めたかはそちらが持つ。

/**
 * ナビの1項目(icon + 可視label)。サイドバーと下部タブバーが同じ構造を共有する。
 *
 * 現在地の表現は aria-current="page" ただ1つに寄せる。NavLink は className を「文字列」で
 * 渡すと既定の .active も足すため、同じ状態が2つの機構で表される。下部タブでは .active が
 * 「ドロワーが開いている」というまったく別の状態にも使われていて、意味が衝突していた。
 * className を「関数」で渡すと react-router は既定クラスを足さないので、
 *   aria-current="page" = 現在のルート / .active = ドロワーが開いている
 * と1つの状態に1つの機構が対応する。
 */
import { NavLink } from 'react-router-dom';
import { RouteIcon, type RouteIconName } from './RouteIcon.js';

export type NavItemVariant = 'sidebar' | 'tab';

/**
 * サイドバーと下部タブでclassの付き方が違うのは、styles.css と
 * scripts/check-mobile-layout.mjs のフィクスチャが今のclass名で寸法を測っているため。
 * 揃えるにはCSSと実描画検査を同時に動かす必要があるので、ここでは差異を消す代わりに
 * 「差異はこの表がすべて」という状態にしておく(2箇所のJSXに散っている状態が問題だった)。
 */
const VARIANT: Record<NavItemVariant, { linkClass?: string; labelClass?: string }> = {
  // .nav a で選ばれるのでリンク自身にclassは要らない。labelは .nav-label
  sidebar: { linkClass: undefined, labelClass: 'nav-label' },
  // .tabbar .tab で選ばれる。labelは裸のspan(タブ用のlabel規則がCSSにない)
  tab: { linkClass: 'tab', labelClass: undefined },
};

export interface NavItemProps {
  to: string;
  icon: RouteIconName;
  /**
   * 表示するラベル。サイドバーは route.label、タブは route.mobileLabel を使う。
   * route を丸ごと受けて内部で選ぶこともできるが、mobileLabel は string | null なので
   * 「null のルートがタブに出ない」ことを NavItem が保証できず、型が緩む。
   */
  label: string;
  variant: NavItemVariant;
  /**
   * 子パスにいるときも現在地とみなすか。既定は完全一致(end)。
   * タブをURLに持つ画面(/analysis/matrix)だけ false にする。
   */
  end?: boolean;
}

export function NavItem({ to, icon, label, variant, end = true }: NavItemProps) {
  const { linkClass, labelClass } = VARIANT[variant];
  return (
    <NavLink to={to} end={end} className={() => linkClass}>
      <RouteIcon name={icon} />
      <span className={labelClass}>{label}</span>
    </NavLink>
  );
}

/**
 * 表示媒体固有の CSS adapter。core は値と不変条件だけを持ち、
 * CSS 変数名・:root・media query の知識はここに閉じる。
 */

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const px = (value) => `${value}px`;

/** biome.json の formatter.lineWidth。生成後の整形で差分が揺れない値に固定する。 */
const LINE_WIDTH = 110;

function declaration(indent, name, value) {
  const line = `${indent}${name}: ${value};`;
  if (line.length <= LINE_WIDTH) return line;
  const parts = value.split(', ');
  const lines = [];
  let current = `${indent}${name}:`;
  for (const [index, part] of parts.entries()) {
    const piece = `${part}${index === parts.length - 1 ? ';' : ','}`;
    if (`${current} ${piece}`.length > LINE_WIDTH) {
      lines.push(current);
      current = `${indent}  ${piece}`;
    } else {
      current = `${current} ${piece}`;
    }
  }
  return [...lines, current].join('\n');
}

const block = (declarations, indent) =>
  declarations.map(([name, value]) => declaration(indent, name, value)).join('\n');

function rootDeclarations(tokens) {
  const { COLOR, EFFECT_COLOR, MOTION, RADIUS, SHADOW, SIZE, SPACE, TYPOGRAPHY } = tokens;
  return [
    ...Object.entries(COLOR).map(([name, value]) => [`--${kebab(name)}`, value]),
    ...Object.entries(EFFECT_COLOR).map(([name, value]) => [`--${kebab(name)}`, value]),
    ['--radius', px(RADIUS.base)],
    ['--font-head', TYPOGRAPHY.fontHead],
    ['--font-mono', TYPOGRAPHY.fontMono],
    ['--line-height-body', String(TYPOGRAPHY.lineHeight)],
    ...Object.entries(TYPOGRAPHY.scale).map(([step, value]) => [`--fs-${step}`, px(value)]),
    ['--motion-instant', `${MOTION.instant}ms`],
    ['--motion-fast', `${MOTION.fast}ms`],
    ['--motion-base', `${MOTION.base}ms`],
    ['--motion-chart', `${MOTION.chart}ms`],
    ['--ease-standard', MOTION.easeStandard],
    ['--shadow-popover', SHADOW.popover],
    ['--shadow-overlay', SHADOW.overlay],
    ['--shadow-category-panel', SHADOW.categoryPanel],
    ['--shadow-drawer', SHADOW.drawer],
    ['--shadow-compact-popover', SHADOW.compactPopover],
    ['--shadow-floating-action', SHADOW.floatingAction],
    ['--shadow-floating-action-compact', SHADOW.floatingActionCompact],
    ['--scrim', SHADOW.scrim],
    ['--header-h', px(SIZE.headerHeight)],
    ['--tabbar-h', px(SIZE.tabbarHeight)],
    ['--sidebar-w', px(SIZE.sidebarWidth)],
    ['--drawer-w', px(SIZE.drawerWidth)],
    ['--content-max-w', px(SIZE.contentReadingMaxWidth)],
    ['--content-data-max-w', px(SIZE.contentDataMaxWidth)],
    ['--aside-panel-w', px(SIZE.asidePanelWidth)],
    ['--icon-rail-w', px(SIZE.iconRailWidth)],
    ['--page-gutter', px(SPACE.pageGutter)],
    ['--page-gutter-compact', px(SPACE.compactPageGutter)],
    ['--financial-chart-height', px(SIZE.financialChartHeight)],
    ['--tap-target-min', px(SIZE.tapTargetMin)],
    ['--nav-icon-size', px(SIZE.navIconSize)],
    ['--tab-icon-size', px(SIZE.tabIconSize)],
    ['--nav-icon-label-gap', px(SPACE.navIconLabelGap)],
    ['--nav-group-gap', px(SPACE.navGroupGap)],
  ];
}

/** styles.css の :root に置く写し。 */
export function renderRootCss(tokens) {
  return `:root {\n${block(rootDeclarations(tokens), '  ')}\n}`;
}

/** prefers-contrast: more の CSS 媒体固有上書き。 */
export function renderHighContrastCss(tokens) {
  const { HIGH_CONTRAST_COLOR } = tokens;
  const declarations = [
    ['--line', HIGH_CONTRAST_COLOR.line],
    ['--ink-soft', 'var(--ink)'],
    ['--control-border', 'var(--ink)'],
    ['--control-border-hover', 'var(--ink)'],
    ['--biz-soft', HIGH_CONTRAST_COLOR.bizSoft],
    ['--biz-soft-line', 'var(--biz)'],
    ['--biz-strong', HIGH_CONTRAST_COLOR.bizStrong],
  ];
  return `@media (prefers-contrast: more) {\n  :root {\n${block(declarations, '    ')}\n  }\n}`;
}

/**
 * 認証前の画面だけが使うアイコン。
 *
 * Lucide stroke icon の geometry を必要な分だけ写したもの (lucide-static v1.37.0 / ISC)。
 * UiIcon に名前を足すと業務画面の初期チャンクまで太るので、ここに閉じる。
 * どのアイコンも装飾であり、必ずテキストと併記する (aria-hidden)。
 */
import type { ReactNode } from 'react';

export const Icon = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const ICONS = {
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  shield: (
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  ),
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
} as const;

/** 棒グラフ4本のロゴマーク (§7.1 の 1)。濃淡は CSS のトークンが決める */
export const LogoMark = () => (
  <svg
    className="login-logo-mark"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    aria-hidden="true"
    focusable="false"
  >
    <rect className="bar-1" x="3" y="15" width="4.5" height="10" rx="1" />
    <rect className="bar-2" x="9.5" y="10" width="4.5" height="15" rx="1" />
    <rect className="bar-3" x="16" y="6" width="4.5" height="19" rx="1" />
    <rect className="bar-4" x="22.5" y="2" width="4.5" height="23" rx="1" />
  </svg>
);

/**
 * Google の G ロゴ。ブランド規定の4色をそのまま使う (UiIcon の単色アイコンで代えない。§7.1)。
 * 色はトークンではなく Google の指定値であり、テーマで変えてはいけない。
 */
export const GoogleG = () => (
  <img className="login-google-mark" src="/google-g.svg" alt="" aria-hidden="true" />
);

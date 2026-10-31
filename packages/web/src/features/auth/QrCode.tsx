/**
 * otpauth URI の QR (§7.10)。符号化は qr.ts が web の中で行い、外部の生成サービスへ秘密鍵を送らない (C7)。
 * MfaPage から遅延読込し、設定の画面を開いた人だけが符号化の JS を読む (Q-7)。
 */
import { useMemo } from 'react';
import { encodeQr, qrPath } from './qr.js';

/** 規格の quiet zone (4 モジュール)。これより狭いと読み取れない端末がある */
const QUIET_ZONE = 4;

export default function QrCode({ value }: { value: string }) {
  const matrix = useMemo(() => encodeQr(value), [value]);
  const extent = matrix.size + QUIET_ZONE * 2;
  return (
    <svg
      className="login-qr"
      role="img"
      aria-label="認証アプリで読み取るQRコード"
      viewBox={`0 0 ${extent} ${extent}`}
      shapeRendering="crispEdges"
    >
      <rect className="login-qr-quiet" width={extent} height={extent} />
      <path className="login-qr-modules" d={qrPath(matrix, QUIET_ZONE)} />
    </svg>
  );
}

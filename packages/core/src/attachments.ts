/**
 * レシート・領収書の添付(spec: specs/attachments-and-transit.md)。
 * ここは純関数だけを置き、R2/D1 への書き込みは packages/api 側が持つ。
 *
 * 添付先は現金と MF 取込明細を判別 union で持つ。
 * API の wire 形式は後方互換のため、現金 = 'cash:<id>' / MF = MF の ID 列を維持する。
 */
import { CASH_TX_PREFIX } from './cash.js';

export type AttachmentTarget = { kind: 'cash'; id: number } | { kind: 'mf'; txId: string };

export type AttachmentTargetKind = AttachmentTarget['kind'];
export type AttachmentState = 'ready' | 'delete_pending' | 'delete_failed';
export type AttachmentCleanupStage =
  | 'none'
  | 'object_delete_pending'
  | 'object_delete_failed'
  | 'original_missing'
  | 'metadata_delete_pending'
  | 'dead_letter';

export interface AttachmentTargetColumns {
  targetKind: AttachmentTargetKind;
  targetKey: string;
}

const targetKeyValid = (value: string): boolean =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 外部入力の制御文字を境界で拒否する
  value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);

/**
 * MF 明細 ID を型付き添付先へする。cash: は現金専用の予約名前空間なので拒否する。
 * 取込境界と添付 API がこの同じ判定を使うことで、MF ID `cash:1` の衝突を防ぐ。
 */
export function parseMfAttachmentTarget(txId: string): AttachmentTarget | null {
  if (!targetKeyValid(txId) || txId.startsWith(CASH_TX_PREFIX)) return null;
  return { kind: 'mf', txId };
}

/** API の wire 形式を型付き添付先へ変換する */
export function parseAttachmentTarget(value: string): AttachmentTarget | null {
  if (!targetKeyValid(value)) return null;
  if (!value.startsWith(CASH_TX_PREFIX)) return parseMfAttachmentTarget(value);

  const rawId = value.slice(CASH_TX_PREFIX.length);
  // 同じ現金IDに複数表現を作らない(cash:01 / cash:+1 は拒否)
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? { kind: 'cash', id } : null;
}

/** 型付き添付先を後方互換の wire 形式へ変換する */
export function serializeAttachmentTarget(target: AttachmentTarget): string {
  return target.kind === 'cash' ? `${CASH_TX_PREFIX}${target.id}` : target.txId;
}

/** D1 の target_kind / target_key との変換。分岐を API ルートに散在させない */
export function attachmentTargetColumns(target: AttachmentTarget): AttachmentTargetColumns {
  return {
    targetKind: target.kind,
    targetKey: target.kind === 'cash' ? String(target.id) : target.txId,
  };
}

/** D1 から読み出した値も同じ制約で検証する */
export function attachmentTargetFromColumns(targetKind: string, targetKey: string): AttachmentTarget | null {
  if (targetKind === 'cash') return parseAttachmentTarget(`${CASH_TX_PREFIX}${targetKey}`);
  if (targetKind === 'mf') return parseMfAttachmentTarget(targetKey);
  return null;
}

/** 1ファイルの上限。スマホのカメラ原本(4〜6MB)がそのまま通る大きさにしている */
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
/** 1明細あたりの上限。レシートの裏表+補足で足りる件数 */
export const ATTACHMENT_MAX_PER_TARGET = 10;
/** Cloudflare free枠で複数利用者が共存しても単独利用者がbucketを占有しない既定値 */
export const ATTACHMENT_USER_QUOTA_BYTES = 100 * 1024 * 1024;

/** 証憑原本とcleanup用データを同じ保持規則に混ぜない。 */
export const ATTACHMENT_RETENTION_DEFAULTS = {
  ready: 'explicit-delete-only',
  orphanReady: 'explicit-delete-only',
  cleanupGraceDays: 7,
  importUploadDays: 30,
  reconcileBatchSize: 10,
  maxAttempts: 5,
} as const;

/** 許可する形式 → R2 キーに使う拡張子。ここに無い形式は保存しない */
export const ATTACHMENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
} as const;

export type AttachmentContentType = keyof typeof ATTACHMENT_TYPES;

/** 拡張子から形式を引く(スマホが application/octet-stream を送ってくる場合の後段) */
const EXT_TO_TYPE: Record<string, AttachmentContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

export interface Attachment {
  id: number;
  target: AttachmentTarget;
  /** 後方互換のwire形式。新規ロジックは target を使う */
  targetId: string;
  filename: string;
  contentType: string;
  /** バイト数 */
  size: number;
  state: AttachmentState;
  deleteAttempts: number;
  /** 削除中断/失敗後に利用者が再実行できるか */
  retryable: boolean;
  /** R2原本が存在し得ることを示す単調fact由来の表示値 */
  originalAvailable: boolean;
  cleanupStage: AttachmentCleanupStage;
  /** MF洗替えで親が一時的に消えても証憑を到達可能に保つ */
  orphaned: boolean;
  createdAt: string;
}

const isAttachmentContentType = (v: string): v is AttachmentContentType => v in ATTACHMENT_TYPES;

/**
 * ブラウザが申告した MIME を正規化する。
 * 申告が空・generic(application/octet-stream)なときだけ拡張子で補う。
 * iOS の写真は HEIC を octet-stream で送ってくることがあるため、この後段が要る。
 */
export function resolveAttachmentType(contentType: string, filename: string): AttachmentContentType | null {
  const declared = contentType.split(';', 1)[0].trim().toLowerCase();
  if (isAttachmentContentType(declared)) return declared;
  if (declared && declared !== 'application/octet-stream') return null;
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return EXT_TO_TYPE[ext] ?? null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

/**
 * 利用者申告ではなく先頭magicから実形式を判別する。
 * HEIC/HEIFはISO BMFFのmajor brandを確認し、単なるftypだけでは受理しない。
 */
export function attachmentContentTypeFromSignature(bytes: Uint8Array): AttachmentContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image/webp';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (!startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) || bytes.length < 12) return null;
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') return 'image/heic';
  if (brand === 'heif' || brand === 'mif1' || brand === 'msf1') return 'image/heif';
  return null;
}

export interface AttachmentQuotaUsage {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  accepted: boolean;
}

/** writer lease内のauthoritative usageから、追加可能性と画面表示を同時に導出する。 */
export function attachmentQuotaUsage(
  usedBytes: number,
  additionalBytes = 0,
  limitBytes = ATTACHMENT_USER_QUOTA_BYTES,
): AttachmentQuotaUsage {
  const used = Math.max(0, Math.trunc(usedBytes));
  const limit = Math.max(0, Math.trunc(limitBytes));
  const additional = Math.max(0, Math.trunc(additionalBytes));
  return {
    usedBytes: used,
    limitBytes: limit,
    remainingBytes: Math.max(0, limit - used),
    accepted: used + additional <= limit,
  };
}

/**
 * 表示用のファイル名を無害化する。
 * パス区切り・制御文字を落とし、長さを詰める。R2 のキーには使わない(キーは UUID)ため、
 * ここでの目的は画面表示とダウンロード名の安全性だけ。
 */
export function sanitizeAttachmentFilename(raw: string): string {
  const cleaned = raw
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字の除去が目的
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (!cleaned) return 'receipt';
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

/**
 * R2 のキー。利用者入力を一切含めない(パス区切りの混入を構造的に排除する)。
 * 月で切るのは、保持期間の運用を既存の backups/ と同じ粒度で扱えるようにするため。
 */
export function attachmentR2Key(
  userId: string,
  month: string,
  uuid: string,
  type: AttachmentContentType,
): string {
  return `attachments/${userId}/${month}/${uuid}.${ATTACHMENT_TYPES[type]}`;
}

export interface AttachmentReject {
  code: 'unsupported_type' | 'too_large' | 'empty_file' | 'too_many';
  message: string;
}

/** 受け入れ可否。拒否理由は画面にそのまま出す日本語で返す */
export function attachmentRejectReason(input: {
  contentType: string;
  filename: string;
  size: number;
  existingCount: number;
}): AttachmentReject | null {
  if (input.existingCount >= ATTACHMENT_MAX_PER_TARGET)
    return {
      code: 'too_many',
      message: `1件の明細に添付できるのは${ATTACHMENT_MAX_PER_TARGET}件までです。不要な添付を削除してください`,
    };
  if (input.size <= 0) return { code: 'empty_file', message: '中身が空のファイルは添付できません' };
  if (input.size > ATTACHMENT_MAX_BYTES)
    return {
      code: 'too_large',
      message: `ファイルが大きすぎます(上限 ${ATTACHMENT_MAX_BYTES / 1024 / 1024}MB)。撮り直すか縮小してください`,
    };
  if (!resolveAttachmentType(input.contentType, input.filename))
    return {
      code: 'unsupported_type',
      message: '写真(JPEG/PNG/WebP/HEIC)か PDF を添付してください',
    };
  return null;
}

/** 画面に出すファイルサイズ */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

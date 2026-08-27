/**
 * 証憑の添付と交通費の純ロジック契約(spec: specs/attachments-and-transit.md)。
 * 画面と API が同じ判断をするため、境界の振る舞いをここで固定する。
 */
import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_TARGET,
  ATTACHMENT_RETENTION_DEFAULTS,
  ATTACHMENT_USER_QUOTA_BYTES,
  RECEIPT_WARN_THRESHOLD,
  attachmentContentTypeFromSignature,
  attachmentQuotaUsage,
  attachmentR2Key,
  attachmentRejectReason,
  attachmentTargetColumns,
  attachmentTargetFromColumns,
  buildTransitEntry,
  formatAttachmentSize,
  missingReceiptSeverity,
  parseAttachmentTarget,
  parseMfAttachmentTarget,
  receiptStatus,
  resolveAttachmentType,
  sanitizeAttachmentFilename,
  serializeAttachmentTarget,
  transitInputError,
} from '../src/index.js';

const jpeg = { contentType: 'image/jpeg', filename: 'receipt.jpg', size: 1024, existingCount: 0 };

describe('AttachmentTarget', () => {
  it('wire文字列を現金/MFの判別unionに変換し、往復できる', () => {
    const cash = parseAttachmentTarget('cash:42');
    const mf = parseAttachmentTarget('mf-synthetic-42');

    expect(cash).toEqual({ kind: 'cash', id: 42 });
    expect(mf).toEqual({ kind: 'mf', txId: 'mf-synthetic-42' });
    expect(cash && serializeAttachmentTarget(cash)).toBe('cash:42');
    expect(mf && serializeAttachmentTarget(mf)).toBe('mf-synthetic-42');
  });

  it('DB列への変換と復元を一箇所で行う', () => {
    expect(attachmentTargetColumns({ kind: 'cash', id: 42 })).toEqual({
      targetKind: 'cash',
      targetKey: '42',
    });
    expect(attachmentTargetColumns({ kind: 'mf', txId: 'mf-synthetic-42' })).toEqual({
      targetKind: 'mf',
      targetKey: 'mf-synthetic-42',
    });
    expect(attachmentTargetFromColumns('cash', '42')).toEqual({ kind: 'cash', id: 42 });
    expect(attachmentTargetFromColumns('mf', 'mf-synthetic-42')).toEqual({
      kind: 'mf',
      txId: 'mf-synthetic-42',
    });
  });

  it('cash:をMF IDに使う衝突と、非正規の現金IDを拒否する', () => {
    expect(parseMfAttachmentTarget('cash:1')).toBeNull();
    expect(parseAttachmentTarget('cash:0')).toBeNull();
    expect(parseAttachmentTarget('cash:01')).toBeNull();
    expect(parseAttachmentTarget('cash:not-a-number')).toBeNull();
    expect(attachmentTargetFromColumns('mf', 'cash:1')).toBeNull();
  });

  it('空・制御文字・過長のIDを境界で拒否する', () => {
    expect(parseAttachmentTarget('')).toBeNull();
    expect(parseAttachmentTarget('mf\n1')).toBeNull();
    expect(parseAttachmentTarget('x'.repeat(201))).toBeNull();
  });
});

describe('resolveAttachmentType', () => {
  it('申告された MIME をそのまま使う', () => {
    expect(resolveAttachmentType('image/png', 'a.png')).toBe('image/png');
    expect(resolveAttachmentType('application/pdf; charset=binary', 'a.pdf')).toBe('application/pdf');
  });

  it('iOS の HEIC のように generic な申告のときだけ拡張子で補う', () => {
    expect(resolveAttachmentType('application/octet-stream', 'IMG_0001.HEIC')).toBe('image/heic');
    expect(resolveAttachmentType('', 'scan.pdf')).toBe('application/pdf');
  });

  it('許可外の申告は拡張子が正しくても受けない(拡張子偽装で通さない)', () => {
    expect(resolveAttachmentType('text/html', 'a.jpg')).toBeNull();
    expect(resolveAttachmentType('application/octet-stream', 'a.exe')).toBeNull();
  });
});

describe('attachmentContentTypeFromSignature', () => {
  it('JPEG/PNG/WebP/PDF/HEIC/HEIFをmagic signatureで判別する', () => {
    expect(attachmentContentTypeFromSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBe('image/jpeg');
    expect(
      attachmentContentTypeFromSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(
      attachmentContentTypeFromSignature(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe('image/webp');
    expect(attachmentContentTypeFromSignature(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(
      attachmentContentTypeFromSignature(
        new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
      ),
    ).toBe('image/heic');
    expect(
      attachmentContentTypeFromSignature(
        new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66]),
      ),
    ).toBe('image/heif');
  });

  it('拡張子や申告MIMEが正しくても署名不明は受け入れない', () => {
    expect(attachmentContentTypeFromSignature(new TextEncoder().encode('<html>'))).toBeNull();
  });
});

describe('attachment quota / retention defaults', () => {
  it('利用量・残量と超過を同じ純関数から導出する', () => {
    expect(attachmentQuotaUsage(ATTACHMENT_USER_QUOTA_BYTES - 2, 2)).toEqual({
      usedBytes: ATTACHMENT_USER_QUOTA_BYTES - 2,
      limitBytes: ATTACHMENT_USER_QUOTA_BYTES,
      remainingBytes: 2,
      accepted: true,
    });
    expect(attachmentQuotaUsage(ATTACHMENT_USER_QUOTA_BYTES - 2, 3).accepted).toBe(false);
  });

  it('証憑原本は明示削除まで保持し、cleanupだけ有限猶予で収束させる', () => {
    expect(ATTACHMENT_RETENTION_DEFAULTS).toEqual({
      ready: 'explicit-delete-only',
      orphanReady: 'explicit-delete-only',
      cleanupGraceDays: 7,
      importUploadDays: 30,
      reconcileBatchSize: 10,
      maxAttempts: 5,
    });
  });
});

describe('attachmentRejectReason', () => {
  it('通常の写真は受け入れる', () => {
    expect(attachmentRejectReason(jpeg)).toBeNull();
  });

  it('上限ちょうどは通し、1バイト超えたら拒否する', () => {
    expect(attachmentRejectReason({ ...jpeg, size: ATTACHMENT_MAX_BYTES })).toBeNull();
    expect(attachmentRejectReason({ ...jpeg, size: ATTACHMENT_MAX_BYTES + 1 })?.code).toBe('too_large');
  });

  it('空ファイルと件数超過をそれぞれの理由で拒否する', () => {
    expect(attachmentRejectReason({ ...jpeg, size: 0 })?.code).toBe('empty_file');
    expect(attachmentRejectReason({ ...jpeg, existingCount: ATTACHMENT_MAX_PER_TARGET })?.code).toBe(
      'too_many',
    );
  });

  it('件数超過は形式や大きさより先に判定する(直せない理由を先に出す)', () => {
    const reject = attachmentRejectReason({
      contentType: 'text/html',
      filename: 'a.html',
      size: 0,
      existingCount: ATTACHMENT_MAX_PER_TARGET,
    });
    expect(reject?.code).toBe('too_many');
  });

  it('許可外の形式を拒否する', () => {
    expect(attachmentRejectReason({ ...jpeg, contentType: 'text/csv', filename: 'a.csv' })?.code).toBe(
      'unsupported_type',
    );
  });
});

describe('sanitizeAttachmentFilename', () => {
  it('パス区切りと先頭ドットを落とす', () => {
    expect(sanitizeAttachmentFilename('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(sanitizeAttachmentFilename('a/b\\c.jpg')).toBe('a_b_c.jpg');
  });

  it('空になる名前は既定名に置き換える', () => {
    expect(sanitizeAttachmentFilename('   ')).toBe('receipt');
    expect(sanitizeAttachmentFilename('...')).toBe('receipt');
  });

  it('長すぎる名前を詰める', () => {
    expect(sanitizeAttachmentFilename('あ'.repeat(200))).toHaveLength(80);
  });
});

describe('attachmentR2Key', () => {
  it('利用者入力を含めず、月で切ったキーを作る', () => {
    expect(attachmentR2Key('default', '2026-08', 'uuid-1', 'image/heic')).toBe(
      'attachments/default/2026-08/uuid-1.heic',
    );
  });
});

describe('formatAttachmentSize', () => {
  it('桁に応じて単位を変える', () => {
    expect(formatAttachmentSize(512)).toBe('512B');
    expect(formatAttachmentSize(2048)).toBe('2KB');
    expect(formatAttachmentSize(3 * 1024 * 1024)).toBe('3.0MB');
  });
});

describe('buildTransitEntry / transitInputError', () => {
  it('往復は片道運賃の2倍で、内容に区間と往復/片道を残す', () => {
    expect(buildTransitEntry({ from: '名古屋', to: '金山', oneWayAmount: 230, round: true })).toEqual({
      amount: 460,
      description: '電車代 名古屋→金山(往復)',
    });
  });

  it('片道はそのままの金額', () => {
    expect(buildTransitEntry({ from: '名古屋', to: '金山', oneWayAmount: 230, round: false })).toEqual({
      amount: 230,
      description: '電車代 名古屋→金山(片道)',
    });
  });

  it('前後の空白は落として組み立てる', () => {
    expect(
      buildTransitEntry({ from: ' 名古屋 ', to: ' 金山 ', oneWayAmount: 1, round: false }).description,
    ).toBe('電車代 名古屋→金山(片道)');
  });

  it('区間の片方欠けと金額不正を日本語で拒否する', () => {
    expect(transitInputError({ from: '名古屋', to: '', oneWayAmount: 230, round: false })).not.toBeNull();
    expect(transitInputError({ from: '名古屋', to: '金山', oneWayAmount: 0, round: false })).not.toBeNull();
    expect(transitInputError({ from: '名古屋', to: '金山', oneWayAmount: 1.5, round: false })).not.toBeNull();
    expect(transitInputError({ from: '名古屋', to: '金山', oneWayAmount: 230, round: true })).toBeNull();
  });
});

describe('receiptStatus', () => {
  it('添付があれば attached、無ければ waived の有無で分かれる', () => {
    expect(receiptStatus({ receiptWaived: false }, 1)).toBe('attached');
    expect(receiptStatus({ receiptWaived: true }, 1)).toBe('attached');
    expect(receiptStatus({ receiptWaived: true }, 0)).toBe('waived');
    expect(receiptStatus({ receiptWaived: false }, 0)).toBe('missing');
  });
});

describe('missingReceiptSeverity', () => {
  const biz = { io: 'expense', side: 'biz' } as const;

  it('事業の支出は下限以上だけ警告色にする', () => {
    expect(missingReceiptSeverity({ ...biz, amount: RECEIPT_WARN_THRESHOLD })).toBe('warn');
    expect(missingReceiptSeverity({ ...biz, amount: RECEIPT_WARN_THRESHOLD - 1 })).toBe('quiet');
  });

  it('収入と家計は金額によらず静かに出す', () => {
    expect(missingReceiptSeverity({ io: 'income', side: 'biz', amount: 100_000 })).toBe('quiet');
    expect(missingReceiptSeverity({ io: 'expense', side: 'per', amount: 100_000 })).toBe('quiet');
  });
});

/**
 * 証憑の取得先をmerchantから継承するためのpure domain。
 * password / token / sessionはこのドメインに入れず、認証は取得先で別管理する。
 */

const CORPORATE_PREFIX = /^(?:(?:株式|有限|合同)会社|\(株\)|\(有\))\s*/;
const CORPORATE_SUFFIX = /\s*(?:(?:株式|有限|合同)会社|\(株\)|\(有\))$/;
const SAFE_VARIANCE = /[\s　]/g;

/**
 * merchant/source名の安全な表記ゆれだけを吸収する。
 * 部分一致・読み変換・略称推測はしない。
 */
export function normalizeReceiptSourceKeyPart(value: string): string {
  let normalized = value.normalize('NFKC').toLowerCase().trim();
  // 法人格は名称の前後に独立している場合だけ除く。
  normalized = normalized.replace(CORPORATE_PREFIX, '').replace(CORPORATE_SUFFIX, '');
  return normalized.replace(SAFE_VARIANCE, '');
}

/** merchantと取得serviceの組み合わせを永続参照するkey。 */
export function receiptSourceProfileKey(merchant: string, serviceName: string): string {
  return `${normalizeReceiptSourceKeyPart(merchant)}::${normalizeReceiptSourceKeyPart(serviceName)}`;
}

export interface ReceiptSourceProfile {
  profileKey: string;
  merchantKey: string;
  serviceName: string;
  /** 証憑を取得する公開URL。http/httpsのみ、URL内認証情報は不可。 */
  sourceUrl: string;
  /** ログイン画面で選ぶaccount名。秘密情報は持たない。 */
  loginAccount: string;
  memo: string;
}

export interface ReceiptSourceProfileFields {
  serviceName: string;
  sourceUrl: string;
  loginAccount: string;
  memo: string;
}

export type ReceiptSourceProfileIssue = 'invalid_merchant' | 'invalid_service_name' | 'invalid_source_url';

export type ReceiptSourceProfileBuildResult =
  | { ok: true; profile: ReceiptSourceProfile }
  | { ok: false; issues: ReceiptSourceProfileIssue[] };

const safeHttpUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
    // URLに埋め込まれた認証情報は、ログやexportへの混入を防ぐため拒否する。
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
};

/** 外部入力から秘密を含まないcanonical profileを作る。 */
export function buildReceiptSourceProfile(
  merchant: string,
  fields: ReceiptSourceProfileFields,
): ReceiptSourceProfileBuildResult {
  const merchantKey = normalizeReceiptSourceKeyPart(merchant);
  const serviceName = fields.serviceName.trim();
  const serviceKey = normalizeReceiptSourceKeyPart(serviceName);
  const sourceUrl = safeHttpUrl(fields.sourceUrl);
  const issues: ReceiptSourceProfileIssue[] = [];
  if (!merchantKey) issues.push('invalid_merchant');
  if (!serviceKey) issues.push('invalid_service_name');
  if (!sourceUrl) issues.push('invalid_source_url');
  if (issues.length > 0 || !sourceUrl) return { ok: false, issues };

  return {
    ok: true,
    profile: {
      profileKey: `${merchantKey}::${serviceKey}`,
      merchantKey,
      serviceName,
      sourceUrl,
      loginAccount: fields.loginAccount.trim(),
      memo: fields.memo.trim(),
    },
  };
}

export interface ReceiptSourceTransaction {
  transactionId: string;
  /** YYYY-MM。継承は月に依存せずmerchantだけで決まる。 */
  month: string;
  merchant: string;
}

export interface ReceiptSourceOverride {
  transactionId: string;
  /** nullは「この明細では継承しない」という明示判断。 */
  profileKey: string | null;
}

export type ReceiptSourceResolutionState =
  | 'resolved'
  | 'ambiguous'
  | 'unmatched'
  | 'cleared'
  | 'invalid-override';

export interface ReceiptSourceResolution {
  state: ReceiptSourceResolutionState;
  profile: ReceiptSourceProfile | null;
  candidates: ReceiptSourceProfile[];
  /** merchant継承で利用したkey。overrideの場合は null。 */
  inheritedFrom: string | null;
  overrideState: 'none' | 'applied' | 'cleared' | 'invalid';
}

/** merchant継承と明細overrideを1箇所で解決する。 */
export function resolveReceiptSourceProfile(
  transaction: ReceiptSourceTransaction,
  profiles: readonly ReceiptSourceProfile[],
  overrides: readonly ReceiptSourceOverride[],
): ReceiptSourceResolution {
  const profilesByKey = new Map(profiles.map((profile) => [profile.profileKey, profile]));
  const override = overrides.find((candidate) => candidate.transactionId === transaction.transactionId);
  if (override) {
    if (override.profileKey === null) {
      return {
        state: 'cleared',
        profile: null,
        candidates: [],
        inheritedFrom: null,
        overrideState: 'cleared',
      };
    }
    const selected = profilesByKey.get(override.profileKey);
    if (!selected) {
      return {
        state: 'invalid-override',
        profile: null,
        candidates: [],
        inheritedFrom: null,
        overrideState: 'invalid',
      };
    }
    return {
      state: 'resolved',
      profile: selected,
      candidates: [],
      inheritedFrom: null,
      overrideState: 'applied',
    };
  }

  const merchantKey = normalizeReceiptSourceKeyPart(transaction.merchant);
  const candidates = [...profilesByKey.values()]
    .filter((profile) => profile.merchantKey === merchantKey)
    .sort((a, b) => a.profileKey.localeCompare(b.profileKey));
  if (candidates.length === 0) {
    return {
      state: 'unmatched',
      profile: null,
      candidates: [],
      inheritedFrom: null,
      overrideState: 'none',
    };
  }
  if (candidates.length > 1) {
    return {
      state: 'ambiguous',
      profile: null,
      candidates,
      inheritedFrom: merchantKey,
      overrideState: 'none',
    };
  }
  return {
    state: 'resolved',
    profile: candidates[0],
    candidates: [],
    inheritedFrom: merchantKey,
    overrideState: 'none',
  };
}

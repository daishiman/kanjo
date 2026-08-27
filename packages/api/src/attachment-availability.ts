/**
 * D1は削除進捗の単調fact、レスポンス時の原本可用性はexact-key R2 HEADを正本にする。
 * bucket listは使わず、1 requestのR2操作数と同時実行数を固定する。
 */
export const ATTACHMENT_AVAILABILITY_CONCURRENCY = 4;
/** Free internal services 1,000/invocationからauth/D1等の100枠を残す。削除fact済みkeyは含めない。 */
export const ATTACHMENT_AVAILABILITY_MAX_CANDIDATES = 900;

export const ATTACHMENT_AVAILABILITY_ERROR = {
  code: 'attachment_availability_unavailable',
  message: '原本の保管状況を確認できません。時間をおいて再試行してください',
} as const;

export class AttachmentAvailabilityError extends Error {
  constructor(readonly reason: 'candidate_limit' | 'head_failed' | 'get_failed') {
    super('attachment availability unavailable');
    this.name = 'AttachmentAvailabilityError';
  }
}

export interface AttachmentAvailabilityCandidate {
  r2Key: string;
  objectDeletedAt: string | null;
}

export async function resolveAttachmentAvailability(
  files: R2Bucket,
  candidates: readonly AttachmentAvailabilityCandidate[],
): Promise<Map<string, boolean>> {
  const unique = new Map<string, AttachmentAvailabilityCandidate>();
  for (const candidate of candidates) unique.set(candidate.r2Key, candidate);
  const result = new Map<string, boolean>();
  const headCandidates: string[] = [];
  for (const candidate of unique.values()) {
    if (candidate.objectDeletedAt) result.set(candidate.r2Key, false);
    else headCandidates.push(candidate.r2Key);
  }
  if (headCandidates.length > ATTACHMENT_AVAILABILITY_MAX_CANDIDATES)
    throw new AttachmentAvailabilityError('candidate_limit');

  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const key = headCandidates[index];
      if (key === undefined) return;
      try {
        result.set(key, (await files.head(key)) !== null);
      } catch {
        throw new AttachmentAvailabilityError('head_failed');
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(ATTACHMENT_AVAILABILITY_CONCURRENCY, headCandidates.length) }, worker),
  );
  return result;
}

/** HEADとGETのエラー意味を統一する。HEAD後の帯域外削除raceもmissingとして返す。 */
export async function getAvailableAttachmentObject(
  files: R2Bucket,
  candidate: AttachmentAvailabilityCandidate,
): Promise<R2ObjectBody | null> {
  const availability = await resolveAttachmentAvailability(files, [candidate]);
  if (!availability.get(candidate.r2Key)) return null;
  try {
    return await files.get(candidate.r2Key);
  } catch {
    throw new AttachmentAvailabilityError('get_failed');
  }
}

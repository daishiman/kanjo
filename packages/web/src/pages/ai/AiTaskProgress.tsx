import { aiProgressText } from './view-model.js';

/** 一覧と選択中バーが共有する、文字を伴う進捗表示。 */
export function AiTaskProgress({ progress }: { progress: number | null }) {
  return (
    <span className="ai-progress" aria-label={`進捗 ${aiProgressText(progress)}`}>
      {progress != null && (
        <span className="ai-progress-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      )}
      <span className="num">{aiProgressText(progress)}</span>
    </span>
  );
}

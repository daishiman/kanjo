/** 列挙値だけを URL から受け取り、未知値は画面固有の既定へ戻す。 */
export function choiceParam<Value extends string>(
  params: URLSearchParams,
  name: string,
  choices: readonly Value[],
  fallback: Value,
): Value {
  const value = params.get(name);
  return value && choices.includes(value as Value) ? (value as Value) : fallback;
}

/** Diagnosis / Trends が共有する、既存 query を保った部分更新。 */
export function patchSearchParams<Key extends string>(
  previous: URLSearchParams,
  patch: Partial<Record<Key, string | null>>,
): URLSearchParams {
  const next = new URLSearchParams(previous);
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) next.delete(name);
    else next.set(name, String(value));
  }
  return next;
}

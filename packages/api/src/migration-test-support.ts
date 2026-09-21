/**
 * D1 migration をテスト用の prepare/run 単位へ分ける。
 *
 * 単純な `split(';')` では CREATE TRIGGER の BEGIN ... END 内の終端まで分割してしまう。
 * 文字列・引用識別子・コメント内のセミコロンも文末ではないため、最小限の字句状態を持って読む。
 * production の migration 適用経路ではなく、Miniflare を使うテストだけの helper。
 */
export function splitMigrationStatements(source: string): string[] {
  const statements: string[] = [];
  let statement = '';
  let token = '';
  let quote: "'" | '"' | '`' | ']' | null = null;
  let lineComment = false;
  let blockComment = false;
  let createSeen = false;
  let inTrigger = false;
  let triggerBodyDepth = 0;
  let caseDepth = 0;

  const finishToken = () => {
    if (!token) return;
    const keyword = token.toUpperCase();
    token = '';
    if (!inTrigger) {
      if (keyword === 'CREATE') createSeen = true;
      else if (createSeen && (keyword === 'TEMP' || keyword === 'TEMPORARY')) return;
      else if (createSeen && keyword === 'TRIGGER') inTrigger = true;
      else if (createSeen) createSeen = false;
      return;
    }
    if (keyword === 'CASE') caseDepth += 1;
    else if (keyword === 'BEGIN' && caseDepth === 0) triggerBodyDepth += 1;
    else if (keyword === 'END') {
      if (caseDepth > 0) caseDepth -= 1;
      else if (triggerBodyDepth > 0) triggerBodyDepth -= 1;
    }
  };

  const pushStatement = () => {
    const sql = statement.trim();
    if (sql) statements.push(sql);
    statement = '';
    createSeen = false;
    inTrigger = false;
    triggerBodyDepth = 0;
    caseDepth = 0;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] as string;
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        statement += '\n';
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
        statement += ' ';
      }
      continue;
    }
    if (quote) {
      statement += char;
      const closes = quote === ']' ? char === ']' : char === quote;
      if (!closes) continue;
      if (quote !== ']' && next === quote) {
        statement += next;
        index += 1;
      } else quote = null;
      continue;
    }
    if (char === '-' && next === '-') {
      finishToken();
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      finishToken();
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      finishToken();
      quote = char === '[' ? ']' : char;
      statement += char;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) token += char;
    else finishToken();

    if (char === ';' && (!inTrigger || triggerBodyDepth === 0)) pushStatement();
    else statement += char;
  }
  finishToken();
  pushStatement();
  return statements;
}

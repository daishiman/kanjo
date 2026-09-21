import { describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

describe('migration test SQL splitter', () => {
  it('通常文・引用中のセミコロン・trigger body を正しい単位へ分ける', () => {
    expect(
      splitMigrationStatements(`
        -- standalone comment;
        CREATE TABLE sample (id TEXT, note TEXT DEFAULT 'a;b');
        /* block; comment */
        CREATE TRIGGER sample_once
        BEFORE INSERT ON sample
        WHEN EXISTS (SELECT 1 FROM sample WHERE id = NEW.id)
        BEGIN
          SELECT CASE WHEN NEW.id = 'x;y' THEN RAISE(ABORT, 'duplicate; id') END;
        END;
        CREATE INDEX sample_note ON sample(note);
      `),
    ).toEqual([
      "CREATE TABLE sample (id TEXT, note TEXT DEFAULT 'a;b')",
      `CREATE TRIGGER sample_once
        BEFORE INSERT ON sample
        WHEN EXISTS (SELECT 1 FROM sample WHERE id = NEW.id)
        BEGIN
          SELECT CASE WHEN NEW.id = 'x;y' THEN RAISE(ABORT, 'duplicate; id') END;
        END`,
      'CREATE INDEX sample_note ON sample(note)',
    ]);
  });
});

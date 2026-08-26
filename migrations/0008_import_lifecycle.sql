-- Migration number: 0008  取込run/unit・利用者別writer claim・active target
-- 0006/0007は適用済みの可能性があるため変更せず、ライフサイクル追加はappend-onlyにする。

CREATE TABLE import_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','applying','committed','failed','duplicate')),
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_import_runs_user_created ON import_runs(user_id, created_at);

-- user_idのPKを1 statementでclaimし、expires_at超過時だけ別runが回復する。
-- run_idは受理前のquery計画中にも所有tokenとして使うため、import_runsへのFKは意図的に付けない。
-- claimはTTL/明示releaseで消えるephemeral coordination、監査正本はimport_runs/importsである。
CREATE TABLE import_writer_claims (
  user_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 重複判定は過去ever-seenではなく、domain×month/globalの現行指紋と比較する。
CREATE TABLE import_active_targets (
  user_id TEXT NOT NULL,
  target_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  import_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, target_key)
);
CREATE INDEX idx_import_active_import ON import_active_targets(user_id, import_id);

-- importsをrequest配下のlogical unit/attemptとして閉じた状態で追跡する。
ALTER TABLE imports ADD COLUMN run_id TEXT;
ALTER TABLE imports ADD COLUMN target_keys TEXT;
ALTER TABLE imports ADD COLUMN failure_reason TEXT;
ALTER TABLE imports ADD COLUMN fingerprint_version INTEGER;
ALTER TABLE imports ADD COLUMN committed_at TEXT;
CREATE INDEX idx_imports_run ON imports(run_id, id);

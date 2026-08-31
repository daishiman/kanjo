#!/usr/bin/env python3
"""Project canonical C28 Beads identities into the C02-owned local graph.

The bridge remains the only Beads reader.  This writer validates the exact
feature/task set and dependency parity, then updates graph + Markdown
frontmatter as one fail-closed local transaction.
"""

from __future__ import annotations

import argparse
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any

import jsonschema
import yaml


PLUGIN_ROOT = Path("/Users/dm/.codex/plugins/cache/harness-dev/dev-graph/0.1.9")
BRIDGE = PLUGIN_ROOT / "scripts" / "bd-bridge.py"
NODE_SCHEMA = PLUGIN_ROOT / "schemas" / "graph-node.schema.json"

FEATURE_ID = "feat-mobile-financial-visualization"
TASK_IDS = [f"SYS-MOBFIN-P{number:02d}" for number in range(1, 14)]
BEADS_IDS = {
    FEATURE_ID: "kanjo-dy9",
    **{task_id: f"kanjo-dy9.{index}" for index, task_id in enumerate(TASK_IDS, 1)},
}


class ProjectionError(RuntimeError):
    pass


def canonical_digest(value: Any) -> str:
    packed = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(packed).hexdigest()


def file_digest(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def bridge_show(repo_root: Path, beads_id: str) -> dict[str, Any]:
    command = [
        "python3",
        str(BRIDGE),
        "--op",
        "show",
        "--repo-root",
        str(repo_root),
        "--bd-issue-id",
        beads_id,
    ]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    result = payload.get("result")
    if not isinstance(result, dict):
        raise ProjectionError(f"bridge show omitted result for {beads_id}")
    return result


def dependency_ids(issue: dict[str, Any]) -> set[str]:
    return {
        dependency["external_ref"].removeprefix("dev-graph:")
        for dependency in issue.get("dependencies", [])
        if isinstance(dependency, dict)
        and dependency.get("dependency_type") == "blocks"
        and isinstance(dependency.get("external_ref"), str)
        and dependency["external_ref"].startswith("dev-graph:")
    }


def split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---\n"):
        raise ProjectionError("artifact has no YAML frontmatter")
    marker = text.find("\n---\n", 4)
    if marker < 0:
        raise ProjectionError("artifact frontmatter is not terminated")
    return text[4:marker], text[marker + 5 :]


def update_frontmatter(text: str, node_id: str, linkage: dict[str, Any], updated_at: str) -> str:
    frontmatter, body = split_frontmatter(text)
    parsed = yaml.safe_load(frontmatter)
    if not isinstance(parsed, dict) or parsed.get("graph_node_id") != node_id:
        raise ProjectionError(f"frontmatter identity mismatch: {node_id}")
    if parsed.get("beads_linkage") == linkage and parsed.get("updated_at") == updated_at:
        return text
    if parsed.get("beads_linkage") is not None:
        raise ProjectionError(f"refusing to overwrite non-null linkage: {node_id}")

    updated, count = re.subn(
        r"(?m)^updated_at:.*$",
        f"updated_at: '{updated_at}'",
        frontmatter,
        count=1,
    )
    if count != 1:
        raise ProjectionError(f"updated_at field is not unique: {node_id}")
    linkage_yaml = (
        "beads_linkage:\n"
        f"  bd_issue_id: {linkage['bd_issue_id']}\n"
        f"  linked_at: '{linkage['linked_at']}'\n"
        f"  sync_state: {linkage['sync_state']}\n"
        "  github_mirror: null"
    )
    updated, count = re.subn(r"(?m)^beads_linkage: null$", linkage_yaml, updated, count=1)
    if count != 1:
        raise ProjectionError(f"beads_linkage null field is not unique: {node_id}")
    candidate = f"---\n{updated}\n---\n{body}"
    checked, checked_body = split_frontmatter(candidate)
    checked_parsed = yaml.safe_load(checked)
    if checked_parsed.get("beads_linkage") != linkage or checked_parsed.get("updated_at") != updated_at:
        raise ProjectionError(f"frontmatter projection validation failed: {node_id}")
    if checked_body != body:
        raise ProjectionError(f"artifact body changed during linkage projection: {node_id}")
    return candidate


def atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve(strict=True)
    graph_path = root / ".dev-graph/state/graph.json"
    parity_path = root / ".dev-graph/state/beads-parity-feat-mobile-financial-visualization.json"
    receipt_path = root / ".dev-graph/receipts/sync-beads-feat-mobile-financial-visualization.json"
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    nodes = {
        node.get("graph_node_id"): node
        for node in graph.get("nodes", [])
        if isinstance(node, dict) and node.get("graph_node_id") in BEADS_IDS
    }
    if set(nodes) != set(BEADS_IDS):
        raise ProjectionError("canonical graph does not contain the exact feature + P01..P13 set")

    issues: dict[str, dict[str, Any]] = {}
    for node_id, beads_id in BEADS_IDS.items():
        issue = bridge_show(root, beads_id)
        if issue.get("id") != beads_id or issue.get("external_ref") != f"dev-graph:{node_id}":
            raise ProjectionError(f"Beads identity mismatch: {node_id}")
        if issue.get("status") != "open":
            raise ProjectionError(f"unexpected Beads status for {node_id}: {issue.get('status')}")
        if node_id == FEATURE_ID:
            if issue.get("issue_type") != "epic":
                raise ProjectionError("feature Beads artifact is not an epic")
        else:
            if issue.get("issue_type") != "task" or issue.get("parent") != BEADS_IDS[FEATURE_ID]:
                raise ProjectionError(f"task parent/type mismatch: {node_id}")
            expected_dependencies = set(nodes[node_id].get("depends_on", []))
            if dependency_ids(issue) != expected_dependencies:
                raise ProjectionError(f"dependency parity mismatch: {node_id}")
        issues[node_id] = issue

    proposed = copy.deepcopy(graph)
    proposed_nodes = {node["graph_node_id"]: node for node in proposed["nodes"] if node.get("graph_node_id") in BEADS_IDS}
    changed_ids: list[str] = []
    artifact_updates: dict[Path, bytes] = {}
    for node_id in [FEATURE_ID, *TASK_IDS]:
        node = proposed_nodes[node_id]
        issue = issues[node_id]
        linkage = {
            "bd_issue_id": issue["id"],
            "linked_at": issue["created_at"],
            "sync_state": "synced",
            "github_mirror": None,
        }
        if node.get("beads_linkage") != linkage:
            node["beads_linkage"] = linkage
            node["updated_at"] = issue["created_at"]
            changed_ids.append(node_id)
        artifact = (root / node["file_path"]).resolve(strict=True)
        if root not in artifact.parents:
            raise ProjectionError(f"artifact escapes repo root: {artifact}")
        original_text = artifact.read_text(encoding="utf-8")
        new_text = update_frontmatter(original_text, node_id, linkage, node["updated_at"])
        if new_text != original_text:
            artifact_updates[artifact] = new_text.encode()

    schema = json.loads(NODE_SCHEMA.read_text(encoding="utf-8"))
    for node_id in [FEATURE_ID, *TASK_IDS]:
        jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(proposed_nodes[node_id])

    revision_before = graph.get("graph_revision")
    if not isinstance(revision_before, int):
        raise ProjectionError("graph_revision is not an integer")
    idempotent = not changed_ids and not artifact_updates
    if changed_ids:
        proposed["graph_revision"] = revision_before + 1

    parity = {
        "schema_version": "1.0.0",
        "feature_id": FEATURE_ID,
        "workspace_id": "bdw_e880d8c2fef2fbed5ceb187f",
        "nodes": [
            {
                "graph_node_id": task_id,
                "bd_issue_id": BEADS_IDS[task_id],
                "graph_status": "active",
                "depends_on": nodes[task_id].get("depends_on", []),
            }
            for task_id in TASK_IDS
        ],
    }
    remote_snapshot = {
        node_id: {
            "id": issue["id"],
            "external_ref": issue["external_ref"],
            "status": issue["status"],
            "parent": issue.get("parent"),
            "depends_on": sorted(dependency_ids(issue)),
            "created_at": issue["created_at"],
            "updated_at": issue["updated_at"],
        }
        for node_id, issue in issues.items()
    }
    receipt = {
        "schema_version": "1.0.0",
        "owner": "C02/run-dev-graph-node",
        "consumer": "C03/run-dev-graph-sync",
        "operation": "project_beads_linkage",
        "status": "preview" if args.dry_run else "applied",
        "feature_id": FEATURE_ID,
        "projected_node_ids": [FEATURE_ID, *TASK_IDS],
        "changed_node_ids": changed_ids,
        "graph_revision_before": revision_before,
        "graph_revision_after": proposed.get("graph_revision"),
        "graph_digest_after": canonical_digest(proposed),
        "remote_snapshot_digest": canonical_digest(remote_snapshot),
        "parity_manifest": parity_path.relative_to(root).as_posix(),
        "write_count": 0 if args.dry_run or idempotent else 1 + len(artifact_updates) + 2,
        "idempotent": idempotent,
    }
    if args.dry_run:
        print(json.dumps(receipt, ensure_ascii=False, indent=2))
        return 0

    lock_path = graph_path.with_name(f".{graph_path.name}.register.lock")
    with lock_path.open("a+", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ProjectionError("C02 graph writer is already active") from exc
        if receipt_path.exists() and not idempotent:
            raise ProjectionError(f"immutable sync receipt already exists: {receipt_path}")
        originals = {path: path.read_bytes() for path in [graph_path, *artifact_updates]}
        try:
            if changed_ids:
                atomic_write_bytes(
                    graph_path,
                    (json.dumps(proposed, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode(),
                )
            for path, content in artifact_updates.items():
                atomic_write_bytes(path, content)
            parity_bytes = (json.dumps(parity, ensure_ascii=False, indent=2) + "\n").encode()
            if not parity_path.exists() or parity_path.read_bytes() != parity_bytes:
                atomic_write_bytes(parity_path, parity_bytes)
            if not receipt_path.exists():
                atomic_write_bytes(receipt_path, (json.dumps(receipt, ensure_ascii=False, indent=2) + "\n").encode())
        except Exception:
            for path, content in originals.items():
                atomic_write_bytes(path, content)
            raise

    receipt["graph_file_sha256_after"] = file_digest(graph_path)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

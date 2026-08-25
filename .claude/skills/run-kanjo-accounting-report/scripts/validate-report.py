#!/usr/bin/env python3
# /// script
# name: validate-report
# version: 1.0.0
# purpose: kanjo 会計分析レポートJSONを送信前に検査する(5節・上限・プレーンテキスト・priority・金額型)
# inputs:
#   - argv[1]: 検査するレポートJSONのパス
# outputs:
#   - stdout: OK 1行 / NG 行の一覧
#   - exit: 0=送信可 / 1=修正が必要 / 2=ファイル・JSONが読めない
# requires-python: ">=3.9"
# dependencies: []
# contexts: [E, C]
# network: false
# write-scope: none
# ///
"""送信前にレポートJSONの形を検査する(標準ライブラリのみ)。

- 5節 (spend / change / reduction / split / subscriptions) が全て揃うこと
- summary / body / items / dataGaps の文字数・件数が API 上限内であること
- 本文がプレーンテキストであること(HTMLタグ・Markdown見出し・表記号を含まない)
- priority が high / mid / low / null のいずれかであること
- 金額が整数または null であること

exit 0 = 送信可。exit 1 = 修正が必要(理由を1行ずつ標準出力へ)。exit 2 = ファイル/JSON が読めない。
正本: packages/api/src/ai/contract.ts (reportInputSchema)。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SECTION_IDS = ("spend", "change", "reduction", "split", "subscriptions")
PRIORITIES = {"high", "mid", "low"}
LIMITS = {
    "generatedBy": 60,
    "model": 120,
    "title": 120,
    "summary": 3000,
    "section_title": 120,
    "body": 12000,
    "item_label": 200,
    "item_note": 1000,
    "items": 60,
    "dataGaps": 40,
    "dataGap": 500,
}
HTML_TAG_RE = re.compile(r"<\s*/?[a-zA-Z][^>]*>")
MARKDOWN_LINE_RE = re.compile(r"^\s*(#{1,6}\s|\|.*\||```)")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _text_issues(where: str, value: object, limit: int, *, required: bool) -> list[str]:
    issues: list[str] = []
    if value is None:
        if required:
            issues.append(f"{where}: 必須です")
        return issues
    if not isinstance(value, str):
        issues.append(f"{where}: 文字列にしてください")
        return issues
    if required and not value.strip():
        issues.append(f"{where}: 空です")
    if len(value) > limit:
        issues.append(f"{where}: {len(value)}字は上限 {limit} 字を超えています")
    if HTML_TAG_RE.search(value):
        issues.append(f"{where}: HTMLタグを含んでいます(プレーンテキストのみ)")
    if CONTROL_RE.search(value):
        issues.append(f"{where}: 制御文字を含んでいます")
    for line in value.splitlines():
        if MARKDOWN_LINE_RE.match(line):
            issues.append(f"{where}: Markdown の見出し・表・コードフェンスは使えません: {line.strip()[:30]!r}")
            break
    return issues


def _item_issues(where: str, item: object) -> list[str]:
    if not isinstance(item, dict):
        return [f"{where}: オブジェクトにしてください"]
    issues = _text_issues(f"{where}.label", item.get("label"), LIMITS["item_label"], required=True)
    issues += _text_issues(f"{where}.note", item.get("note"), LIMITS["item_note"], required=False)
    amount = item.get("amount")
    if amount is not None and (isinstance(amount, bool) or not isinstance(amount, int)):
        issues.append(f"{where}.amount: 円の整数か null にしてください(小数・文字列は不可)")
    priority = item.get("priority")
    if priority is not None and priority not in PRIORITIES:
        issues.append(f"{where}.priority: high / mid / low / null のいずれかにしてください")
    return issues


def validate(report: object) -> list[str]:
    """レポート dict を検査し、問題点のリストを返す(空なら送信可)。"""
    if not isinstance(report, dict):
        return ["トップレベルはオブジェクトにしてください"]
    issues = _text_issues("generatedBy", report.get("generatedBy"), LIMITS["generatedBy"], required=True)
    issues += _text_issues("model", report.get("model"), LIMITS["model"], required=False)
    issues += _text_issues("title", report.get("title"), LIMITS["title"], required=False)
    issues += _text_issues("summary", report.get("summary"), LIMITS["summary"], required=True)

    sections = report.get("sections")
    if not isinstance(sections, list):
        issues.append("sections: 配列にしてください")
        sections = []
    seen: list[str] = []
    for idx, section in enumerate(sections):
        where = f"sections[{idx}]"
        if not isinstance(section, dict):
            issues.append(f"{where}: オブジェクトにしてください")
            continue
        sid = section.get("id")
        if sid not in SECTION_IDS:
            issues.append(f"{where}.id: {sid!r} は未定義です(使える id: {', '.join(SECTION_IDS)})")
        else:
            seen.append(sid)
        issues += _text_issues(f"{where}.title", section.get("title"), LIMITS["section_title"], required=False)
        issues += _text_issues(f"{where}.body", section.get("body"), LIMITS["body"], required=True)
        items = section.get("items")
        if items is not None:
            if not isinstance(items, list):
                issues.append(f"{where}.items: 配列にしてください")
            else:
                if len(items) > LIMITS["items"]:
                    issues.append(f"{where}.items: {len(items)}件は上限 {LIMITS['items']} 件を超えています")
                for j, item in enumerate(items):
                    issues += _item_issues(f"{where}.items[{j}]", item)
    missing = [sid for sid in SECTION_IDS if sid not in seen]
    if missing:
        issues.append(f"sections: 節が不足しています: {', '.join(missing)}(5節すべて必要)")
    duplicated = sorted({sid for sid in seen if seen.count(sid) > 1})
    if duplicated:
        issues.append(f"sections: 節が重複しています: {', '.join(duplicated)}")

    gaps = report.get("dataGaps")
    if gaps is not None:
        if not isinstance(gaps, list):
            issues.append("dataGaps: 配列にしてください")
        else:
            if len(gaps) > LIMITS["dataGaps"]:
                issues.append(f"dataGaps: {len(gaps)}件は上限 {LIMITS['dataGaps']} 件を超えています")
            for j, gap in enumerate(gaps):
                issues += _text_issues(f"dataGaps[{j}]", gap, LIMITS["dataGap"], required=True)
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="kanjo 会計分析レポートJSONの送信前検査")
    parser.add_argument("path", help="検査するレポートJSONのパス")
    args = parser.parse_args(argv)
    try:
        report = json.loads(Path(args.path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"読めません: {exc}")
        return 2
    issues = validate(report)
    if issues:
        for issue in issues:
            print(f"NG {issue}")
        print(f"修正が必要です({len(issues)}件)。直してから再検査してください。")
        return 1
    print("OK 5節・上限・プレーンテキストの条件を満たしています。送信できます。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

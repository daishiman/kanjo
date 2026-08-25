#!/usr/bin/env python3
# /// script
# name: validate-report
# version: 2.0.0
# purpose: kanjo 会計分析レポートJSONを送信前に検査する(5節・要点サマリー・図表・needs・上限・プレーンテキスト)
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
- keyFindings(improvements / wasted / quickWins)・followUp・needs・charts の形が第2版の契約に合うこと
  (charts は kind / unit が既定値内、series.data の長さが labels と一致、id が一意)

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
FINDING_KEYS = ("improvements", "wasted", "quickWins")
NEED_SCREENS = {"import", "classify", "settings", "budget", "subscriptions", "household", "overview"}
CHART_KINDS = {"bar", "line", "stackedBar"}
CHART_UNITS = {"yen", "pct", "count"}
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
    "finding_items": 10,
    "followUp_body": 6000,
    "followUp_items": 30,
    "needs": 30,
    "need_gap": 300,
    "need_action": 500,
    "need_screen": 40,
    "charts": 6,
    "chart_id": 40,
    "chart_title": 120,
    "chart_labels": 72,
    "chart_label": 40,
    "chart_series": 8,
    "series_label": 60,
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


def _items_issues(where: str, items: object, limit: int) -> list[str]:
    if items is None:
        return []
    if not isinstance(items, list):
        return [f"{where}: 配列にしてください"]
    issues: list[str] = []
    if len(items) > limit:
        issues.append(f"{where}: {len(items)}件は上限 {limit} 件を超えています")
    for j, item in enumerate(items):
        issues += _item_issues(f"{where}[{j}]", item)
    return issues


def _key_findings_issues(kf: object) -> list[str]:
    if kf is None:
        return []
    if not isinstance(kf, dict):
        return ["keyFindings: オブジェクトにしてください"]
    issues: list[str] = []
    for key in kf:
        if key not in FINDING_KEYS:
            issues.append(f"keyFindings.{key}: 未定義です(使えるキー: {', '.join(FINDING_KEYS)})")
    for key in FINDING_KEYS:
        issues += _items_issues(f"keyFindings.{key}", kf.get(key), LIMITS["finding_items"])
    return issues


def _follow_up_issues(fu: object) -> list[str]:
    if fu is None:
        return []
    if not isinstance(fu, dict):
        return ["followUp: オブジェクトか null にしてください"]
    issues = _text_issues("followUp.body", fu.get("body"), LIMITS["followUp_body"], required=True)
    issues += _items_issues("followUp.items", fu.get("items"), LIMITS["followUp_items"])
    return issues


def _needs_issues(needs: object) -> list[str]:
    if needs is None:
        return []
    if not isinstance(needs, list):
        return ["needs: 配列にしてください"]
    issues: list[str] = []
    if len(needs) > LIMITS["needs"]:
        issues.append(f"needs: {len(needs)}件は上限 {LIMITS['needs']} 件を超えています")
    for j, need in enumerate(needs):
        where = f"needs[{j}]"
        if not isinstance(need, dict):
            issues.append(f"{where}: オブジェクトにしてください")
            continue
        issues += _text_issues(f"{where}.gap", need.get("gap"), LIMITS["need_gap"], required=True)
        issues += _text_issues(f"{where}.action", need.get("action"), LIMITS["need_action"], required=True)
        screen = need.get("screen")
        if screen is not None:
            if not isinstance(screen, str) or len(screen) > LIMITS["need_screen"]:
                issues.append(f"{where}.screen: 画面 id の文字列か null にしてください")
            elif screen not in NEED_SCREENS:
                issues.append(
                    f"{where}.screen: {screen!r} は未定義の画面です(使える id: {', '.join(sorted(NEED_SCREENS))} / null)"
                )
    return issues


def _chart_issues(where: str, chart: object) -> list[str]:
    if not isinstance(chart, dict):
        return [f"{where}: オブジェクトにしてください"]
    issues = _text_issues(f"{where}.id", chart.get("id"), LIMITS["chart_id"], required=True)
    issues += _text_issues(f"{where}.title", chart.get("title"), LIMITS["chart_title"], required=True)
    if chart.get("kind") not in CHART_KINDS:
        issues.append(f"{where}.kind: {chart.get('kind')!r} は未定義です(使える kind: {', '.join(sorted(CHART_KINDS))})")
    unit = chart.get("unit")
    if unit is not None and unit not in CHART_UNITS:
        issues.append(f"{where}.unit: {unit!r} は未定義です(使える unit: {', '.join(sorted(CHART_UNITS))})")
    labels = chart.get("labels")
    n_labels = 0
    if not isinstance(labels, list) or not labels:
        issues.append(f"{where}.labels: 1件以上の配列にしてください")
    else:
        n_labels = len(labels)
        if n_labels > LIMITS["chart_labels"]:
            issues.append(f"{where}.labels: {n_labels}件は上限 {LIMITS['chart_labels']} 件を超えています")
        for j, label in enumerate(labels):
            issues += _text_issues(f"{where}.labels[{j}]", label, LIMITS["chart_label"], required=True)
    series = chart.get("series")
    if not isinstance(series, list) or not series:
        issues.append(f"{where}.series: 1本以上の配列にしてください")
        return issues
    if len(series) > LIMITS["chart_series"]:
        issues.append(f"{where}.series: {len(series)}本は上限 {LIMITS['chart_series']} 本を超えています")
    for j, sr in enumerate(series):
        sw = f"{where}.series[{j}]"
        if not isinstance(sr, dict):
            issues.append(f"{sw}: オブジェクトにしてください")
            continue
        issues += _text_issues(f"{sw}.label", sr.get("label"), LIMITS["series_label"], required=True)
        data = sr.get("data")
        if not isinstance(data, list) or not data:
            issues.append(f"{sw}.data: 1件以上の数値配列にしてください")
            continue
        if n_labels and len(data) != n_labels:
            issues.append(f"{sw}.data: {len(data)}件ですが labels は {n_labels} 件です(同じ長さにしてください)")
        for k, v in enumerate(data):
            if v is None:
                continue
            if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
                issues.append(f"{sw}.data[{k}]: 数値か null にしてください")
                break
    return issues


def _charts_issues(charts: object) -> list[str]:
    if charts is None:
        return []
    if not isinstance(charts, list):
        return ["charts: 配列にしてください"]
    issues: list[str] = []
    if len(charts) > LIMITS["charts"]:
        issues.append(f"charts: {len(charts)}件は上限 {LIMITS['charts']} 件を超えています")
    ids: list[str] = []
    for j, chart in enumerate(charts):
        issues += _chart_issues(f"charts[{j}]", chart)
        if isinstance(chart, dict) and isinstance(chart.get("id"), str):
            ids.append(chart["id"])
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        issues.append(f"charts: id が重複しています: {', '.join(dup)}")
    return issues


def validate(report: object) -> list[str]:
    """レポート dict を検査し、問題点のリストを返す(空なら送信可)。"""
    if not isinstance(report, dict):
        return ["トップレベルはオブジェクトにしてください"]
    issues = _text_issues("generatedBy", report.get("generatedBy"), LIMITS["generatedBy"], required=True)
    issues += _text_issues("model", report.get("model"), LIMITS["model"], required=False)
    issues += _text_issues("title", report.get("title"), LIMITS["title"], required=False)
    issues += _text_issues("summary", report.get("summary"), LIMITS["summary"], required=True)
    issues += _key_findings_issues(report.get("keyFindings"))
    issues += _follow_up_issues(report.get("followUp"))
    issues += _needs_issues(report.get("needs"))
    issues += _charts_issues(report.get("charts"))

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
    print("OK 5節・要点サマリー・図表・上限・プレーンテキストの条件を満たしています。送信できます。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

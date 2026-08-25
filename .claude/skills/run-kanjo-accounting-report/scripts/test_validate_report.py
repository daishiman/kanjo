#!/usr/bin/env python3
# /// script
# name: test_validate_report
# version: 2.0.0
# purpose: validate-report.py の機能テスト(unittest・実データ非使用)
# inputs:
#   - なし(python3 -B -m unittest discover -s <scripts dir> -p 'test_*.py' で起動)
# outputs:
#   - stdout: unittest の結果
#   - exit: 0=全件OK / 1=失敗あり
# requires-python: ">=3.9"
# dependencies: []
# contexts: [E, C]
# network: false
# write-scope: none
# ///
"""validate-report.py の機能テスト(標準ライブラリ unittest)。

実行: python3 -B -m unittest discover -s skills/run-kanjo-accounting-report/scripts -p 'test_*.py'
ネットワーク・実データを一切使わない。
"""
from __future__ import annotations

import copy
import importlib.util
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("validate_report", HERE / "validate-report.py")
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MOD)

SECTIONS = ("spend", "change", "reduction", "split", "subscriptions")


def good_report() -> dict:
    return {
        "generatedBy": "claude-code",
        "model": "test-model",
        "title": "テスト期間の会計分析",
        "summary": "総評1行目。\n総評2行目。",
        "sections": [
            {
                "id": sid,
                "body": "本文。\n- 箇条書き",
                "items": [{"label": "科目A", "amount": 1000, "note": "備考", "priority": "high"}],
            }
            for sid in SECTIONS
        ],
        "keyFindings": {
            "improvements": [{"label": "外注費の増加", "amount": 120000, "note": "3ヶ月連続", "priority": "high"}],
            "wasted": [{"label": "重複サブスク", "amount": 6480, "priority": "mid"}],
            "quickWins": [{"label": "契約を1本化", "amount": 6480, "priority": "high"}],
        },
        "charts": [
            {
                "id": "exp",
                "kind": "bar",
                "title": "月別経費",
                "unit": "yen",
                "labels": ["2026-01", "2026-02"],
                "series": [{"label": "経費", "data": [1000, None]}],
            }
        ],
        "followUp": {"body": "前回指摘は解消。", "items": [{"label": "解消済み", "amount": None}]},
        "needs": [{"gap": "家賃が未仕分け", "action": "公私仕分けで家賃を個人にする", "screen": "classify"}],
        "dataGaps": ["前年同月のデータが未取込"],
    }


class ValidateTest(unittest.TestCase):
    def test_good_report_has_no_issues(self) -> None:
        self.assertEqual(MOD.validate(good_report()), [])

    def test_top_level_must_be_object(self) -> None:
        self.assertEqual(len(MOD.validate([])), 1)

    def test_missing_section_is_reported_with_name(self) -> None:
        r = good_report()
        r["sections"] = [s for s in r["sections"] if s["id"] != "split"]
        issues = MOD.validate(r)
        self.assertTrue(any("節が不足" in i and "split" in i for i in issues), issues)

    def test_duplicated_and_unknown_section(self) -> None:
        r = good_report()
        r["sections"].append(copy.deepcopy(r["sections"][0]))
        r["sections"].append({"id": "bonus", "body": "x"})
        issues = MOD.validate(r)
        self.assertTrue(any("重複" in i and "spend" in i for i in issues), issues)
        self.assertTrue(any("未定義" in i for i in issues), issues)

    def test_sections_must_be_list(self) -> None:
        r = good_report()
        r["sections"] = "x"
        issues = MOD.validate(r)
        self.assertTrue(any("sections: 配列" in i for i in issues), issues)
        self.assertTrue(any("節が不足" in i for i in issues), issues)

    def test_section_object_and_items_shape(self) -> None:
        r = good_report()
        r["sections"][0] = "text"
        r["sections"][1]["items"] = "no"
        r["sections"][2]["items"] = ["bad"]
        issues = MOD.validate(r)
        self.assertTrue(any("sections[0]: オブジェクト" in i for i in issues), issues)
        self.assertTrue(any("sections[1].items: 配列" in i for i in issues), issues)
        self.assertTrue(any("sections[2].items[0]: オブジェクト" in i for i in issues), issues)

    def test_plain_text_rules(self) -> None:
        r = good_report()
        r["summary"] = "<b>太字</b>"
        r["sections"][0]["body"] = "## 見出し\n本文"
        r["sections"][1]["body"] = "| a | b |"
        r["sections"][2]["body"] = "制御\x01文字"
        issues = MOD.validate(r)
        self.assertTrue(any("HTMLタグ" in i for i in issues), issues)
        self.assertEqual(sum("Markdown" in i for i in issues), 2, issues)
        self.assertTrue(any("制御文字" in i for i in issues), issues)

    def test_length_and_count_limits(self) -> None:
        r = good_report()
        r["summary"] = "あ" * 3001
        r["sections"][0]["items"] = [{"label": "x"}] * 61
        r["dataGaps"] = ["g"] * 41
        issues = MOD.validate(r)
        self.assertTrue(any("summary" in i and "上限 3000" in i for i in issues), issues)
        self.assertTrue(any("items: 61件" in i for i in issues), issues)
        self.assertTrue(any("dataGaps: 41件" in i for i in issues), issues)

    def test_required_and_type_checks(self) -> None:
        r = good_report()
        r["generatedBy"] = "   "
        r["summary"] = 12
        del r["sections"][0]["body"]
        r["sections"][1]["items"][0]["label"] = ""
        r["dataGaps"] = "not-a-list"
        issues = MOD.validate(r)
        self.assertTrue(any("generatedBy: 空" in i for i in issues), issues)
        self.assertTrue(any("summary: 文字列" in i for i in issues), issues)
        self.assertTrue(any("sections[0].body: 必須" in i for i in issues), issues)
        self.assertTrue(any("items[0].label: 空" in i for i in issues), issues)
        self.assertTrue(any("dataGaps: 配列" in i for i in issues), issues)

    def test_item_amount_and_priority(self) -> None:
        r = good_report()
        r["sections"][0]["items"] = [
            {"label": "a", "amount": 12.5},
            {"label": "b", "amount": True},
            {"label": "c", "amount": None, "priority": "urgent"},
            {"label": "d", "amount": -300, "priority": None},
        ]
        issues = MOD.validate(r)
        self.assertEqual(sum("amount" in i for i in issues), 2, issues)
        self.assertEqual(sum("priority" in i for i in issues), 1, issues)

    def test_data_gap_entries_are_checked(self) -> None:
        r = good_report()
        r["dataGaps"] = ["", "<i>x</i>"]
        issues = MOD.validate(r)
        self.assertTrue(any("dataGaps[0]: 空" in i for i in issues), issues)
        self.assertTrue(any("dataGaps[1]" in i and "HTML" in i for i in issues), issues)


    # --- 第2版の追加項目 ---
    def test_v1_report_without_new_fields_is_still_valid(self) -> None:
        r = good_report()
        for key in ("keyFindings", "charts", "followUp", "needs"):
            del r[key]
        self.assertEqual(MOD.validate(r), [])

    def test_key_findings_shape(self) -> None:
        r = good_report()
        r["keyFindings"] = []
        self.assertTrue(any("keyFindings: オブジェクト" in i for i in MOD.validate(r)))
        r = good_report()
        r["keyFindings"]["bogus"] = []
        self.assertTrue(any("keyFindings.bogus" in i for i in MOD.validate(r)))
        r = good_report()
        r["keyFindings"]["wasted"] = [{"label": "x", "priority": "urgent"}]
        self.assertTrue(any("keyFindings.wasted[0].priority" in i for i in MOD.validate(r)))
        r = good_report()
        r["keyFindings"]["quickWins"] = [{"label": "x"}] * 11
        self.assertTrue(any("keyFindings.quickWins: 11件" in i for i in MOD.validate(r)))

    def test_follow_up_shape(self) -> None:
        r = good_report()
        r["followUp"] = None
        self.assertEqual(MOD.validate(r), [])
        r["followUp"] = "text"
        self.assertTrue(any("followUp: オブジェクト" in i for i in MOD.validate(r)))
        r["followUp"] = {"items": []}
        self.assertTrue(any("followUp.body: 必須" in i for i in MOD.validate(r)))
        r["followUp"] = {"body": "ok", "items": [{"label": ""}]}
        self.assertTrue(any("followUp.items[0].label" in i for i in MOD.validate(r)))

    def test_needs_shape_and_screen(self) -> None:
        r = good_report()
        r["needs"] = {}
        self.assertTrue(any("needs: 配列" in i for i in MOD.validate(r)))
        r["needs"] = ["x"]
        self.assertTrue(any("needs[0]: オブジェクト" in i for i in MOD.validate(r)))
        r["needs"] = [{"gap": "g", "action": "a", "screen": "nowhere"}]
        self.assertTrue(any("needs[0].screen" in i and "未定義" in i for i in MOD.validate(r)))
        r["needs"] = [{"gap": "g", "action": "a", "screen": None}]
        self.assertEqual(MOD.validate(r), [])
        r["needs"] = [{"gap": "g", "action": "a", "screen": 3}]
        self.assertTrue(any("needs[0].screen" in i for i in MOD.validate(r)))
        r["needs"] = [{"gap": "", "action": None}]
        issues = MOD.validate(r)
        self.assertTrue(any("needs[0].gap: 空" in i for i in issues))
        self.assertTrue(any("needs[0].action: 必須" in i for i in issues))
        r["needs"] = [{"gap": "g", "action": "a"}] * 31
        self.assertTrue(any("needs: 31件" in i for i in MOD.validate(r)))

    def test_chart_shape(self) -> None:
        r = good_report()
        r["charts"] = {}
        self.assertTrue(any("charts: 配列" in i for i in MOD.validate(r)))
        r["charts"] = ["x"]
        self.assertTrue(any("charts[0]: オブジェクト" in i for i in MOD.validate(r)))

        def chart(**over: object) -> dict:
            base = copy.deepcopy(good_report()["charts"][0])
            base.update(over)
            return base

        r["charts"] = [chart(kind="pie")]
        self.assertTrue(any("charts[0].kind" in i for i in MOD.validate(r)))
        r["charts"] = [chart(unit="usd")]
        self.assertTrue(any("charts[0].unit" in i for i in MOD.validate(r)))
        r["charts"] = [chart(labels=[])]
        self.assertTrue(any("charts[0].labels: 1件以上" in i for i in MOD.validate(r)))
        r["charts"] = [chart(labels=["a"] * 73)]
        self.assertTrue(any("charts[0].labels: 73件" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=[])]
        self.assertTrue(any("charts[0].series: 1本以上" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=[{"label": "s", "data": [1, 2]}] * 9)]
        self.assertTrue(any("charts[0].series: 9本" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=["x"])]
        self.assertTrue(any("charts[0].series[0]: オブジェクト" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=[{"label": "s", "data": [1, 2, 3]}])]
        self.assertTrue(any("同じ長さ" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=[{"label": "s", "data": []}])]
        self.assertTrue(any("series[0].data: 1件以上" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=[{"label": "s", "data": [1, "2"]}])]
        self.assertTrue(any("series[0].data[1]" in i for i in MOD.validate(r)))
        r["charts"] = [chart(series=[{"label": "s", "data": [True, 1]}])]
        self.assertTrue(any("series[0].data[0]" in i for i in MOD.validate(r)))
        r["charts"] = [chart(id="dup"), chart(id="dup")]
        self.assertTrue(any("id が重複" in i for i in MOD.validate(r)))
        r["charts"] = [chart(id=f"c{i}") for i in range(7)]
        self.assertTrue(any("charts: 7件" in i for i in MOD.validate(r)))
        c = chart(series=[{"label": "s", "data": [1.5, 2]}])
        c.pop("unit")
        r["charts"] = [c]
        self.assertEqual(MOD.validate(r), [])


class MainTest(unittest.TestCase):
    def _run(self, payload: object) -> tuple[int, str]:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "report.json"
            path.write_text(payload if isinstance(payload, str) else json.dumps(payload), encoding="utf-8")
            buf = io.StringIO()
            with redirect_stdout(buf):
                code = MOD.main([str(path)])
        return code, buf.getvalue()

    def test_exit_0_for_valid(self) -> None:
        code, out = self._run(good_report())
        self.assertEqual(code, 0)
        self.assertIn("OK", out)

    def test_exit_1_for_invalid(self) -> None:
        r = good_report()
        r["sections"].pop()
        code, out = self._run(r)
        self.assertEqual(code, 1)
        self.assertIn("NG", out)
        self.assertIn("修正が必要", out)

    def test_exit_2_for_broken_json(self) -> None:
        code, out = self._run("{not json")
        self.assertEqual(code, 2)
        self.assertIn("読めません", out)

    def test_exit_2_for_missing_file(self) -> None:
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = MOD.main(["/nonexistent/kanjo-report.json"])
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()

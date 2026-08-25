#!/usr/bin/env python3
# /// script
# name: test_validate_report
# version: 3.0.0
# purpose: validate-report.py(第3版)の機能テスト(unittest・実データ非使用)
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
ネットワーク・実データを一切使わない。図表カタログは references/chart-catalog.json(生成物)を読む。
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
BODY = "本文の説明です。この節では対象期間の経費の内訳と、前月・前年からの変化を数値の根拠つきで述べます。" * 2
SUMMARY = "対象期間の経費は前月比で増加しました。図2が示すとおり外注費の比率が最も大きく、次いで家賃です。詳細は各節を参照してください。"


def finding(**over: object) -> dict:
    base = {
        "label": "外注費の増加",
        "fact": "外注費が3ヶ月連続で増加し、直近月は120,000円でした",
        "basis": "直近3ヶ月の外注費合計 ÷ 3 との比較",
        "interpretation": "案件の外部依存が高まっており、固定費化しつつあります",
        "action": "外注先を1社に集約して単価交渉を行う",
        "expectedEffect": 20000,
        "amount": 120000,
        "priority": "high",
        "chart": "composition",
    }
    base.update(over)
    return base


def good_report() -> dict:
    return {
        "generatedBy": "claude-code",
        "model": "test-model",
        "title": "テスト期間の会計分析",
        "summary": SUMMARY,
        "sections": [
            {
                "id": sid,
                "body": BODY,
                "items": [{"label": f"科目{i}", "amount": 1000 * (i + 1), "note": "備考", "priority": "high"} for i in range(3)],
                "gap": None,
            }
            for sid in SECTIONS
        ],
        "keyFindings": {
            "improvements": [finding()],
            "wasted": [finding(label="重複サブスク", amount=6480, chart="subs_vendor")],
            "quickWins": [finding(label="契約を1本化", amount=6480, chart=None)],
            "notes": {"improvements": "", "wasted": "", "quickWins": ""},
        },
        "charts": [{"catalogId": "composition", "caption": "外注費が全体の4割を占め、家賃と合わせて7割に達しています"}],
        "followUp": {"body": "前回指摘は解消。", "items": [{"label": "解消済み", "amount": None}]},
        "needs": [{"gap": "家賃が未仕分け", "action": "公私仕分けで家賃を個人にする", "screen": "classify"}],
        "dataGaps": ["前年同月のデータが未取込"],
    }


def good_data(available_figures: tuple[int, ...] = (2,)) -> dict:
    """GET /api/ai/data の charts 部分だけを模した最小データ"""
    catalog = MOD.load_catalog(None)
    charts = []
    for c in catalog.get("charts", []):
        charts.append({"id": c["id"], "figure": c["figure"], "available": c["figure"] in available_figures})
    return {"charts": charts}


class CatalogTest(unittest.TestCase):
    def test_catalog_is_loaded_from_references(self) -> None:
        catalog = MOD.load_catalog(None)
        ids = {c["id"] for c in catalog["charts"]}
        self.assertIn("composition", ids)
        self.assertEqual(len(ids), 8)

    def test_missing_catalog_returns_empty(self) -> None:
        self.assertEqual(MOD.load_catalog(Path("/nonexistent/catalog.json")), {})


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
        r["sections"].append({"id": "bonus", "body": BODY})
        issues = MOD.validate(r)
        self.assertTrue(any("重複" in i and "spend" in i for i in issues), issues)
        self.assertTrue(any("未定義" in i for i in issues), issues)

    def test_section_min_items_or_gap(self) -> None:
        r = good_report()
        r["sections"][0]["items"] = [{"label": "a"}]  # spend は3行必要
        issues = MOD.validate(r)
        self.assertTrue(any("sections[0](spend): items が3行以上" in i for i in issues), issues)
        r["sections"][0]["gap"] = "対象期間が1ヶ月のため内訳が3件に満たない"
        self.assertEqual(MOD.validate(r), [])
        r["sections"][0]["gap"] = "短い"
        self.assertTrue(any("items が3行以上" in i for i in MOD.validate(r)))
        r = good_report()
        r["sections"][1]["items"] = []  # change は1行
        self.assertTrue(any("(change): items が1行以上" in i for i in MOD.validate(r)))

    def test_text_minimums(self) -> None:
        r = good_report()
        r["summary"] = "短い総評"
        r["sections"][0]["body"] = "短い本文"
        issues = MOD.validate(r)
        self.assertTrue(any("summary" in i and "下限 60" in i for i in issues), issues)
        self.assertTrue(any("sections[0].body" in i and "下限 80" in i for i in issues), issues)

    def test_plain_text_rules(self) -> None:
        r = good_report()
        r["summary"] = "<b>太字</b>" + SUMMARY
        r["sections"][0]["body"] = "## 見出し\n" + BODY
        r["sections"][1]["body"] = "| a | b |" + BODY
        r["sections"][2]["body"] = "制御\x01文字" + BODY
        issues = MOD.validate(r)
        self.assertTrue(any("HTMLタグ" in i for i in issues), issues)
        self.assertEqual(sum("Markdown" in i for i in issues), 2, issues)
        self.assertTrue(any("制御文字" in i for i in issues), issues)

    def test_length_and_count_limits(self) -> None:
        r = good_report()
        r["summary"] = "あ" * 1201
        r["sections"][0]["items"] = [{"label": "x"}] * 61
        r["dataGaps"] = ["g"] * 41
        issues = MOD.validate(r)
        self.assertTrue(any("summary" in i and "上限 1200" in i for i in issues), issues)
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

    # --- 第3版: 要点3段 ---
    def test_key_findings_required(self) -> None:
        r = good_report()
        del r["keyFindings"]
        self.assertTrue(any("keyFindings: 必須" in i for i in MOD.validate(r)))
        r["keyFindings"] = []
        self.assertTrue(any("keyFindings: オブジェクト" in i for i in MOD.validate(r)))

    def test_finding_three_steps_required(self) -> None:
        r = good_report()
        r["keyFindings"]["improvements"] = [{"label": "x", "amount": 100}]
        issues = MOD.validate(r)
        for field in ("fact", "basis", "interpretation", "action"):
            self.assertTrue(any(f"improvements[0].{field}: 必須" in i for i in issues), (field, issues))
        r = good_report()
        r["keyFindings"]["improvements"] = [finding(fact="外注費が増え続けており見直しが必要である")]
        issues = MOD.validate(r)
        self.assertTrue(any("improvements[0].fact" in i and "数値" in i for i in issues), issues)
        r = good_report()
        r["summary"] = r["summary"].replace("図2", "図 ２")
        self.assertEqual(MOD.validate(r), [], "空白・全角数字の図参照も拾う")
        r = good_report()
        r["keyFindings"]["improvements"] = [finding(fact="短い", interpretation="短い解釈")]
        issues = MOD.validate(r)
        self.assertTrue(any("improvements[0].fact" in i and "下限 10" in i for i in issues), issues)
        self.assertTrue(any("improvements[0].interpretation" in i and "下限 10" in i for i in issues), issues)

    def test_finding_effect_chart_priority(self) -> None:
        r = good_report()
        r["keyFindings"]["wasted"] = [finding(expectedEffect=1.5, chart="pie_chart", priority="urgent")]
        issues = MOD.validate(r)
        self.assertTrue(any("wasted[0].expectedEffect" in i for i in issues), issues)
        self.assertTrue(any("wasted[0].chart" in i and "カタログにありません" in i for i in issues), issues)
        self.assertTrue(any("wasted[0].priority" in i for i in issues), issues)

    def test_empty_category_needs_note(self) -> None:
        r = good_report()
        r["keyFindings"]["wasted"] = []
        issues = MOD.validate(r)
        self.assertTrue(any("keyFindings.wasted が空" in i for i in issues), issues)
        r["keyFindings"]["notes"]["wasted"] = "対象期間に重複契約や未使用サービスは見つかりませんでした"
        self.assertEqual(MOD.validate(r), [])
        r["keyFindings"]["bogus"] = []
        self.assertTrue(any("keyFindings.bogus" in i for i in MOD.validate(r)))

    def test_follow_up_shape(self) -> None:
        r = good_report()
        r["followUp"] = None
        self.assertEqual(MOD.validate(r), [])
        r["followUp"] = "text"
        self.assertTrue(any("followUp: オブジェクト" in i for i in MOD.validate(r)))
        r["followUp"] = {"items": []}
        self.assertTrue(any("followUp.body: 必須" in i for i in MOD.validate(r)))

    def test_needs_shape_and_screen(self) -> None:
        r = good_report()
        r["needs"] = [{"gap": "g", "action": "a", "screen": "nowhere"}]
        self.assertTrue(any("needs[0].screen" in i and "未定義" in i for i in MOD.validate(r)))
        r["needs"] = [{"gap": "g", "action": "a", "screen": None}]
        self.assertEqual(MOD.validate(r), [])
        r["needs"] = [{"gap": "g", "action": "a"}] * 31
        self.assertTrue(any("needs: 31件" in i for i in MOD.validate(r)))

    # --- 第3版: 図表はカタログ参照だけ ---
    def test_chart_refs(self) -> None:
        r = good_report()
        r["charts"] = {}
        self.assertTrue(any("charts: 配列" in i for i in MOD.validate(r)))
        r["charts"] = ["x"]
        self.assertTrue(any("charts[0]: オブジェクト" in i for i in MOD.validate(r)))
        r["charts"] = [{"catalogId": "pie_chart", "caption": "カタログにない図を指定したケースです"}]
        self.assertTrue(any("charts[0].catalogId" in i and "カタログにありません" in i for i in MOD.validate(r)))
        r["charts"] = [{"catalogId": "composition", "caption": "x", "labels": ["a"], "series": [{"data": [1]}]}]
        issues = MOD.validate(r)
        self.assertTrue(any("charts[0].labels" in i and "数値" in i for i in issues), issues)
        self.assertTrue(any("charts[0].series" in i for i in issues), issues)
        r["charts"] = [{"catalogId": "composition", "caption": "同じ図を2回指定したケースです"}] * 2
        self.assertTrue(any("catalogId が重複" in i for i in MOD.validate(r)))
        r["charts"] = [{"catalogId": "composition", "caption": "あ" * 401}]
        self.assertTrue(any("charts[0].caption" in i and "上限 400" in i for i in MOD.validate(r)))
        r["charts"] = [{"catalogId": f"c{i}", "caption": "x"} for i in range(9)]
        self.assertTrue(any("charts: 9件" in i for i in MOD.validate(r)))
        r["charts"] = None
        self.assertEqual(MOD.validate(r), [])

    def test_availability_with_data(self) -> None:
        r = good_report()
        self.assertEqual(MOD.validate(r, data=good_data((2,))), [])
        # 図1 も出せるのに caption も参照も無い
        issues = MOD.validate(r, data=good_data((1, 2)))
        self.assertTrue(any("図1(trend_ma)は出せる図" in i for i in issues), issues)
        self.assertTrue(any("図1(trend_ma)が summary" in i for i in issues), issues)
        # 図2 が出せないのに本文が参照
        issues = MOD.validate(r, data=good_data(()))
        self.assertTrue(any("「図2」を参照していますが" in i for i in issues), issues)
        # caption が短い
        r["charts"][0]["caption"] = "短い読み解き"
        issues = MOD.validate(r, data=good_data((2,)))
        self.assertTrue(any("caption を15字以上" in i for i in issues), issues)
        # data に charts が無い
        self.assertTrue(any("--data: charts" in i for i in MOD.validate(good_report(), data={})))


class MainTest(unittest.TestCase):
    def _run(self, payload: object, data: object = None) -> tuple[int, str]:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "report.json"
            path.write_text(payload if isinstance(payload, str) else json.dumps(payload), encoding="utf-8")
            argv = [str(path)]
            if data is not None:
                dpath = Path(tmp) / "data.json"
                dpath.write_text(json.dumps(data), encoding="utf-8")
                argv += ["--data", str(dpath)]
            buf = io.StringIO()
            with redirect_stdout(buf):
                code = MOD.main(argv)
        return code, buf.getvalue()

    def test_exit_0_for_valid(self) -> None:
        code, out = self._run(good_report())
        self.assertEqual(code, 0)
        self.assertIn("OK", out)

    def test_exit_0_with_data(self) -> None:
        code, out = self._run(good_report(), good_data((2,)))
        self.assertEqual(code, 0, out)

    def test_exit_1_for_invalid(self) -> None:
        r = good_report()
        r["sections"].pop()
        code, out = self._run(r)
        self.assertEqual(code, 1)
        self.assertIn("NG", out)
        self.assertIn("修正が必要", out)

    def test_exit_1_with_data_mismatch(self) -> None:
        code, out = self._run(good_report(), good_data(()))
        self.assertEqual(code, 1)
        self.assertIn("図2", out)

    def test_exit_2_for_broken_json(self) -> None:
        code, out = self._run("{not json")
        self.assertEqual(code, 2)
        self.assertIn("読めません", out)

    def test_exit_2_for_non_object_data(self) -> None:
        code, out = self._run(good_report(), [1])
        self.assertEqual(code, 2)

    def test_exit_2_for_missing_file(self) -> None:
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = MOD.main(["/nonexistent/kanjo-report.json"])
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()

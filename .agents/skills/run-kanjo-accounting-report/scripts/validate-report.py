#!/usr/bin/env python3
# /// script
# name: validate-report
# version: 4.0.0
# purpose: kanjo 会計分析レポートJSON(第4版)を送信前に検査する(5節・図表・背景仮説と外部出典の分離)
# inputs:
#   - argv[1]: 検査するレポートJSONのパス
#   - --data <path>: GET /api/ai/data の保存JSON(任意)。渡すと図の available と本文の「図N」参照を照合する
#   - --catalog <path>: 図表カタログJSON(既定: ../references/chart-catalog.json)
# outputs:
#   - stdout: OK 1行 / NG 行の一覧
#   - exit: 0=送信可 / 1=修正が必要 / 2=ファイル・JSONが読めない
# requires-python: ">=3.9"
# dependencies: []
# contexts: [E, C]
# network: false
# write-scope: none
# ///
"""送信前にレポートJSON(第4版)の形を検査する(標準ライブラリのみ)。

- 5節 (spend / change / reduction / split / subscriptions) が全て揃い、節ごとの最低行数(items)を満たすこと。
  満たせないときは gap にデータ不足の理由(10字以上)があること
- summary / body / caption の文字数が下限〜上限内であること(短すぎ=分析していない、長すぎ=読めない)
- 要点(keyFindings)の各項目が fact / basis / interpretation / action の4欄を持つこと。0件の区分には notes に理由があること
- 本文がプレーンテキストであること(HTMLタグ・Markdown見出し・表記号を含まない)
- charts は {catalogId, caption} だけ(数値は送らない)。catalogId は references/chart-catalog.json にある id のみ
- --data で GET /api/ai/data の保存JSONを渡すと、出せる図(available=true)に caption と本文の「図N」参照があるか、
  出せない図を本文が参照していないかまで照合する(アプリ側の保存時検査と同じ規則)

exit 0 = 送信可。exit 1 = 修正が必要(理由を1行ずつ標準出力へ)。exit 2 = ファイル/JSON が読めない。
正本: packages/api/src/ai/contract.ts (reportInputSchema / normalizeReport)。カタログの正本は catalog.ts → pnpm catalog:export。
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
QUESTION_TYPES = {"distribution", "comparison", "relationship", "decomposition", "trend", "concentration", "anomaly"}
EVIDENCE_LEVELS = {"data_confirmed", "published_source", "assumption"}
EVIDENCE_LEVELS.add("user_reported")
CONFIDENCES = {"low", "medium", "high"}
DEFAULT_CATALOG = Path(__file__).resolve().parent.parent / "references" / "chart-catalog.json"
_ZEN2HAN = str.maketrans("０１２３４５６７８９", "0123456789")
FIGURE_RE = re.compile(r"図\s*([0-9０-９]+)")  # アプリ側(contract.ts)と同じ: 空白・全角数字も拾う
# 下限・最低行数の既定値(chart-catalog.json があればそちらで上書き。contract.ts と同じ値)
TEXT_MIN = {"summary": 60, "body": 80, "gap": 10, "caption": 15}
SECTION_MIN_ITEMS = {"spend": 3, "change": 1, "reduction": 2, "split": 2, "subscriptions": 1}
LIMITS = {
    "generatedBy": 60,
    "model": 120,
    "title": 120,
    "summary": 1200,
    "section_title": 120,
    "body": 6000,
    "gap": 400,
    "finding_fact": 600,
    "finding_basis": 400,
    "finding_interpretation": 800,
    "finding_action": 600,
    "finding_note": 400,
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
    # カタログの図の枚数(chart-catalog.json があればそこから上書きする)
    "charts": 10,
    "chart_id": 40,
    "caption": 400,
}
HTML_TAG_RE = re.compile(r"<\s*/?[a-zA-Z][^>]*>")
MARKDOWN_LINE_RE = re.compile(r"^\s*(#{1,6}\s|\|.*\||```)")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# 本文の書き方(正本は references/report-schema.md「本文の書き方」)。
# 画面(ReportText)は「- 」で始まる行だけを箇条書きとして描く。「・」「*」「1.」を
# 混ぜるとレポートごとに体裁がぶれ、同じ指示から同じ見た目が再現できないので、
# 記法を1つに固定し、ここで機械的に落とす。
BULLET_RE = re.compile(r"^-\s+\S")
BAD_BULLET_RE = re.compile(r"^\s*(?:[・*•‧]|[0-9０-９]+\s*[.)、]|[(（][0-9０-９]+[)）])\s*\S")
BULLET_MAX = 120  # 箇条書き1行の上限字数。これを超えるなら段落で書く
# 本文ごとの最低箇条書き行数(0 = 箇条書き不要)。要点(keyFindings)の4欄は1文で完結
# させる欄なので対象外。
BULLET_MIN = {"summary": 3, "body": 2, "followUp_body": 2}


def _bullet_issues(where: str, value: str, need: int) -> list[str]:
    """本文の箇条書き規約を検査する。

    毎回同じ見た目を再現するための3点だけを見る:
      1. 記法は「- 」だけ(「・」「*」「1.」は画面が箇条書きとして描かない)
      2. 箇条書きを `need` 行以上入れる(長い地の文だけにしない)
      3. 箇条書き1行は BULLET_MAX 字以内(長い1行は箇条書きの利点を消す)
    さらに、箇条書きだけで地の文が無い本文は文脈が落ちるので、リード文を1行求める。
    """
    issues: list[str] = []
    lines = [ln.strip() for ln in value.splitlines() if ln.strip()]
    bullets = [ln for ln in lines if BULLET_RE.match(ln)]
    for ln in lines:
        if not BULLET_RE.match(ln) and BAD_BULLET_RE.match(ln):
            issues.append(f"{where}: 箇条書きは行頭「- 」に統一してください(「・」「*」「1.」は不可): {ln[:30]!r}")
            break
    if need and len(bullets) < need:
        issues.append(
            f"{where}: 箇条書き(行頭「- 」)が{len(bullets)}行です。{need}行以上に分けてください"
            "(地の文だけの長い段落は読み手が要点を拾えません)"
        )
    for ln in bullets:
        body = ln[1:].strip()
        if len(body) > BULLET_MAX:
            issues.append(f"{where}: 箇条書き1行が{len(body)}字です。{BULLET_MAX}字以内に切るか段落へ移してください: {body[:30]!r}")
            break
    if need and bullets and len(bullets) == len(lines):
        issues.append(f"{where}: 箇条書きだけです。先頭に結論を述べるリード文を1〜2文入れてください")
    return issues


def _text_issues(
    where: str, value: object, limit: int, *, required: bool, minimum: int = 0, bullets: int = 0
) -> list[str]:
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
    elif minimum and len(value.strip()) < minimum:
        issues.append(f"{where}: {len(value.strip())}字は下限 {minimum} 字に足りません(分析の内容を書いてください)")
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
    if value.strip():
        issues += _bullet_issues(where, value, bullets)
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


def _finding_issues(where: str, item: object) -> list[str]:
    """要点1件 = 事実(fact+basis) → 解釈(interpretation) → 次のアクション(action)。4欄すべて必須"""
    if not isinstance(item, dict):
        return [f"{where}: オブジェクトにしてください"]
    issues = _text_issues(f"{where}.label", item.get("label"), LIMITS["item_label"], required=True)
    issues += _text_issues(f"{where}.fact", item.get("fact"), LIMITS["finding_fact"], required=True, minimum=10)
    fact = item.get("fact")
    if isinstance(fact, str) and fact.strip() and not re.search(r"[0-9０-９]", fact):
        issues.append(f"{where}.fact: 数値が入っていません(金額・比率・月数など、取得データにある数字で事実を書いてください)")
    issues += _text_issues(f"{where}.basis", item.get("basis"), LIMITS["finding_basis"], required=True, minimum=5)
    for key in ("fact", "basis"):
        value = item.get(key)
        if isinstance(value, str) and re.search(r"https?://", value):
            issues.append(
                f"{where}.{key}: 外部URLを会計金額の根拠に混ぜないでください(contextAnalysis.externalEvidence へ分離)"
            )
    issues += _text_issues(
        f"{where}.interpretation", item.get("interpretation"), LIMITS["finding_interpretation"], required=True, minimum=10
    )
    issues += _text_issues(f"{where}.action", item.get("action"), LIMITS["finding_action"], required=True, minimum=5)
    for key in ("amount", "expectedEffect"):
        v = item.get(key)
        if v is not None and (isinstance(v, bool) or not isinstance(v, int)):
            issues.append(f"{where}.{key}: 円の整数か null にしてください(小数・文字列は不可)")
    priority = item.get("priority")
    if priority is not None and priority not in PRIORITIES:
        issues.append(f"{where}.priority: high / mid / low / null のいずれかにしてください")
    chart = item.get("chart")
    if chart is not None and (not isinstance(chart, str) or len(chart) > LIMITS["chart_id"]):
        issues.append(f"{where}.chart: 図表カタログの id 文字列か null にしてください")
    return issues


def _key_findings_issues(kf: object, catalog_ids: set[str]) -> list[str]:
    if kf is None:
        return ["keyFindings: 必須です(improvements / wasted / quickWins と notes)"]
    if not isinstance(kf, dict):
        return ["keyFindings: オブジェクトにしてください"]
    issues: list[str] = []
    for key in kf:
        if key not in FINDING_KEYS and key != "notes":
            issues.append(f"keyFindings.{key}: 未定義です(使えるキー: {', '.join(FINDING_KEYS)}, notes)")
    notes = kf.get("notes")
    if notes is not None and not isinstance(notes, dict):
        issues.append("keyFindings.notes: オブジェクトにしてください")
        notes = None
    for key in FINDING_KEYS:
        items = kf.get(key)
        if items is None:
            items = []
        if not isinstance(items, list):
            issues.append(f"keyFindings.{key}: 配列にしてください")
            continue
        if len(items) > LIMITS["finding_items"]:
            issues.append(f"keyFindings.{key}: {len(items)}件は上限 {LIMITS['finding_items']} 件を超えています")
        for j, item in enumerate(items):
            issues += _finding_issues(f"keyFindings.{key}[{j}]", item)
            if isinstance(item, dict) and isinstance(item.get("chart"), str) and catalog_ids and item["chart"] not in catalog_ids:
                issues.append(f"keyFindings.{key}[{j}].chart: {item['chart']!r} は図表カタログにありません")
        note = notes.get(key) if isinstance(notes, dict) else None
        issues += _text_issues(f"keyFindings.notes.{key}", note, LIMITS["finding_note"], required=False)
        if len(items) == 0 and (not isinstance(note, str) or len(note.strip()) < 10):
            issues.append(
                f"keyFindings.{key} が空です。該当なしなら keyFindings.notes.{key} に理由を10字以上で書いてください"
            )
    return issues


def _follow_up_issues(fu: object) -> list[str]:
    if fu is None:
        return []
    if not isinstance(fu, dict):
        return ["followUp: オブジェクトか null にしてください"]
    issues = _text_issues(
        "followUp.body", fu.get("body"), LIMITS["followUp_body"], required=True, bullets=BULLET_MIN["followUp_body"]
    )
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


def _context_analysis_issues(context: object) -> list[str]:
    """第4版の背景分析を fail-closed で検査する。

    会計数値の事実と外部情報は、形の段階で別フィールドにする。
    因果は断定せず、背景→作用経路→観測指標と反証条件を必須にする。
    """
    if context is None:
        return ["contextAnalysis: 第4版では必須です(外部調査OFFでも問いと仮説を分離して記録)"]
    if not isinstance(context, dict):
        return ["contextAnalysis: オブジェクトにしてください"]
    issues: list[str] = []
    external_research = context.get("externalResearch")
    if external_research not in {"off", "used"}:
        issues.append("contextAnalysis.externalResearch: off / used のどちらかにしてください")
    if context.get("questionType") not in QUESTION_TYPES:
        issues.append("contextAnalysis.questionType: 7種の問いの型から選んでください")
    question = context.get("question")
    if not isinstance(question, dict):
        issues.append("contextAnalysis.question: オブジェクトにしてください")
    else:
        for field, limit in (("decision", 500), ("metric", 300), ("comparison", 500), ("range", 200)):
            issues += _text_issues(f"contextAnalysis.question.{field}", question.get(field), limit, required=True)

    facts = context.get("interviewFacts", [])
    interview_ids: set[str] = set()
    if not isinstance(facts, list):
        issues.append("contextAnalysis.interviewFacts: 配列にしてください")
    else:
        if len(facts) > 20:
            issues.append("contextAnalysis.interviewFacts: 20件以下にしてください")
        for index, fact in enumerate(facts):
            where = f"contextAnalysis.interviewFacts[{index}]"
            if not isinstance(fact, dict):
                issues.append(f"{where}: オブジェクトにしてください")
                continue
            fact_id = fact.get("id")
            if not isinstance(fact_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,39}", fact_id):
                issues.append(f"{where}.id: 小文字英数・_ ・- の40字以下にしてください")
            elif fact_id in interview_ids:
                issues.append(f"{where}.id: {fact_id!r} が重複しています")
            else:
                interview_ids.add(fact_id)
            if fact.get("source") != "user_reported":
                issues.append(f"{where}.source: user_reported にしてください")
            issues += _text_issues(f"{where}.question", fact.get("question"), 300, required=True)
            issues += _text_issues(f"{where}.answer", fact.get("answer"), 1200, required=True)

    statistical_facts = context.get("statisticalFacts")
    fact_ids: set[str] = set()
    if not isinstance(statistical_facts, list):
        issues.append("contextAnalysis.statisticalFacts: 配列にしてください")
        statistical_facts = []
    for index, fact in enumerate(statistical_facts):
        where = f"contextAnalysis.statisticalFacts[{index}]"
        if not isinstance(fact, dict):
            issues.append(f"{where}: オブジェクトにしてください")
            continue
        fact_id = fact.get("id")
        if not isinstance(fact_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,39}", fact_id):
            issues.append(f"{where}.id: 小文字英数・_ ・- の40字以下にしてください")
        elif fact_id in fact_ids:
            issues.append(f"{where}.id: {fact_id!r} が重複しています")
        else:
            fact_ids.add(fact_id)
        issues += _text_issues(f"{where}.statement", fact.get("statement"), 1000, required=True, minimum=10)
        issues += _text_issues(f"{where}.basis", fact.get("basis"), 800, required=True, minimum=5)
        refs = fact.get("evidenceRefs")
        if not isinstance(refs, list) or not refs or any(not isinstance(ref, str) or not ref.strip() for ref in refs):
            issues.append(f"{where}.evidenceRefs: 取得JSONの根拠名を1件以上記録してください")

    interpretations = context.get("interpretations")
    if not isinstance(interpretations, list):
        issues.append("contextAnalysis.interpretations: 配列にしてください")
        interpretations = []
    for index, interpretation in enumerate(interpretations):
        where = f"contextAnalysis.interpretations[{index}]"
        if not isinstance(interpretation, dict):
            issues.append(f"{where}: オブジェクトにしてください")
            continue
        issues += _text_issues(f"{where}.statement", interpretation.get("statement"), 1000, required=True, minimum=10)
        issues += _text_issues(f"{where}.limitation", interpretation.get("limitation"), 800, required=True, minimum=5)
        refs = interpretation.get("factRefs")
        if not isinstance(refs, list) or not refs or any(ref not in fact_ids for ref in refs):
            issues.append(f"{where}.factRefs: statisticalFacts.id を1件以上参照してください")

    evidence = context.get("externalEvidence", [])
    source_ids: set[str] = set()
    if not isinstance(evidence, list):
        issues.append("contextAnalysis.externalEvidence: 配列にしてください")
        evidence = []
    else:
        if len(evidence) > 20:
            issues.append("contextAnalysis.externalEvidence: 20件以下にしてください")
        for index, source in enumerate(evidence):
            where = f"contextAnalysis.externalEvidence[{index}]"
            if not isinstance(source, dict):
                issues.append(f"{where}: オブジェクトにしてください")
                continue
            source_id = source.get("id")
            if not isinstance(source_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,39}", source_id):
                issues.append(f"{where}.id: 小文字英数・_ ・- の40字以下にしてください")
            elif source_id in source_ids:
                issues.append(f"{where}.id: {source_id!r} が重複しています")
            else:
                source_ids.add(source_id)
            issues += _text_issues(f"{where}.title", source.get("title"), 300, required=True)
            url = source.get("url")
            if not isinstance(url, str) or not re.fullmatch(r"https?://[^\s]+", url):
                issues.append(f"{where}.url: http(s) URL を記録してください")
            accessed = source.get("accessedAt")
            if not isinstance(accessed, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", accessed):
                issues.append(f"{where}.accessedAt: YYYY-MM-DD 形式にしてください")
            published = source.get("publishedAt")
            if published is not None and not isinstance(published, str):
                issues.append(f"{where}.publishedAt: 文字列か null にしてください")
            issues += _text_issues(f"{where}.claim", source.get("claim"), 1000, required=True, minimum=10)
            issues += _text_issues(f"{where}.relevance", source.get("relevance"), 1000, required=True, minimum=10)
            if source.get("evidenceLevel") != "published_source":
                issues.append(f"{where}.evidenceLevel: published_source にしてください")
    if external_research == "off" and evidence:
        issues.append("contextAnalysis.externalEvidence: 外部調査OFFのときは空配列にしてください")
    if external_research == "used" and not evidence:
        issues.append("contextAnalysis.externalEvidence: 外部調査を使った場合はURL・取得日・主張を1件以上記録してください")

    hypotheses = context.get("causalHypotheses", [])
    assumption_count = 0
    if not isinstance(hypotheses, list):
        issues.append("contextAnalysis.causalHypotheses: 配列にしてください")
        hypotheses = []
    else:
        if len(hypotheses) > 12:
            issues.append("contextAnalysis.causalHypotheses: 12件以下にしてください")
        for index, hypothesis in enumerate(hypotheses):
            where = f"contextAnalysis.causalHypotheses[{index}]"
            if not isinstance(hypothesis, dict):
                issues.append(f"{where}: オブジェクトにしてください")
                continue
            if hypothesis.get("role") not in {"primary", "alternative"}:
                issues.append(f"{where}.role: primary / alternative のどちらかにしてください")
            for field, limit in (("hypothesis", 1000), ("cause", 500), ("mechanism", 700), ("outcome", 500)):
                issues += _text_issues(f"{where}.{field}", hypothesis.get(field), limit, required=True, minimum=5)
            for field in ("evidenceFor", "evidenceAgainst", "confounders"):
                values = hypothesis.get(field)
                if not isinstance(values, list) or len(values) == 0:
                    issues.append(f"{where}.{field}: 1件以上の配列にしてください")
                elif len(values) > 12 or any(not isinstance(value, str) or not value.strip() for value in values):
                    issues.append(f"{where}.{field}: 空でない文字列を12件以下にしてください")
            for field, limit in (("falsificationCondition", 800), ("validationAction", 800)):
                issues += _text_issues(f"{where}.{field}", hypothesis.get(field), limit, required=True, minimum=5)
            level = hypothesis.get("evidenceLevel")
            if level not in EVIDENCE_LEVELS:
                issues.append(f"{where}.evidenceLevel: data_confirmed / user_reported / published_source / assumption から選んでください")
            if level == "assumption":
                assumption_count += 1
            if hypothesis.get("confidence") not in CONFIDENCES:
                issues.append(f"{where}.confidence: low / medium / high から選んでください")
            refs = hypothesis.get("evidenceRefs")
            if not isinstance(refs, list) or any(not isinstance(ref, str) or not ref.strip() for ref in refs):
                issues.append(f"{where}.evidenceRefs: 空でない文字列の配列にしてください")
            elif level == "published_source" and (not refs or any(ref not in source_ids for ref in refs)):
                issues.append(f"{where}.evidenceRefs: externalEvidence.id を1件以上参照してください")
            elif level == "user_reported" and (not refs or any(ref not in interview_ids for ref in refs)):
                issues.append(f"{where}.evidenceRefs: interviewFacts.id を1件以上参照してください")
    if hypotheses and assumption_count * 2 > len(hypotheses):
        issues.append("contextAnalysis.causalHypotheses: 想定(assumption)は仮説全体の半数以下にしてください")
    if hypotheses:
        roles = {hypothesis.get("role") for hypothesis in hypotheses if isinstance(hypothesis, dict)}
        if not {"primary", "alternative"}.issubset(roles):
            issues.append("contextAnalysis.causalHypotheses: 主仮説(primary)と対立仮説(alternative)を各1件以上必要です")
    return issues


def load_catalog(path: Path | None) -> dict:
    """図表カタログJSON(pnpm catalog:export の生成物)を読む。無ければ空(id 照合を省略)"""
    p = path or DEFAULT_CATALOG
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _apply_catalog_limits(catalog: dict) -> None:
    tl = catalog.get("textLimits")
    if isinstance(tl, dict):
        for key, name in (("summary", "summary"), ("sectionBody", "body"), ("gap", "gap"), ("caption", "caption")):
            v = tl.get(key)
            if isinstance(v, dict):
                if isinstance(v.get("min"), int):
                    TEXT_MIN[name] = v["min"]
                if isinstance(v.get("max"), int):
                    LIMITS[name] = v["max"]
    entries = catalog.get("charts")
    if isinstance(entries, list) and entries:
        LIMITS["charts"] = len(entries)
    smi = catalog.get("sectionMinItems")
    if isinstance(smi, dict):
        for k, v in smi.items():
            if k in SECTION_MIN_ITEMS and isinstance(v, int):
                SECTION_MIN_ITEMS[k] = v


def _charts_issues(charts: object, catalog_ids: set[str]) -> list[str]:
    """charts は {catalogId, caption} の配列。数値・labels・series を送ってきたら拒否(図はアプリが描く)"""
    if charts is None:
        return []
    if not isinstance(charts, list):
        return ["charts: 配列にしてください"]
    issues: list[str] = []
    if len(charts) > LIMITS["charts"]:
        issues.append(f"charts: {len(charts)}件は上限 {LIMITS['charts']} 件を超えています")
    ids: list[str] = []
    for j, chart in enumerate(charts):
        where = f"charts[{j}]"
        if not isinstance(chart, dict):
            issues.append(f"{where}: オブジェクトにしてください")
            continue
        for forbidden in ("labels", "series", "data", "kind"):
            if forbidden in chart:
                issues.append(f"{where}.{forbidden}: 第3版では図の数値・形を送りません(catalogId と caption だけ)")
        issues += _text_issues(f"{where}.catalogId", chart.get("catalogId"), LIMITS["chart_id"], required=True)
        issues += _text_issues(f"{where}.caption", chart.get("caption"), LIMITS["caption"], required=True)
        cid = chart.get("catalogId")
        if isinstance(cid, str):
            ids.append(cid)
            if catalog_ids and cid not in catalog_ids:
                issues.append(f"{where}.catalogId: {cid!r} は図表カタログにありません(使える id: {', '.join(sorted(catalog_ids))})")
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        issues.append(f"charts: catalogId が重複しています: {', '.join(dup)}")
    return issues


def _figure_refs(text: object) -> set[int]:
    if not isinstance(text, str):
        return set()
    return {int(m.translate(_ZEN2HAN)) for m in FIGURE_RE.findall(text)}


def _availability_issues(report: dict, data: dict) -> list[str]:
    """GET /api/ai/data の charts(available / figure)と照合する(アプリ保存時の normalizeReport と同じ規則)"""
    charts = data.get("charts")
    if not isinstance(charts, list):
        return ["--data: charts 配列がありません(GET /api/ai/data の保存JSONを渡してください)"]
    captions: dict[str, str] = {}
    for ref in report.get("charts") or []:
        if isinstance(ref, dict) and isinstance(ref.get("catalogId"), str):
            captions[ref["catalogId"]] = ref.get("caption") if isinstance(ref.get("caption"), str) else ""
    referenced: set[int] = _figure_refs(report.get("summary"))
    for sec in report.get("sections") or []:
        if isinstance(sec, dict):
            referenced |= _figure_refs(sec.get("body"))
    issues: list[str] = []
    available: set[int] = set()
    for c in charts:
        if not isinstance(c, dict):
            continue
        fig, cid = c.get("figure"), c.get("id")
        if c.get("available"):
            available.add(fig)
            cap = captions.get(cid, "")
            if len(cap.strip()) < TEXT_MIN["caption"]:
                issues.append(f"図{fig}({cid})は出せる図です。charts に caption を{TEXT_MIN['caption']}字以上で付けてください")
            if fig not in referenced:
                issues.append(f"図{fig}({cid})が summary か各節の body で「図{fig}」として参照されていません")
    for n in sorted(referenced):
        if n not in available:
            issues.append(f"本文が「図{n}」を参照していますが、その図は出せません(available=false)か存在しません")
    return issues


def validate(report: object, catalog: dict | None = None, data: dict | None = None) -> list[str]:
    """レポート dict を検査し、問題点のリストを返す(空なら送信可)。

    catalog: chart-catalog.json の内容(None なら既定パスを読む)。data: GET /api/ai/data の内容(任意)。
    """
    if not isinstance(report, dict):
        return ["トップレベルはオブジェクトにしてください"]
    catalog = load_catalog(None) if catalog is None else catalog
    _apply_catalog_limits(catalog)
    catalog_ids = {c["id"] for c in catalog.get("charts", []) if isinstance(c, dict) and isinstance(c.get("id"), str)}
    issues = _text_issues("generatedBy", report.get("generatedBy"), LIMITS["generatedBy"], required=True)
    if report.get("analysisDepth") not in {"concise", "standard", "detailed"}:
        issues.append("analysisDepth: concise / standard / detailed のどれかにしてください")
    issues += _text_issues("model", report.get("model"), LIMITS["model"], required=False)
    issues += _text_issues("title", report.get("title"), LIMITS["title"], required=False)
    issues += _text_issues(
        "summary",
        report.get("summary"),
        LIMITS["summary"],
        required=True,
        minimum=TEXT_MIN["summary"],
        bullets=BULLET_MIN["summary"],
    )
    issues += _key_findings_issues(report.get("keyFindings"), catalog_ids)
    issues += _follow_up_issues(report.get("followUp"))
    issues += _needs_issues(report.get("needs"))
    issues += _charts_issues(report.get("charts"), catalog_ids)
    issues += _context_analysis_issues(report.get("contextAnalysis"))

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
        issues += _text_issues(
            f"{where}.body",
            section.get("body"),
            LIMITS["body"],
            required=True,
            minimum=TEXT_MIN["body"],
            bullets=BULLET_MIN["body"],
        )
        issues += _text_issues(f"{where}.gap", section.get("gap"), LIMITS["gap"], required=False)
        items = section.get("items")
        n_items = 0
        if items is not None:
            if not isinstance(items, list):
                issues.append(f"{where}.items: 配列にしてください")
            else:
                n_items = len(items)
                if len(items) > LIMITS["items"]:
                    issues.append(f"{where}.items: {len(items)}件は上限 {LIMITS['items']} 件を超えています")
                for j, item in enumerate(items):
                    issues += _item_issues(f"{where}.items[{j}]", item)
        if sid in SECTION_MIN_ITEMS and n_items < SECTION_MIN_ITEMS[sid]:
            gap = section.get("gap")
            if not isinstance(gap, str) or len(gap.strip()) < TEXT_MIN["gap"]:
                issues.append(
                    f"{where}({sid}): items が{SECTION_MIN_ITEMS[sid]}行以上必要です(現在{n_items}行)。"
                    f"データ不足なら gap に理由を{TEXT_MIN['gap']}字以上で書いてください"
                )
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
    if data is not None:
        issues += _availability_issues(report, data)
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="kanjo 会計分析レポートJSONの送信前検査")
    parser.add_argument("path", help="検査するレポートJSONのパス")
    parser.add_argument("--data", help="GET /api/ai/data の保存JSON(渡すと図の available と「図N」参照を照合)")
    parser.add_argument("--catalog", help=f"図表カタログJSON(既定: {DEFAULT_CATALOG})")
    args = parser.parse_args(argv)
    try:
        report = json.loads(Path(args.path).read_text(encoding="utf-8"))
        data = json.loads(Path(args.data).read_text(encoding="utf-8")) if args.data else None
    except (OSError, ValueError) as exc:
        print(f"読めません: {exc}")
        return 2
    catalog = load_catalog(Path(args.catalog) if args.catalog else None)
    if not catalog.get("charts"):
        print("注意: 図表カタログ(chart-catalog.json)が読めないため、catalogId の照合を省略しました。")
    if data is not None and not isinstance(data, dict):
        print("読めません: --data はオブジェクトの JSON にしてください")
        return 2
    issues = validate(report, catalog, data)
    if issues:
        for issue in issues:
            print(f"NG {issue}")
        print(f"修正が必要です({len(issues)}件)。直してから再検査してください。")
        return 1
    print("OK 5節・要点・図表・背景仮説・外部出典の分離条件を満たしています。送信できます。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

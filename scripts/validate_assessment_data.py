from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
VALID_ANSWERS = {"yes", "partial", "no", "unsure"}
RECOGNIZED_FRAMEWORK_KEYS = {"nist_csf", "cis_controls", "cisa", "mitre_attack"}


def _load_json(filename: str) -> Any:
    with open(DATA_DIR / filename, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    warnings: list[str] = []
    errors: list[str] = []

    questions = _load_json("questions.json")
    scoring_rules = _load_json("scoring_rules.json")
    domain_metadata = _load_json("domain_metadata.json")
    source_registry = _load_json("source_registry.json")
    methodology = _load_json("assessment_methodology.json")
    scoring_rationale = _load_json("scoring_rationale.json")
    threat_overlay = _load_json("threat_overlay_notes.json")

    if not isinstance(questions, list) or not questions:
        errors.append("questions.json must contain a non-empty list.")
        questions = []
    if not isinstance(scoring_rules, dict) or not scoring_rules:
        errors.append("scoring_rules.json must contain a non-empty object.")
        scoring_rules = {}
    if not isinstance(domain_metadata, dict) or not domain_metadata:
        errors.append("domain_metadata.json must contain a non-empty object.")
        domain_metadata = {}
    if not isinstance(source_registry, list) or not source_registry:
        errors.append("source_registry.json must contain a non-empty list.")
        source_registry = []
    if not isinstance(methodology, dict) or not methodology:
        errors.append("assessment_methodology.json must contain a non-empty object.")
        methodology = {}
    if not isinstance(scoring_rationale, dict) or not scoring_rationale:
        errors.append("scoring_rationale.json must contain a non-empty object.")
        scoring_rationale = {}
    if not isinstance(threat_overlay, dict) or not threat_overlay:
        errors.append("threat_overlay_notes.json must contain a non-empty object.")

    question_ids = [str(item.get("id") or "") for item in questions]
    duplicates = sorted({qid for qid in question_ids if qid and question_ids.count(qid) > 1})
    if duplicates:
        errors.append(f"Duplicate question ids: {', '.join(duplicates)}")

    source_ids = [str(item.get("id") or "") for item in source_registry]
    if len(source_ids) != len(set(source_ids)):
        errors.append("source_registry.json contains duplicate source ids.")
    source_id_set = set(source_ids)

    required_scored_question_ids: set[str] = set()
    all_question_ids = set(question_ids)
    domain_ids = set(domain_metadata.keys())

    for source in source_registry:
        for key in ("id", "name", "publisher", "type", "note"):
            if not str(source.get(key) or "").strip():
                errors.append(f"source_registry entry is missing non-empty '{key}': {source}")

    for key in ("methodology_name", "methodology_version", "questions_version", "scoring_version", "description", "important_note"):
        if not str(methodology.get(key) or "").strip():
            errors.append(f"assessment_methodology.json is missing non-empty '{key}'.")
    score_scale = methodology.get("score_scale") or {}
    if score_scale.get("min") != 0 or score_scale.get("max") != 100:
        errors.append("assessment_methodology.json score_scale must be 0..100.")

    for question in questions:
        qid = str(question.get("id") or "").strip()
        domain = str(question.get("domain") or "").strip()
        options = question.get("options")

        if not qid:
            errors.append("Question with empty id found.")
            continue
        if not domain:
            errors.append(f"Question '{qid}' is missing domain.")
        elif domain not in domain_ids:
            errors.append(f"Question '{qid}' references unknown domain '{domain}'.")

        if not str(question.get("question") or "").strip():
            errors.append(f"Question '{qid}' has empty question text.")
        if not isinstance(options, list) or set(options) != VALID_ANSWERS:
            errors.append(f"Question '{qid}' must define options exactly as yes/partial/no/unsure.")

        for ref_id in question.get("source_refs") or []:
            if ref_id not in source_id_set:
                errors.append(f"Question '{qid}' references unknown source id '{ref_id}'.")

        framework_mappings = question.get("framework_mappings") or {}
        for mapping_key, mapping_values in framework_mappings.items():
            if mapping_key not in RECOGNIZED_FRAMEWORK_KEYS:
                errors.append(f"Question '{qid}' uses unrecognized framework mapping key '{mapping_key}'.")
            if not isinstance(mapping_values, list) or not all(str(value).strip() for value in mapping_values):
                errors.append(f"Question '{qid}' has invalid framework mapping values for '{mapping_key}'.")
            if mapping_key in {"cisa", "mitre_attack"}:
                for ref_id in mapping_values:
                    if ref_id not in source_id_set:
                        errors.append(f"Question '{qid}' mapping '{mapping_key}' references unknown source id '{ref_id}'.")

        if qid in scoring_rules:
            required_scored_question_ids.add(qid)
            rationale = scoring_rationale.get(qid)
            if not isinstance(rationale, dict):
                errors.append(f"Scored question '{qid}' is missing scoring rationale.")
            else:
                for answer in VALID_ANSWERS:
                    answer_rationale = rationale.get(answer)
                    if not isinstance(answer_rationale, dict):
                        errors.append(f"Scoring rationale for '{qid}' is missing answer '{answer}'.")
                        continue
                    for rationale_key in ("risk_impact", "severity", "rationale", "deduction_explanation", "recommendation_hint"):
                        if not str(answer_rationale.get(rationale_key) or "").strip():
                            errors.append(f"Scoring rationale for '{qid}.{answer}' is missing '{rationale_key}'.")

        if domain == "employee_security_hygiene":
            if question.get("required") is True and qid not in scoring_rules:
                warnings.append(f"Hygiene question '{qid}' is marked required but is not scored.")
            if qid in scoring_rules:
                warnings.append(f"Hygiene question '{qid}' is present in scoring_rules and will affect official score.")

    for qid, rule in scoring_rules.items():
        if qid not in all_question_ids:
            errors.append(f"scoring_rules.json references missing question '{qid}'.")
            continue
        if set(rule.keys()) != VALID_ANSWERS:
            errors.append(f"scoring_rules.json for '{qid}' must use only yes/partial/no/unsure.")
        for answer, value in rule.items():
            if answer not in VALID_ANSWERS:
                errors.append(f"scoring_rules.json for '{qid}' uses invalid answer key '{answer}'.")
            if not isinstance(value, (int, float)):
                errors.append(f"scoring_rules.json for '{qid}.{answer}' must be numeric.")

    for question in questions:
        qid = str(question.get("id") or "")
        if question.get("required", True) and qid in scoring_rules:
            continue
        if question.get("required", True) and qid not in scoring_rules and qid != "":
            warnings.append(f"Required question '{qid}' has no scoring rule and will not affect the official score.")

    max_possible_score = sum(max(rule.values()) for rule in scoring_rules.values())
    if max_possible_score <= 0:
        errors.append("Max possible score could not be calculated from scoring_rules.json.")

    status = "OK" if not errors else "ERROR"
    print(f"[{status}] Assessment data validation")
    print(f"Questions: {len(questions)}")
    print(f"Scored questions: {len(scoring_rules)}")
    print(f"Domains: {len(domain_metadata)}")
    print(f"Sources: {len(source_registry)}")
    print(f"Methodology version: {methodology.get('methodology_version', '')}")
    print(f"Max possible raw points: {max_possible_score}")

    if warnings:
        print("\nWarnings:")
        for item in warnings:
            print(f"- {item}")

    if errors:
        print("\nErrors:")
        for item in errors:
            print(f"- {item}")
        return 1

    print("\nNo validation errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

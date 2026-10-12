"""Model Comparator and Baseline Analysis.

Generates comparative summaries across trained ML models (Logistic Regression,
Random Forest) and establishes rigorous alignment criteria for comparisons
with the existing browser rule-based inference engine.
"""

from typing import Any, Dict, List, Optional
import pandas as pd


def generate_comparison_markdown(
    model_results: Dict[str, Dict[str, Any]],
    target_info: Optional[str] = None,
) -> str:
    """Generates a structured Markdown comparison table across trained models.

    Args:
        model_results: Mapping of model_name -> metrics_dict (from compute_evaluation_metrics).
        target_info: Optional header subtitle indicating target dimension and mode.

    Returns:
        Formatted Markdown string.
    """
    lines = [
        "## Model Performance Comparison",
        "",
    ]
    if target_info:
        lines.append(f"**Target Configuration**: {target_info}\n")

    lines.append("| Model | Macro F1 | Weighted F1 | Accuracy (Supp.) | Samples |")
    lines.append("| :--- | :---: | :---: | :---: | :---: |")

    for name, res in model_results.items():
        macro = res.get("macro_f1", 0.0)
        weighted = res.get("weighted_f1", 0.0)
        acc = res.get("accuracy", 0.0)
        n_samples = res.get("sample_count", 0)
        lines.append(
            f"| **{name}** | {macro:.4f} | {weighted:.4f} | {acc:.4f} ({acc*100:.1f}%) | {n_samples} |"
        )

    lines.append("")
    lines.append("### Per-Class Detailed Comparison")
    lines.append("")

    for name, res in model_results.items():
        lines.append(f"#### {name}")
        lines.append("| Class | Precision | Recall | F1-Score | Support |")
        lines.append("| :--- | :---: | :---: | :---: | :---: |")
        for c_name, per_c in res.get("per_class", {}).items():
            lines.append(
                f"| {c_name} | {per_c['precision']:.4f} | {per_c['recall']:.4f} | {per_c['f1_score']:.4f} | {per_c['support']} |"
            )
        lines.append("")

    return "\n".join(lines)


def evaluate_against_rule_based_baseline(
    ml_metrics: Dict[str, Any],
    rule_based_metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Provides a comparative assessment against the rule-based inference baseline.

    Strict Evaluation Guardrail:
    The existing rule-based engine operates in browser memory with personalized
    dynamic baselines and temporal smoothing. It can only be compared empirically
    if evaluated on the exact same labelled test samples with compatible binary
    or multi-class state mappings.

    Never claim an ML model is superior unless substantiated by equivalent
    test set evaluation.
    """
    if rule_based_metrics is None:
        return {
            "comparison_available": False,
            "status": "RULE_BASED_BENCHMARK_PENDING",
            "notes": (
                "Rule-based baseline predictions have not been evaluated on this offline dataset. "
                "Rule-based inference operates with real-time personal calibration and cannot be "
                "directly compared without executing the rule heuristics on the identical test clips."
            ),
        }

    ml_macro = ml_metrics.get("macro_f1", 0.0)
    rule_macro = rule_based_metrics.get("macro_f1", 0.0)
    delta = ml_macro - rule_macro

    superiority_claim = "SUPERIOR" if delta > 0.03 else ("INFERIOR" if delta < -0.03 else "COMPARABLE")

    return {
        "comparison_available": True,
        "ml_macro_f1": ml_macro,
        "rule_based_macro_f1": rule_macro,
        "f1_delta": delta,
        "assessment": superiority_claim,
        "notes": (
            f"Evaluated on identical test set. ML model Macro F1 delta: {delta:+.4f}. "
            f"Assessment: {superiority_claim}."
        ),
    }

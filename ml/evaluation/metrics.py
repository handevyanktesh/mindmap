"""Model Evaluation Metrics.

Computes comprehensive classification metrics with emphasis on Macro F1,
per-class precision/recall, confusion matrices, and class distributions,
adhering to strict imbalanced classification reporting standards.
"""

from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)


def compute_evaluation_metrics(
    y_true: Union[np.ndarray, List[int]],
    y_pred: Union[np.ndarray, List[int]],
    class_names: Optional[List[str]] = None,
    all_labels: Optional[List[int]] = None,
    participant_count: Optional[int] = None,
    min_minority_support: int = 5,
) -> Dict[str, Any]:
    """Computes real, uninvented classification performance metrics.

    Args:
        y_true: Ground truth target labels.
        y_pred: Model predictions.
        class_names: Optional list of human-readable class names.
        all_labels: Optional full list of valid class integers (e.g. [0, 1]).
        participant_count: Number of unique human participants in the evaluated split.
        min_minority_support: Minimum true samples required to consider per-class evaluation conclusive.

    Returns:
        Structured dictionary containing macro_f1, per_class metrics, confusion_matrix,
        conclusiveness assessment, and class distribution.
    """
    y_t = np.asarray(y_true, dtype=int)
    y_p = np.asarray(y_pred, dtype=int)

    if len(y_t) == 0:
        raise ValueError("Cannot compute metrics on an empty dataset.")

    if all_labels is not None:
        eval_classes = sorted(list(all_labels))
    else:
        eval_classes = sorted(list(set(np.unique(y_t)).union(set(np.unique(y_p)))))

    num_classes = len(eval_classes)

    if class_names is None:
        display_class_names = [f"Class {c}" for c in eval_classes]
    elif len(class_names) == num_classes:
        display_class_names = list(class_names)
    else:
        display_class_names = [class_names[c] if c < len(class_names) else f"Class {c}" for c in eval_classes]

    # 1. Macro & Weighted F1
    macro_f1 = float(f1_score(y_t, y_p, labels=eval_classes, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_t, y_p, labels=eval_classes, average="weighted", zero_division=0))

    # 2. Supplementary Accuracy
    accuracy = float(accuracy_score(y_t, y_p))

    # 3. Per-class Precision, Recall, F1, Support
    prec, rec, f1s, supp = precision_recall_fscore_support(
        y_t, y_p, labels=eval_classes, zero_division=0
    )

    per_class_metrics = {}
    inconclusive_classes = []
    for idx, c in enumerate(eval_classes):
        c_name = display_class_names[idx]
        support_cnt = int(supp[idx])
        is_conclusive = support_cnt >= min_minority_support
        if not is_conclusive:
            inconclusive_classes.append(c_name)
        per_class_metrics[c_name] = {
            "class_id": int(c),
            "precision": float(prec[idx]),
            "recall": float(rec[idx]),
            "f1_score": float(f1s[idx]),
            "support": support_cnt,
            "conclusive": is_conclusive,
        }

    # 4. Confusion Matrix with fixed eval_classes shape
    cm = confusion_matrix(y_t, y_p, labels=eval_classes)
    cm_list = cm.tolist()

    # 5. Class Distribution Statistics
    total_samples = len(y_t)
    unique_labels, counts = np.unique(y_t, return_counts=True)
    count_dict = {lbl: cnt for lbl, cnt in zip(unique_labels, counts)}

    class_dist = {}
    for idx, c in enumerate(eval_classes):
        cnt = int(count_dict.get(c, 0))
        name = display_class_names[idx]
        class_dist[name] = {
            "count": cnt,
            "percentage": float((cnt / total_samples) * 100.0),
        }

    return {
        "sample_count": total_samples,
        "participant_count": participant_count,
        "classes": display_class_names,
        "class_ids": [int(c) for c in eval_classes],
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "accuracy": accuracy,
        "per_class": per_class_metrics,
        "confusion_matrix": cm_list,
        "class_distribution": class_dist,
        "inconclusive_classes": inconclusive_classes,
        "is_fully_conclusive": len(inconclusive_classes) == 0,
    }


def format_metrics_report(metrics: Dict[str, Any], title: str = "Evaluation Report") -> str:
    """Formats metrics dictionary into a readable plain-text report."""
    lines = [
        "=" * 60,
        f"  {title.upper()}",
        "=" * 60,
        f"Total Samples: {metrics['sample_count']}",
    ]
    if metrics.get("participant_count") is not None:
        lines.append(f"Unique Participants: {metrics['participant_count']}")

    lines.extend([
        f"Macro F1-Score: {metrics['macro_f1']:.4f}",
        f"Weighted F1-Score: {metrics['weighted_f1']:.4f}",
        f"Accuracy (Supplementary): {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.1f}%)",
        "",
        "--- Class Distribution (Ground Truth) ---",
    ])
    for c_name, dist in metrics["class_distribution"].items():
        lines.append(f"  {c_name}: {dist['count']} samples ({dist['percentage']:.1f}%)")

    lines.append("")
    lines.append("--- Per-Class Performance ---")
    lines.append(f"  {'Class':<28} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Support':<8} | {'Status':<12}")
    lines.append("  " + "-" * 90)
    for c_name, per_c in metrics["per_class"].items():
        status = "Conclusive" if per_c.get("conclusive", True) else "INCONCLUSIVE"
        lines.append(
            f"  {c_name:<28} | {per_c['precision']:<10.4f} | {per_c['recall']:<10.4f} | {per_c['f1_score']:<10.4f} | {per_c['support']:<8} | {status:<12}"
        )

    if metrics.get("inconclusive_classes"):
        lines.append("")
        lines.append("  [WARNING] Inconclusive minority classes due to limited support (<5 test samples):")
        for ic in metrics["inconclusive_classes"]:
            lines.append(f"    - {ic}")
        lines.append("    High overall accuracy on imbalanced data does NOT indicate successful minority detection.")

    lines.append("")
    lines.append("--- Confusion Matrix (Row=True, Col=Pred) ---")
    header = "  " + f"{'':<20}" + "".join([f"{name[:8]:>10}" for name in metrics["classes"]])
    lines.append(header)
    for idx, row in enumerate(metrics["confusion_matrix"]):
        c_label = metrics["classes"][idx] if idx < len(metrics["classes"]) else f"Class {idx}"
        row_str = "  " + f"{c_label:<20}" + "".join([f"{val:>10}" for val in row])
        lines.append(row_str)

    lines.append("=" * 60)
    return "\n".join(lines)

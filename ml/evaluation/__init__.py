"""ML evaluation package."""

from ml.evaluation.metrics import (
    compute_evaluation_metrics,
    format_metrics_report,
)
from ml.evaluation.comparator import (
    generate_comparison_markdown,
    evaluate_against_rule_based_baseline,
)

__all__ = [
    "compute_evaluation_metrics",
    "format_metrics_report",
    "generate_comparison_markdown",
    "evaluate_against_rule_based_baseline",
]

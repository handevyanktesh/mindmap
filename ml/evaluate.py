"""MindMap ML Pipeline — Standalone Model Evaluation CLI.

Loads saved model pipelines and evaluates performance on holdout test datasets.
"""

import argparse
import json
from pathlib import Path
import sys
from typing import Optional
import numpy as np
import pandas as pd

from ml.configs.dataset_config import DAiSEEConfig
from ml.evaluation.metrics import compute_evaluation_metrics, format_metrics_report
from ml.labels.label_mapper import get_class_names, prepare_dataset_targets
from ml.models.registry import load_model
from ml.preprocessing.daisee_loader import load_split_annotations
from ml.train import generate_synthetic_benchmark_dataset


def evaluate_saved_model(
    model_path: Path,
    dataset_base_dir: Optional[Path] = None,
    use_synthetic: bool = False,
    output_dir: Optional[Path] = None,
) -> None:
    """Evaluates a saved model pipeline."""
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    pipeline, metadata = load_model(model_path)
    print(f"\n[INFO] Loaded model from: {model_path}")
    print(f"  Model Type:        {metadata.get('model_name', 'Unknown')}")
    print(f"  Target Dimension:  {metadata.get('target_dimension', 'engagement')}")
    print(f"  Target Mode:       {metadata.get('target_mode', 'binary')}")

    target_dim = metadata.get("target_dimension", "engagement")
    target_mode = metadata.get("target_mode", "binary")
    feature_cols = metadata.get("feature_columns", [])
    class_names = metadata.get("class_names") or get_class_names(target_dim, target_mode)

    if use_synthetic or metadata.get("is_synthetic", False):
        print("\n[INFO] Evaluating on synthetic test fixture...")
        _, _, test_df = generate_synthetic_benchmark_dataset(n_samples=100)
    else:
        d_cfg = DAiSEEConfig(base_dir=dataset_base_dir or Path("ml/data/DAiSEE"))
        features_cache = d_cfg.base_dir / "Features" / "features_test_subset.csv"
        if features_cache.exists():
            print(f"\n[INFO] Loading test features from cache: {features_cache}")
            test_df = pd.read_csv(features_cache)
        else:
            test_df = load_split_annotations("Test", d_cfg)

    test_clean, y_test = prepare_dataset_targets(test_df, target_dim, target_mode)

    if not feature_cols:
        from ml.configs.training_config import CANONICAL_FEATURE_COLUMNS
        feature_cols = [c for c in CANONICAL_FEATURE_COLUMNS if c in test_clean.columns]

    X_test = test_clean[feature_cols].to_numpy()
    y_pred = pipeline.predict(X_test)

    metrics = compute_evaluation_metrics(y_test, y_pred, class_names=class_names)
    report_str = format_metrics_report(metrics, title=f"Holdout Evaluation: {model_path.name}")
    print("\n" + report_str)

    if output_dir:
        out_p = Path(output_dir)
        out_p.mkdir(parents=True, exist_ok=True)
        eval_file = out_p / f"eval_{model_path.stem}.json"
        with open(eval_file, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)
        print(f"\n[INFO] Saved evaluation results to: {eval_file}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a trained MindMap ML model.")
    parser.add_argument("--model-path", type=str, required=True, help="Path to saved model (.joblib)")
    parser.add_argument("--base-dir", type=str, default="ml/data/DAiSEE", help="Base DAiSEE dataset path")
    parser.add_argument("--synthetic", action="store_true", help="Evaluate using synthetic test fixture")
    parser.add_argument("--output-dir", type=str, default="ml/outputs", help="Output directory")

    args = parser.parse_args()
    evaluate_saved_model(
        model_path=Path(args.model_path),
        dataset_base_dir=Path(args.base_dir),
        use_synthetic=args.synthetic,
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()

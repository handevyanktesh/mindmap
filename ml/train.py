"""MindMap ML Pipeline — Model Training and Evaluation CLI.

Trains reproducible baseline classifiers (Logistic Regression, Random Forest)
on video-derived temporal features, evaluates on official splits, and exports
metrics, confusion matrices, and serialized model pipelines.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from ml.configs.dataset_config import DAiSEEConfig
from ml.configs.training_config import CANONICAL_FEATURE_COLUMNS, TrainingConfig
from ml.evaluation.comparator import generate_comparison_markdown
from ml.evaluation.metrics import compute_evaluation_metrics, format_metrics_report
from ml.labels.label_mapper import (
    TargetDimension,
    TargetMode,
    get_class_names,
    get_label_mapping_doc,
    map_target,
    prepare_dataset_targets,
)
from ml.models.baselines import build_model_pipeline
from ml.models.registry import save_model
from ml.preprocessing.daisee_loader import (
    load_split_annotations,
    verify_participant_split_disjointness,
)
from ml.preprocessing.missingness_handler import analyze_missingness


def generate_synthetic_benchmark_dataset(
    n_samples: int = 150,
    random_seed: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates a synthetic dataset for testing pipeline execution.

    Explicit Guardrail:
    This data is ONLY for verifying pipeline functionality, code execution,
    and testing. It must NEVER be reported as real affective computing performance.
    """
    rng = np.random.RandomState(random_seed)

    def _create_split(n: int, split_name: str, part_offset: int) -> pd.DataFrame:
        participants = [f"P_{part_offset + i // 3:04d}" for i in range(n)]
        clip_ids = [f"clip_{split_name.lower()}_{i:04d}" for i in range(n)]

        # Synthetic ground truth: 0, 1, 2, 3 (ordinal DAiSEE labels)
        engagement = rng.choice([0, 1, 2, 3], size=n, p=[0.15, 0.25, 0.40, 0.20])
        confusion = rng.choice([0, 1, 2, 3], size=n, p=[0.50, 0.25, 0.15, 0.10])
        boredom = rng.choice([0, 1, 2, 3], size=n, p=[0.40, 0.30, 0.20, 0.10])
        frustration = rng.choice([0, 1, 2, 3], size=n, p=[0.60, 0.20, 0.15, 0.05])

        # Generate realistic facial features with correlation to targets
        ear_base = 0.28 + (engagement >= 2) * 0.04 - (confusion >= 2) * 0.02
        ear_mean = rng.normal(ear_base, 0.03)
        ear_std = rng.exponential(0.02, size=n)
        ear_min = np.clip(ear_mean - ear_std * 2.0, 0.05, 0.30)
        ear_max = np.clip(ear_mean + ear_std * 2.0, 0.20, 0.45)
        ear_velocity = rng.exponential(0.015, size=n)
        ear_closure_ratio = np.clip(rng.beta(1, 10, size=n) + (engagement < 2) * 0.05, 0.0, 1.0)

        # Gaze features
        gaze_x_mean = rng.normal(0.50, 0.06, size=n)
        gaze_y_mean = rng.normal(0.50, 0.05, size=n)
        gaze_x_std = rng.exponential(0.03, size=n) + (confusion >= 2) * 0.03
        gaze_y_std = rng.exponential(0.03, size=n) + (confusion >= 2) * 0.02
        gaze_disp = rng.exponential(0.12, size=n) + (confusion >= 2) * 0.08
        gaze_dev_ratio = np.clip(rng.beta(1, 8, size=n) + (engagement < 2) * 0.08, 0.0, 1.0)

        # Head Pose features (degrees)
        head_yaw_mean = rng.normal(0.0, 6.0, size=n)
        head_pitch_mean = rng.normal(0.0, 5.0, size=n)
        head_roll_mean = rng.normal(0.0, 3.0, size=n)
        head_yaw_std = rng.exponential(2.5, size=n) + (confusion >= 2) * 2.0
        head_pitch_std = rng.exponential(2.0, size=n)
        head_roll_std = rng.exponential(1.5, size=n)
        head_pose_disp = rng.exponential(6.0, size=n) + (confusion >= 2) * 4.0
        head_pose_turn_ratio = np.clip(rng.beta(1, 10, size=n) + (engagement < 2) * 0.06, 0.0, 1.0)

        gaze_spread = np.hypot(gaze_x_std, gaze_y_std)
        pose_spread = np.sqrt(head_yaw_std**2 + head_pitch_std**2 + head_roll_std**2)

        # Quality metrics
        valid_frames_ratio = np.clip(rng.beta(15, 2, size=n), 0.3, 1.0)
        ear_valid_ratio = valid_frames_ratio
        gaze_valid_ratio = np.clip(valid_frames_ratio - rng.uniform(0.0, 0.05, size=n), 0.2, 1.0)
        pose_valid_ratio = valid_frames_ratio

        # Inject realistic missing values (5% random missingness)
        mask_missing = rng.rand(n, len(CANONICAL_FEATURE_COLUMNS)) < 0.05

        df_data = {
            "clip_id": clip_ids,
            "participant_id": participants,
            "split": split_name,
            "boredom": boredom,
            "engagement": engagement,
            "confusion": confusion,
            "frustration": frustration,
            "ear_mean": ear_mean,
            "ear_std": ear_std,
            "ear_min": ear_min,
            "ear_max": ear_max,
            "ear_velocity": ear_velocity,
            "ear_closure_ratio": ear_closure_ratio,
            "gaze_x_mean": gaze_x_mean,
            "gaze_y_mean": gaze_y_mean,
            "gaze_x_std": gaze_x_std,
            "gaze_y_std": gaze_y_std,
            "gaze_displacement": gaze_disp,
            "gaze_deviation_ratio": gaze_dev_ratio,
            "head_yaw_mean": head_yaw_mean,
            "head_pitch_mean": head_pitch_mean,
            "head_roll_mean": head_roll_mean,
            "head_yaw_std": head_yaw_std,
            "head_pitch_std": head_pitch_std,
            "head_roll_std": head_roll_std,
            "head_pose_displacement": head_pose_disp,
            "head_pose_turn_ratio": head_pose_turn_ratio,
            "gaze_spread": gaze_spread,
            "pose_spread": pose_spread,
            "valid_frames_ratio": valid_frames_ratio,
            "ear_valid_ratio": ear_valid_ratio,
            "gaze_valid_ratio": gaze_valid_ratio,
            "pose_valid_ratio": pose_valid_ratio,
        }
        df = pd.DataFrame(df_data)

        # Apply missingness to feature columns
        for col_idx, col in enumerate(CANONICAL_FEATURE_COLUMNS):
            if col in df.columns:
                df.loc[mask_missing[:, col_idx], col] = np.nan

        return df

    n_train = int(n_samples * 0.6)
    n_val = int(n_samples * 0.2)
    n_test = n_samples - n_train - n_val

    train_df = _create_split(n_train, "Train", 0)
    val_df = _create_split(n_val, "Validation", 100)
    test_df = _create_split(n_test, "Test", 200)

    return train_df, val_df, test_df


from ml.preprocessing.dataset_extractor import extract_features_for_split_subset


def run_pipeline(
    config: TrainingConfig,
    dataset_config: DAiSEEConfig,
    use_synthetic: bool = False,
    synthetic_samples: int = 150,
    max_train_videos: int = 50,
    max_val_videos: int = 15,
    max_test_videos: int = 20,
    sample_stride: int = 4,
    max_frames_per_video: int = 40,
    force_extract: bool = False,
    test_sampling: Optional[str] = None,
) -> Dict[str, Any]:
    """Executes end-to-end training, validation, and testing."""
    print("=" * 70)
    print(" MINDMAP ML TRAINING & EVALUATION PIPELINE")
    print(f" Target Dimension: {config.target_dimension.upper()}")
    print(f" Target Mode:      {config.target_mode.upper()}")
    print(f" Models:           {config.model_type}")
    print(f" Output Directory: {config.output_dir}")
    print("=" * 70)

    is_synthetic_run = False
    extraction_audits: Dict[str, Any] = {}

    # 1. Dataset Loading
    if use_synthetic:
        print("\n[INFO] --synthetic flag active. Generating synthetic fixture dataset...")
        print("[CAUTION] Synthetic data results test code execution ONLY and do NOT reflect real model performance.")
        train_df, val_df, test_df = generate_synthetic_benchmark_dataset(
            n_samples=synthetic_samples, random_seed=config.random_seed
        )
        is_synthetic_run = True
    else:
        try:
            dataset_config.validate_dataset_exists()
            print(f"\n[INFO] Loading DAiSEE dataset from {dataset_config.base_dir}...")
            train_labels_df = load_split_annotations("Train", dataset_config)
            val_labels_df = load_split_annotations("Validation", dataset_config)
            test_labels_df = load_split_annotations("Test", dataset_config)
        except FileNotFoundError as err:
            print(f"\n[ERROR] Real dataset files not available: {err}")
            print("\nTo download DAiSEE:")
            print("  1. Request access from the official DAiSEE creators (IIT Mandi).")
            print("  2. Place labels in: ml/data/DAiSEE/Labels/ (TrainLabels.csv, ValidationLabels.csv, TestLabels.csv)")
            print("  3. Place videos in: ml/data/DAiSEE/DataSet/")
            print("\nTo test pipeline execution with synthetic data, pass --synthetic flag.")
            sys.exit(1)

        print("\n[INFO] Loading/Extracting features from DAiSEE video files...")
        train_df, audit_train = extract_features_for_split_subset(
            train_labels_df,
            "Train",
            dataset_config=dataset_config,
            max_videos=max_train_videos,
            max_frames_per_video=max_frames_per_video,
            sample_stride=sample_stride,
            stratify_target="joint",
            random_seed=config.random_seed,
            force_reextract=force_extract,
        )
        val_df, audit_val = extract_features_for_split_subset(
            val_labels_df,
            "Validation",
            dataset_config=dataset_config,
            max_videos=max_val_videos,
            max_frames_per_video=max_frames_per_video,
            stratify_target="joint",
            random_seed=config.random_seed,
            force_reextract=force_extract,
        )
        test_df, audit_test = extract_features_for_split_subset(
            test_labels_df,
            "Test",
            dataset_config=dataset_config,
            max_videos=max_test_videos,
            max_frames_per_video=max_frames_per_video,
            stratify_target=test_sampling,
            random_seed=config.random_seed,
            force_reextract=force_extract,
        )
        extraction_audits = {
            "train": audit_train,
            "validation": audit_val,
            "test": audit_test,
        }

    # 2. Participant Split Integrity Verification
    split_check = verify_participant_split_disjointness(train_df, val_df, test_df)
    print("\n--- Participant Split Verification ---")
    print(f"  Train participants:      {split_check['train_participant_count']}")
    print(f"  Validation participants: {split_check['validation_participant_count']}")
    print(f"  Test participants:       {split_check['test_participant_count']}")
    print(f"  Participant Disjointness: {'PASSED (Zero Leakage)' if split_check['is_disjoint'] else 'FAILED (Overlap Detected!)'}")
    if not split_check["is_disjoint"]:
        print(f"  [WARNING] Leaked participants: {split_check['overlap_train_test']}")

    # 3. Label Preparation
    label_doc = get_label_mapping_doc(config.target_dimension, config.target_mode)
    class_names = get_class_names(config.target_dimension, config.target_mode)
    all_target_labels = [0, 1] if config.target_mode == "binary" else [0, 1, 2, 3]
    print(f"\n--- Target Label Mapping ({config.target_dimension}) ---")
    print(f"  Description: {label_doc['description']}")
    print(f"  Classes: {class_names}")

    train_clean, y_train = prepare_dataset_targets(train_df, config.target_dimension, config.target_mode)
    val_clean, y_val = prepare_dataset_targets(val_df, config.target_dimension, config.target_mode)
    test_clean, y_test = prepare_dataset_targets(test_df, config.target_dimension, config.target_mode)

    # Feature matrix extraction
    feature_cols = [c for c in config.feature_columns if c in train_clean.columns]
    X_train = train_clean[feature_cols].to_numpy()
    X_val = val_clean[feature_cols].to_numpy()
    X_test = test_clean[feature_cols].to_numpy()

    # 4. Missingness Analysis
    missing_stats = analyze_missingness(train_clean, feature_cols)
    print(f"\n--- Missingness & Quality (Train Split) ---")
    print(f"  Samples with any missing values: {missing_stats['samples_with_any_missing']} / {len(train_clean)}")
    print(f"  Mean valid frames ratio:         {missing_stats['mean_valid_frames_ratio']*100:.1f}%")

    # 5. Model Selection & Training
    models_to_train = ["majority_class"]
    if config.model_type in ("logistic_regression", "both", "all"):
        models_to_train.append("logistic_regression")
    if config.model_type in ("random_forest", "both", "all"):
        models_to_train.append("random_forest")

    results: Dict[str, Dict[str, Any]] = {}
    saved_models: Dict[str, str] = {}

    test_participant_count = test_df["participant_id"].nunique() if "participant_id" in test_df.columns else None

    for m_name in models_to_train:
        print(f"\n>>> Training {m_name.replace('_', ' ').title()}...")
        pipeline = build_model_pipeline(m_name, feature_names=feature_cols)

        # Fit on training split
        pipeline.fit(X_train, y_train)

        # Evaluate on validation split for model tuning
        y_val_pred = pipeline.predict(X_val)
        val_metrics = compute_evaluation_metrics(
            y_val,
            y_val_pred,
            class_names=class_names,
            all_labels=all_target_labels,
        )
        print(f"    Validation Macro F1: {val_metrics['macro_f1']:.4f}")

        # Final evaluation on holdout test split
        y_test_pred = pipeline.predict(X_test)
        test_metrics = compute_evaluation_metrics(
            y_test,
            y_test_pred,
            class_names=class_names,
            all_labels=all_target_labels,
            participant_count=test_participant_count,
        )
        print(f"    Test Holdout Macro F1: {test_metrics['macro_f1']:.4f}")
        print(f"    Test Holdout Accuracy: {test_metrics['accuracy']:.4f}")

        results[m_name] = test_metrics

        # Save model
        target_slug = f"{config.target_dimension}_{config.target_mode}"
        model_filename = f"{m_name}_{target_slug}.joblib"
        model_path = config.models_dir / model_filename

        metadata = {
            "model_name": m_name,
            "target_dimension": config.target_dimension,
            "target_mode": config.target_mode,
            "class_names": class_names,
            "feature_columns": feature_cols,
            "test_macro_f1": test_metrics["macro_f1"],
            "test_accuracy": test_metrics["accuracy"],
            "is_synthetic": is_synthetic_run,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }
        save_model(pipeline, model_path, metadata)
        saved_models[m_name] = str(model_path)
        print(f"    Saved model checkpoint: {model_path}")

    # 6. Evaluation Reports & Comparison
    print("\n" + "=" * 70)
    print(" FINAL EVALUATION SUMMARY")
    print("=" * 70)
    for m_name, test_metrics in results.items():
        report_text = format_metrics_report(
            test_metrics, title=f"Test Set Evaluation: {m_name.replace('_', ' ').title()}"
        )
        print("\n" + report_text)

    # Generate Markdown Comparison
    target_info_str = f"{config.target_dimension.title()} ({config.target_mode.upper()})"
    if is_synthetic_run:
        target_info_str += " [SYNTHETIC FIXTURE RUN — NOT EMPIRICAL BENCHMARK]"

    md_comparison = generate_comparison_markdown(results, target_info=target_info_str)

    # Save metrics and summary
    summary_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "target_dimension": config.target_dimension,
        "target_mode": config.target_mode,
        "is_synthetic": is_synthetic_run,
        "split_integrity": split_check,
        "missingness": missing_stats,
        "extraction_audits": extraction_audits,
        "results": results,
        "saved_models": saved_models,
    }

    metrics_json_path = config.output_dir / f"evaluation_{config.target_dimension}_{config.target_mode}.json"
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    report_md_path = config.output_dir / f"comparison_{config.target_dimension}_{config.target_mode}.md"
    with open(report_md_path, "w", encoding="utf-8") as f:
        f.write(md_comparison)

    print(f"\n[INFO] Saved evaluation metrics to: {metrics_json_path}")
    print(f"[INFO] Saved comparison report to:  {report_md_path}")

    return summary_data


def main() -> None:
    parser = argparse.ArgumentParser(description="MindMap ML Training & Evaluation Pipeline")
    parser.add_argument("--base-dir", type=str, default="ml/data/DAiSEE", help="Base DAiSEE dataset path")
    parser.add_argument("--target", type=str, default="engagement", choices=["engagement", "confusion", "boredom", "frustration"], help="Target affective state dimension")
    parser.add_argument("--mode", type=str, default="binary", choices=["binary", "4class"], help="Target classification mode")
    parser.add_argument("--model", type=str, default="both", choices=["logistic_regression", "random_forest", "both"], help="Baseline model architecture")
    parser.add_argument("--output-dir", type=str, default="ml/outputs", help="Output directory for reports and metrics")
    parser.add_argument("--synthetic", action="store_true", help="Execute pipeline on synthetic fixture dataset (for testing)")
    parser.add_argument("--synthetic-samples", type=int, default=150, help="Number of samples to generate in synthetic fixture")
    parser.add_argument("--max-train-videos", type=int, default=50, help="Max videos to extract for Train")
    parser.add_argument("--max-val-videos", type=int, default=15, help="Max videos to extract for Validation")
    parser.add_argument("--max-test-videos", type=int, default=20, help="Max videos to extract for Test")
    parser.add_argument("--sample-stride", type=int, default=4, help="Stride step between sampled frames")
    parser.add_argument("--max-frames", type=int, default=40, help="Max frames per video to extract")
    parser.add_argument("--force-extract", action="store_true", help="Force re-extraction of video features")
    parser.add_argument("--test-sampling", type=str, default=None, choices=["natural", "joint"], help="Sampling strategy for test split ('natural' or 'joint')")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")

    args = parser.parse_args()

    cfg = TrainingConfig(
        target_dimension=args.target,
        target_mode=args.mode,
        model_type=args.model,
        output_dir=Path(args.output_dir),
        random_seed=args.seed,
    )

    d_cfg = DAiSEEConfig(base_dir=Path(args.base_dir))

    run_pipeline(
        config=cfg,
        dataset_config=d_cfg,
        use_synthetic=args.synthetic,
        synthetic_samples=args.synthetic_samples,
        max_train_videos=args.max_train_videos,
        max_val_videos=args.max_val_videos,
        max_test_videos=args.max_test_videos,
        sample_stride=args.sample_stride,
        max_frames_per_video=args.max_frames,
        force_extract=args.force_extract,
        test_sampling=None if args.test_sampling == "natural" else args.test_sampling,
    )


if __name__ == "__main__":
    main()

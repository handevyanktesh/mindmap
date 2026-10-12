"""Integration tests for end-to-end training and evaluation pipeline on synthetic fixture."""

import tempfile
from pathlib import Path
import numpy as np
import pytest

from ml.configs.training_config import CANONICAL_FEATURE_COLUMNS, TrainingConfig
from ml.evaluation.metrics import compute_evaluation_metrics
from ml.labels.label_mapper import prepare_dataset_targets
from ml.models.baselines import build_model_pipeline
from ml.models.registry import load_model, save_model
from ml.preprocessing.daisee_loader import verify_participant_split_disjointness
from ml.train import generate_synthetic_benchmark_dataset


def test_synthetic_pipeline_end_to_end():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1. Generate synthetic fixture (40 samples)
        train_df, val_df, test_df = generate_synthetic_benchmark_dataset(
            n_samples=40, random_seed=42
        )

        assert len(train_df) > 0
        assert len(val_df) > 0
        assert len(test_df) > 0

        # 2. Check participant split integrity
        split_check = verify_participant_split_disjointness(train_df, val_df, test_df)
        assert split_check["is_disjoint"] is True

        # 3. Target preparation
        train_clean, y_train = prepare_dataset_targets(train_df, dimension="engagement", mode="binary")
        test_clean, y_test = prepare_dataset_targets(test_df, dimension="engagement", mode="binary")

        feature_cols = [c for c in CANONICAL_FEATURE_COLUMNS if c in train_clean.columns]
        X_train = train_clean[feature_cols].to_numpy()
        X_test = test_clean[feature_cols].to_numpy()

        assert X_train.shape[1] == len(feature_cols)

        # 4. Train Logistic Regression
        lr_pipeline = build_model_pipeline("logistic_regression", feature_names=feature_cols)
        lr_pipeline.fit(X_train, y_train)

        y_pred_lr = lr_pipeline.predict(X_test)
        metrics_lr = compute_evaluation_metrics(y_test, y_pred_lr)

        assert "macro_f1" in metrics_lr
        assert "confusion_matrix" in metrics_lr
        assert 0.0 <= metrics_lr["macro_f1"] <= 1.0

        # 5. Train Random Forest
        rf_pipeline = build_model_pipeline("random_forest", feature_names=feature_cols)
        rf_pipeline.fit(X_train, y_train)

        y_pred_rf = rf_pipeline.predict(X_test)
        metrics_rf = compute_evaluation_metrics(y_test, y_pred_rf)

        assert "macro_f1" in metrics_rf
        assert 0.0 <= metrics_rf["macro_f1"] <= 1.0

        # 6. Model serialization & deserialization check
        model_save_path = tmp_path / "model.joblib"
        save_model(lr_pipeline, model_save_path, metadata={"test_macro_f1": metrics_lr["macro_f1"]})

        reloaded_pipeline, meta = load_model(model_save_path)
        y_reloaded_pred = reloaded_pipeline.predict(X_test)
        assert np.array_equal(y_pred_lr, y_reloaded_pred)
        assert meta["test_macro_f1"] == metrics_lr["macro_f1"]

        # 7. Majority Class Baseline check
        dummy_pipeline = build_model_pipeline("majority_class", feature_names=feature_cols)
        dummy_pipeline.fit(X_train, y_train)
        y_pred_dummy = dummy_pipeline.predict(X_test)
        metrics_dummy = compute_evaluation_metrics(y_test, y_pred_dummy)
        assert "macro_f1" in metrics_dummy
        assert 0.0 <= metrics_dummy["accuracy"] <= 1.0

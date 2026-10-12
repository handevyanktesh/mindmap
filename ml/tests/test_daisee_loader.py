"""Unit tests for DAiSEE loader and participant split integrity."""

import pandas as pd
import pytest

from ml.configs.dataset_config import DAiSEEConfig
from ml.preprocessing.daisee_loader import (
    normalize_daisee_dataframe,
    verify_participant_split_disjointness,
)


def test_extract_participant_id():
    # Standard 6-digit prefix format
    assert DAiSEEConfig.extract_participant_id("1100011002.avi") == "110001"
    assert DAiSEEConfig.extract_participant_id("4800231015.mp4") == "480023"

    # Nested folder format
    assert DAiSEEConfig.extract_participant_id("DataSet/Train/110001/1100011002/1100011002.avi") == "110001"

    # Delimited fallback
    assert DAiSEEConfig.extract_participant_id("user12_clip03.avi") == "user12"


def test_normalize_daisee_dataframe():
    raw_df = pd.DataFrame(
        {
            "ClipID": [" 1100011002.avi "],
            "Engagement": [3],
            "Confusion": [1],
            "Boredom": [0],
            "Frustration": [0],
        }
    )
    norm = normalize_daisee_dataframe(raw_df)
    assert "clip_id" in norm.columns
    assert "participant_id" in norm.columns
    assert norm["clip_id"].iloc[0] == "1100011002.avi"
    assert norm["participant_id"].iloc[0] == "110001"
    assert norm["engagement"].iloc[0] == 3


def test_verify_participant_split_disjointness():
    # Disjoint splits
    train_df = pd.DataFrame({"participant_id": ["P1", "P2", "P3"]})
    val_df = pd.DataFrame({"participant_id": ["P4", "P5"]})
    test_df = pd.DataFrame({"participant_id": ["P6", "P7"]})

    res = verify_participant_split_disjointness(train_df, val_df, test_df)
    assert res["is_disjoint"] is True
    assert len(res["overlap_train_val"]) == 0
    assert len(res["overlap_train_test"]) == 0

    # Leaking participant P2 into test
    leaky_test = pd.DataFrame({"participant_id": ["P2", "P7"]})
    res_leaky = verify_participant_split_disjointness(train_df, val_df, leaky_test)
    assert res_leaky["is_disjoint"] is False
    assert "P2" in res_leaky["overlap_train_test"]


def test_select_representative_subset_minority_retention():
    from ml.preprocessing.dataset_extractor import select_representative_subset

    # Construct an imbalanced split: 95% majority, 5% minority
    records = []
    for i in range(100):
        is_minority_eng = (i < 5)
        is_minority_conf = (i < 8)
        records.append({
            "clip_id": f"clip_{i:03d}.avi",
            "participant_id": f"part_{i // 4:03d}",
            "engagement": 1 if is_minority_eng else 3,
            "confusion": 2 if is_minority_conf else 0,
        })
    df = pd.DataFrame(records)

    # Sample a subset of 30
    sub = select_representative_subset(df, max_videos=30, stratify_target="joint", random_seed=42)
    assert len(sub) == 30
    # Minority classes must be retained
    assert (sub["engagement"] < 2).sum() >= 2
    assert (sub["confusion"] >= 2).sum() >= 2


def test_compute_evaluation_metrics_conclusive_check():
    from ml.evaluation.metrics import compute_evaluation_metrics

    # Test with adequate support (>= 5)
    y_true_adequate = [0] * 10 + [1] * 20
    y_pred_adequate = [0] * 10 + [1] * 20
    res_adeq = compute_evaluation_metrics(
        y_true_adequate, y_pred_adequate, class_names=["Low", "High"], min_minority_support=5
    )
    assert res_adeq["is_fully_conclusive"] is True
    assert len(res_adeq["inconclusive_classes"]) == 0

    # Test with inadequate minority support (< 5)
    y_true_sparse = [0] * 2 + [1] * 20
    y_pred_sparse = [0] * 2 + [1] * 20
    res_sparse = compute_evaluation_metrics(
        y_true_sparse, y_pred_sparse, class_names=["Low", "High"], min_minority_support=5
    )
    assert res_sparse["is_fully_conclusive"] is False
    assert "Low" in res_sparse["inconclusive_classes"]

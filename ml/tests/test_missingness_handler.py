"""Unit tests for missingness and data quality handler."""

import numpy as np
import pandas as pd
import pytest

from ml.preprocessing.missingness_handler import (
    DOMAIN_FEATURE_DEFAULTS,
    SafeDomainImputer,
    analyze_missingness,
    filter_low_quality_samples,
)


def test_analyze_missingness():
    df = pd.DataFrame(
        {
            "ear_mean": [0.30, np.nan, 0.28, 0.32],
            "gaze_x_mean": [0.50, 0.48, np.nan, 0.52],
            "valid_frames_ratio": [1.0, 0.5, 0.8, 0.9],
        }
    )
    res = analyze_missingness(df, ["ear_mean", "gaze_x_mean"])

    assert res["total_samples"] == 4
    assert res["feature_missing_counts"]["ear_mean"] == 1
    assert res["feature_missing_percentages"]["ear_mean"] == 25.0
    assert res["feature_missing_counts"]["gaze_x_mean"] == 1
    assert res["samples_with_any_missing"] == 2


def test_safe_domain_imputer_standard_and_empty_column():
    X = np.array(
        [
            [0.28, np.nan],
            [0.32, np.nan],
            [np.nan, np.nan],
        ]
    )
    feature_names = ["ear_mean", "head_yaw_mean"]
    imputer = SafeDomainImputer(strategy="median", feature_names=feature_names)
    X_imputed = imputer.fit_transform(X)

    # First column median = (0.28 + 0.32) / 2 = 0.30
    assert X_imputed[2, 0] == pytest.approx(0.30)
    # Second column entirely NaN -> should fall back to DOMAIN_FEATURE_DEFAULTS["head_yaw_mean"] = 0.0
    assert X_imputed[0, 1] == pytest.approx(0.0)
    assert not np.isnan(X_imputed).any()


def test_filter_low_quality_samples():
    df = pd.DataFrame(
        {
            "clip_id": ["c1", "c2", "c3"],
            "valid_frames_ratio": [0.95, 0.05, 0.40],
        }
    )
    retained, dropped = filter_low_quality_samples(df, min_valid_ratio=0.20)
    assert len(retained) == 2
    assert len(dropped) == 1
    assert "c2" in dropped["clip_id"].values

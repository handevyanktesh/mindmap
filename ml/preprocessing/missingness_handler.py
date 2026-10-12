"""Missingness & Data Quality Handler.

Provides missing-feature analysis, quality gating, and robust imputation
strategies for video-derived temporal feature vectors.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer


# Domain-specific default fallbacks when all samples or a feature are missing
DOMAIN_FEATURE_DEFAULTS = {
    "ear_mean": 0.28,
    "ear_std": 0.02,
    "ear_min": 0.15,
    "ear_max": 0.32,
    "ear_velocity": 0.01,
    "ear_closure_ratio": 0.05,
    "gaze_x_mean": 0.50,
    "gaze_y_mean": 0.50,
    "gaze_x_std": 0.03,
    "gaze_y_std": 0.03,
    "gaze_displacement": 0.10,
    "gaze_deviation_ratio": 0.05,
    "head_yaw_mean": 0.0,
    "head_pitch_mean": 0.0,
    "head_roll_mean": 0.0,
    "head_yaw_std": 2.0,
    "head_pitch_std": 2.0,
    "head_roll_std": 1.5,
    "head_pose_displacement": 5.0,
    "head_pose_turn_ratio": 0.02,
    "gaze_spread": 0.04,
    "pose_spread": 3.0,
    "valid_frames_ratio": 1.0,
    "ear_valid_ratio": 1.0,
    "gaze_valid_ratio": 1.0,
    "pose_valid_ratio": 1.0,
}


def analyze_missingness(
    df: pd.DataFrame, feature_columns: List[str]
) -> Dict[str, Any]:
    """Computes missing value percentages and detection rate statistics.

    Args:
        df: DataFrame containing feature columns.
        feature_columns: List of feature column names to evaluate.

    Returns:
        Dictionary with per-feature null counts, percentages, and quality metrics.
    """
    total_rows = len(df)
    if total_rows == 0:
        return {
            "total_samples": 0,
            "feature_missing_counts": {},
            "feature_missing_percentages": {},
            "samples_with_any_missing": 0,
            "mean_valid_frames_ratio": 0.0,
        }

    missing_counts = {}
    missing_pcts = {}
    for col in feature_columns:
        if col in df.columns:
            null_count = int(df[col].isna().sum())
            missing_counts[col] = null_count
            missing_pcts[col] = float((null_count / total_rows) * 100.0)
        else:
            missing_counts[col] = total_rows
            missing_pcts[col] = 100.0

    present_cols = [c for c in feature_columns if c in df.columns]
    any_missing_count = int(df[present_cols].isna().any(axis=1).sum()) if present_cols else total_rows

    mean_valid_ratio = float(df["valid_frames_ratio"].mean()) if "valid_frames_ratio" in df.columns else 0.0

    return {
        "total_samples": total_rows,
        "feature_missing_counts": missing_counts,
        "feature_missing_percentages": missing_pcts,
        "samples_with_any_missing": any_missing_count,
        "mean_valid_frames_ratio": mean_valid_ratio,
    }


class SafeDomainImputer(BaseEstimator, TransformerMixin):
    """Scikit-learn compatible imputer with domain fallback defaults.

    Uses standard median imputation per column, but if a column is entirely
    missing or empty, falls back to physiologically plausible resting defaults.
    """

    def __init__(self, strategy: str = "median", feature_names: Optional[List[str]] = None):
        self.strategy = strategy
        self.feature_names = feature_names
        self.imputer_ = SimpleImputer(strategy=strategy)
        self.fill_values_: Dict[int, float] = {}

    def fit(self, X: Any, y: Optional[Any] = None) -> "SafeDomainImputer":
        X_df = pd.DataFrame(X)
        self.imputer_.fit(X_df)

        # Store fallbacks
        for idx in range(X_df.shape[1]):
            val = self.imputer_.statistics_[idx]
            if not np.isfinite(val):
                col_name = (
                    self.feature_names[idx]
                    if self.feature_names and idx < len(self.feature_names)
                    else None
                )
                fallback = DOMAIN_FEATURE_DEFAULTS.get(col_name, 0.0) if col_name else 0.0
                self.imputer_.statistics_[idx] = fallback
                self.fill_values_[idx] = fallback
        return self

    def transform(self, X: Any) -> np.ndarray:
        X_df = pd.DataFrame(X)
        transformed = self.imputer_.transform(X_df)
        # Final safeguard: replace any lingering NaNs with 0.0
        return np.nan_to_num(transformed, nan=0.0)


def filter_low_quality_samples(
    df: pd.DataFrame, min_valid_ratio: float = 0.20
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Partitions dataset into high-quality and rejected low-quality clips.

    Args:
        df: Input DataFrame.
        min_valid_ratio: Minimum fraction of validly detected frames (default 20%).

    Returns:
        Tuple of (retained_df, dropped_df).
    """
    if "valid_frames_ratio" not in df.columns:
        return df.copy(), pd.DataFrame()

    retained = df[df["valid_frames_ratio"] >= min_valid_ratio].copy()
    dropped = df[df["valid_frames_ratio"] < min_valid_ratio].copy()
    return retained, dropped

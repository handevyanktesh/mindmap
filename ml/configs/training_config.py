"""Training Pipeline Configuration.

Defines model hyperparameters, target selections, feature feature sets,
and output directory management for MindMap ML experiments.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


# Canonical list of temporal statistical features derived from video facial landmarks
CANONICAL_FEATURE_COLUMNS = [
    # EAR (Eye Aspect Ratio) features
    "ear_mean",
    "ear_std",
    "ear_min",
    "ear_max",
    "ear_velocity",
    "ear_closure_ratio",
    # Gaze features
    "gaze_x_mean",
    "gaze_y_mean",
    "gaze_x_std",
    "gaze_y_std",
    "gaze_displacement",
    "gaze_deviation_ratio",
    # Head Pose features (in degrees)
    "head_yaw_mean",
    "head_pitch_mean",
    "head_roll_mean",
    "head_yaw_std",
    "head_pitch_std",
    "head_roll_std",
    "head_pose_displacement",
    "head_pose_turn_ratio",
    # Stability & Cross-Modal Metrics
    "gaze_spread",
    "pose_spread",
    # Data Quality & Missingness Indicators
    "valid_frames_ratio",
    "ear_valid_ratio",
    "gaze_valid_ratio",
    "pose_valid_ratio",
]


@dataclass
class ModelHyperparameters:
    """Hyperparameter definitions for baseline models."""

    logistic_regression: Dict[str, Any] = field(
        default_factory=lambda: {
            "C": 1.0,
            "penalty": "l2",
            "solver": "lbfgs",
            "class_weight": "balanced",
            "max_iter": 1000,
            "random_state": 42,
        }
    )

    random_forest: Dict[str, Any] = field(
        default_factory=lambda: {
            "n_estimators": 100,
            "max_depth": 8,
            "min_samples_split": 4,
            "min_samples_leaf": 2,
            "class_weight": "balanced",
            "random_state": 42,
            "n_jobs": -1,
        }
    )


@dataclass
class TrainingConfig:
    """Master configuration for an ML training and evaluation run."""

    target_dimension: str = "engagement"  # 'engagement' or 'confusion'
    target_mode: str = "binary"           # 'binary' or '4class'
    model_type: str = "both"              # 'logistic_regression', 'random_forest', or 'both'
    output_dir: Path = field(default_factory=lambda: Path("ml/outputs").resolve())
    models_dir: Path = field(default_factory=lambda: Path("ml/models/saved").resolve())
    feature_columns: List[str] = field(default_factory=lambda: list(CANONICAL_FEATURE_COLUMNS))
    imputer_strategy: str = "median"
    scale_features: bool = True
    random_seed: int = 42
    hyperparameters: ModelHyperparameters = field(default_factory=ModelHyperparameters)

    def __post_init__(self) -> None:
        self.output_dir = Path(self.output_dir)
        self.models_dir = Path(self.models_dir)
        self.target_dimension = self.target_dimension.lower()
        self.target_mode = self.target_mode.lower()
        self.model_type = self.model_type.lower()

        if self.target_dimension not in ("engagement", "confusion", "boredom", "frustration"):
            raise ValueError(f"Invalid target dimension: {self.target_dimension}")

        if self.target_mode not in ("binary", "4class"):
            raise ValueError(f"Invalid target mode: {self.target_mode} (must be 'binary' or '4class')")

        if self.model_type not in ("logistic_regression", "random_forest", "both"):
            raise ValueError(f"Invalid model type: {self.model_type}")

        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)

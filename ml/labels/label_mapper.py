"""DAiSEE Label Mapper & Target Preparation.

Maps the original DAiSEE 4-level affective state annotations
(0=Very Low, 1=Low, 2=High, 3=Very High) to machine learning targets.

Key Principles:
1. Multidimensional Independence:
   Engagement and Confusion are separate, independent dimensions in DAiSEE.
   A student can be simultaneously highly engaged and confused (e.g. actively
   grappling with challenging material), or neither.
   They are NEVER treated as mutually exclusive classes.

2. Dual Mode Support:
   - 4-Class Ordinal: Preserves full granularity [0, 1, 2, 3].
   - Binary: Groups lower levels (0, 1) vs higher levels (2, 3) to mitigate
     extreme label sparsity while maintaining practical utility.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import numpy as np
import pandas as pd


class TargetMode(str, Enum):
    FOUR_CLASS = "4class"
    BINARY = "binary"


class TargetDimension(str, Enum):
    ENGAGEMENT = "engagement"
    CONFUSION = "confusion"
    BOREDOM = "boredom"
    FRUSTRATION = "frustration"


# Official DAiSEE 4-level semantic labels
DAISEE_LEVEL_DESCRIPTIONS = {
    0: "Very Low",
    1: "Low",
    2: "High",
    3: "Very High",
}

# 4-Class identity mapping
FOUR_CLASS_MAP = {0: 0, 1: 1, 2: 2, 3: 3}
FOUR_CLASS_NAMES = ["Very Low", "Low", "High", "Very High"]

# Binary mappings: {0, 1} -> 0 (Low / Reduced), {2, 3} -> 1 (Elevated / High)
BINARY_MAP = {0: 0, 1: 0, 2: 1, 3: 1}

BINARY_NAMES = {
    TargetDimension.ENGAGEMENT: ["Reduced / Low Engagement", "Engaged / High Engagement"],
    TargetDimension.CONFUSION: ["Low / No Confusion", "Elevated Confusion"],
    TargetDimension.BOREDOM: ["Low / No Boredom", "Elevated Boredom"],
    TargetDimension.FRUSTRATION: ["Low / No Frustration", "Elevated Frustration"],
}


def _parse_dim_and_mode(
    dimension: Union[TargetDimension, str],
    mode: Union[TargetMode, str],
) -> Tuple[TargetDimension, TargetMode]:
    dim = dimension if isinstance(dimension, TargetDimension) else TargetDimension(str(dimension).lower())
    m = mode if isinstance(mode, TargetMode) else TargetMode(str(mode).lower())
    return dim, m


def get_class_names(
    dimension: Union[TargetDimension, str] = TargetDimension.ENGAGEMENT,
    mode: Union[TargetMode, str] = TargetMode.BINARY,
) -> List[str]:
    """Returns human-readable class names for the specified target configuration."""
    dim, m = _parse_dim_and_mode(dimension, mode)

    if m == TargetMode.FOUR_CLASS:
        return list(FOUR_CLASS_NAMES)
    return list(BINARY_NAMES[dim])


def get_label_mapping_doc(
    dimension: Union[TargetDimension, str] = TargetDimension.ENGAGEMENT,
    mode: Union[TargetMode, str] = TargetMode.BINARY,
) -> Dict[str, Any]:
    """Returns documentation and metadata for the active label mapping."""
    dim, m = _parse_dim_and_mode(dimension, mode)

    if m == TargetMode.FOUR_CLASS:
        return {
            "dimension": dim.value,
            "mode": "4class",
            "mapping": FOUR_CLASS_MAP,
            "classes": FOUR_CLASS_NAMES,
            "description": "Preserves original 4-level DAiSEE ordinal annotation: 0=Very Low, 1=Low, 2=High, 3=Very High.",
            "is_independent": True,
        }
    return {
        "dimension": dim.value,
        "mode": "binary",
        "mapping": BINARY_MAP,
        "classes": BINARY_NAMES[dim],
        "description": "Binary grouping: 0={0, 1} (Very Low / Low), 1={2, 3} (High / Very High).",
        "is_independent": True,
    }


def map_target(
    values: Union[pd.Series, np.ndarray, Sequence[Any]],
    dimension: Union[TargetDimension, str] = TargetDimension.ENGAGEMENT,
    mode: Union[TargetMode, str] = TargetMode.BINARY,
) -> np.ndarray:
    """Maps raw DAiSEE ordinal integers to the specified target representation.

    Args:
        values: Series or array of raw DAiSEE integers (0, 1, 2, 3).
        dimension: Affective dimension ('engagement', 'confusion', etc.).
        mode: Target mode ('4class' or 'binary').

    Returns:
        NumPy integer array of target labels.
    """
    _, m = _parse_dim_and_mode(dimension, mode)
    s = pd.Series(values)

    if m == TargetMode.FOUR_CLASS:
        mapped = s.map(FOUR_CLASS_MAP)
    else:
        mapped = s.map(BINARY_MAP)

    if mapped.isna().any():
        unmapped_indices = mapped[mapped.isna()].index.tolist()
        invalid_raw = s.iloc[unmapped_indices[:5]].tolist()
        raise ValueError(
            f"Encountered unmapped or invalid label values: {invalid_raw}. "
            "Expected integer labels in range 0-3."
        )

    return mapped.astype(int).to_numpy()


def prepare_dataset_targets(
    df: pd.DataFrame,
    dimension: Union[TargetDimension, str] = TargetDimension.ENGAGEMENT,
    mode: Union[TargetMode, str] = TargetMode.BINARY,
) -> Tuple[pd.DataFrame, np.ndarray]:
    """Extracts and formats target labels from a normalized DAiSEE DataFrame.

    Returns:
        Tuple of (clean_df, y_array).
    """
    dim_str = str(dimension).lower()
    if dim_str not in df.columns:
        raise KeyError(
            f"Target dimension '{dim_str}' not found in DataFrame columns: {list(df.columns)}"
        )

    # Drop rows where target annotation is missing (NaN)
    valid_mask = df[dim_str].notna()
    clean_df = df[valid_mask].copy()

    y = map_target(clean_df[dim_str], dimension=dimension, mode=mode)
    return clean_df, y

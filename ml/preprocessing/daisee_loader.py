"""DAiSEE Dataset Loader and Split Verifier.

Parses official DAiSEE annotation CSV files, resolves video and precomputed
feature paths, extracts participant identifiers, and verifies participant-level
disjointness across splits.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import numpy as np
import pandas as pd

from ml.configs.dataset_config import DAiSEEConfig


def normalize_daisee_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalizes DAiSEE column names and whitespace.

    Standard expected output columns:
        'clip_id', 'participant_id', 'boredom', 'engagement', 'confusion', 'frustration'
    """
    cleaned = df.copy()
    cleaned.columns = [str(c).strip() for c in cleaned.columns]

    # Column mapping dictionary (case-insensitive)
    col_map = {}
    for col in cleaned.columns:
        c_lower = col.lower().replace("_", "").replace(" ", "")
        if "clip" in c_lower or "video" in c_lower:
            col_map[col] = "clip_id"
        elif "engage" in c_lower:
            col_map[col] = "engagement"
        elif "confus" in c_lower:
            col_map[col] = "confusion"
        elif "bored" in c_lower:
            col_map[col] = "boredom"
        elif "frustrat" in c_lower:
            col_map[col] = "frustration"

    cleaned = cleaned.rename(columns=col_map)

    if "clip_id" not in cleaned.columns:
        raise ValueError(
            f"Could not identify a clip_id column. Available columns: {list(df.columns)}"
        )

    # Clean clip_id string values
    cleaned["clip_id"] = cleaned["clip_id"].astype(str).str.strip()

    # Extract participant_id for participant-level splitting
    cleaned["participant_id"] = cleaned["clip_id"].apply(
        DAiSEEConfig.extract_participant_id
    )

    # Convert annotation columns to numeric integers
    for target in ("boredom", "engagement", "confusion", "frustration"):
        if target in cleaned.columns:
            cleaned[target] = pd.to_numeric(cleaned[target], errors="coerce")

    return cleaned


def load_split_annotations(
    split: str, config: Optional[DAiSEEConfig] = None
) -> pd.DataFrame:
    """Loads and standardizes annotations for a given split ('Train', 'Validation', 'Test').

    Args:
        split: Target split name.
        config: Optional DAiSEEConfig instance.

    Returns:
        Standardized DataFrame with normalized columns.

    Raises:
        FileNotFoundError: If the split's label file does not exist.
    """
    cfg = config or DAiSEEConfig()
    label_file = cfg.get_labels_file(split)

    if not label_file.exists():
        raise FileNotFoundError(
            f"DAiSEE {split} annotations not found at: {label_file}\n"
            "Please ensure the dataset is downloaded into ml/data/DAiSEE/Labels/ "
            "or set DAISEE_BASE_DIR."
        )

    raw_df = pd.read_csv(label_file)
    normalized_df = normalize_daisee_dataframe(raw_df)
    normalized_df["split"] = split.capitalize()
    return normalized_df


def verify_participant_split_disjointness(
    train_df: pd.DataFrame,
    val_df: Optional[pd.DataFrame] = None,
    test_df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """Verifies that no participants leak across Train, Validation, and Test splits.

    Returns:
        Dictionary reporting disjointness status and any overlapping participant IDs.
    """
    train_parts = set(train_df["participant_id"].unique()) if "participant_id" in train_df.columns else set()
    val_parts = (
        set(val_df["participant_id"].unique())
        if val_df is not None and "participant_id" in val_df.columns
        else set()
    )
    test_parts = (
        set(test_df["participant_id"].unique())
        if test_df is not None and "participant_id" in test_df.columns
        else set()
    )

    leak_train_val = train_parts.intersection(val_parts)
    leak_train_test = train_parts.intersection(test_parts)
    leak_val_test = val_parts.intersection(test_parts)

    is_disjoint = not (leak_train_val or leak_train_test or leak_val_test)

    return {
        "is_disjoint": is_disjoint,
        "train_participant_count": len(train_parts),
        "validation_participant_count": len(val_parts),
        "test_participant_count": len(test_parts),
        "overlap_train_val": sorted(list(leak_train_val)),
        "overlap_train_test": sorted(list(leak_train_test)),
        "overlap_val_test": sorted(list(leak_val_test)),
    }

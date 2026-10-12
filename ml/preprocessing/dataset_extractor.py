"""Dataset Feature Extraction Manager.

Processes batches of real video files from official DAiSEE splits, applies
canonical facial feature extraction with MediaPipe Tasks, and compiles
labeled feature DataFrames with execution and quality auditing.
"""

from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from ml.configs.dataset_config import DAiSEEConfig
from ml.configs.training_config import CANONICAL_FEATURE_COLUMNS
from ml.preprocessing.feature_extractor import extract_features_from_video


def resolve_video_path(
    base_video_dir: Path,
    participant_id: str,
    clip_id: str,
) -> Optional[Path]:
    """Resolves the physical path to a DAiSEE video file.

    Handles directory structures like:
    `DataSet/<split>/<participant>/<clip_stem>/<clip_stem>.avi`
    or directly `DataSet/<split>/<clip_id>`.
    """
    stem = Path(clip_id).stem.strip()
    candidate1 = base_video_dir / participant_id / stem / f"{stem}.avi"
    if candidate1.exists():
        return candidate1

    candidate2 = base_video_dir / stem / f"{stem}.avi"
    if candidate2.exists():
        return candidate2

    candidate3 = base_video_dir / f"{stem}.avi"
    if candidate3.exists():
        return candidate3

    return None


FEATURE_EXTRACTOR_VERSION = "2.0.0"


def select_representative_subset(
    df: pd.DataFrame,
    max_videos: Optional[int] = None,
    stratify_target: Optional[str] = "joint",
    random_seed: int = 42,
) -> pd.DataFrame:
    """Selects a representative subset from available split videos.

    Guarantees minority class presence without data leakage across splits.
    If stratify_target is 'joint', stratifies across both engagement and confusion
    binary state quadrants (e0_c0, e0_c1, e1_c0, e1_c1) with a minimum minority floor.
    """
    if not max_videos or len(df) <= max_videos:
        return df.copy()

    df = df.copy()
    if stratify_target == "joint" and "engagement" in df.columns and "confusion" in df.columns:
        e_bin = (df["engagement"] >= 2).astype(int).astype(str)
        c_bin = (df["confusion"] >= 2).astype(int).astype(str)
        df["_strata"] = "e" + e_bin + "_c" + c_bin

        strata_counts = df["_strata"].value_counts()
        min_floor = max(4, max_videos // 12)

        parts: List[pd.DataFrame] = []
        remaining_budget = max_videos
        sampled_indices = set()

        for s_name in strata_counts.index[::-1]:
            s_df = df[df["_strata"] == s_name]
            n_take = min(min_floor, len(s_df), remaining_budget)
            if n_take > 0:
                s_sample = s_df.sample(n=n_take, random_state=random_seed)
                sampled_indices.update(s_sample.index)
                parts.append(s_sample)
                remaining_budget -= n_take

        remaining_df = df.loc[~df.index.isin(sampled_indices)]
        if remaining_budget > 0 and len(remaining_df) > 0:
            fill_sample = remaining_df.sample(n=min(remaining_budget, len(remaining_df)), random_state=random_seed)
            parts.append(fill_sample)

        selected = pd.concat(parts).sample(frac=1.0, random_state=random_seed)
        return selected.drop(columns=["_strata"])

    elif stratify_target and stratify_target in df.columns:
        grouped = df.groupby(stratify_target, group_keys=False)
        fraction = min(1.0, max_videos / len(df))

        def _sample_group(g: pd.DataFrame) -> pd.DataFrame:
            n_items = max(1, min(len(g), int(np.ceil(len(g) * fraction))))
            return g.sample(n=n_items, random_state=random_seed)

        sampled = grouped.apply(_sample_group)
        if len(sampled) > max_videos:
            sampled = sampled.sample(n=max_videos, random_state=random_seed)
        return sampled

    return df.sample(n=max_videos, random_state=random_seed)


def extract_features_for_split_subset(
    split_df: pd.DataFrame,
    split_name: str,
    dataset_config: Optional[DAiSEEConfig] = None,
    max_videos: Optional[int] = None,
    max_frames_per_video: int = 40,
    sample_stride: int = 4,
    stratify_target: Optional[str] = "joint",
    random_seed: int = 42,
    output_features_dir: Optional[Path] = None,
    force_reextract: bool = False,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Extracts features from real DAiSEE videos for a specified split with resumable caching.

    Args:
        split_df: DataFrame with normalized annotations ('clip_id', 'participant_id', etc.).
        split_name: Name of the split ('Train', 'Validation', 'Test').
        dataset_config: DAiSEE path configuration.
        max_videos: Maximum number of real videos to process.
        max_frames_per_video: Frame cap per video for fast reliable extraction.
        sample_stride: Stride step between sampled video frames.
        stratify_target: 'joint', 'engagement', 'confusion', or None.
        random_seed: Random seed for deterministic sample selection.
        output_features_dir: Optional directory to cache extracted CSV.
        force_reextract: If True, bypasses existing cache and forces re-extraction.

    Returns:
        Tuple of (features_dataframe, extraction_audit_statistics).
    """
    cfg = dataset_config or DAiSEEConfig()
    v_dir = cfg.get_split_video_dir(split_name)

    # 1. Filter to physically available videos
    available_records: List[Dict[str, Any]] = []
    skipped_count = 0

    for _, row in split_df.iterrows():
        p_id = str(row["participant_id"]).strip()
        c_id = str(row["clip_id"]).strip()
        v_path = resolve_video_path(v_dir, p_id, c_id)
        if v_path and v_path.exists():
            item = dict(row)
            item["_video_path"] = str(v_path)
            available_records.append(item)
        else:
            skipped_count += 1

    avail_df = pd.DataFrame(available_records)
    print(f"\n[{split_name.upper()}] Physically available videos: {len(avail_df)} / {len(split_df)} (Skipped/Missing: {skipped_count})")

    if avail_df.empty:
        return pd.DataFrame(), {
            "split": split_name,
            "processed": 0,
            "skipped": skipped_count,
            "failed": 0,
            "cached_reused": 0,
            "total_available": 0,
        }

    # 2. Select representative subset
    selected_df = select_representative_subset(
        avail_df,
        max_videos=max_videos,
        stratify_target=stratify_target,
        random_seed=random_seed,
    )
    print(f"[{split_name.upper()}] Selected {len(selected_df)} videos for feature extraction.")

    # 3. Check for existing valid cache to resume or reuse
    out_dir = output_features_dir or (cfg.base_dir / "Features")
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_path = out_dir / f"features_{split_name.lower()}_subset.csv"

    cached_map: Dict[str, Dict[str, Any]] = {}
    if not force_reextract and cache_path.exists():
        try:
            existing_cached_df = pd.read_csv(cache_path)
            has_version = (
                "_extractor_version" in existing_cached_df.columns
                and (existing_cached_df["_extractor_version"].astype(str) == FEATURE_EXTRACTOR_VERSION).all()
            )
            has_schema = all(col in existing_cached_df.columns for col in CANONICAL_FEATURE_COLUMNS)
            if has_version and has_schema:
                for _, c_row in existing_cached_df.iterrows():
                    c_id = str(c_row["clip_id"]).strip()
                    cached_map[c_id] = dict(c_row)
                print(f"[{split_name.upper()}] Loaded {len(cached_map)} valid cached clips from {cache_path}")
            else:
                print(f"[{split_name.upper()}] Existing cache at {cache_path} is stale or schema mismatch. Re-extracting.")
        except Exception as e:
            print(f"[{split_name.upper()}] Failed reading cache ({e}). Re-extracting.")

    # 4. Feature Extraction Loop with Resumption
    extracted_rows: List[Dict[str, Any]] = []
    processed_count = 0
    cached_reused_count = 0
    failed_count = 0
    start_time = time.time()

    for idx, (_, row) in enumerate(selected_df.iterrows()):
        c_id = str(row["clip_id"]).strip()
        v_path = Path(row["_video_path"])

        if c_id in cached_map:
            cached_item = dict(cached_map[c_id])
            if "_video_path" in cached_item:
                del cached_item["_video_path"]
            extracted_rows.append(cached_item)
            cached_reused_count += 1
            continue

        try:
            feats = extract_features_from_video(
                v_path,
                max_frames=max_frames_per_video,
                sample_stride=sample_stride,
            )
            item = dict(row)
            item.update(feats)
            item["_extractor_version"] = FEATURE_EXTRACTOR_VERSION
            extracted_rows.append(item)
            processed_count += 1
            if (processed_count % 10 == 0) or (idx + 1 == len(selected_df)):
                elapsed = time.time() - start_time
                print(f"  Extracted {processed_count} new videos ({elapsed:.1f}s, last valid_ratio={feats.get('valid_frames_ratio', 0.0):.2f})")
        except Exception as err:
            print(f"  [ERROR] Failed extracting {v_path.name}: {err}")
            failed_count += 1

    result_df = pd.DataFrame(extracted_rows)
    if "_video_path" in result_df.columns:
        result_df = result_df.drop(columns=["_video_path"])

    # 5. Save updated cache (preserving all accumulated clips in cache)
    combined_cache_records = dict(cached_map)
    for rec in extracted_rows:
        rec_clean = dict(rec)
        if "_video_path" in rec_clean:
            del rec_clean["_video_path"]
        combined_cache_records[str(rec_clean["clip_id"]).strip()] = rec_clean

    full_cache_df = pd.DataFrame(list(combined_cache_records.values()))
    full_cache_df.to_csv(cache_path, index=False)
    print(f"[{split_name.upper()}] Saved features ({len(result_df)} clips returned, {len(full_cache_df)} total in persistent cache, {cached_reused_count} reused, {processed_count} newly extracted) to: {cache_path}")

    audit_stats = {
        "split": split_name,
        "processed": processed_count,
        "cached_reused": cached_reused_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "total_available": len(avail_df),
        "mean_valid_frames_ratio": float(result_df["valid_frames_ratio"].mean()) if "valid_frames_ratio" in result_df.columns else 0.0,
        "extractor_version": FEATURE_EXTRACTOR_VERSION,
        "cache_path": str(cache_path),
    }

    return result_df, audit_stats

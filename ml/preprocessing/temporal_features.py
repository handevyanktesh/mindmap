"""Temporal Feature Aggregator.

Computes windowed and video-level temporal statistics over sequences of
frame-level facial metrics (EAR, Gaze, Head Pose).

All statistical formulations mirror the browser runtime temporal logic
(frontend/src/features/temporal/temporalFeatures.js).
"""

from typing import Any, Dict, List, Optional, Sequence
import numpy as np


# Standard thresholds matching browser defaults
DEFAULT_EAR_CLOSURE_THRESHOLD = 0.18
DEFAULT_GAZE_DEVIATION_THRESHOLD = 0.15
DEFAULT_HEAD_YAW_TURN_THRESHOLD = 20.0  # degrees
DEFAULT_HEAD_PITCH_TURN_THRESHOLD = 15.0  # degrees


def _safe_mean(values: Sequence[float]) -> float:
    arr = [v for v in values if v is not None and np.isfinite(v)]
    return float(np.mean(arr)) if len(arr) > 0 else 0.0


def _safe_std(values: Sequence[float]) -> float:
    arr = [v for v in values if v is not None and np.isfinite(v)]
    return float(np.std(arr, ddof=0)) if len(arr) > 1 else 0.0


def _safe_min(values: Sequence[float]) -> float:
    arr = [v for v in values if v is not None and np.isfinite(v)]
    return float(np.min(arr)) if len(arr) > 0 else 0.0


def _safe_max(values: Sequence[float]) -> float:
    arr = [v for v in values if v is not None and np.isfinite(v)]
    return float(np.max(arr)) if len(arr) > 0 else 0.0


def _safe_velocity(values: Sequence[float]) -> float:
    """Computes mean absolute frame-to-frame change rate."""
    arr = [v for v in values if v is not None and np.isfinite(v)]
    if len(arr) < 2:
        return 0.0
    diffs = np.abs(np.diff(arr))
    return float(np.mean(diffs))


def _calculate_gaze_displacement(gx_list: Sequence[float], gy_list: Sequence[float]) -> float:
    """Calculates accumulated 2D Euclidean displacement across valid consecutive gaze points."""
    valid_pairs = [
        (x, y)
        for x, y in zip(gx_list, gy_list)
        if x is not None and y is not None and np.isfinite(x) and np.isfinite(y)
    ]
    if len(valid_pairs) < 2:
        return 0.0

    total_disp = 0.0
    for i in range(1, len(valid_pairs)):
        dx = valid_pairs[i][0] - valid_pairs[i - 1][0]
        dy = valid_pairs[i][1] - valid_pairs[i - 1][1]
        total_disp += float(np.hypot(dx, dy))
    return total_disp


def _calculate_pose_displacement(
    yaw_list: Sequence[float], pitch_list: Sequence[float], roll_list: Sequence[float]
) -> float:
    """Calculates accumulated 3D angular displacement across consecutive head pose angles."""
    valid_triplets = [
        (y, p, r)
        for y, p, r in zip(yaw_list, pitch_list, roll_list)
        if None not in (y, p, r) and np.isfinite(y) and np.isfinite(p) and np.isfinite(r)
    ]
    if len(valid_triplets) < 2:
        return 0.0

    total_disp = 0.0
    for i in range(1, len(valid_triplets)):
        dy = valid_triplets[i][0] - valid_triplets[i - 1][0]
        dp = valid_triplets[i][1] - valid_triplets[i - 1][1]
        dr = valid_triplets[i][2] - valid_triplets[i - 1][2]
        total_disp += float(np.sqrt(dy * dy + dp * dp + dr * dr))
    return total_disp


def aggregate_temporal_features(
    frame_records: List[Dict[str, Any]],
    total_expected_frames: Optional[int] = None,
    ear_closure_thresh: float = DEFAULT_EAR_CLOSURE_THRESHOLD,
    gaze_dev_thresh: float = DEFAULT_GAZE_DEVIATION_THRESHOLD,
    yaw_turn_thresh: float = DEFAULT_HEAD_YAW_TURN_THRESHOLD,
    pitch_turn_thresh: float = DEFAULT_HEAD_PITCH_TURN_THRESHOLD,
) -> Dict[str, float]:
    """Aggregates a sequence of frame observations into canonical statistical features.

    Args:
        frame_records: List of frame dicts with keys:
            'ear', 'gaze_x', 'gaze_y', 'head_yaw', 'head_pitch', 'head_roll', 'is_valid'.
        total_expected_frames: Total video frames (defaults to len(frame_records)).

    Returns:
        Dictionary of canonical feature names mapped to numerical float values.
    """
    total_frames = total_expected_frames if total_expected_frames and total_expected_frames > 0 else len(frame_records)
    if total_frames == 0:
        total_frames = 1

    if not frame_records:
        # Return all zeros when no frames are provided
        return {
            "ear_mean": 0.0,
            "ear_std": 0.0,
            "ear_min": 0.0,
            "ear_max": 0.0,
            "ear_velocity": 0.0,
            "ear_closure_ratio": 0.0,
            "gaze_x_mean": 0.5,
            "gaze_y_mean": 0.5,
            "gaze_x_std": 0.0,
            "gaze_y_std": 0.0,
            "gaze_displacement": 0.0,
            "gaze_deviation_ratio": 0.0,
            "head_yaw_mean": 0.0,
            "head_pitch_mean": 0.0,
            "head_roll_mean": 0.0,
            "head_yaw_std": 0.0,
            "head_pitch_std": 0.0,
            "head_roll_std": 0.0,
            "head_pose_displacement": 0.0,
            "head_pose_turn_ratio": 0.0,
            "gaze_spread": 0.0,
            "pose_spread": 0.0,
            "valid_frames_ratio": 0.0,
            "ear_valid_ratio": 0.0,
            "gaze_valid_ratio": 0.0,
            "pose_valid_ratio": 0.0,
        }

    # Extract sequences
    ear_vals: List[float] = []
    gaze_x_vals: List[float] = []
    gaze_y_vals: List[float] = []
    yaw_vals: List[float] = []
    pitch_vals: List[float] = []
    roll_vals: List[float] = []
    valid_frames_count = 0

    ear_closure_count = 0
    gaze_dev_count = 0
    pose_turn_count = 0

    for rec in frame_records:
        if not rec:
            continue
        if rec.get("is_valid", False):
            valid_frames_count += 1

        # EAR
        ear = rec.get("ear")
        if ear is not None and np.isfinite(ear):
            ear_vals.append(float(ear))
            if float(ear) < ear_closure_thresh:
                ear_closure_count += 1

        # Gaze
        gx = rec.get("gaze_x")
        gy = rec.get("gaze_y")
        if gx is not None and gy is not None and np.isfinite(gx) and np.isfinite(gy):
            gaze_x_vals.append(float(gx))
            gaze_y_vals.append(float(gy))
            # Distance from center (0.5, 0.5)
            center_dist = np.hypot(float(gx) - 0.5, float(gy) - 0.5)
            if center_dist > gaze_dev_thresh:
                gaze_dev_count += 1

        # Head Pose
        yaw = rec.get("head_yaw")
        pitch = rec.get("head_pitch")
        roll = rec.get("head_roll")
        if (
            yaw is not None
            and pitch is not None
            and roll is not None
            and np.isfinite(yaw)
            and np.isfinite(pitch)
            and np.isfinite(roll)
        ):
            yaw_vals.append(float(yaw))
            pitch_vals.append(float(pitch))
            roll_vals.append(float(roll))
            if abs(float(yaw)) > yaw_turn_thresh or abs(float(pitch)) > pitch_turn_thresh:
                pose_turn_count += 1

    # Aggregations
    ear_mean = _safe_mean(ear_vals)
    ear_std = _safe_std(ear_vals)
    ear_min = _safe_min(ear_vals)
    ear_max = _safe_max(ear_vals)
    ear_vel = _safe_velocity(ear_vals)
    ear_closure_ratio = (ear_closure_count / len(ear_vals)) if ear_vals else 0.0

    gaze_x_mean = _safe_mean(gaze_x_vals) if gaze_x_vals else 0.5
    gaze_y_mean = _safe_mean(gaze_y_vals) if gaze_y_vals else 0.5
    gaze_x_std = _safe_std(gaze_x_vals)
    gaze_y_std = _safe_std(gaze_y_vals)
    gaze_disp = _calculate_gaze_displacement(gaze_x_vals, gaze_y_vals)
    gaze_dev_ratio = (gaze_dev_count / len(gaze_x_vals)) if gaze_x_vals else 0.0

    yaw_mean = _safe_mean(yaw_vals)
    pitch_mean = _safe_mean(pitch_vals)
    roll_mean = _safe_mean(roll_vals)
    yaw_std = _safe_std(yaw_vals)
    pitch_std = _safe_std(pitch_vals)
    roll_std = _safe_std(roll_vals)
    pose_disp = _calculate_pose_displacement(yaw_vals, pitch_vals, roll_vals)
    pose_turn_ratio = (pose_turn_count / len(yaw_vals)) if yaw_vals else 0.0

    # Cross-modal dispersion
    gaze_spread = float(np.hypot(gaze_x_std, gaze_y_std))
    pose_spread = float(np.sqrt(yaw_std**2 + pitch_std**2 + roll_std**2))

    # Quality indicators
    valid_frames_ratio = float(np.clip(valid_frames_count / total_frames, 0.0, 1.0))
    ear_valid_ratio = float(np.clip(len(ear_vals) / total_frames, 0.0, 1.0))
    gaze_valid_ratio = float(np.clip(len(gaze_x_vals) / total_frames, 0.0, 1.0))
    pose_valid_ratio = float(np.clip(len(yaw_vals) / total_frames, 0.0, 1.0))

    return {
        "ear_mean": ear_mean,
        "ear_std": ear_std,
        "ear_min": ear_min,
        "ear_max": ear_max,
        "ear_velocity": ear_vel,
        "ear_closure_ratio": float(np.clip(ear_closure_ratio, 0.0, 1.0)),
        "gaze_x_mean": gaze_x_mean,
        "gaze_y_mean": gaze_y_mean,
        "gaze_x_std": gaze_x_std,
        "gaze_y_std": gaze_y_std,
        "gaze_displacement": gaze_disp,
        "gaze_deviation_ratio": float(np.clip(gaze_dev_ratio, 0.0, 1.0)),
        "head_yaw_mean": yaw_mean,
        "head_pitch_mean": pitch_mean,
        "head_roll_mean": roll_mean,
        "head_yaw_std": yaw_std,
        "head_pitch_std": pitch_std,
        "head_roll_std": roll_std,
        "head_pose_displacement": pose_disp,
        "head_pose_turn_ratio": float(np.clip(pose_turn_ratio, 0.0, 1.0)),
        "gaze_spread": gaze_spread,
        "pose_spread": pose_spread,
        "valid_frames_ratio": valid_frames_ratio,
        "ear_valid_ratio": ear_valid_ratio,
        "gaze_valid_ratio": gaze_valid_ratio,
        "pose_valid_ratio": pose_valid_ratio,
    }

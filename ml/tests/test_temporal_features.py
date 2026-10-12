"""Unit tests for temporal feature aggregation."""

import numpy as np
import pytest

from ml.configs.training_config import CANONICAL_FEATURE_COLUMNS
from ml.preprocessing.temporal_features import aggregate_temporal_features


def test_aggregate_temporal_features_empty():
    res = aggregate_temporal_features([])
    for col in CANONICAL_FEATURE_COLUMNS:
        assert col in res
        assert np.isfinite(res[col])
    assert res["valid_frames_ratio"] == 0.0


def test_aggregate_temporal_features_constant_series():
    frames = [
        {
            "ear": 0.30,
            "gaze_x": 0.50,
            "gaze_y": 0.50,
            "head_yaw": 5.0,
            "head_pitch": 2.0,
            "head_roll": 0.0,
            "is_valid": True,
        }
        for _ in range(10)
    ]
    res = aggregate_temporal_features(frames, total_expected_frames=10)

    assert res["ear_mean"] == pytest.approx(0.30)
    assert res["ear_std"] == pytest.approx(0.0)
    assert res["ear_min"] == pytest.approx(0.30)
    assert res["ear_max"] == pytest.approx(0.30)
    assert res["ear_velocity"] == pytest.approx(0.0)
    assert res["ear_closure_ratio"] == pytest.approx(0.0)

    assert res["gaze_x_mean"] == pytest.approx(0.50)
    assert res["gaze_displacement"] == pytest.approx(0.0)
    assert res["head_yaw_mean"] == pytest.approx(5.0)
    assert res["valid_frames_ratio"] == pytest.approx(1.0)


def test_aggregate_temporal_features_variation_and_closures():
    frames = [
        # 3 normal open frames
        {"ear": 0.30, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
        {"ear": 0.30, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
        {"ear": 0.30, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
        # 2 closed eye blink frames (EAR < 0.18)
        {"ear": 0.10, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
        {"ear": 0.10, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
    ]
    res = aggregate_temporal_features(frames, total_expected_frames=5)

    assert res["ear_closure_ratio"] == pytest.approx(2.0 / 5.0)
    assert res["ear_min"] == pytest.approx(0.10)
    assert res["ear_max"] == pytest.approx(0.30)
    assert res["ear_std"] > 0.0
    assert res["ear_velocity"] > 0.0


def test_aggregate_temporal_features_default_expected_frames():
    # If total_expected_frames is None, defaults to len(frame_records)
    frames = [
        {"ear": 0.25, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
        {"ear": 0.25, "gaze_x": 0.50, "gaze_y": 0.50, "head_yaw": 0.0, "head_pitch": 0.0, "head_roll": 0.0, "is_valid": True},
        {"ear": None, "gaze_x": None, "gaze_y": None, "head_yaw": None, "head_pitch": None, "head_roll": None, "is_valid": False},
    ]
    res = aggregate_temporal_features(frames)
    assert res["valid_frames_ratio"] == pytest.approx(2.0 / 3.0)
    assert res["ear_valid_ratio"] == pytest.approx(2.0 / 3.0)

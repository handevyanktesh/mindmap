"""Unit tests for frame and sequence feature extraction."""

import numpy as np
import pytest

from ml.preprocessing.feature_extractor import (
    extract_features_from_landmark_sequence,
    extract_frame_features,
)
from ml.tests.test_landmark_definitions import _make_dummy_landmarks


def test_extract_frame_features_none():
    res = extract_frame_features(None)
    assert res["is_valid"] is False
    assert res["ear"] is None
    assert res["gaze_x"] is None
    assert res["head_yaw"] is None


def test_extract_frame_features_valid():
    landmarks = _make_dummy_landmarks(478)
    landmarks[33] = {"x": 0.20, "y": 0.40, "z": 0.0}
    landmarks[263] = {"x": 0.80, "y": 0.40, "z": 0.0}
    landmarks[168] = {"x": 0.50, "y": 0.35, "z": 0.0}
    landmarks[152] = {"x": 0.50, "y": 0.75, "z": 0.0}

    res = extract_frame_features(landmarks)
    assert res["is_valid"] is True
    assert res["head_yaw"] is not None
    assert res["head_pitch"] is not None
    assert res["head_roll"] is not None


def test_extract_features_from_landmark_sequence():
    landmarks = _make_dummy_landmarks(478)
    landmarks[33] = {"x": 0.20, "y": 0.40, "z": 0.0}
    landmarks[263] = {"x": 0.80, "y": 0.40, "z": 0.0}
    landmarks[168] = {"x": 0.50, "y": 0.35, "z": 0.0}
    landmarks[152] = {"x": 0.50, "y": 0.75, "z": 0.0}

    # 5 valid frames, 2 None frames
    seq = [landmarks] * 5 + [None, None]
    temporal_res = extract_features_from_landmark_sequence(seq, total_expected_frames=7)

    assert "ear_mean" in temporal_res
    assert "gaze_x_mean" in temporal_res
    assert "valid_frames_ratio" in temporal_res
    assert temporal_res["valid_frames_ratio"] == pytest.approx(5.0 / 7.0)

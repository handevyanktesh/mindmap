"""Unit tests for canonical landmark definitions and geometric calculations."""

import math
import numpy as np
import pytest

from ml.preprocessing.landmark_definitions import (
    LEFT_EYE_LANDMARKS,
    RIGHT_EYE_LANDMARKS,
    calculate_ear,
    calculate_gaze,
    calculate_head_pose,
    calculate_single_eye_ear,
    euclidean_distance_2d,
)


def _make_dummy_landmarks(count: int = 478):
    """Creates a list of landmark objects with {x, y, z} defaults."""
    return [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(count)]


def test_euclidean_distance_2d():
    p1 = {"x": 0.0, "y": 0.0}
    p2 = {"x": 3.0, "y": 4.0}
    dist = euclidean_distance_2d(p1, p2)
    assert dist == pytest.approx(5.0)

    # Invalid / None inputs
    assert euclidean_distance_2d(None, p2) is None
    assert euclidean_distance_2d(p1, {"x": float("nan"), "y": 0.0}) is None


def test_calculate_single_eye_ear_open_vs_closed():
    # Canonical open eye points: width = 0.10, height1 = 0.03, height2 = 0.03
    p1 = {"x": 0.20, "y": 0.30}  # outer corner
    p4 = {"x": 0.30, "y": 0.30}  # inner corner (width = 0.10)
    p2 = {"x": 0.23, "y": 0.285}
    p6 = {"x": 0.23, "y": 0.315}  # dist = 0.030
    p3 = {"x": 0.27, "y": 0.285}
    p5 = {"x": 0.27, "y": 0.315}  # dist = 0.030

    ear_open = calculate_single_eye_ear(p1, p2, p3, p4, p5, p6)
    assert ear_open is not None
    # EAR = (0.03 + 0.03) / (2 * 0.10) = 0.30
    assert ear_open == pytest.approx(0.30, rel=1e-3)

    # Closed eye: vertical points coincide with horizontal axis
    p2_closed = {"x": 0.23, "y": 0.30}
    p6_closed = {"x": 0.23, "y": 0.30}
    p3_closed = {"x": 0.27, "y": 0.30}
    p5_closed = {"x": 0.27, "y": 0.30}

    ear_closed = calculate_single_eye_ear(p1, p2_closed, p3_closed, p4, p5_closed, p6_closed)
    assert ear_closed == pytest.approx(0.0, abs=1e-5)

    # Degenerate zero width
    ear_zero = calculate_single_eye_ear(p1, p2, p3, p1, p5, p6)
    assert ear_zero is None


def test_calculate_ear_from_landmark_array():
    landmarks = _make_dummy_landmarks(478)

    # Populate left eye
    landmarks[362] = {"x": 0.40, "y": 0.30, "z": 0.0}
    landmarks[263] = {"x": 0.46, "y": 0.30, "z": 0.0}
    landmarks[385] = {"x": 0.42, "y": 0.29, "z": 0.0}
    landmarks[380] = {"x": 0.42, "y": 0.31, "z": 0.0}
    landmarks[387] = {"x": 0.44, "y": 0.29, "z": 0.0}
    landmarks[373] = {"x": 0.44, "y": 0.31, "z": 0.0}

    # Populate right eye
    landmarks[33] = {"x": 0.20, "y": 0.30, "z": 0.0}
    landmarks[133] = {"x": 0.26, "y": 0.30, "z": 0.0}
    landmarks[160] = {"x": 0.22, "y": 0.29, "z": 0.0}
    landmarks[144] = {"x": 0.22, "y": 0.31, "z": 0.0}
    landmarks[158] = {"x": 0.24, "y": 0.29, "z": 0.0}
    landmarks[153] = {"x": 0.24, "y": 0.31, "z": 0.0}

    l_ear, r_ear, comb_ear = calculate_ear(landmarks)
    assert l_ear is not None
    assert r_ear is not None
    assert comb_ear == pytest.approx((l_ear + r_ear) / 2.0)

    # Insufficient landmarks
    assert calculate_ear([]) == (None, None, None)
    assert calculate_ear(None) == (None, None, None)


def test_calculate_gaze_centered_and_deviated():
    landmarks = _make_dummy_landmarks(478)

    # Left eye bounds: x in [0.40, 0.50], y in [0.25, 0.35]
    landmarks[362] = {"x": 0.40, "y": 0.30, "z": 0.0}
    landmarks[263] = {"x": 0.50, "y": 0.30, "z": 0.0}
    landmarks[386] = {"x": 0.45, "y": 0.25, "z": 0.0}
    landmarks[374] = {"x": 0.45, "y": 0.35, "z": 0.0}
    # Left iris at center (0.45, 0.30)
    landmarks[473] = {"x": 0.45, "y": 0.30, "z": 0.0}

    # Right eye bounds: x in [0.20, 0.30], y in [0.25, 0.35]
    landmarks[33] = {"x": 0.20, "y": 0.30, "z": 0.0}
    landmarks[133] = {"x": 0.30, "y": 0.30, "z": 0.0}
    landmarks[159] = {"x": 0.25, "y": 0.25, "z": 0.0}
    landmarks[145] = {"x": 0.25, "y": 0.35, "z": 0.0}
    # Right iris at center (0.25, 0.30)
    landmarks[468] = {"x": 0.25, "y": 0.30, "z": 0.0}

    gx, gy = calculate_gaze(landmarks)
    assert gx == pytest.approx(0.50, abs=0.01)
    assert gy == pytest.approx(0.50, abs=0.01)


def test_calculate_head_pose_frontal_and_rotated():
    landmarks = _make_dummy_landmarks(478)

    # Perfectly frontal head
    # Right eye outer (33) to Left eye outer (263) along X axis
    landmarks[33] = {"x": 0.30, "y": 0.40, "z": 0.0}
    landmarks[263] = {"x": 0.70, "y": 0.40, "z": 0.0}
    # Nose bridge (168) to Chin (152) along Y axis
    landmarks[168] = {"x": 0.50, "y": 0.35, "z": 0.0}
    landmarks[152] = {"x": 0.50, "y": 0.75, "z": 0.0}

    yaw, pitch, roll = calculate_head_pose(landmarks)
    assert yaw == pytest.approx(0.0, abs=1.0)
    assert pitch == pytest.approx(0.0, abs=1.0)
    assert roll == pytest.approx(0.0, abs=1.0)

    # Tilted roll (eyes tilted 45 degrees)
    landmarks[33] = {"x": 0.30, "y": 0.30, "z": 0.0}
    landmarks[263] = {"x": 0.70, "y": 0.70, "z": 0.0}
    yaw_t, pitch_t, roll_t = calculate_head_pose(landmarks)
    assert roll_t == pytest.approx(45.0, abs=1.0)

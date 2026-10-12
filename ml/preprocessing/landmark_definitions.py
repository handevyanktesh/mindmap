"""Canonical MediaPipe Facial Landmark Indices and Geometry.

Directly mirrors the topological indices and geometric formulas used in the
browser runtime (frontend/src/features/facial/).

MediaPipe Face Mesh Canonical Topology (468/478 landmarks):
- Left Eye EAR: 362, 385, 387, 263, 373, 380
- Right Eye EAR: 33, 160, 158, 133, 153, 144
- Irises: Left 473, Right 468
- Head Pose Basis: Right Outer Canthus (33), Left Outer Canthus (263),
  Nose Bridge / Sellion (168), Nose Tip (1), Chin (152), Mouth cheilion (61, 291).
"""

import math
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import numpy as np


# Left Eye Landmark Indices (Subject's Left / Observer's Right)
LEFT_EYE_LANDMARKS = {
    "p1": 362,  # Medial canthus (inner corner)
    "p2": 385,  # Upper eyelid lateral
    "p3": 387,  # Upper eyelid medial
    "p4": 263,  # Lateral canthus (outer corner)
    "p5": 373,  # Lower eyelid medial
    "p6": 380,  # Lower eyelid lateral
}

# Right Eye Landmark Indices (Subject's Right / Observer's Left)
RIGHT_EYE_LANDMARKS = {
    "p1": 33,   # Lateral canthus (outer corner)
    "p2": 160,  # Upper eyelid lateral
    "p3": 158,  # Upper eyelid medial
    "p4": 133,  # Medial canthus (inner corner)
    "p5": 153,  # Lower eyelid medial
    "p6": 144,  # Lower eyelid lateral
}

# Iris Centers and Perimeters (MediaPipe 478-landmark model)
LEFT_IRIS_LANDMARKS = {
    "center": 473,
    "perimeter": [474, 475, 476, 477],
}

RIGHT_IRIS_LANDMARKS = {
    "center": 468,
    "perimeter": [469, 470, 471, 472],
}

# Eye Boundary Landmarks for Gaze Normalization
LEFT_EYE_BOUNDS = {
    "corner_inner": 362,
    "corner_outer": 263,
    "eyelid_upper": 386,
    "eyelid_lower": 374,
}

RIGHT_EYE_BOUNDS = {
    "corner_outer": 33,
    "corner_inner": 133,
    "eyelid_upper": 159,
    "eyelid_lower": 145,
}

# Head Pose Key Landmark Indices
HEAD_POSE_LANDMARKS = {
    "right_eye_outer": 33,
    "left_eye_outer": 263,
    "nose_bridge": 168,
    "nose_tip": 1,
    "chin": 152,
    "right_mouth_corner": 61,
    "left_mouth_corner": 291,
}

EPSILON = 1e-7


def _get_point_coords(
    landmark: Any,
) -> Optional[Tuple[float, float, float]]:
    """Safely extracts (x, y, z) coordinates from dictionary, object, or sequence."""
    if landmark is None:
        return None
    try:
        if isinstance(landmark, dict):
            x = float(landmark.get("x", np.nan))
            y = float(landmark.get("y", np.nan))
            z = float(landmark.get("z", 0.0))
        elif hasattr(landmark, "x") and hasattr(landmark, "y"):
            x = float(landmark.x)
            y = float(landmark.y)
            z = float(getattr(landmark, "z", 0.0))
        elif isinstance(landmark, (list, tuple, np.ndarray)) and len(landmark) >= 2:
            x = float(landmark[0])
            y = float(landmark[1])
            z = float(landmark[2]) if len(landmark) > 2 else 0.0
        else:
            return None

        if not (np.isfinite(x) and np.isfinite(y) and np.isfinite(z)):
            return None
        return x, y, z
    except (TypeError, ValueError):
        return None


def euclidean_distance_2d(
    p1: Any, p2: Any
) -> Optional[float]:
    """Calculates 2D Euclidean distance between two landmark coordinates."""
    c1 = _get_point_coords(p1)
    c2 = _get_point_coords(p2)
    if c1 is None or c2 is None:
        return None
    dx = c1[0] - c2[0]
    dy = c1[1] - c2[1]
    return math.hypot(dx, dy)


def calculate_single_eye_ear(
    p1: Any, p2: Any, p3: Any, p4: Any, p5: Any, p6: Any
) -> Optional[float]:
    """Calculates Eye Aspect Ratio (EAR) using Soukupová & Čech (2016) formulation:

    EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)

    Args:
        p1: Horizontal eye corner 1
        p2: Upper eyelid vertical point 1
        p3: Upper eyelid vertical point 2
        p4: Horizontal eye corner 2
        p5: Lower eyelid vertical point 2 (paired with p3)
        p6: Lower eyelid vertical point 1 (paired with p2)

    Returns:
        EAR float value or None if invalid or degenerate eye width.
    """
    dist_a = euclidean_distance_2d(p2, p6)
    dist_b = euclidean_distance_2d(p3, p5)
    dist_c = euclidean_distance_2d(p1, p4)

    if dist_a is None or dist_b is None or dist_c is None:
        return None

    if dist_c <= EPSILON:
        return None

    ear = (dist_a + dist_b) / (2.0 * dist_c)
    if not np.isfinite(ear) or ear < 0.0:
        return None
    return ear


def calculate_ear(
    landmarks: Sequence[Any],
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """Calculates left, right, and combined EAR from landmark array.

    Returns:
        Tuple of (left_ear, right_ear, combined_ear)
    """
    if landmarks is None or len(landmarks) < 388:
        return None, None, None

    # Left eye
    l_ear = calculate_single_eye_ear(
        landmarks[LEFT_EYE_LANDMARKS["p1"]],
        landmarks[LEFT_EYE_LANDMARKS["p2"]],
        landmarks[LEFT_EYE_LANDMARKS["p3"]],
        landmarks[LEFT_EYE_LANDMARKS["p4"]],
        landmarks[LEFT_EYE_LANDMARKS["p5"]],
        landmarks[LEFT_EYE_LANDMARKS["p6"]],
    )

    # Right eye
    r_ear = calculate_single_eye_ear(
        landmarks[RIGHT_EYE_LANDMARKS["p1"]],
        landmarks[RIGHT_EYE_LANDMARKS["p2"]],
        landmarks[RIGHT_EYE_LANDMARKS["p3"]],
        landmarks[RIGHT_EYE_LANDMARKS["p4"]],
        landmarks[RIGHT_EYE_LANDMARKS["p5"]],
        landmarks[RIGHT_EYE_LANDMARKS["p6"]],
    )

    if l_ear is not None and r_ear is not None:
        combined_ear = (l_ear + r_ear) / 2.0
    elif l_ear is not None:
        combined_ear = l_ear
    elif r_ear is not None:
        combined_ear = r_ear
    else:
        combined_ear = None

    return l_ear, r_ear, combined_ear


def calculate_single_eye_gaze(
    iris_pt: Any, corner1: Any, corner2: Any, upper: Any, lower: Any
) -> Tuple[Optional[float], Optional[float]]:
    """Calculates normalized 2D gaze for a single eye.

    0.5 is centered; 0.0 is left/top bound, 1.0 is right/bottom bound.
    """
    iris_c = _get_point_coords(iris_pt)
    c1 = _get_point_coords(corner1)
    c2 = _get_point_coords(corner2)
    up = _get_point_coords(upper)
    lo = _get_point_coords(lower)

    if None in (iris_c, c1, c2, up, lo):
        return None, None

    min_x = min(c1[0], c2[0])
    max_x = max(c1[0], c2[0])
    min_y = min(up[1], lo[1])
    max_y = max(up[1], lo[1])

    width = max_x - min_x
    height = max_y - min_y

    if width <= EPSILON or height <= EPSILON:
        return None, None

    gaze_x = (iris_c[0] - min_x) / width
    gaze_y = (iris_c[1] - min_y) / height

    # Clamp to reasonable bounds [0.0, 1.0]
    gaze_x = float(np.clip(gaze_x, 0.0, 1.0))
    gaze_y = float(np.clip(gaze_y, 0.0, 1.0))
    return gaze_x, gaze_y


def calculate_gaze(
    landmarks: Sequence[Any],
) -> Tuple[Optional[float], Optional[float]]:
    """Calculates combined normalized (gaze_x, gaze_y) from landmarks."""
    if landmarks is None or len(landmarks) < 478:
        # 478 is required for iris landmarks
        return None, None

    l_iris = landmarks[LEFT_IRIS_LANDMARKS["center"]]
    l_c1 = landmarks[LEFT_EYE_BOUNDS["corner_inner"]]
    l_c2 = landmarks[LEFT_EYE_BOUNDS["corner_outer"]]
    l_up = landmarks[LEFT_EYE_BOUNDS["eyelid_upper"]]
    l_lo = landmarks[LEFT_EYE_BOUNDS["eyelid_lower"]]

    r_iris = landmarks[RIGHT_IRIS_LANDMARKS["center"]]
    r_c1 = landmarks[RIGHT_EYE_BOUNDS["corner_outer"]]
    r_c2 = landmarks[RIGHT_EYE_BOUNDS["corner_inner"]]
    r_up = landmarks[RIGHT_EYE_BOUNDS["eyelid_upper"]]
    r_lo = landmarks[RIGHT_EYE_BOUNDS["eyelid_lower"]]

    lx, ly = calculate_single_eye_gaze(l_iris, l_c1, l_c2, l_up, l_lo)
    rx, ry = calculate_single_eye_gaze(r_iris, r_c1, r_c2, r_up, r_lo)

    if lx is not None and rx is not None:
        gx = (lx + rx) / 2.0
    else:
        gx = lx if lx is not None else rx

    if ly is not None and ry is not None:
        gy = (ly + ry) / 2.0
    else:
        gy = ly if ly is not None else ry

    return gx, gy


def calculate_head_pose(
    landmarks: Sequence[Any],
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """Estimates head pose (Yaw, Pitch, Roll in degrees) from facial landmarks.

    Uses an orthonormal 3D facial coordinate basis matching browser implementation:
    - Transverse axis (uX): Vector from Right Eye Outer (33) to Left Eye Outer (263)
    - Vertical axis (uY): Vector from Nose Bridge (168) to Chin (152)
    - Sagittal Normal (uZ): Cross product (uX x uY) pointing out of face

    Conventions:
    - Yaw: + Turning head right, - Turning head left (0° = frontal)
    - Pitch: + Nodding chin down, - Looking chin up (0° = level)
    - Roll: + Tilting right shoulder, - Tilting left shoulder (0° = level)

    Returns:
        Tuple of (yaw, pitch, roll) in degrees.
    """
    if landmarks is None or len(landmarks) < 264:
        return None, None, None

    p_right = _get_point_coords(landmarks[HEAD_POSE_LANDMARKS["right_eye_outer"]])
    p_left = _get_point_coords(landmarks[HEAD_POSE_LANDMARKS["left_eye_outer"]])
    p_bridge = _get_point_coords(landmarks[HEAD_POSE_LANDMARKS["nose_bridge"]])
    p_chin = _get_point_coords(landmarks[HEAD_POSE_LANDMARKS["chin"]])

    if None in (p_right, p_left, p_bridge, p_chin):
        return None, None, None

    # 1. Transverse vector (Right Eye to Left Eye)
    vx = np.array([p_left[0] - p_right[0], p_left[1] - p_right[1], p_left[2] - p_right[2]], dtype=float)
    len_x = float(np.linalg.norm(vx))
    if len_x <= EPSILON:
        return None, None, None
    ux = vx / len_x

    # 2. Vertical vector (Nose Bridge to Chin)
    vy = np.array([p_chin[0] - p_bridge[0], p_chin[1] - p_bridge[1], p_chin[2] - p_bridge[2]], dtype=float)
    len_y = float(np.linalg.norm(vy))
    if len_y <= EPSILON:
        return None, None, None
    uy = vy / len_y

    # 3. Sagittal normal (uX cross uY)
    uz = np.cross(ux, uy)
    len_z = float(np.linalg.norm(uz))
    if len_z <= EPSILON:
        return None, None, None
    uz = uz / len_z

    # Re-orthogonalize uY to guarantee orthonormal basis
    uy = np.cross(uz, ux)
    uy = uy / np.linalg.norm(uy)

    # Derive Euler angles in degrees
    # Yaw: Horizontal rotation around Y
    yaw_rad = math.asin(float(np.clip(-uz[0], -1.0, 1.0)))
    yaw_deg = math.degrees(yaw_rad)

    # Pitch: Vertical rotation around X
    pitch_rad = math.asin(float(np.clip(uz[1], -1.0, 1.0)))
    pitch_deg = math.degrees(pitch_rad)

    # Roll: In-plane rotation around Z
    roll_rad = math.atan2(float(ux[1]), float(ux[0]))
    roll_deg = math.degrees(roll_rad)

    return yaw_deg, pitch_deg, roll_deg

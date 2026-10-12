"""Video & Frame Facial Feature Extractor.

Extracts normalized EAR, Gaze coordinates, and 3D Head Pose Euler angles
from facial landmarks, with support for live video decoding when OpenCV
and MediaPipe are available.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Union
import numpy as np

from ml.preprocessing.landmark_definitions import (
    calculate_ear,
    calculate_gaze,
    calculate_head_pose,
)
from ml.preprocessing.temporal_features import aggregate_temporal_features


def extract_frame_features(landmarks: Optional[Sequence[Any]]) -> Dict[str, Any]:
    """Extracts instantaneous frame-level features from canonical facial landmarks.

    Args:
        landmarks: 468 or 478 facial landmark coordinates (dict, tuple, or MediaPipe Landmark).

    Returns:
        Dictionary with:
            - 'ear': Combined EAR or None
            - 'ear_left': Left EAR or None
            - 'ear_right': Right EAR or None
            - 'gaze_x': Normalized combined gaze X or None
            - 'gaze_y': Normalized combined gaze Y or None
            - 'head_yaw': Head yaw angle in degrees or None
            - 'head_pitch': Head pitch angle in degrees or None
            - 'head_roll': Head roll angle in degrees or None
            - 'is_valid': True if face landmarks are present and extracted
    """
    if landmarks is None or len(landmarks) < 264:
        return {
            "ear": None,
            "ear_left": None,
            "ear_right": None,
            "gaze_x": None,
            "gaze_y": None,
            "head_yaw": None,
            "head_pitch": None,
            "head_roll": None,
            "is_valid": False,
        }

    l_ear, r_ear, comb_ear = calculate_ear(landmarks)
    gx, gy = calculate_gaze(landmarks)
    yaw, pitch, roll = calculate_head_pose(landmarks)

    is_valid = bool(
        comb_ear is not None or (gx is not None and gy is not None) or yaw is not None
    )

    return {
        "ear": comb_ear,
        "ear_left": l_ear,
        "ear_right": r_ear,
        "gaze_x": gx,
        "gaze_y": gy,
        "head_yaw": yaw,
        "head_pitch": pitch,
        "head_roll": roll,
        "is_valid": is_valid,
    }


def extract_features_from_landmark_sequence(
    landmark_sequence: Sequence[Optional[Sequence[Any]]],
    total_expected_frames: Optional[int] = None,
) -> Dict[str, float]:
    """Processes a pre-extracted sequence of frame landmarks into temporal features.

    Args:
        landmark_sequence: Sequence of frame landmarks (None if face missed in frame).
        total_expected_frames: Total frames in video (defaults to len(landmark_sequence)).

    Returns:
        Aggregated canonical feature dictionary.
    """
    frame_records = [
        extract_frame_features(frame_lm) for frame_lm in landmark_sequence
    ]
    return aggregate_temporal_features(
        frame_records, total_expected_frames=total_expected_frames
    )


MODEL_ASSET_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

_DETECTOR_CACHE = None


def get_face_landmarker_detector(model_path: Optional[Union[str, Path]] = None) -> Any:
    """Initializes and caches MediaPipe Tasks FaceLandmarker detector."""
    global _DETECTOR_CACHE
    if _DETECTOR_CACHE is not None:
        return _DETECTOR_CACHE

    import urllib.request
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    target_path = Path(model_path) if model_path else Path("ml/models/face_landmarker.task")
    if not target_path.exists():
        target_path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(MODEL_ASSET_URL, target_path)

    base_options = python.BaseOptions(model_asset_path=str(target_path))
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        num_faces=1,
        running_mode=vision.RunningMode.IMAGE,
    )
    _DETECTOR_CACHE = vision.FaceLandmarker.create_from_options(options)
    return _DETECTOR_CACHE


def extract_features_from_video(
    video_path: Union[str, Path],
    max_frames: Optional[int] = None,
    sample_stride: int = 1,
    model_path: Optional[Union[str, Path]] = None,
) -> Dict[str, float]:
    """Decodes video frames using OpenCV and MediaPipe FaceMesh to extract features.

    Args:
        video_path: Path to video file (.avi, .mp4).
        max_frames: Optional upper limit on processed frames.
        sample_stride: Step size between decoded frames (1 = process every frame).
        model_path: Optional path to face_landmarker.task model.

    Raises:
        ImportError: If opencv-python or mediapipe are not installed.
        FileNotFoundError: If video file does not exist.
        RuntimeError: If video file cannot be opened.
    """
    v_path = Path(video_path)
    if not v_path.exists():
        raise FileNotFoundError(f"Video file not found: {v_path}")

    try:
        import cv2
        import mediapipe as mp
    except ImportError as e:
        raise ImportError(
            f"Video decoding requires opencv-python and mediapipe ({e}).\n"
            "Install with: pip install opencv-python mediapipe\n"
            "Or process pre-extracted landmark files using extract_features_from_landmark_sequence."
        )

    cap = cv2.VideoCapture(str(v_path))
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video file: {v_path}")

    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_records: List[Dict[str, Any]] = []

    try:
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        use_tasks_api = True
    except (ImportError, AttributeError):
        use_tasks_api = False

    if use_tasks_api:
        detector = get_face_landmarker_detector(model_path)
        frame_idx = 0
        processed_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_stride == 0:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                res = detector.detect(mp_image)
                if res.face_landmarks:
                    landmarks = res.face_landmarks[0]
                    record = extract_frame_features(landmarks)
                else:
                    record = extract_frame_features(None)

                frame_records.append(record)
                processed_count += 1
                if max_frames and processed_count >= max_frames:
                    break
            frame_idx += 1
    else:
        mp_face_mesh = mp.solutions.face_mesh
        with mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as face_mesh:
            frame_idx = 0
            processed_count = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % sample_stride == 0:
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = face_mesh.process(rgb_frame)

                    if results.multi_face_landmarks:
                        landmarks = results.multi_face_landmarks[0].landmark
                        record = extract_frame_features(landmarks)
                    else:
                        record = extract_frame_features(None)

                    frame_records.append(record)
                    processed_count += 1
                    if max_frames and processed_count >= max_frames:
                        break
                frame_idx += 1

    cap.release()

    return aggregate_temporal_features(
        frame_records,
        total_expected_frames=len(frame_records),
    )

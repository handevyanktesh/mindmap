"""Model Registry and Serialization.

Manages disk persistence, versioning, and metadata tracking for trained models.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union
import joblib
from sklearn.pipeline import Pipeline


def save_model(
    pipeline: Pipeline,
    filepath: Union[str, Path],
    metadata: Optional[Dict[str, Any]] = None,
) -> Path:
    """Saves a fitted pipeline and its training metadata to disk.

    Args:
        pipeline: Trained Scikit-Learn Pipeline.
        filepath: Target file path (.joblib or .pkl).
        metadata: Optional dictionary with training details, metrics, and feature lists.

    Returns:
        Path to saved artifact.
    """
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    meta = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "pipeline_steps": [name for name, _ in pipeline.steps],
    }
    if metadata:
        meta.update(metadata)

    payload = {
        "model": pipeline,
        "metadata": meta,
    }

    joblib.dump(payload, path)
    return path


def load_model(filepath: Union[str, Path]) -> Tuple[Pipeline, Dict[str, Any]]:
    """Loads a saved model pipeline and its metadata from disk.

    Args:
        filepath: Path to saved artifact.

    Returns:
        Tuple of (pipeline, metadata_dict).

    Raises:
        FileNotFoundError: If the file does not exist.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")

    payload = joblib.load(path)
    if isinstance(payload, dict) and "model" in payload:
        return payload["model"], payload.get("metadata", {})
    elif isinstance(payload, Pipeline):
        return payload, {}
    else:
        raise ValueError(f"Unrecognized artifact structure in {path}")

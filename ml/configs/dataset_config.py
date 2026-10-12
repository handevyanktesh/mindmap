"""DAiSEE Dataset Configuration.

Provides configurable paths, split definitions, participant ID parsing,
and validation logic for the Dataset for Affective States in E-Environments (DAiSEE).
"""

from dataclasses import dataclass, field
import os
from pathlib import Path
import re
from typing import Dict, List, Optional, Tuple


@dataclass
class DAiSEEConfig:
    """Configuration for DAiSEE dataset paths and layout.

    Attributes:
        base_dir: Root directory of DAiSEE dataset.
        data_dir: Subdirectory containing video files (e.g. 'DataSet').
        labels_dir: Subdirectory containing annotation CSV files (e.g. 'Labels').
        features_dir: Directory for storing extracted feature files (.parquet / .npz).
        splits: List of supported dataset splits.
        label_files: Mapping from split name to expected label CSV filename.
        video_extensions: Tuple of supported video file extensions.
    """

    base_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("DAISEE_BASE_DIR", "ml/data/DAiSEE")
        ).resolve()
    )
    data_dir: Optional[Path] = None
    labels_dir: Optional[Path] = None
    features_dir: Optional[Path] = None
    splits: Tuple[str, ...] = ("Train", "Validation", "Test")
    label_files: Dict[str, str] = field(
        default_factory=lambda: {
            "Train": "TrainLabels.csv",
            "Validation": "ValidationLabels.csv",
            "Test": "TestLabels.csv",
        }
    )
    video_extensions: Tuple[str, ...] = (".avi", ".mp4", ".mov", ".mkv")

    def __post_init__(self) -> None:
        self.base_dir = Path(self.base_dir)
        if self.data_dir is None:
            self.data_dir = self.base_dir / "DataSet"
        else:
            self.data_dir = Path(self.data_dir)

        if self.labels_dir is None:
            self.labels_dir = self.base_dir / "Labels"
        else:
            self.labels_dir = Path(self.labels_dir)

        if self.features_dir is None:
            self.features_dir = self.base_dir / "Features"
        else:
            self.features_dir = Path(self.features_dir)

    def get_labels_file(self, split: str) -> Path:
        """Returns the expected path to the label CSV file for a given split."""
        split_normalized = split.capitalize()
        filename = self.label_files.get(split_normalized, f"{split_normalized}Labels.csv")
        primary_path = self.labels_dir / filename
        if primary_path.exists():
            return primary_path

        # Case-insensitive / alternate fallback search
        if self.labels_dir.exists():
            candidates = list(self.labels_dir.glob(f"*{split.lower()}*.csv"))
            if candidates:
                return candidates[0]

        return primary_path

    def get_split_video_dir(self, split: str) -> Path:
        """Returns the expected video root directory for a given split."""
        split_normalized = split.capitalize()
        return self.data_dir / split_normalized

    def validate_dataset_exists(self, split: Optional[str] = None) -> None:
        """Validates that dataset directories and labels exist.

        Raises:
            FileNotFoundError: If required directories or label files cannot be found.
        """
        if not self.labels_dir.exists():
            raise FileNotFoundError(
                f"DAiSEE labels directory not found: {self.labels_dir}\n"
                "Please download DAiSEE according to its official terms and place it in:\n"
                f"  {self.base_dir}\n"
                "Or configure DAISEE_BASE_DIR environment variable or pass --data-dir."
            )

        splits_to_check = [split.capitalize()] if split else list(self.splits)
        for s in splits_to_check:
            label_file = self.get_labels_file(s)
            if not label_file.exists():
                raise FileNotFoundError(
                    f"DAiSEE {s} split label file not found at: {label_file}\n"
                    f"Expected filename: {self.label_files.get(s, s + 'Labels.csv')}"
                )

    @staticmethod
    def extract_participant_id(clip_id_or_path: str) -> str:
        """Extracts participant/subject ID from a clip identifier or file path.

        In the official DAiSEE dataset, clip identifiers are commonly formatted as:
        `<ParticipantID><SessionID><ClipNumber>` (e.g. `1100011002.avi` -> `110001`),
        or placed in nested folders: `Train/<ParticipantID>/<ClipID>/<ClipID>.avi`.

        Args:
            clip_id_or_path: Clip name (e.g. '1100011002.avi') or full path.

        Returns:
            Normalized participant ID string.
        """
        raw = str(clip_id_or_path).replace("\\", "/")
        name = Path(raw).name
        stem = Path(name).stem.strip()

        # Check path parts if folder is named with participant ID (e.g. .../Train/110001/...)
        parts = Path(raw).parts
        for part in reversed(parts[:-1]):
            clean_part = part.strip()
            # If folder is 4-8 digits and not a split name
            if clean_part.isdigit() and len(clean_part) in (4, 5, 6, 7) and clean_part != stem:
                return clean_part

        # Check numeric prefix pattern in stem (first 6 digits)
        numeric_match = re.match(r"^(\d{6})", stem)
        if numeric_match:
            return numeric_match.group(1)

        # Fallback to general prefix if separated by underscore or hyphen
        parts_delimited = re.split(r"[_-]", stem)
        if len(parts_delimited) > 1 and parts_delimited[0]:
            return parts_delimited[0]

        # Ultimate fallback: return stem
        return stem

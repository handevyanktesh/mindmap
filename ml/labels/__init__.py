"""ML label mapping package."""

from ml.labels.label_mapper import (
    TargetDimension,
    TargetMode,
    get_class_names,
    get_label_mapping_doc,
    map_target,
    prepare_dataset_targets,
)

__all__ = [
    "TargetDimension",
    "TargetMode",
    "get_class_names",
    "get_label_mapping_doc",
    "map_target",
    "prepare_dataset_targets",
]

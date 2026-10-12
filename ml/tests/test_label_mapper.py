"""Unit tests for label mapper and target preparation."""

import numpy as np
import pandas as pd
import pytest

from ml.labels.label_mapper import (
    TargetDimension,
    TargetMode,
    get_class_names,
    get_label_mapping_doc,
    map_target,
    prepare_dataset_targets,
)


def test_map_target_binary_engagement():
    # 0, 1 -> 0 (Low); 2, 3 -> 1 (High)
    raw = [0, 1, 2, 3, 2, 0]
    mapped = map_target(raw, dimension=TargetDimension.ENGAGEMENT, mode=TargetMode.BINARY)
    assert np.array_equal(mapped, [0, 0, 1, 1, 1, 0])


def test_map_target_binary_confusion():
    # 0, 1 -> 0 (No/Low confusion); 2, 3 -> 1 (Elevated confusion)
    raw = [0, 1, 2, 3]
    mapped = map_target(raw, dimension=TargetDimension.CONFUSION, mode=TargetMode.BINARY)
    assert np.array_equal(mapped, [0, 0, 1, 1])


def test_map_target_four_class():
    raw = [0, 1, 2, 3]
    mapped = map_target(raw, dimension=TargetDimension.ENGAGEMENT, mode=TargetMode.FOUR_CLASS)
    assert np.array_equal(mapped, [0, 1, 2, 3])


def test_map_target_invalid_value_raises():
    raw = [0, 1, 4]  # 4 is invalid in DAiSEE
    with pytest.raises(ValueError):
        map_target(raw, dimension=TargetDimension.ENGAGEMENT, mode=TargetMode.BINARY)


def test_independent_dimensions():
    # A student can be simultaneously highly engaged (3) and confused (2)
    df = pd.DataFrame(
        {
            "clip_id": ["c1", "c2"],
            "engagement": [3, 0],
            "confusion": [2, 0],
        }
    )
    _, y_eng = prepare_dataset_targets(df, dimension="engagement", mode="binary")
    _, y_conf = prepare_dataset_targets(df, dimension="confusion", mode="binary")

    # Clip 1: Engaged (1) and Confused (1)
    assert y_eng[0] == 1
    assert y_conf[0] == 1

    # Clip 2: Disengaged (0) and Not Confused (0)
    assert y_eng[1] == 0
    assert y_conf[1] == 0


def test_get_class_names_and_doc():
    names_bin = get_class_names("engagement", "binary")
    assert len(names_bin) == 2

    names_4c = get_class_names("engagement", "4class")
    assert len(names_4c) == 4

    doc = get_label_mapping_doc("confusion", "binary")
    assert doc["is_independent"] is True

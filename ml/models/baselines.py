"""Baseline Machine Learning Models for Behavioural Classification.

Constructs reproducible Scikit-Learn pipelines combining safe domain imputation,
standardization, and regularized classification with balanced class weighting.
"""

from typing import Any, Dict, List, Optional
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.preprocessing.missingness_handler import SafeDomainImputer


def build_logistic_regression_pipeline(
    feature_names: Optional[List[str]] = None,
    hyperparameters: Optional[Dict[str, Any]] = None,
) -> Pipeline:
    """Builds an end-to-end Logistic Regression pipeline.

    Steps:
        1. SafeDomainImputer: median imputation with domain fallbacks.
        2. StandardScaler: zero-mean, unit-variance feature scaling.
        3. LogisticRegression: regularized linear classifier with balanced class weighting.
    """
    params = {
        "C": 1.0,
        "penalty": "l2",
        "solver": "lbfgs",
        "class_weight": "balanced",
        "max_iter": 1000,
        "random_state": 42,
    }
    if hyperparameters:
        params.update(hyperparameters)

    return Pipeline(
        steps=[
            ("imputer", SafeDomainImputer(strategy="median", feature_names=feature_names)),
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(**params)),
        ]
    )


def build_random_forest_pipeline(
    feature_names: Optional[List[str]] = None,
    hyperparameters: Optional[Dict[str, Any]] = None,
) -> Pipeline:
    """Builds an end-to-end Random Forest pipeline.

    Steps:
        1. SafeDomainImputer: median imputation with domain fallbacks.
        2. RandomForestClassifier: ensemble trees with balanced class weighting.
    """
    params = {
        "n_estimators": 100,
        "max_depth": 8,
        "min_samples_split": 4,
        "min_samples_leaf": 2,
        "class_weight": "balanced",
        "random_state": 42,
        "n_jobs": -1,
    }
    if hyperparameters:
        params.update(hyperparameters)

    return Pipeline(
        steps=[
            ("imputer", SafeDomainImputer(strategy="median", feature_names=feature_names)),
            ("classifier", RandomForestClassifier(**params)),
        ]
    )


from sklearn.dummy import DummyClassifier


def build_majority_classifier_pipeline(
    feature_names: Optional[List[str]] = None,
    hyperparameters: Optional[Dict[str, Any]] = None,
) -> Pipeline:
    """Builds a zero-rule Majority Class baseline pipeline.

    Predicts the most frequent training class unconditionally.
    Serves as the empirical benchmark lower bound.
    """
    params = {"strategy": "most_frequent"}
    if hyperparameters:
        params.update(hyperparameters)

    return Pipeline(
        steps=[
            ("imputer", SafeDomainImputer(strategy="median", feature_names=feature_names)),
            ("classifier", DummyClassifier(**params)),
        ]
    )


def build_model_pipeline(
    model_name: str,
    feature_names: Optional[List[str]] = None,
    hyperparameters: Optional[Dict[str, Any]] = None,
) -> Pipeline:
    """Factory creating the appropriate model pipeline by name."""
    name_clean = model_name.lower().replace("-", "_").replace(" ", "_")
    if name_clean in ("majority_class", "majority", "dummy"):
        return build_majority_classifier_pipeline(feature_names, hyperparameters)
    elif name_clean in ("logistic_regression", "lr", "logistic"):
        return build_logistic_regression_pipeline(feature_names, hyperparameters)
    elif name_clean in ("random_forest", "rf", "forest"):
        return build_random_forest_pipeline(feature_names, hyperparameters)
    else:
        raise ValueError(
            f"Unknown model name: {model_name}. Supported: 'majority_class', 'logistic_regression', 'random_forest'"
        )

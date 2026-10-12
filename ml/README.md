# MindMap — Machine Learning Training & Evaluation Pipeline (Phase 5A)

An isolated, reproducible machine learning training and evaluation pipeline for affective computing models (engagement and confusion classification), designed to operate on video-derived temporal features compatible with MindMap's browser-local runtime.

---

## 1. Directory Structure

```
ml/
├── configs/
│   ├── dataset_config.py          # DAiSEE dataset path configuration and split resolution
│   └── training_config.py         # Hyperparameters, target dimensions, feature sets
├── data/                          # Dataset directory (.gitignored, manual download)
│   └── DAiSEE/
│       ├── DataSet/               # Video files (Train/, Validation/, Test/)
│       ├── Labels/                # Official CSVs (TrainLabels.csv, ValidationLabels.csv, TestLabels.csv)
│       └── Features/              # Pre-extracted tabular features (.parquet, .csv)
├── preprocessing/
│   ├── landmark_definitions.py    # Canonical MediaPipe 468/478 Face Mesh topology & geometry
│   ├── feature_extractor.py       # Frame-level & video-level facial feature extractor
│   ├── temporal_features.py       # Temporal rolling aggregations (mean, std, velocities, durations)
│   ├── missingness_handler.py     # Missing-feature analysis, quality gating, SafeDomainImputer
│   └── daisee_loader.py           # Annotation CSV loader & participant split disjointness verifier
├── labels/
│   └── label_mapper.py            # DAiSEE 4-level ordinal & binary target mapping
├── models/
│   ├── baselines.py               # Logistic Regression & Random Forest Scikit-Learn pipelines
│   ├── registry.py                # Model serialization (.joblib) & metadata tracking
│   └── saved/                     # Trained model checkpoints (.gitignored)
├── evaluation/
│   ├── metrics.py                 # Macro F1, per-class precision/recall, confusion matrix, accuracy
│   └── comparator.py              # Side-by-side model comparison & rule-based baseline analysis
├── tests/
│   ├── test_landmark_definitions.py
│   ├── test_feature_extractor.py
│   ├── test_temporal_features.py
│   ├── test_missingness_handler.py
│   ├── test_daisee_loader.py
│   ├── test_label_mapper.py
│   └── test_pipeline_integration.py
├── train.py                       # CLI entrypoint for training and model selection
├── evaluate.py                    # CLI entrypoint for standalone holdout evaluation
├── requirements.txt               # Pipeline dependencies
└── README.md                      # This documentation
```

---

## 2. Dataset Support: DAiSEE

The pipeline targets the **Dataset for Affective States in E-Environments (DAiSEE)**.

### Access Terms & Data Handling
- DAiSEE requires manual request and access approval according to its official terms of use (IIT Mandi).
- **Never commit** raw video files (`.avi`, `.mp4`), personal identifiable data, extracted intermediate datasets, or trained model binaries to version control. These patterns are enforced in `.gitignore`.
- If dataset files are missing, the pipeline fails immediately with explicit instructions.

### Expected Directory Layout
```
ml/data/DAiSEE/
├── Labels/
│   ├── TrainLabels.csv
│   ├── ValidationLabels.csv
│   └── TestLabels.csv
└── DataSet/
    ├── Train/
    │   └── <ParticipantID>/<ClipID>/<ClipID>.avi
    ├── Validation/
    │   └── <ParticipantID>/<ClipID>/<ClipID>.avi
    └── Test/
        └── <ParticipantID>/<ClipID>/<ClipID>.avi
```

### Participant-Level Split Integrity
To prevent data leakage, clips from the same subject must never appear in both training and evaluation splits:
- `DAiSEEConfig.extract_participant_id()` automatically parses the 6-digit participant ID from clip filenames (`1100011002.avi` -> `110001`) or folder hierarchy.
- `verify_participant_split_disjointness()` enforces that $\text{Train} \cap \text{Validation} = \emptyset$, $\text{Train} \cap \text{Test} = \emptyset$, and $\text{Validation} \cap \text{Test} = \emptyset$.

---

## 3. Feature Extraction Definitions & Browser Alignment

Feature definitions in Python (`ml/preprocessing/`) directly correspond to the browser runtime implementation (`frontend/src/features/`):

| Feature Modality | Browser Definition (`frontend/src/features/`) | Python Training Definition (`ml/preprocessing/`) | Correspondence |
| :--- | :--- | :--- | :--- |
| **Eye Aspect Ratio (EAR)** | `facial/eyeFeatures.js` (Soukupová & Čech, 2016)<br>Left: 362, 385, 387, 263, 373, 380<br>Right: 33, 160, 158, 133, 153, 144 | `landmark_definitions.py`<br>`calculate_ear()` using identical landmark indices and Euclidean distance formula | Identical |
| **Normalized 2D Gaze** | `facial/gazeFeatures.js`<br>Iris centers: Left 473, Right 468<br>Horizontal & vertical bounds | `landmark_definitions.py`<br>`calculate_gaze()` with identical bounding canthi and eyelids | Identical |
| **Head Pose (Yaw, Pitch, Roll)** | `facial/headPoseFeatures.js`<br>Orthonormal 3D facial coordinate basis derived from skull landmarks 33, 263, 168, 152 | `landmark_definitions.py`<br>`calculate_head_pose()` using identical orthonormal cross-product basis | Identical |
| **Temporal Variations** | `temporal/temporalFeatures.js`<br>Windowed mean, std, min, max, velocity, closure durations | `temporal_features.py`<br>`aggregate_temporal_features()` with matching threshold constants | Compatible |
| **Missingness & Gating** | `fusion/fusionFeatures.js`<br>Dynamic quality gating excluding invalid modalities | `missingness_handler.py`<br>`SafeDomainImputer` + validity ratios | Compatible |

### Documented Differences
- **Execution Environment:** In the browser, MediaPipe Face Landmarker runs via WebAssembly at webcam frame rate (~30 FPS). The offline Python pipeline can process full video streams using OpenCV + MediaPipe Python or consume pre-extracted landmark coordinates.
- **Dynamic Personal Baseline:** The browser runtime computes an adaptive personal rolling baseline for real-time drift compensation. The offline ML pipeline learns direct classification boundaries over population feature distributions, providing an independent benchmark.

---

## 4. Label Preparation & Target Mapping

DAiSEE annotates 4 affective states: **Engagement, Confusion, Boredom, and Frustration** on a 4-point ordinal scale:
- `0`: Very Low
- `1`: Low
- `2`: High
- `3`: Very High

### Multidimensional Independence
Engagement and Confusion are **independent affective dimensions**, not mutually exclusive classes. A learner can be simultaneously highly engaged and confused (e.g. intensely concentrating on difficult material). The pipeline prepares separate, decoupled models for each target.

### Supported Target Modes
1. **Binary Classification (`--mode binary`):**
   - Class 0: `{0, 1}` (Very Low / Low / Reduced)
   - Class 1: `{2, 3}` (High / Very High / Elevated)
   - *Rationale:* Resolves extreme class imbalance across high ordinal categories while aligning with binary classroom alerts.
2. **4-Class Ordinal (`--mode 4class`):**
   - Classes 0, 1, 2, 3 preserved without reduction.

---

## 5. Baseline Models

Two reproducible supervised classifiers are implemented in `ml/models/baselines.py`:

1. **Logistic Regression Pipeline:**
   - `SafeDomainImputer(strategy='median')`: Imputes missing facial metrics using median or physiological neutral defaults (EAR=0.28, Gaze=0.5, Pose=0.0°).
   - `StandardScaler()`: Zero-mean, unit-variance scaling.
   - `LogisticRegression(class_weight='balanced', penalty='l2', max_iter=1000)`: Handles class imbalance via inverse frequency weighting.

2. **Random Forest Pipeline:**
   - `SafeDomainImputer(strategy='median')`
   - `RandomForestClassifier(n_estimators=100, max_depth=8, class_weight='balanced')`: Captures non-linear feature interactions (e.g., eye closure coupled with head tilt).

---

## 6. Evaluation Framework & Reporting Standards

The evaluation suite computes real, uninvented metrics:
- **Macro F1-Score:** Primary selection metric (unweighted average across classes, resilient to class imbalance).
- **Weighted F1-Score:** Supplementary weighted metric.
- **Per-Class Precision, Recall, and F1-Score:** Exposes false alarm vs miss rates.
- **Confusion Matrix:** Full row-normalized and count matrices.
- **Accuracy:** Reported strictly as a supplementary metric, never as the sole indicator.

### Rule-Based Baseline Comparison Protocol
The existing browser rule-based inference engine represents an independent baseline. A machine learning model must only be claimed superior if evaluated on the exact same labelled test clips with compatible prediction targets and verified with empirical metric deltas.

---

## 7. Running the Pipeline

### Setup
Ensure dependencies are available:
```powershell
pip install -r ml/requirements.txt
```

### Running Automated Tests
Run the focused test suite (27 tests covering landmarks, extraction, temporal features, missingness, labels, baselines, and pipeline integration):
```powershell
python -m pytest ml/tests -v
```

### Training with Real DAiSEE Dataset
```powershell
# Train models on Engagement with natural holdout test evaluation
python -m ml.train --target engagement --mode binary --model both --max-train-videos 180 --max-val-videos 60 --max-test-videos 60 --test-sampling natural

# Train models on Confusion with natural holdout test evaluation
python -m ml.train --target confusion --mode binary --model both --max-train-videos 180 --max-val-videos 60 --max-test-videos 60 --test-sampling natural
```

### Verifying Pipeline Execution (Synthetic Fixture)
When the real DAiSEE dataset has not yet been downloaded, run the complete end-to-end pipeline using the reproducible synthetic fixture:
```powershell
python -m ml.train --synthetic --target engagement --mode binary
```

### Evaluating Saved Models
```powershell
python -m ml.evaluate --model-path ml/models/saved/random_forest_engagement_binary.joblib --synthetic
```

---

## 8. Experimental Findings & Architecture Guardrail

See [`ml/reports/PHASE_5_CLOSEOUT_REPORT.md`](file:///C:/GitHub/mindmap/ml/reports/PHASE_5_CLOSEOUT_REPORT.md) for the comprehensive evaluation analysis across 180 train, 60 validation, and 60 natural test holdout clips.

- **Zero Database Persistence:** This pipeline is purely offline. No video frames, landmark coordinates, or biometric features are ever transmitted to the FastAPI backend or MongoDB database.
- **Data Integrity:** Synthetic fixture data is strictly reserved for verifying pipeline execution and unit tests; its results are never presented as real affective computing performance.
- **Deployment Status:** Offline ML models trained on DAiSEE landmark features do not outperform a naive majority baseline on Confusion and demonstrate high false-alarm rates. Live application integration remains deferred; MindMap continues to rely on browser-local personal baseline calibration.

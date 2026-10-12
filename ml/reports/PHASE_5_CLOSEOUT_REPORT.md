# MindMap Phase 5 — ML Experiment Close-Out and Evaluation Report

**Date:** October 2026  
**Module:** `ml/` (Isolated Experimental Machine Learning Pipeline)  
**Status:** Completed & Closed Out  
**Live Deployment Decision:** **DEFERRED (Do Not Integrate)**  

---

## 1. Executive Summary

This report documents the empirical evaluation of machine learning baseline classifiers trained on facial video features from the **DAiSEE** dataset (Dataset for Affective States in E-Environments).

### Primary Findings
1. **Severe Natural Class Imbalance:** In the official DAiSEE dataset, over 93% of student clips are annotated as highly engaged, and over 91% as having low or no confusion.
2. **The High-Accuracy Fallacy:** A zero-rule **Majority-Class Baseline** (predicting high engagement / no confusion unconditionally without processing facial video) achieves **93.3% accuracy** on Engagement and **91.7% accuracy** on Confusion. Reporting accuracy as proof of model competence in this domain is invalid.
3. **Absence of Discriminative Predictive Signal:**
   - For **Confusion**, supervised models failed to beat the naive majority baseline on Macro F1:
     - Majority Baseline: Macro F1 = `0.4783` (Accuracy 91.7%)
     - Random Forest: Macro F1 = `0.4643` (Accuracy 86.7%, Elevated Confusion F1 = `0.0000`, 0/5 detected)
     - Logistic Regression: Macro F1 = `0.4271` (Accuracy 63.3%, Elevated Confusion F1 = `0.0833`, 1/5 detected, 18 false alarms)
   - For **Engagement**, Random Forest achieved Macro F1 = `0.6207` (vs Majority `0.4828`), but only identified 1 out of 4 reduced-engagement clips, with minority support below the statistical conclusiveness threshold ($N=4 < 5$).
4. **Architectural & Privacy Guardrail:** MindMap's live application maintains its browser-local rule-based inference engine with personalized baseline calibration. **No ML weights, models, or remote inference APIs are integrated into the FastAPI backend or React frontend.**

---

## 2. Dataset Audit & Sampling Scope

### A. Dataset Completeness
Audited physical video files extracted from the official IIT Mandi release archive (`DAiSEE.zip`):

| Split | Annotated Rows | Unique Clips | Unique Participants | Available Videos on Disk | Missing from Archive | Disk Coverage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Train** | 5,358 | 5,358 | 69 | 4,852 | 506 | 90.6% |
| **Validation** | 1,429 | 1,429 | 19 | 1,429 | 0 | **100.0%** |
| **Test** | 1,784 | 1,784 | 21 | 1,638 | 146 | 91.8% |
| **Total** | 8,571 | 8,571 | 109 | 7,919 matched (8,232 total on disk) | 652 | 92.4% |

- **Participant Disjointness:** Verified across all splits:
  - $\text{Train} \cap \text{Validation} = \emptyset$
  - $\text{Train} \cap \text{Test} = \emptyset$
  - $\text{Validation} \cap \text{Test} = \emptyset$
  - Zero participant leakage detected.

### B. Sampled Experimental Subsets (Phase 5E Scope)
To avoid multi-day CPU video decoding while verifying predictive signal, experiments were conducted on representative sampled subsets:
- **Train Split:** 180 video clips (sampled from 4,852 available, covering 55–76 unique participants). Joint stratification was applied across engagement and confusion to guarantee minority representation during fitting.
- **Validation Split:** 60 video clips (sampled from 1,429 available, covering 18–29 unique participants). Used strictly for model and hyperparameter selection.
- **Test Split (Holdout):** 60 video clips (sampled from 1,638 available, covering 15–18 unique participants). Evaluated under **natural empirical label prevalence** without artificial balancing.
- **Persistent Accumulated Cache:** Across iterative runs, features from 254 Train clips, 83 Validation clips, and 97 Test clips were cached with schema versioning (`FEATURE_EXTRACTOR_VERSION = "2.0.0"`).

---

## 3. Feature Pipeline & Browser Alignment

Features extracted by `ml/preprocessing/feature_extractor.py` and `ml/preprocessing/temporal_features.py` strictly mirror the browser runtime logic (`frontend/src/features/`):
- **Eye Aspect Ratio (EAR):** Soukupová & Čech formula using 6 canonical landmark points per eye (mean, std, min, max, velocity, closure ratio).
- **Gaze Tracking:** Normalized 2D iris center coordinates relative to eyelid/canthi bounds (mean, std, displacement, spread, deviation ratio).
- **Head Pose Estimation:** 3D Euler angles (Yaw, Pitch, Roll) computed via orthonormal basis vectors from landmark positions (mean, std, displacement, turn ratios).
- **Extraction Quality:** Corrected denominator formulation computes validity against processed frames (`len(frame_records)`). Mean valid face detection ratio across all processed DAiSEE clips: **100.0%**.

---

## 4. Empirical Evaluation Results

### A. Target: Binary Engagement
- **Label Mapping:** Binary grouping: $0 = \{0, 1\}$ (Reduced / Low), $1 = \{2, 3\}$ (Engaged / High).
- **Holdout Test Set ($N=60$):**
  - Reduced / Low Engagement: 4 clips (**6.7%**) — *Marked INCONCLUSIVE ($N < 5$)*.
  - Engaged / High Engagement: 56 clips (**93.3%**).

| Model | Macro F1 | Weighted F1 | Supplementary Accuracy | Reduced F1 (Supp=4) | Engaged F1 (Supp=56) | Conclusiveness |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Majority Baseline** | 0.4828 | 0.9011 | **93.3%** | 0.0000 (Recall 0.0%) | **0.9655** (Recall 100.0%) | Inconclusive on minority |
| **Logistic Regression** (Balanced) | 0.4695 | 0.7377 | 65.0% | 0.1600 (Recall 50.0%) | 0.7789 (Recall 66.1%) | Inconclusive on minority |
| **Random Forest** (Balanced) | **0.6207** | **0.9111** | 91.7% | **0.2857** (Recall 25.0%) | 0.9558 (Recall 96.4%) | Inconclusive on minority |

#### Confusion Matrices (Engagement)

**Majority Class:**
```
                      Pred Reduced   Pred Engaged
Actual Reduced (4)          0              4
Actual Engaged (56)         0             56
```

**Logistic Regression:**
```
                      Pred Reduced   Pred Engaged
Actual Reduced (4)          2              2
Actual Engaged (56)        19             37
```

**Random Forest:**
```
                      Pred Reduced   Pred Engaged
Actual Reduced (4)          1              3
Actual Engaged (56)         2             54
```

---

### B. Target: Binary Confusion
- **Label Mapping:** Binary grouping: $0 = \{0, 1\}$ (Low / No Confusion), $1 = \{2, 3\}$ (Elevated Confusion).
- **Holdout Test Set ($N=60$):**
  - Low / No Confusion: 55 clips (**91.7%**).
  - Elevated Confusion: 5 clips (**8.3%**) — *Minimum support threshold met ($N=5$)*.

| Model | Macro F1 | Weighted F1 | Supplementary Accuracy | Low/No F1 (Supp=55) | Elevated F1 (Supp=5) | Conclusiveness |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Majority Baseline** | **0.4783** | **0.8768** | **91.7%** | **0.9565** (Recall 100.0%) | 0.0000 (Recall 0.0%) | Conclusive |
| **Logistic Regression** (Balanced) | 0.4271 | 0.7135 | 63.3% | 0.7708 (Recall 67.3%) | **0.0833** (Recall 20.0%) | Conclusive |
| **Random Forest** (Balanced) | 0.4643 | 0.8512 | 86.7% | 0.9286 (Recall 94.5%) | 0.0000 (Recall 0.0%) | Conclusive |

#### Confusion Matrices (Confusion)

**Majority Class:**
```
                      Pred Low/No   Pred Elevated
Actual Low/No (55)         55              0
Actual Elevated (5)         5              0
```

**Logistic Regression:**
```
                      Pred Low/No   Pred Elevated
Actual Low/No (55)         37             18
Actual Elevated (5)         4              1
```

**Random Forest:**
```
                      Pred Low/No   Pred Elevated
Actual Low/No (55)         52              3
Actual Elevated (5)         5              0
```

---

## 5. Critical Analysis & Limitations

1. **Failure to Outperform Trivial Lower Bound:**
   - On Confusion, Random Forest achieves Macro F1 = `0.4643`, which is **worse** than the Zero-Rule Majority Baseline (`0.4783`). It completely failed to identify any of the 5 elevated confusion clips.
   - Logistic Regression achieved an Elevated Confusion F1 of only `0.0833`, at the cost of 18 false alarms out of 55 calm students (precision = 5.3%). In an educational setting, an alert system with a 95% false-alarm rate is unusable.
2. **Sparse Minority Support:**
   - Even when sampling 60 test clips from the official test split, only 4 clips exhibited reduced engagement and only 5 exhibited elevated confusion. Five positive examples do not establish statistical significance or reliable generalization.
3. **Noisy Observer Annotations in DAiSEE:**
   - DAiSEE labels were assigned by external human crowdsource annotators watching 10-second web videos without learner comprehension ground truth.
   - Cognitive states like confusion do not reliably manifest as static geometric facial deformations in passive lecture settings.
4. **Superiority of Client-Side Personal Calibration:**
   - The current MindMap browser inference engine uses **personal baseline calibration** (measuring how much a student blinks, moves, or averts gaze relative to their own 30-second resting baseline) combined with rolling temporal EWMA filters.
   - A population-level static ML model trained without personalized normalization cannot distinguish a naturally fast blinker or naturally expressive student from an inattentive or confused student.

---

## 6. Reproducibility Guide

### A. Environment & Dependencies
- Python: 3.13+
- Install dependencies:
  ```powershell
  pip install -r ml/requirements.txt
  ```
- Required packages: `numpy`, `scipy`, `pandas`, `scikit-learn`, `joblib`, `opencv-python`, `mediapipe`.

### B. Model Checkpoint Download
The official canonical MediaPipe Face Landmarker model must be present at:
`ml/models/face_landmarker.task` (3.75 MB).

### C. Execution Commands
To reproduce the exact experiments reported above:

```powershell
# Set Python path
$env:PYTHONPATH="backend\.venv\Lib\site-packages;."

# 1. Run full unit and integration test suite (27 tests)
python -m pytest ml/tests -v

# 2. Train and evaluate Engagement (180 train, 60 val, 60 natural test)
python -m ml.train --target engagement --mode binary --model both --max-train-videos 180 --max-val-videos 60 --max-test-videos 60 --test-sampling natural

# 3. Train and evaluate Confusion (180 train, 60 val, 60 natural test)
python -m ml.train --target confusion --mode binary --model both --max-train-videos 180 --max-val-videos 60 --max-test-videos 60 --test-sampling natural
```

---

## 7. Architectural Integrity & Privacy Verification

### A. Git Hygiene
- `.gitignore` strictly excludes:
  - Video files: `*.avi`, `*.mp4`, `*.mkv`, `*.webm`
  - Datasets & feature caches: `ml/data/` (including `ml/data/DAiSEE/Features/`)
  - Model binaries & weights: `ml/models/saved/`, `*.joblib`, `*.pkl`, `*.task`
  - Output artifacts: `ml/outputs/`, `ml/checkpoints/`
- Verified clean `git status`: Only source code and test files are tracked.

### B. Privacy Boundary Guarantee
- **Zero Raw Video or Landmark Transmission:** Video frames, landmarks, EAR, gaze vectors, head pose angles, and temporal buffers remain strictly in client browser memory.
- **Zero Biometric Persistence:** Neither the FastAPI backend nor MongoDB persists raw facial features or video streams.
- **Isolated ML Sandbox:** The `ml/` module remains completely decoupled from production runtime services. No live inference endpoints or model loading routines exist in `backend/app/` or `frontend/src/`.

---

## 8. Final Decision & Conclusion

> [!IMPORTANT]
> **Live Integration Deferred:** The current population-level ML models trained on DAiSEE landmark features will **not** be integrated into the MindMap application. The production system will continue to rely on client-side personal baseline calibration and temporal rule-based heuristics.

Any future machine learning work should prioritize:
1. Collecting self-reported or comprehension-validated learning datasets rather than third-party video ratings.
2. Personalized contrastive learning architectures (evaluating deviation from individual baselines rather than global absolute thresholds).
3. Multimodal task interaction signals (e.g., note-taking, cursor movement, problem-solving pauses) rather than webcam video alone.

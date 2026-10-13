import pytest
from datetime import datetime, timezone, timedelta
from app.services.analytics_service import SessionAggregator, analytics_manager

def get_auth_token(client, email: str, role: str) -> str:
    client.post("/api/auth/register", json={
        "name": f"User {email}",
        "email": email,
        "password": "securepassword123",
        "role": role
    })
    resp = client.post("/api/auth/login", json={
        "email": email,
        "password": "securepassword123"
    })
    return resp.json()["access_token"]

def test_unit_bucket_boundaries_and_aggregates():
    """Verify 1-minute bucket placement and mathematical aggregation."""
    now = datetime.now(timezone.utc)
    aggregator = SessionAggregator(
        session_id="test_sess_01",
        classroom_id="test_class_01",
        teacher_id="test_teacher_01",
        title="Calculus L1",
        started_at=now
    )

    # Bucket 0: Minute 0 (0-59s)
    aggregator.record_telemetry("stu_1", "NORMAL_BEHAVIOUR", "LOW", 0.9, int((now + timedelta(seconds=10)).timestamp() * 1000))
    aggregator.record_telemetry("stu_2", "NORMAL_BEHAVIOUR", "LOW", 0.8, int((now + timedelta(seconds=15)).timestamp() * 1000))
    aggregator.record_telemetry("stu_3", "REDUCED_ENGAGEMENT_LIKE", "ELEVATED", 0.7, int((now + timedelta(seconds=20)).timestamp() * 1000))

    b0 = aggregator.get_or_create_bucket(0)
    d0 = b0.to_dict("test_sess_01", "test_class_01")

    assert d0["reporting_students"] == 3
    assert d0["total_samples"] == 3
    assert d0["normal_count"] == 2
    assert d0["reduced_count"] == 1
    assert d0["low_confusion_count"] == 2
    assert d0["elevated_confusion_count"] == 1
    assert d0["normal_pct"] == round((2 / 3) * 100, 1)
    assert d0["elevated_confusion_pct"] == round((1 / 3) * 100, 1)
    assert d0["mean_confidence"] == round((0.9 + 0.8 + 0.7) / 3, 2)
    assert d0["data_quality"] == "valid"

def test_unit_zero_vs_missing_observations():
    """Verify distinction between honest zero measurements and missing/empty buckets."""
    now = datetime.now(timezone.utc)
    aggregator = SessionAggregator(
        session_id="test_sess_02",
        classroom_id="test_class_01",
        teacher_id="test_teacher_01",
        title="Calculus L2",
        started_at=now
    )

    # Bucket 0: All normal, 0 elevated confusion
    aggregator.record_telemetry("stu_1", "NORMAL_BEHAVIOUR", "LOW", 0.95, int((now + timedelta(seconds=10)).timestamp() * 1000))
    aggregator.record_telemetry("stu_2", "NORMAL_BEHAVIOUR", "LOW", 0.85, int((now + timedelta(seconds=15)).timestamp() * 1000))

    b0 = aggregator.get_or_create_bucket(0)
    d0 = b0.to_dict("test_sess_02", "test_class_01")
    assert d0["normal_pct"] == 100.0
    assert d0["elevated_confusion_pct"] == 0.0  # Honest zero!
    assert d0["data_quality"] in ["valid", "insufficient_coverage"]

    # Bucket 1: Empty bucket with 0 samples
    b1 = aggregator.get_or_create_bucket(1)
    d1 = b1.to_dict("test_sess_02", "test_class_01")
    assert d1["total_samples"] == 0
    assert d1["normal_pct"] is None  # Missing/null, not 0!
    assert d1["elevated_confusion_pct"] is None  # Missing/null, not 0!
    assert d1["data_quality"] == "empty"

def test_unit_debounce_and_stale_telemetry():
    """Verify burst debounce and out-of-order/stale timestamp normalization."""
    now = datetime.now(timezone.utc)
    aggregator = SessionAggregator(
        session_id="test_sess_03",
        classroom_id="test_class_01",
        teacher_id="test_teacher_01",
        title="Physics L1",
        started_at=now
    )

    t0_ms = int(now.timestamp() * 1000)
    # Rapid burst from stu_1 within 100ms
    aggregator.record_telemetry("stu_1", "NORMAL_BEHAVIOUR", "LOW", 0.9, t0_ms)
    aggregator.record_telemetry("stu_1", "NORMAL_BEHAVIOUR", "LOW", 0.9, t0_ms + 50)
    aggregator.record_telemetry("stu_1", "NORMAL_BEHAVIOUR", "LOW", 0.9, t0_ms + 100)

    # Only 1 sample should be accepted due to 250ms debounce
    b0 = aggregator.get_or_create_bucket(0)
    assert b0.total_samples == 1

def test_session_lifecycle_and_analytics_persistence(client, test_db):
    """End-to-end integration test: session lifecycle, telemetry recording, and persistence."""
    t_token = get_auth_token(client, "t_analytics_e2e@test.com", "teacher")

    # 1. Create classroom
    c_resp = client.post("/api/classrooms/", json={
        "name": "Distributed Systems",
        "description": "Consensus & State Machine Replication"
    }, headers={"Authorization": f"Bearer {t_token}"})
    assert c_resp.status_code == 200
    classroom_id = c_resp.json()["id"]

    # 2. Create and start session
    s_resp = client.post("/api/sessions/", json={
        "classroom_id": classroom_id,
        "title": "Raft Consensus Algorithm"
    }, headers={"Authorization": f"Bearer {t_token}"})
    assert s_resp.status_code == 200
    session_id = s_resp.json()["id"]

    start_resp = client.post(f"/api/sessions/{session_id}/start", headers={"Authorization": f"Bearer {t_token}"})
    assert start_resp.status_code == 200

    # 3. Ingest simulated student telemetry via analytics_manager
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    analytics_manager.record_telemetry(
        session_id=session_id,
        classroom_id=classroom_id,
        student_id="student_alpha",
        engagement_state="NORMAL_BEHAVIOUR",
        confusion_signal="LOW",
        confidence=0.92,
        timestamp_ms=now_ms,
        db=test_db
    )
    analytics_manager.record_telemetry(
        session_id=session_id,
        classroom_id=classroom_id,
        student_id="student_beta",
        engagement_state="REDUCED_ENGAGEMENT_LIKE",
        confusion_signal="ELEVATED",
        confidence=0.78,
        timestamp_ms=now_ms + 1000,
        db=test_db
    )

    # 4. Check active session analytics endpoint (in-memory)
    active_summary = client.get(
        f"/api/sessions/{session_id}/analytics/summary",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    assert active_summary.status_code == 200
    active_data = active_summary.json()
    assert active_data["telemetry_status"] == "in_memory_live_only"
    assert active_data["total_observations"] == 2

    # 5. End session (triggers finalize_session and DB writes)
    end_resp = client.post(f"/api/sessions/{session_id}/end", headers={"Authorization": f"Bearer {t_token}"})
    assert end_resp.status_code == 200

    # 6. Verify persisted analytics summary endpoint
    persisted_summary = client.get(
        f"/api/sessions/{session_id}/analytics/summary",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    assert persisted_summary.status_code == 200
    summary_data = persisted_summary.json()
    assert summary_data["telemetry_status"] == "persisted"
    assert summary_data["total_observations"] == 2
    assert summary_data["engagement_distribution"]["normal_count"] == 1
    assert summary_data["engagement_distribution"]["reduced_count"] == 1
    assert summary_data["confusion_distribution"]["low_count"] == 1
    assert summary_data["confusion_distribution"]["elevated_count"] == 1
    assert summary_data["engagement_distribution"]["normal_pct"] == 50.0
    assert summary_data["confusion_distribution"]["elevated_pct"] == 50.0

    # 7. Verify persisted 1-minute buckets endpoint
    buckets_resp = client.get(
        f"/api/sessions/{session_id}/analytics/buckets",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    assert buckets_resp.status_code == 200
    buckets = buckets_resp.json()
    assert len(buckets) >= 1
    assert buckets[0]["bucket_index"] == 0
    assert buckets[0]["reporting_students"] == 2
    assert buckets[0]["total_samples"] == 2

    # 8. Verify teacher session history endpoint
    history_resp = client.get(
        "/api/sessions/teacher/history",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) >= 1
    matched = next((h for h in history if h["session_id"] == session_id), None)
    assert matched is not None
    assert matched["title"] == "Raft Consensus Algorithm"
    assert matched["classroom_name"] == "Distributed Systems"
    assert matched["telemetry_status"] == "persisted"
    assert matched["normal_pct"] == 50.0
    assert matched["elevated_confusion_pct"] == 50.0

    # 9. Verify classroom-scoped session history endpoint
    class_history_resp = client.get(
        f"/api/classrooms/{classroom_id}/sessions/history",
        headers={"Authorization": f"Bearer {t_token}"}
    )
    assert class_history_resp.status_code == 200
    class_history = class_history_resp.json()
    assert len(class_history) >= 1
    assert class_history[0]["session_id"] == session_id

def test_teacher_authorization_and_cross_classroom_denial(client):
    """Enforce server-side teacher ownership and isolation."""
    t1_token = get_auth_token(client, "t1_analytics_auth@test.com", "teacher")
    t2_token = get_auth_token(client, "t2_analytics_auth@test.com", "teacher")
    s_token = get_auth_token(client, "s_analytics_auth@test.com", "student")

    # Teacher 1 creates classroom & session
    c1 = client.post("/api/classrooms/", json={"name": "Cybersecurity"}, headers={"Authorization": f"Bearer {t1_token}"}).json()
    s1 = client.post("/api/sessions/", json={"classroom_id": c1["id"], "title": "Zero Trust"}, headers={"Authorization": f"Bearer {t1_token}"}).json()
    client.post(f"/api/sessions/{s1['id']}/start", headers={"Authorization": f"Bearer {t1_token}"})
    client.post(f"/api/sessions/{s1['id']}/end", headers={"Authorization": f"Bearer {t1_token}"})

    # Teacher 2 attempts cross-classroom access to summary -> 403 Forbidden
    r_summary = client.get(f"/api/sessions/{s1['id']}/analytics/summary", headers={"Authorization": f"Bearer {t2_token}"})
    assert r_summary.status_code == 403

    # Teacher 2 attempts cross-classroom access to buckets -> 403 Forbidden
    r_buckets = client.get(f"/api/sessions/{s1['id']}/analytics/buckets", headers={"Authorization": f"Bearer {t2_token}"})
    assert r_buckets.status_code == 403

    # Teacher 2 attempts cross-classroom history query -> 403 Forbidden
    r_class_hist = client.get(f"/api/classrooms/{c1['id']}/sessions/history", headers={"Authorization": f"Bearer {t2_token}"})
    assert r_class_hist.status_code == 403

    # Student attempts access to teacher analytics -> 403 Forbidden
    r_student = client.get(f"/api/sessions/{s1['id']}/analytics/summary", headers={"Authorization": f"Bearer {s_token}"})
    assert r_student.status_code == 403

    # Unauthenticated user -> 401 Unauthorized
    r_unauth = client.get(f"/api/sessions/{s1['id']}/analytics/summary")
    assert r_unauth.status_code == 401

def test_empty_and_legacy_session_analytics(client):
    """Ensure sessions without telemetry report 'unavailable' honestly without fake data."""
    t_token = get_auth_token(client, "t_empty_analytics@test.com", "teacher")

    c = client.post("/api/classrooms/", json={"name": "History of AI"}, headers={"Authorization": f"Bearer {t_token}"}).json()
    s = client.post("/api/sessions/", json={"classroom_id": c["id"], "title": "Dartmouth 1956"}, headers={"Authorization": f"Bearer {t_token}"}).json()

    # End session without sending any telemetry
    client.post(f"/api/sessions/{s['id']}/start", headers={"Authorization": f"Bearer {t_token}"})
    client.post(f"/api/sessions/{s['id']}/end", headers={"Authorization": f"Bearer {t_token}"})

    # Summary should report unavailable honestly
    resp = client.get(f"/api/sessions/{s['id']}/analytics/summary", headers={"Authorization": f"Bearer {t_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["telemetry_status"] == "unavailable"
    assert data["total_observations"] == 0
    assert data["data_quality"] == "no_telemetry"
    assert data["engagement_distribution"]["normal_pct"] is None
    assert data["confusion_distribution"]["elevated_pct"] is None

    # Buckets should be empty list
    b_resp = client.get(f"/api/sessions/{s['id']}/analytics/buckets", headers={"Authorization": f"Bearer {t_token}"})
    assert b_resp.status_code == 200
    assert b_resp.json() == []

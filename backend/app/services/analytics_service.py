import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set
from fastapi import HTTPException

logger = logging.getLogger("mindmap.analytics")

def format_duration(seconds: Optional[int]) -> str:
    if seconds is None or seconds <= 0:
        return "0s"
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    rem_seconds = s % 60
    if hours > 0:
        return f"{hours}h {minutes}m {rem_seconds}s"
    if minutes > 0:
        return f"{minutes}m {rem_seconds}s"
    return f"{rem_seconds}s"

class ActiveBucket:
    def __init__(self, bucket_index: int, start_time: datetime, end_time: datetime):
        self.bucket_index = bucket_index
        self.start_time = start_time
        self.end_time = end_time
        self.reporting_students: Set[str] = set()
        self.total_samples = 0
        self.normal_count = 0
        self.reduced_count = 0
        self.uncertain_engagement_count = 0
        self.low_confusion_count = 0
        self.elevated_confusion_count = 0
        self.uncertain_confusion_count = 0
        self.confidence_sum = 0.0
        self.confidence_count = 0
        self.flushed_to_db = False

    def add_sample(self, student_id: str, engagement: str, confusion: str, confidence: float):
        self.reporting_students.add(student_id)
        self.total_samples += 1

        if engagement == "NORMAL_BEHAVIOUR":
            self.normal_count += 1
        elif engagement == "REDUCED_ENGAGEMENT_LIKE":
            self.reduced_count += 1
        else:
            self.uncertain_engagement_count += 1

        if confusion == "LOW":
            self.low_confusion_count += 1
        elif confusion == "ELEVATED":
            self.elevated_confusion_count += 1
        else:
            self.uncertain_confusion_count += 1

        if isinstance(confidence, (int, float)) and 0.0 <= confidence <= 1.0:
            self.confidence_sum += float(confidence)
            self.confidence_count += 1

    def to_dict(self, session_id: str, classroom_id: str) -> Dict[str, Any]:
        valid_eng = self.normal_count + self.reduced_count + self.uncertain_engagement_count
        valid_conf = self.low_confusion_count + self.elevated_confusion_count + self.uncertain_confusion_count

        normal_pct = None
        reduced_pct = None
        uncertain_engagement_pct = None
        if valid_eng > 0:
            normal_pct = round((self.normal_count / valid_eng) * 100.0, 1)
            reduced_pct = round((self.reduced_count / valid_eng) * 100.0, 1)
            uncertain_engagement_pct = round((self.uncertain_engagement_count / valid_eng) * 100.0, 1)

        low_confusion_pct = None
        elevated_confusion_pct = None
        uncertain_confusion_pct = None
        if valid_conf > 0:
            low_confusion_pct = round((self.low_confusion_count / valid_conf) * 100.0, 1)
            elevated_confusion_pct = round((self.elevated_confusion_count / valid_conf) * 100.0, 1)
            uncertain_confusion_pct = round((self.uncertain_confusion_count / valid_conf) * 100.0, 1)

        mean_confidence = None
        if self.confidence_count > 0:
            mean_confidence = round(self.confidence_sum / self.confidence_count, 2)

        data_quality = "valid"
        if self.total_samples == 0:
            data_quality = "empty"
        elif len(self.reporting_students) <= 1 and self.total_samples < 5:
            data_quality = "insufficient_coverage"

        return {
            "_id": f"{session_id}_b{self.bucket_index}",
            "id": f"{session_id}_b{self.bucket_index}",
            "session_id": session_id,
            "classroom_id": classroom_id,
            "bucket_index": self.bucket_index,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "reporting_students": len(self.reporting_students),
            "total_samples": self.total_samples,
            "normal_count": self.normal_count,
            "reduced_count": self.reduced_count,
            "uncertain_engagement_count": self.uncertain_engagement_count,
            "low_confusion_count": self.low_confusion_count,
            "elevated_confusion_count": self.elevated_confusion_count,
            "uncertain_confusion_count": self.uncertain_confusion_count,
            "normal_pct": normal_pct,
            "reduced_pct": reduced_pct,
            "uncertain_engagement_pct": uncertain_engagement_pct,
            "low_confusion_pct": low_confusion_pct,
            "elevated_confusion_pct": elevated_confusion_pct,
            "uncertain_confusion_pct": uncertain_confusion_pct,
            "mean_confidence": mean_confidence,
            "data_quality": data_quality
        }

class SessionAggregator:
    def __init__(self, session_id: str, classroom_id: str, teacher_id: str, title: str, started_at: datetime):
        self.session_id = session_id
        self.classroom_id = classroom_id
        self.teacher_id = teacher_id
        self.title = title
        self.started_at = started_at
        self.buckets: Dict[int, ActiveBucket] = {}
        self.student_last_seen: Dict[str, float] = {}  # student_id -> timestamp_ms
        self.all_reporting_students: Set[str] = set()
        self.persistence_error = False

    def get_or_create_bucket(self, bucket_index: int) -> ActiveBucket:
        if bucket_index not in self.buckets:
            b_start = self.started_at + timedelta(seconds=bucket_index * 60)
            b_end = b_start + timedelta(seconds=60)
            self.buckets[bucket_index] = ActiveBucket(bucket_index, b_start, b_end)
        return self.buckets[bucket_index]

    def record_telemetry(
        self,
        student_id: str,
        engagement_state: str,
        confusion_signal: str,
        confidence: float,
        timestamp_ms: int,
        db: Optional[Any] = None
    ):
        now_utc = datetime.now(timezone.utc)

        # Normalize timestamp to UTC server baseline
        ts_sec = timestamp_ms / 1000.0 if timestamp_ms else now_utc.timestamp()
        obs_time = datetime.fromtimestamp(ts_sec, tz=timezone.utc)

        # Handle out-of-order or stale timestamps (>15s past or >5s future)
        time_diff = abs((now_utc - obs_time).total_seconds())
        if time_diff > 15:
            obs_time = now_utc

        # Enforce debounce: ignore duplicate emits within 250ms from the same student
        last_ms = self.student_last_seen.get(student_id, 0)
        current_event_ms = int(obs_time.timestamp() * 1000)
        if current_event_ms - last_ms < 250:
            return  # Debounce burst duplicates

        self.student_last_seen[student_id] = current_event_ms
        self.all_reporting_students.add(student_id)

        # Determine 60-second bucket index relative to session start
        if hasattr(self.started_at, "tzinfo") and self.started_at.tzinfo is None:
            self.started_at = self.started_at.replace(tzinfo=timezone.utc)

        elapsed_sec = max(0, int((obs_time - self.started_at).total_seconds()))
        bucket_index = elapsed_sec // 60

        bucket = self.get_or_create_bucket(bucket_index)
        bucket.add_sample(student_id, engagement_state, confusion_signal, confidence)

        # Periodically flush any completed prior buckets to DB in non-blocking fashion
        if db is not None:
            self._flush_completed_buckets(bucket_index, db)

    def _flush_completed_buckets(self, current_bucket_index: int, db: Any):
        for idx, b in self.buckets.items():
            if idx < current_bucket_index and not b.flushed_to_db:
                try:
                    b_doc = b.to_dict(self.session_id, self.classroom_id)
                    db.session_analytics_buckets.update_one(
                        {"session_id": self.session_id, "bucket_index": idx},
                        {"$set": b_doc},
                        upsert=True
                    )
                    b.flushed_to_db = True
                except Exception as e:
                    logger.error(f"Failed to flush bucket {idx} for session {self.session_id}: {e}")
                    self.persistence_error = True

class SessionAnalyticsManager:
    def __init__(self):
        self._active_sessions: Dict[str, SessionAggregator] = {}

    def start_session(
        self,
        session_id: str,
        classroom_id: str,
        teacher_id: str,
        title: str,
        started_at: datetime
    ):
        if hasattr(started_at, "tzinfo") and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        self._active_sessions[session_id] = SessionAggregator(
            session_id=session_id,
            classroom_id=classroom_id,
            teacher_id=teacher_id,
            title=title,
            started_at=started_at
        )

    def record_telemetry(
        self,
        session_id: str,
        classroom_id: str,
        student_id: str,
        engagement_state: str,
        confusion_signal: str,
        confidence: float,
        timestamp_ms: int,
        db: Optional[Any] = None
    ):
        aggregator = self._active_sessions.get(session_id)
        if not aggregator:
            # Reconstruct aggregator if missing from memory
            now_utc = datetime.now(timezone.utc)
            aggregator = SessionAggregator(
                session_id=session_id,
                classroom_id=classroom_id,
                teacher_id="",
                title="",
                started_at=now_utc
            )
            self._active_sessions[session_id] = aggregator

        try:
            aggregator.record_telemetry(
                student_id=student_id,
                engagement_state=engagement_state,
                confusion_signal=confusion_signal,
                confidence=confidence,
                timestamp_ms=timestamp_ms,
                db=db
            )
        except Exception as e:
            logger.error(f"Error recording telemetry in session {session_id}: {e}")

    def finalize_session(self, db: Any, session_id: str) -> Optional[Dict[str, Any]]:
        aggregator = self._active_sessions.pop(session_id, None)

        # Retrieve session doc from DB
        session_doc = db.sessions.find_one({"_id": session_id})
        if not session_doc:
            return None

        teacher_id = session_doc.get("teacher_id", "")
        classroom_id = session_doc.get("classroom_id", "")
        session_title = session_doc.get("title", "Session")
        started_at = session_doc.get("started_at")
        ended_at = session_doc.get("ended_at") or datetime.now(timezone.utc)

        duration_seconds = 0
        if started_at:
            if hasattr(started_at, "tzinfo") and started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            if hasattr(ended_at, "tzinfo") and ended_at.tzinfo is None:
                ended_at = ended_at.replace(tzinfo=timezone.utc)
            duration_seconds = max(0, int((ended_at - started_at).total_seconds()))

        # Check total participants enrolled
        total_enrolled = db.participants.count_documents({"session_id": session_id})

        # If no aggregator existed (e.g. ended without receiving live telemetry)
        if not aggregator or not aggregator.buckets:
            summary_doc = {
                "_id": session_id,
                "id": session_id,
                "session_id": session_id,
                "classroom_id": classroom_id,
                "teacher_id": teacher_id,
                "session_title": session_title,
                "started_at": started_at,
                "ended_at": ended_at,
                "duration_seconds": duration_seconds,
                "total_students_enrolled": total_enrolled,
                "peak_reporting_students": 0,
                "total_observations": 0,
                "engagement_distribution": {
                    "normal_count": 0,
                    "reduced_count": 0,
                    "uncertain_count": 0,
                    "normal_pct": None,
                    "reduced_pct": None,
                    "uncertain_pct": None
                },
                "confusion_distribution": {
                    "low_count": 0,
                    "elevated_count": 0,
                    "uncertain_count": 0,
                    "low_pct": None,
                    "elevated_pct": None,
                    "uncertain_pct": None
                },
                "mean_confidence": None,
                "total_buckets": 0,
                "valid_buckets": 0,
                "telemetry_status": "unavailable",
                "data_quality": "no_telemetry",
                "created_at": datetime.now(timezone.utc)
            }
            try:
                db.session_analytics_summaries.update_one(
                    {"session_id": session_id},
                    {"$set": summary_doc},
                    upsert=True
                )
            except Exception as e:
                logger.error(f"Failed to persist empty summary for session {session_id}: {e}")
            return summary_doc

        # Aggregate across all buckets
        all_buckets_sorted = sorted(aggregator.buckets.values(), key=lambda b: b.bucket_index)
        total_observations = 0
        normal_total = 0
        reduced_total = 0
        uncertain_eng_total = 0
        low_conf_total = 0
        elevated_conf_total = 0
        uncertain_conf_total = 0
        conf_sum_total = 0.0
        conf_cnt_total = 0
        peak_reporting = 0
        valid_buckets = 0

        for b in all_buckets_sorted:
            b_dict = b.to_dict(session_id, classroom_id)
            total_observations += b.total_samples
            normal_total += b.normal_count
            reduced_total += b.reduced_count
            uncertain_eng_total += b.uncertain_engagement_count
            low_conf_total += b.low_confusion_count
            elevated_conf_total += b.elevated_confusion_count
            uncertain_conf_total += b.uncertain_confusion_count
            conf_sum_total += b.confidence_sum
            conf_cnt_total += b.confidence_count
            peak_reporting = max(peak_reporting, len(b.reporting_students))
            if b.total_samples > 0:
                valid_buckets += 1

            # Persist bucket to DB
            try:
                db.session_analytics_buckets.update_one(
                    {"session_id": session_id, "bucket_index": b.bucket_index},
                    {"$set": b_dict},
                    upsert=True
                )
            except Exception as e:
                logger.error(f"Error saving bucket {b.bucket_index} for session {session_id}: {e}")
                aggregator.persistence_error = True

        valid_eng = normal_total + reduced_total + uncertain_eng_total
        valid_conf = low_conf_total + elevated_conf_total + uncertain_conf_total

        normal_pct = None
        reduced_pct = None
        uncertain_eng_pct = None
        if valid_eng > 0:
            normal_pct = round((normal_total / valid_eng) * 100.0, 1)
            reduced_pct = round((reduced_total / valid_eng) * 100.0, 1)
            uncertain_eng_pct = round((uncertain_eng_total / valid_eng) * 100.0, 1)

        low_conf_pct = None
        elevated_conf_pct = None
        uncertain_conf_pct = None
        if valid_conf > 0:
            low_conf_pct = round((low_conf_total / valid_conf) * 100.0, 1)
            elevated_conf_pct = round((elevated_conf_total / valid_conf) * 100.0, 1)
            uncertain_conf_pct = round((uncertain_conf_total / valid_conf) * 100.0, 1)

        mean_confidence = None
        if conf_cnt_total > 0:
            mean_confidence = round(conf_sum_total / conf_cnt_total, 2)

        data_quality = "reliable"
        if aggregator.persistence_error:
            data_quality = "degraded"
        elif valid_buckets == 0 or total_observations == 0:
            data_quality = "no_telemetry"
        elif peak_reporting <= 1 and total_observations < 10:
            data_quality = "partial"

        telemetry_status = "persisted"
        if aggregator.persistence_error:
            telemetry_status = "persistence_degraded"
        elif total_observations == 0:
            telemetry_status = "unavailable"

        summary_doc = {
            "_id": session_id,
            "id": session_id,
            "session_id": session_id,
            "classroom_id": classroom_id,
            "teacher_id": teacher_id,
            "session_title": session_title,
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_seconds": duration_seconds,
            "total_students_enrolled": total_enrolled,
            "peak_reporting_students": peak_reporting,
            "total_observations": total_observations,
            "engagement_distribution": {
                "normal_count": normal_total,
                "reduced_count": reduced_total,
                "uncertain_count": uncertain_eng_total,
                "normal_pct": normal_pct,
                "reduced_pct": reduced_pct,
                "uncertain_pct": uncertain_eng_pct
            },
            "confusion_distribution": {
                "low_count": low_conf_total,
                "elevated_count": elevated_conf_total,
                "uncertain_count": uncertain_conf_total,
                "low_pct": low_conf_pct,
                "elevated_pct": elevated_conf_pct,
                "uncertain_pct": uncertain_conf_pct
            },
            "mean_confidence": mean_confidence,
            "total_buckets": len(all_buckets_sorted),
            "valid_buckets": valid_buckets,
            "telemetry_status": telemetry_status,
            "data_quality": data_quality,
            "created_at": datetime.now(timezone.utc)
        }

        try:
            db.session_analytics_summaries.update_one(
                {"session_id": session_id},
                {"$set": summary_doc},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Error persisting session analytics summary {session_id}: {e}")

        return summary_doc

    def get_summary(self, db: Any, session_id: str, teacher_id: str) -> Dict[str, Any]:
        session_doc = db.sessions.find_one({"_id": session_id})
        if not session_doc:
            raise HTTPException(status_code=404, detail="Session not found")

        if session_doc.get("teacher_id") != teacher_id:
            raise HTTPException(status_code=403, detail="Not authorized to access analytics for this session")

        # 1. Check if persisted in MongoDB
        persisted = db.session_analytics_summaries.find_one({"session_id": session_id})
        if persisted:
            persisted["id"] = persisted.get("_id", session_id)
            return persisted

        # 2. Check if active in memory
        aggregator = self._active_sessions.get(session_id)
        if aggregator and session_doc.get("status") == "active":
            started_at = aggregator.started_at
            now_utc = datetime.now(timezone.utc)
            duration_sec = max(0, int((now_utc - started_at).total_seconds()))
            all_buckets = sorted(aggregator.buckets.values(), key=lambda b: b.bucket_index)

            total_obs = sum(b.total_samples for b in all_buckets)
            norm_cnt = sum(b.normal_count for b in all_buckets)
            red_cnt = sum(b.reduced_count for b in all_buckets)
            unc_eng_cnt = sum(b.uncertain_engagement_count for b in all_buckets)
            low_cnt = sum(b.low_confusion_count for b in all_buckets)
            elev_cnt = sum(b.elevated_confusion_count for b in all_buckets)
            unc_conf_cnt = sum(b.uncertain_confusion_count for b in all_buckets)
            c_sum = sum(b.confidence_sum for b in all_buckets)
            c_cnt = sum(b.confidence_count for b in all_buckets)

            valid_eng = norm_cnt + red_cnt + unc_eng_cnt
            valid_conf = low_cnt + elev_cnt + unc_conf_cnt

            normal_pct = round((norm_cnt / valid_eng) * 100.0, 1) if valid_eng > 0 else None
            reduced_pct = round((red_cnt / valid_eng) * 100.0, 1) if valid_eng > 0 else None
            unc_eng_pct = round((unc_eng_cnt / valid_eng) * 100.0, 1) if valid_eng > 0 else None
            low_pct = round((low_cnt / valid_conf) * 100.0, 1) if valid_conf > 0 else None
            elev_pct = round((elev_cnt / valid_conf) * 100.0, 1) if valid_conf > 0 else None
            unc_conf_pct = round((unc_conf_cnt / valid_conf) * 100.0, 1) if valid_conf > 0 else None
            mean_conf = round(c_sum / c_cnt, 2) if c_cnt > 0 else None

            total_enrolled = db.participants.count_documents({"session_id": session_id})

            return {
                "id": session_id,
                "session_id": session_id,
                "classroom_id": aggregator.classroom_id,
                "teacher_id": teacher_id,
                "session_title": session_doc.get("title", "Session"),
                "started_at": started_at,
                "ended_at": None,
                "duration_seconds": duration_sec,
                "total_students_enrolled": total_enrolled,
                "peak_reporting_students": len(aggregator.all_reporting_students),
                "total_observations": total_obs,
                "engagement_distribution": {
                    "normal_count": norm_cnt,
                    "reduced_count": red_cnt,
                    "uncertain_count": unc_eng_cnt,
                    "normal_pct": normal_pct,
                    "reduced_pct": reduced_pct,
                    "uncertain_pct": unc_eng_pct
                },
                "confusion_distribution": {
                    "low_count": low_cnt,
                    "elevated_count": elev_cnt,
                    "uncertain_count": unc_conf_cnt,
                    "low_pct": low_pct,
                    "elevated_pct": elev_pct,
                    "uncertain_pct": unc_conf_pct
                },
                "mean_confidence": mean_conf,
                "total_buckets": len(all_buckets),
                "valid_buckets": sum(1 for b in all_buckets if b.total_samples > 0),
                "telemetry_status": "in_memory_live_only",
                "data_quality": "reliable" if total_obs > 0 else "no_telemetry",
                "created_at": None
            }

        # 3. Ended session without persisted analytics (e.g. legacy pre-Phase 7B session)
        started_at = session_doc.get("started_at")
        ended_at = session_doc.get("ended_at")
        duration_seconds = 0
        if started_at and ended_at:
            if hasattr(started_at, "tzinfo") and started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            if hasattr(ended_at, "tzinfo") and ended_at.tzinfo is None:
                ended_at = ended_at.replace(tzinfo=timezone.utc)
            duration_seconds = max(0, int((ended_at - started_at).total_seconds()))

        total_enrolled = db.participants.count_documents({"session_id": session_id})

        return {
            "id": session_id,
            "session_id": session_id,
            "classroom_id": session_doc.get("classroom_id", ""),
            "teacher_id": teacher_id,
            "session_title": session_doc.get("title", "Session"),
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_seconds": duration_seconds,
            "total_students_enrolled": total_enrolled,
            "peak_reporting_students": 0,
            "total_observations": 0,
            "engagement_distribution": {
                "normal_count": 0,
                "reduced_count": 0,
                "uncertain_count": 0,
                "normal_pct": None,
                "reduced_pct": None,
                "uncertain_pct": None
            },
            "confusion_distribution": {
                "low_count": 0,
                "elevated_count": 0,
                "uncertain_count": 0,
                "low_pct": None,
                "elevated_pct": None,
                "uncertain_pct": None
            },
            "mean_confidence": None,
            "total_buckets": 0,
            "valid_buckets": 0,
            "telemetry_status": "unavailable",
            "data_quality": "no_telemetry",
            "created_at": session_doc.get("created_at")
        }

    def get_buckets(self, db: Any, session_id: str, teacher_id: str) -> List[Dict[str, Any]]:
        session_doc = db.sessions.find_one({"_id": session_id})
        if not session_doc:
            raise HTTPException(status_code=404, detail="Session not found")

        if session_doc.get("teacher_id") != teacher_id:
            raise HTTPException(status_code=403, detail="Not authorized to access analytics for this session")

        # 1. Fetch from DB
        cursor = db.session_analytics_buckets.find({"session_id": session_id}).sort("bucket_index", 1)
        db_buckets = []
        for doc in cursor:
            doc["id"] = doc.get("_id", f"{session_id}_b{doc.get('bucket_index', 0)}")
            db_buckets.append(doc)

        if db_buckets:
            return db_buckets

        # 2. Check active in-memory buckets
        aggregator = self._active_sessions.get(session_id)
        if aggregator and session_doc.get("status") == "active":
            return [b.to_dict(session_id, aggregator.classroom_id) for b in sorted(aggregator.buckets.values(), key=lambda x: x.bucket_index)]

        return []

    def get_teacher_session_history(self, db: Any, teacher_id: str) -> List[Dict[str, Any]]:
        # Find all ended sessions owned by this teacher
        cursor = db.sessions.find({"teacher_id": teacher_id, "status": "ended"}).sort("ended_at", -1)
        history = []

        classroom_cache = {}
        for s in cursor:
            s_id = s["_id"]
            c_id = s.get("classroom_id", "")

            if c_id not in classroom_cache:
                c_doc = db.classrooms.find_one({"_id": c_id})
                classroom_cache[c_id] = c_doc.get("name", "Classroom") if c_doc else "Classroom"
            c_name = classroom_cache[c_id]

            started_at = s.get("started_at")
            ended_at = s.get("ended_at")
            duration_sec = 0
            if started_at and ended_at:
                if hasattr(started_at, "tzinfo") and started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                if hasattr(ended_at, "tzinfo") and ended_at.tzinfo is None:
                    ended_at = ended_at.replace(tzinfo=timezone.utc)
                duration_sec = max(0, int((ended_at - started_at).total_seconds()))

            total_participants = db.participants.count_documents({"session_id": s_id})

            # Check persisted analytics summary
            summary = db.session_analytics_summaries.find_one({"session_id": s_id})
            normal_pct = None
            elevated_pct = None
            telemetry_status = "unavailable"
            data_quality = "no_telemetry"

            if summary:
                eng_dist = summary.get("engagement_distribution", {})
                conf_dist = summary.get("confusion_distribution", {})
                normal_pct = eng_dist.get("normal_pct")
                elevated_pct = conf_dist.get("elevated_pct")
                telemetry_status = summary.get("telemetry_status", "persisted")
                data_quality = summary.get("data_quality", "reliable")

            history.append({
                "id": s_id,
                "session_id": s_id,
                "classroom_id": c_id,
                "classroom_name": c_name,
                "title": s.get("title", "Untitled Session"),
                "status": s.get("status", "ended"),
                "created_at": s.get("created_at"),
                "started_at": started_at,
                "ended_at": ended_at,
                "duration_seconds": duration_sec,
                "duration_formatted": format_duration(duration_sec),
                "total_participants": total_participants,
                "normal_pct": normal_pct,
                "elevated_confusion_pct": elevated_pct,
                "telemetry_status": telemetry_status,
                "data_quality": data_quality
            })

        return history

    def get_classroom_session_history(self, db: Any, classroom_id: str, teacher_id: str) -> List[Dict[str, Any]]:
        classroom = db.classrooms.find_one({"_id": classroom_id})
        if not classroom:
            raise HTTPException(status_code=404, detail="Classroom not found")

        if classroom.get("teacher_id") != teacher_id:
            raise HTTPException(status_code=403, detail="Not authorized to access sessions for this classroom")

        cursor = db.sessions.find({"classroom_id": classroom_id, "status": "ended"}).sort("ended_at", -1)
        history = []
        c_name = classroom.get("name", "Classroom")

        for s in cursor:
            s_id = s["_id"]
            started_at = s.get("started_at")
            ended_at = s.get("ended_at")
            duration_sec = 0
            if started_at and ended_at:
                if hasattr(started_at, "tzinfo") and started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                if hasattr(ended_at, "tzinfo") and ended_at.tzinfo is None:
                    ended_at = ended_at.replace(tzinfo=timezone.utc)
                duration_sec = max(0, int((ended_at - started_at).total_seconds()))

            total_participants = db.participants.count_documents({"session_id": s_id})
            summary = db.session_analytics_summaries.find_one({"session_id": s_id})

            normal_pct = None
            elevated_pct = None
            telemetry_status = "unavailable"
            data_quality = "no_telemetry"

            if summary:
                eng_dist = summary.get("engagement_distribution", {})
                conf_dist = summary.get("confusion_distribution", {})
                normal_pct = eng_dist.get("normal_pct")
                elevated_pct = conf_dist.get("elevated_pct")
                telemetry_status = summary.get("telemetry_status", "persisted")
                data_quality = summary.get("data_quality", "reliable")

            history.append({
                "id": s_id,
                "session_id": s_id,
                "classroom_id": classroom_id,
                "classroom_name": c_name,
                "title": s.get("title", "Untitled Session"),
                "status": s.get("status", "ended"),
                "created_at": s.get("created_at"),
                "started_at": started_at,
                "ended_at": ended_at,
                "duration_seconds": duration_sec,
                "duration_formatted": format_duration(duration_sec),
                "total_participants": total_participants,
                "normal_pct": normal_pct,
                "elevated_confusion_pct": elevated_pct,
                "telemetry_status": telemetry_status,
                "data_quality": data_quality
            })

        return history

# Global singleton
analytics_manager = SessionAnalyticsManager()

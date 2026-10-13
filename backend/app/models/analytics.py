from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class AnalyticsBucketModel(BaseModel):
    id: str = Field(alias="_id")
    session_id: str
    classroom_id: str
    bucket_index: int
    start_time: datetime
    end_time: datetime
    reporting_students: int = 0
    total_samples: int = 0
    normal_count: int = 0
    reduced_count: int = 0
    uncertain_engagement_count: int = 0
    low_confusion_count: int = 0
    elevated_confusion_count: int = 0
    uncertain_confusion_count: int = 0
    normal_pct: Optional[float] = None
    reduced_pct: Optional[float] = None
    uncertain_engagement_pct: Optional[float] = None
    low_confusion_pct: Optional[float] = None
    elevated_confusion_pct: Optional[float] = None
    uncertain_confusion_pct: Optional[float] = None
    mean_confidence: Optional[float] = None
    data_quality: str = "valid"  # "valid", "insufficient_coverage", "empty"

    class Config:
        populate_by_name = True

class SessionAnalyticsSummaryModel(BaseModel):
    id: str = Field(alias="_id")
    session_id: str
    classroom_id: str
    teacher_id: str
    session_title: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int = 0
    total_students_enrolled: int = 0
    peak_reporting_students: int = 0
    total_observations: int = 0
    engagement_distribution: Dict[str, Any] = Field(default_factory=dict)
    confusion_distribution: Dict[str, Any] = Field(default_factory=dict)
    mean_confidence: Optional[float] = None
    total_buckets: int = 0
    valid_buckets: int = 0
    telemetry_status: str = "persisted"  # "persisted", "unavailable", "in_memory_live_only", "persistence_degraded"
    data_quality: str = "reliable"       # "reliable", "partial", "no_telemetry", "degraded"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

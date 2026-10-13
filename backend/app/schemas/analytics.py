from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class AnalyticsBucketResponse(BaseModel):
    id: str
    session_id: str
    classroom_id: str
    bucket_index: int
    start_time: datetime
    end_time: datetime
    reporting_students: int
    total_samples: int
    normal_count: int
    reduced_count: int
    uncertain_engagement_count: int
    low_confusion_count: int
    elevated_confusion_count: int
    uncertain_confusion_count: int
    normal_pct: Optional[float] = None
    reduced_pct: Optional[float] = None
    uncertain_engagement_pct: Optional[float] = None
    low_confusion_pct: Optional[float] = None
    elevated_confusion_pct: Optional[float] = None
    uncertain_confusion_pct: Optional[float] = None
    mean_confidence: Optional[float] = None
    data_quality: str

class EngagementDistributionResponse(BaseModel):
    normal_count: int = 0
    reduced_count: int = 0
    uncertain_count: int = 0
    normal_pct: Optional[float] = None
    reduced_pct: Optional[float] = None
    uncertain_pct: Optional[float] = None

class ConfusionDistributionResponse(BaseModel):
    low_count: int = 0
    elevated_count: int = 0
    uncertain_count: int = 0
    low_pct: Optional[float] = None
    elevated_pct: Optional[float] = None
    uncertain_pct: Optional[float] = None

class SessionAnalyticsSummaryResponse(BaseModel):
    id: str
    session_id: str
    classroom_id: str
    teacher_id: str
    session_title: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int
    total_students_enrolled: int
    peak_reporting_students: int
    total_observations: int
    engagement_distribution: EngagementDistributionResponse
    confusion_distribution: ConfusionDistributionResponse
    mean_confidence: Optional[float] = None
    total_buckets: int
    valid_buckets: int
    telemetry_status: str  # "persisted", "unavailable", "in_memory_live_only", "persistence_degraded"
    data_quality: str      # "reliable", "partial", "no_telemetry", "degraded"
    created_at: Optional[datetime] = None

class TeacherSessionHistoryItem(BaseModel):
    id: str
    session_id: str
    classroom_id: str
    classroom_name: str
    title: str
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int
    duration_formatted: str
    total_participants: int
    normal_pct: Optional[float] = None
    elevated_confusion_pct: Optional[float] = None
    telemetry_status: str
    data_quality: str

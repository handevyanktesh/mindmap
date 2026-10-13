from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError
from app.core.config import settings

client = None
db = None

def connect_to_mongo():
    global client, db
    if not settings.MONGODB_URI:
        print("Warning: MONGODB_URI is not set. Running without database connection.")
        return

    try:
        client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        db = client[settings.DATABASE_NAME]

        # Create indexes
        db.users.create_index("email", unique=True)
        db.classrooms.create_index("join_code", unique=True)
        db.classrooms.create_index("teacher_id")
        db.sessions.create_index("classroom_id")
        db.sessions.create_index("teacher_id")
        db.sessions.create_index("status")
        db.sessions.create_index([("classroom_id", 1), ("created_at", -1)])
        db.participants.create_index("session_id")
        db.participants.create_index("student_id")
        db.participants.create_index("classroom_id")
        db.participants.create_index(
            [("session_id", 1), ("student_id", 1)],
            unique=True,
            partialFilterExpression={"status": "joined"}
        )

        # Analytics indexes & TTL retention (90-day retention for detailed 1-minute buckets)
        db.session_analytics_buckets.create_index([("session_id", 1), ("bucket_index", 1)], unique=True)
        db.session_analytics_buckets.create_index("start_time", expireAfterSeconds=90 * 86400)
        db.session_analytics_summaries.create_index("session_id", unique=True)
        db.session_analytics_summaries.create_index([("teacher_id", 1), ("created_at", -1)])
        db.session_analytics_summaries.create_index([("classroom_id", 1), ("created_at", -1)])

        # Student private reflection indexes
        db.reflections.create_index([("student_id", 1), ("created_at", -1)])
        db.reflections.create_index([("student_id", 1), ("session_id", 1)])

        # Classroom chat indexes
        db.chat_messages.create_index([("session_id", 1), ("created_at", 1)])
        db.chat_messages.create_index([("classroom_id", 1), ("created_at", -1)])

        print(f"Connected to MongoDB database: {settings.DATABASE_NAME}")
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}")
        client = None
        db = None
    except Exception as e:
        print(f"An error occurred while connecting to MongoDB: {e}")
        client = None
        db = None

def check_mongo_health() -> bool:
    """
    Actively checks MongoDB ping readiness. Returns True if DB is reachable, False otherwise.
    """
    global client, db
    if client is None or db is None:
        return False
    try:
        client.admin.command('ping')
        return True
    except (ConnectionFailure, PyMongoError, Exception):
        return False

def close_mongo_connection():
    global client, db
    if client:
        client.close()
        client = None
        db = None
        print("MongoDB connection closed.")

def get_database():
    return db

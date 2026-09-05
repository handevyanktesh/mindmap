from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
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
        
        print(f"Connected to MongoDB Atlas database: {settings.DATABASE_NAME}")
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB Atlas: {e}")
        client = None
        db = None
    except Exception as e:
        print(f"An error occurred while connecting to MongoDB: {e}")
        client = None
        db = None

def close_mongo_connection():
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")

def get_database():
    return db

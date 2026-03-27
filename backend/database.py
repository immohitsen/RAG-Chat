import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
client = None
db = None

async def connect_to_mongo():
    global client, db
    try:
        client = AsyncIOMotorClient(MONGO_URI)
        db = client["rag_database"]
        print(f"✅ Connected to MongoDB at {MONGO_URI}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("🛑 Disconnected from MongoDB")

def get_db():
    return db

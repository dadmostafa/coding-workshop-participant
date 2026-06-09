"""
MongoDB connection management with Lambda-aware connection pooling.
Reuses the client across warm invocations; resets on error.
"""

import os
from pymongo import MongoClient

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is not None:
        return _client

    host = os.getenv("MONGO_HOST", "localhost")
    port = int(os.getenv("MONGO_PORT", "27017"))
    user = os.getenv("MONGO_USER", "")
    password = os.getenv("MONGO_PASS", "")
    db_name = os.getenv("MONGO_NAME", "acme")
    is_local = os.getenv("IS_LOCAL", "true") == "true"

    kwargs = {
        "host": host,
        "port": port,
        "serverSelectionTimeoutMS": 5000,
        "socketTimeoutMS": 45000,
    }

    if user:
        kwargs["username"] = user
        kwargs["password"] = password
        kwargs["authSource"] = db_name

    if not is_local:
        kwargs["tls"] = True
        kwargs["tlsAllowInvalidCertificates"] = True
        kwargs["retryWrites"] = False

    _client = MongoClient(**kwargs)
    return _client


def get_db():
    db_name = os.getenv("MONGO_NAME", "acme")
    return get_client()[db_name]


def reset_client():
    global _client
    _client = None

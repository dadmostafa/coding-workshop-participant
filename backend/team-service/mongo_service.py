"""
MongoDB connection management with Lambda-aware connection pooling.
"""

import os
import re as re_module
from pymongo import MongoClient, ASCENDING, DESCENDING

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is not None:
        return _client

    host     = os.getenv("MONGO_HOST", "localhost")
    port     = int(os.getenv("MONGO_PORT", "27017"))
    user     = os.getenv("MONGO_USER", "")
    password = os.getenv("MONGO_PASS", "")
    db_name  = os.getenv("MONGO_NAME", "acme")
    is_local = os.getenv("IS_LOCAL", "true") == "true"

    kwargs = {
        "host": host,
        "port": port,
        "serverSelectionTimeoutMS": 5000,
        "socketTimeoutMS":          45000,
        "connectTimeoutMS":         10000,
        "maxPoolSize":              10,
        "retryReads":               True,
    }

    if user:
        kwargs["username"]   = user
        kwargs["password"]   = password
        kwargs["authSource"] = db_name

    if not is_local:
        kwargs["tls"]                    = True
        kwargs["tlsAllowInvalidCertificates"] = True
        kwargs["retryWrites"]            = False

    _client = MongoClient(**kwargs)
    return _client


def get_db():
    db_name = os.getenv("MONGO_NAME", "acme")
    return get_client()[db_name]


def reset_client():
    global _client
    _client = None


def ensure_indexes(db):
    """
    Create indexes for performance and uniqueness constraints.
    Safe to call on every cold start — MongoDB is idempotent with indexes.
    """
    try:
        # Users
        db["users"].create_index([("username", ASCENDING)], unique=True, background=True)
        db["users"].create_index([("email",    ASCENDING)], unique=True, sparse=True, background=True)

        # Teams
        db["teams"].create_index([("name",    ASCENDING)], background=True)
        db["teams"].create_index([("deleted", ASCENDING)], background=True)
        db["teams"].create_index([("department", ASCENDING)], background=True)

        # Members
        db["members"].create_index([("team_id", ASCENDING)],               background=True)
        db["members"].create_index([("team_id", ASCENDING), ("name", ASCENDING)], background=True)
        db["members"].create_index([("deleted", ASCENDING)],               background=True)
        db["members"].create_index([("name",    ASCENDING)],               background=True)

        # Achievements
        db["achievements"].create_index([("team_id", ASCENDING)],                         background=True)
        db["achievements"].create_index([("team_id", ASCENDING), ("year", DESCENDING)],   background=True)
        db["achievements"].create_index([("year", DESCENDING), ("month", DESCENDING)],    background=True)
        db["achievements"].create_index([("deleted", ASCENDING)],                         background=True)

        # Audit log
        db["audit_log"].create_index([("timestamp", DESCENDING)], background=True)
        db["audit_log"].create_index([("username",  ASCENDING)],  background=True)
        db["audit_log"].create_index([("resource",  ASCENDING)],  background=True)
        db["audit_log"].create_index([("action",    ASCENDING)],  background=True)

        # Team notes
        db["team_notes"].create_index([("team_id",   ASCENDING)],  background=True)
        db["team_notes"].create_index([("created_at",DESCENDING)], background=True)

        # Projects
        db["projects"].create_index([("team_id", ASCENDING)], background=True)
        db["projects"].create_index([("status", ASCENDING)], background=True)
        db["projects"].create_index([("owner_id", ASCENDING)], background=True)
        db["projects"].create_index([("updated_at", DESCENDING)], background=True)
        db["projects"].create_index([("deleted", ASCENDING)], background=True)
        db["projects"].create_index([("due_date", ASCENDING)], background=True)

    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Index creation warning: %s", e)

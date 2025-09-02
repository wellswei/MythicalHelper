# models.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

UTC = timezone.utc

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True)
    username = Column(String(50), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(20), unique=True, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)
    phone_verified_at = Column(DateTime, nullable=True)
    role = Column(String(20), default="user")
    status = Column(String(20), default="active")
    valid_until = Column(DateTime, nullable=True)
    badges = Column(Text, default="{}")  # JSON string
    oath_accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_phone', 'phone'),
        Index('idx_users_username', 'username'),
    )

class Registration(Base):
    __tablename__ = "registrations"
    
    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    username_set = Column(Boolean, default=False)
    oath_accepted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User", backref="registrations")

class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(String(50), primary_key=True)
    channel = Column(String(10), nullable=False)  # email or sms
    destination = Column(String(255), nullable=False)
    purpose = Column(String(20), nullable=False)  # signin, signup, change_email, change_phone
    subject_id = Column(String(50), nullable=True)
    code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_tickets_destination', 'destination'),
        Index('idx_tickets_expires_at', 'expires_at'),
    )

class Proof(Base):
    __tablename__ = "proofs"
    
    token = Column(String(100), primary_key=True)
    channel = Column(String(10), nullable=False)
    destination = Column(String(255), nullable=False)
    purpose = Column(String(20), nullable=False)
    subject_id = Column(String(50), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_proofs_expires_at', 'expires_at'),
    )

class Session(Base):
    __tablename__ = "sessions"
    
    access_token = Column(String(100), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationship
    user = relationship("User", backref="sessions")
    
    # Indexes
    __table_args__ = (
        Index('idx_sessions_user_id', 'user_id'),
        Index('idx_sessions_expires_at', 'expires_at'),
    )

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    refresh_token = Column(String(100), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationship
    user = relationship("User", backref="refresh_tokens")
    
    # Indexes
    __table_args__ = (
        Index('idx_refresh_tokens_user_id', 'user_id'),
        Index('idx_refresh_tokens_expires_at', 'expires_at'),
    )

class Purchase(Base):
    __tablename__ = "purchases"
    
    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=True)
    currency = Column(String(3), default="USD")
    provider_payment_id = Column(String(100), nullable=True)
    purchased_at = Column(DateTime, default=datetime.utcnow)
    valid_until_after_purchase = Column(DateTime, nullable=True)
    
    # Relationship
    user = relationship("User", backref="purchases")

class RateLimit(Base):
    __tablename__ = "rate_limits"
    
    key = Column(String(255), primary_key=True)
    window_start = Column(DateTime, nullable=False)
    count = Column(Integer, default=0)
    limit = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_rate_limits_window_start', 'window_start'),
    )

# Database setup
def get_database_url():
    """Get database URL from environment or use default SQLite"""
    return os.getenv("DATABASE_URL", "sqlite:///./mythicalhelper.db")

def create_database():
    """Create database and tables"""
    engine = create_engine(get_database_url())
    Base.metadata.create_all(engine)
    return engine

def get_session():
    """Get database session"""
    engine = create_engine(get_database_url())
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

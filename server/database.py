# database.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import json
from models import (
    User, Registration, MagicLink, Proof, Session as DBSession, 
    RefreshToken, Purchase, RateLimit, get_session
)

UTC = timezone.utc

class DatabaseService:
    def __init__(self):
        self.db: Session = get_session()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.db.close()
    
    # User operations
    def create_user(self, user_id: str, **kwargs) -> User:
        user = User(id=user_id, **kwargs)
        self.db.add(user)
        self.db.commit()
        return user
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()
    
    # phone-based lookup removed
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()
    
    def update_user(self, user_id: str, **kwargs) -> Optional[User]:
        user = self.get_user_by_id(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            user.updated_at = datetime.utcnow()
            self.db.commit()
        return user
    
    def delete_user(self, user_id: str) -> bool:
        user = self.get_user_by_id(user_id)
        if user:
            user.deleted_at = datetime.utcnow()
            self.db.commit()
            return True
        return False
    
    # Registration operations
    def create_registration(self, reg_id: str, user_id: str) -> Registration:
        reg = Registration(id=reg_id, user_id=user_id)
        self.db.add(reg)
        self.db.commit()
        return reg
    
    def get_registration_by_id(self, reg_id: str) -> Optional[Registration]:
        return self.db.query(Registration).filter(Registration.id == reg_id).first()
    
    def update_registration(self, reg_id: str, **kwargs) -> Optional[Registration]:
        reg = self.get_registration_by_id(reg_id)
        if reg:
            for key, value in kwargs.items():
                if hasattr(reg, key):
                    setattr(reg, key, value)
            reg.updated_at = datetime.utcnow()
            self.db.commit()
        return reg
    
    # Magic Link operations
    def create_magic_link(self, token: str, email: str, purpose: str, 
                         expires_at: datetime, subject_id: Optional[str] = None) -> MagicLink:
        magic_link = MagicLink(
            token=token, email=email, purpose=purpose,
            expires_at=expires_at, subject_id=subject_id
        )
        self.db.add(magic_link)
        self.db.commit()
        return magic_link
    
    def get_magic_link_by_token(self, token: str) -> Optional[MagicLink]:
        return self.db.query(MagicLink).filter(MagicLink.token == token).first()
    
    def mark_magic_link_used(self, token: str) -> bool:
        magic_link = self.get_magic_link_by_token(token)
        if magic_link and not magic_link.used_at:
            magic_link.used_at = datetime.utcnow()
            self.db.commit()
            return True
        return False
    
    def delete_magic_link(self, token: str) -> bool:
        magic_link = self.get_magic_link_by_token(token)
        if magic_link:
            self.db.delete(magic_link)
            self.db.commit()
            return True
        return False
    
    def cleanup_expired_magic_links(self) -> int:
        count = self.db.query(MagicLink).filter(MagicLink.expires_at < datetime.utcnow()).delete()
        self.db.commit()
        return count
    
    # Proof operations
    def create_proof(self, token: str, channel: str, destination: str,
                    purpose: str, expires_at: datetime, 
                    subject_id: Optional[str] = None) -> Proof:
        proof = Proof(
            token=token, channel=channel, destination=destination,
            purpose=purpose, expires_at=expires_at, subject_id=subject_id
        )
        self.db.add(proof)
        self.db.commit()
        return proof
    
    def get_proof_by_token(self, token: str) -> Optional[Proof]:
        return self.db.query(Proof).filter(Proof.token == token).first()
    
    def delete_proof(self, token: str) -> bool:
        proof = self.get_proof_by_token(token)
        if proof:
            self.db.delete(proof)
            self.db.commit()
            return True
        return False
    
    def cleanup_expired_proofs(self) -> int:
        count = self.db.query(Proof).filter(Proof.expires_at < datetime.utcnow()).delete()
        self.db.commit()
        return count
    
    # Session operations
    def create_session(self, access_token: str, user_id: str, role: str, 
                      expires_at: datetime) -> DBSession:
        session = DBSession(
            access_token=access_token, user_id=user_id,
            role=role, expires_at=expires_at
        )
        self.db.add(session)
        self.db.commit()
        return session
    
    def get_session_by_token(self, access_token: str) -> Optional[DBSession]:
        return self.db.query(DBSession).filter(DBSession.access_token == access_token).first()
    
    def delete_session(self, access_token: str) -> bool:
        session = self.get_session_by_token(access_token)
        if session:
            self.db.delete(session)
            self.db.commit()
            return True
        return False
    
    def cleanup_expired_sessions(self) -> int:
        count = self.db.query(DBSession).filter(DBSession.expires_at < datetime.utcnow()).delete()
        self.db.commit()
        return count
    
    # Refresh token operations
    def create_refresh_token(self, refresh_token: str, user_id: str, role: str,
                           expires_at: datetime) -> RefreshToken:
        refresh = RefreshToken(
            refresh_token=refresh_token, user_id=user_id,
            role=role, expires_at=expires_at
        )
        self.db.add(refresh)
        self.db.commit()
        return refresh
    
    def get_refresh_token(self, refresh_token: str) -> Optional[RefreshToken]:
        return self.db.query(RefreshToken).filter(RefreshToken.refresh_token == refresh_token).first()
    
    def delete_refresh_token(self, refresh_token: str) -> bool:
        refresh = self.get_refresh_token(refresh_token)
        if refresh:
            self.db.delete(refresh)
            self.db.commit()
            return True
        return False
    
    def cleanup_expired_refresh_tokens(self) -> int:
        count = self.db.query(RefreshToken).filter(RefreshToken.expires_at < datetime.utcnow()).delete()
        self.db.commit()
        return count
    
    # Signup session token operations
    def create_signup_session_token(self, signup_session_token: str, user_id: str, 
                                  expires_at: datetime) -> SignupSessionToken:
        from models import SignupSessionToken
        sst = SignupSessionToken(
            signup_session_token=signup_session_token,
            user_id=user_id,
            expires_at=expires_at
        )
        self.db.add(sst)
        self.db.commit()
        return sst
    
    def get_signup_session_token(self, signup_session_token: str) -> Optional[SignupSessionToken]:
        from models import SignupSessionToken
        return self.db.query(SignupSessionToken).filter(
            SignupSessionToken.signup_session_token == signup_session_token
        ).first()
    
    def delete_signup_session_token(self, signup_session_token: str) -> bool:
        from models import SignupSessionToken
        sst = self.get_signup_session_token(signup_session_token)
        if sst:
            self.db.delete(sst)
            self.db.commit()
            return True
        return False
    
    def cleanup_expired_signup_session_tokens(self) -> int:
        from models import SignupSessionToken
        count = self.db.query(SignupSessionToken).filter(
            SignupSessionToken.expires_at < datetime.utcnow()
        ).delete()
        self.db.commit()
        return count
    
    # Rate limit operations
    def get_rate_limit(self, key: str) -> Optional[RateLimit]:
        return self.db.query(RateLimit).filter(RateLimit.key == key).first()
    
    def create_or_update_rate_limit(self, key: str, window_start: datetime,
                                   count: int, limit: int) -> RateLimit:
        """Upsert a rate limit record and correctly roll the window.

        If an existing record is present but the provided window_start is a
        different minute, we reset window_start and the counter to the
        provided values. We always refresh the limit and updated_at.
        """
        rate_limit = self.get_rate_limit(key)
        now_utc = datetime.utcnow()
        if rate_limit:
            # New minute window: reset window_start and counter
            if rate_limit.window_start != window_start:
                rate_limit.window_start = window_start
                rate_limit.count = count
            else:
                # Same window; allow caller to explicitly set count
                rate_limit.count = count
            rate_limit.limit = limit
            rate_limit.updated_at = now_utc
        else:
            rate_limit = RateLimit(
                key=key,
                window_start=window_start,
                count=count,
                limit=limit,
                created_at=now_utc,
                updated_at=now_utc,
            )
            self.db.add(rate_limit)
        self.db.commit()
        return rate_limit
    
    def cleanup_expired_rate_limits(self, window_start: datetime) -> int:
        count = self.db.query(RateLimit).filter(RateLimit.window_start < window_start).delete()
        self.db.commit()
        return count
    
    # Purchase operations
    def create_purchase(self, purchase_id: str, user_id: str, **kwargs) -> Purchase:
        purchase = Purchase(id=purchase_id, user_id=user_id, **kwargs)
        self.db.add(purchase)
        self.db.commit()
        return purchase
    
    def get_purchase_by_id(self, purchase_id: str) -> Optional[Purchase]:
        return self.db.query(Purchase).filter(Purchase.id == purchase_id).first()
    
    # Utility methods
    def get_all_users(self) -> List[User]:
        return self.db.query(User).filter(User.deleted_at.is_(None)).all()
    
    def get_user_by_email_or_phone(self, email: Optional[str] = None, 
                                  phone: Optional[str] = None) -> Optional[User]:
        # Backward-compat: only email is supported now
        if email:
            return self.get_user_by_email(email)
        return None

# Convenience function
def get_db() -> DatabaseService:
    return DatabaseService()

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.auth.models import TokenBlocklist, User
from app.modules.auth.schemas.auth import UserRegister


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def create_user(
    db: Session, user_in: UserRegister, hashed_password: str
) -> User:
    db_user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def add_token_to_blocklist(db: Session, jti: str) -> None:
    db_token = TokenBlocklist(jti=jti)
    db.add(db_token)
    db.commit()


def is_token_blacklisted(db: Session, jti: str) -> bool:
    return (
        db.scalar(select(TokenBlocklist).where(TokenBlocklist.jti == jti))
        is not None
    )

from sqlalchemy.orm import Session
from models import Chat, Message
from repositories.base import BaseRepository
from typing import List, Optional

class ChatRepository(BaseRepository[Chat]):
    def __init__(self):
        super().__init__(Chat)

    def get_messages(self, db: Session, chat_id: int) -> List[Message]:
        return db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp).all()

    def get_or_create_by_uuid(self, db: Session, session_uuid: str) -> Chat:
        chat = db.query(Chat).filter(Chat.session_uuid == session_uuid).first()
        if chat:
            return chat
        chat = Chat(session_uuid=session_uuid, title="Chat Baru")
        db.add(chat)
        db.flush()
        db.refresh(chat)
        return chat

    def add_message(self, db: Session, chat_id: int, role: str, content: str) -> Message:
        msg = Message(chat_id=chat_id, role=role, content=content)
        db.add(msg)
        db.flush()
        db.refresh(msg)
        return msg

    def list_chats(self, db: Session) -> List[Chat]:
        """Daftar sesi chat (terbaru dulu) beserta jumlah pesan."""
        from sqlalchemy import func, select

        count_subq = (
            select(func.count(Message.id))
            .where(Message.chat_id == Chat.id)
            .correlate(Chat)
            .scalar_subquery()
        )
        return (
            db.query(Chat, count_subq.label("message_count"))
            .order_by(Chat.created_at.desc())
            .all()
        )

    def delete_by_session_uuid(self, db: Session, session_uuid: str) -> bool:
        chat = db.query(Chat).filter(Chat.session_uuid == session_uuid).first()
        if not chat:
            return False
        db.delete(chat)
        db.commit()
        return True

chat_repository = ChatRepository()

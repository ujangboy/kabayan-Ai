from sqlalchemy.orm import Session
from models import Chat, Message
from repositories.base import BaseRepository
from typing import List

class ChatRepository(BaseRepository[Chat]):
    def __init__(self):
        super().__init__(Chat)

    def get_messages(self, db: Session, chat_id: int) -> List[Message]:
        return db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp).all()
        
    def add_message(self, db: Session, chat_id: int, role: str, content: str) -> Message:
        msg = Message(chat_id=chat_id, role=role, content=content)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg

chat_repository = ChatRepository()

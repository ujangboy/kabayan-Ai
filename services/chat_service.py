from repositories.chat_repository import chat_repository
from sqlalchemy.orm import Session

class ChatService:
    @staticmethod
    def create_chat(db: Session, title: str):
        return chat_repository.create(db, {"title": title})

    @staticmethod
    def get_chat(db: Session, chat_id: int):
        return chat_repository.get(db, chat_id)
        
    @staticmethod
    def get_messages(db: Session, chat_id: int):
        return chat_repository.get_messages(db, chat_id)

chat_service = ChatService()

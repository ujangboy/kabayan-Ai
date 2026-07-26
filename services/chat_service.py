from repositories.chat_repository import chat_repository
from services.ai_service import ai_service
from services.rag_service import rag_service
from sqlalchemy.orm import Session
import json

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

    # @staticmethod
    # def handle_message(db: Session, chat_id: int, user_message: str, documents: list) -> str:
    #     # Saat ini belum digunakan karena Phase 2.1 masih menggunakan pola client-side state
    #     # (menyimpan history di localStorage frontend). Akan diaktifkan pada iterasi mendatang
    #     # jika UI frontend telah diadaptasi untuk menerima history dari database secara penuh.
    #     chat_repository.add_message(db, chat_id, "user", user_message)
    #     history = chat_repository.get_messages(db, chat_id)
    #     hist_dicts = [{"role": msg.role, "content": msg.content} for msg in history[:-1]] 
    #     context = ""
    #     if documents:
    #         retrieved = rag_service.search(user_message, active_doc_ids=documents, top_k=3)
    #         if retrieved:
    #             context += "--- DOKUMEN REFERENSI LOKAL ---\n"
    #             context += retrieved
    #             context += "\n\n"
    #     response_text = ai_service.chat(hist_dicts, context, user_message)
    #     chat_repository.add_message(db, chat_id, "assistant", response_text)
    #     return response_text

chat_service = ChatService()

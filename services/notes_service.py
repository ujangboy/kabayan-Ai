from services.ai_service import ai_service
from prompts.notes import NOTES_PROMPT
from repositories.note_repository import note_repository
from services.json_utils import sanitize_output
from sqlalchemy.orm import Session

class NotesService:
    @staticmethod
    def generate_notes(db: Session, subject_id: int, title: str, context: str):
        response = ai_service.generate(
            capability="reasoning",
            prompt_template=NOTES_PROMPT,
            input_variables={"context": context},
            use_cache=False,
            temperature=0.7,
        )
        content = sanitize_output(response)
        # Kembalikan content saja — caller yang memutuskan apakah perlu disimpan
        return content

    @staticmethod
    def generate_and_save_notes(db: Session, subject_id: int, title: str, context: str):
        """Generate AI + langsung simpan ke DB. Dipakai oleh endpoint yang memang ingin auto-save."""
        content = NotesService.generate_notes(db, subject_id, title, context)
        note = note_repository.create(db, {
            "subject_id": subject_id,
            "title": title,
            "content": content
        })
        return note

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 50):
        return note_repository.get_all(db, skip=skip, limit=limit)

    @staticmethod
    def delete(db: Session, note_id: int):
        return note_repository.delete(db, note_id)
        
    @staticmethod
    def process_action(db: Session, note_id: int, action: str):
        from services.flashcard_service import flashcard_service
        from services.quiz_service import quiz_service
        from services.summary_service import summary_service
        
        note = note_repository.get(db, note_id)
        if not note: return (False, None)
        
        if action == 'rapikan':
            from langchain_core.prompts import PromptTemplate
            prompt = PromptTemplate.from_template("Rapikan format dan bahasa dari catatan berikut tanpa mengubah makna aslinya:\n\n{context}")
            new_content = sanitize_output(ai_service.generate("reasoning", prompt, {"context": note.content}, use_cache=False))
            note_repository.update(db, note, {"content": new_content})
            updated_content = new_content
            
        elif action == 'ringkas':
            summary = summary_service.generate_summary(note.content, "Ringkas poin-poin penting.")
            new_content = note.content + "\n\n--- RINGKASAN AI ---\n" + sanitize_output(summary)
            note_repository.update(db, note, {"content": new_content})
            updated_content = new_content
            
        elif action == 'jelaskan':
            from langchain_core.prompts import PromptTemplate
            prompt = PromptTemplate.from_template("Jelaskan catatan berikut dengan bahasa yang lebih sederhana dan mudah dipahami:\n\n{context}")
            explanation = sanitize_output(ai_service.generate("reasoning", prompt, {"context": note.content}, use_cache=False))
            new_content = note.content + "\n\n--- PENJELASAN AI ---\n" + explanation
            note_repository.update(db, note, {"content": new_content})
            updated_content = new_content
            
        elif action == 'flashcard':
            flashcard_service.generate_flashcards(db, note.subject_id, note.content)
            updated_content = note.content
            
        elif action == 'quiz':
            quiz_service.generate_quiz(db, note.subject_id, note.content)
            updated_content = note.content
            
        return (True, updated_content)

notes_service = NotesService()

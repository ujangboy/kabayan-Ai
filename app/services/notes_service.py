from app.services.ai_service import ai_service
from app.prompts.notes import NOTES_PROMPT
from app.repositories.note_repository import note_repository
from app.services.json_utils import sanitize_output
from sqlalchemy.orm import Session

class NotesService:
    def generate_notes(self, db: Session, subject_id: int, title: str, context: str):
        response = ai_service.generate(
            capability="reasoning",
            prompt_template=NOTES_PROMPT,
            input_variables={"context": context},
            use_cache=True,
            temperature=0.7,
        )
        content = sanitize_output(response)
        return content

    def generate_and_save_notes(self, db: Session, subject_id: int, title: str, context: str):
        """Generate AI + langsung simpan ke DB. Dipakai oleh endpoint yang memang ingin auto-save."""
        content = self.generate_notes(db, subject_id, title, context)
        note = note_repository.create(db, {
            "subject_id": subject_id,
            "title": title,
            "content": content
        })
        return note

    def get_all(self, db: Session, skip: int = 0, limit: int = 50):
        return note_repository.get_all(db, skip=skip, limit=limit)

    def delete(self, db: Session, note_id: int):
        return note_repository.delete(db, note_id)

    def process_action(self, db: Session, note_id: int, action: str):
        from app.services.flashcard_service import flashcard_service
        from app.services.quiz_service import quiz_service
        from app.services.summary_service import summary_service
        
        note = note_repository.get(db, note_id)
        if not note: return (False, None)
        
        if action == 'rapikan':
            from langchain_core.prompts import PromptTemplate
            prompt = PromptTemplate.from_template("Rapikan format dan bahasa dari catatan berikut tanpa mengubah makna aslinya:\n\n{context}")
            new_content = sanitize_output(ai_service.generate("reasoning", prompt, {"context": note.content}, use_cache=True))
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
            explanation = sanitize_output(ai_service.generate("reasoning", prompt, {"context": note.content}, use_cache=True))
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

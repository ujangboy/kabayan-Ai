from pptx import Presentation

def parse_pptx(file_path: str) -> str:
    text = ""
    try:
        prs = Presentation(file_path)
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text += shape.text + "\n"
    except Exception as e:
        print(f"Error parsing PPTX: {e}")
    return text

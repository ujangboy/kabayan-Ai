import openpyxl

def extract_text(file_path: str) -> str:
    """
    Extracts text from an XLSX file.
    """
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        full_text = []
        for sheet in wb.worksheets:
            full_text.append(f"--- Sheet: {sheet.title} ---")
            for row in sheet.iter_rows(values_only=True):
                # Filter out None values and join row items
                row_data = [str(cell) for cell in row if cell is not None]
                if row_data:
                    full_text.append("\t".join(row_data))
        return "\n".join(full_text)
    except Exception as e:
        return f"Error membaca XLSX: {e}"

class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, detail: object = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.message)

import json
from typing import List, Optional
from pydantic import BaseModel, Field

class AuthConfig(BaseModel):
    enabled: bool = False
    google_client_id: str = ""
    allowed_emails: List[str] = Field(default_factory=list)

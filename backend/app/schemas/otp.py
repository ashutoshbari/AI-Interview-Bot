from pydantic import BaseModel, Field


class OTPSendResponse(BaseModel):
    message: str
    channels: list[str]


class OTPVerifyRequest(BaseModel):
    otp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class OTPVerifyResponse(BaseModel):
    verified: bool
    message: str


class WarningRequest(BaseModel):
    type: str = Field(..., description="tab_switch | copy_paste")


class WarningResponse(BaseModel):
    tab_switch_count: int
    copy_paste_count: int

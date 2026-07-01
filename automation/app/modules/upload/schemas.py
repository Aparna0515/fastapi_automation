from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CourseBase(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=255)


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class StudentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class StudentCreate(StudentBase):
    course_id: int


class StudentResponse(StudentBase):
    id: int
    course_id: int
    course_name: str = ""

    model_config = ConfigDict(from_attributes=True)


class UploadSummaryResponse(BaseModel):
    success: bool
    rows_inserted: int
    errors: list[str]

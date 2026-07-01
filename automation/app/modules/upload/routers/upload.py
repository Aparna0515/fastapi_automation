from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session
from celery.result import AsyncResult
from app.core.celery import celery_app
from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.services.dependencies import get_current_user
from app.modules.upload.models import Course, Student
from app.modules.upload.schemas import (
    CourseResponse,
    StudentResponse,
    UploadSummaryResponse,
)
from app.modules.upload.tasks import import_file_task, export_data_task

router = APIRouter()


@router.post("/", response_model=dict)
async def upload_file(
    model_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a CSV or JSON file to dynamically import data into a target model."""
    contents = await file.read()
    
    # Decode contents to string for JSON serialization through Celery message broker
    try:
        contents_str = contents.decode("utf-8")
    except UnicodeDecodeError:
        contents_str = contents.decode("latin-1")
        
    # Queue Celery background task
    task = import_file_task.delay(
        model_name,
        contents_str,
        file.filename,
        current_user.email,
        current_user.name,
    )
    
    return {
        "success": True,
        "task_id": task.id,
        "status": task.status,
    }


@router.post("/export", response_model=dict)
def export_file(
    model_name: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """Trigger background Celery task to export DB records to CSV."""
    task = export_data_task.delay(model_name, current_user.email, current_user.name)
    return {
        "success": True,
        "task_id": task.id,
        "status": task.status,
    }


@router.get("/tasks/{task_id}", response_model=dict)
def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll background Celery task status to retrieve import results once completed."""
    task_result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "status": task_result.status,
        "result": None,
    }
    
    if task_result.ready():
        if task_result.successful():
            response["result"] = task_result.result
        else:
            response["result"] = {
                "success": False,
                "rows_inserted": 0,
                "errors": [str(task_result.info)],
            }
            
    return response


@router.get("/models")
def get_upload_models(current_user: User = Depends(get_current_user)):
    """Get metadata about upload models, expected headers, and guidelines."""
    return [
        {
            "model": "Course",
            "description": "Import new courses into the database.",
            "fields": [
                {
                    "name": "course_name",
                    "type": "string",
                    "required": True,
                    "description": "Unique name of the course.",
                }
            ],
            "template_csv": "course_name\nComputer Science\nData Science",
            "template_json": '[{"course_name": "Computer Science"}, {"course_name": "Data Science"}]',
        },
        {
            "model": "Student",
            "description": "Import student profiles. Associated courses will be resolved or dynamically created.",
            "fields": [
                {
                    "name": "name",
                    "type": "string",
                    "required": True,
                    "description": "Full name of the student.",
                },
                {
                    "name": "email",
                    "type": "string",
                    "required": True,
                    "description": "Unique email address.",
                },
                {
                    "name": "course",
                    "type": "string",
                    "required": False,
                    "description": "Course name (will be created automatically if not found).",
                },
                {
                    "name": "course_id",
                    "type": "integer",
                    "required": False,
                    "description": "Alternative option to map directly to an existing Course ID.",
                },
            ],
            "template_csv": "name,email,course\nAlice,alice@example.com,Computer Science\nBob,bob@example.com,Data Science",
            "template_json": '[{"name": "Alice", "email": "alice@example.com", "course": "Computer Science"}, {"name": "Bob", "email": "bob@example.com", "course": "Data Science"}]',
        },
    ]


@router.get("/courses", response_model=list[CourseResponse])
def get_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve lists of existing Course records."""
    return db.query(Course).all()


@router.get("/students", response_model=list[StudentResponse])
def get_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve lists of existing Student records, including resolved course names."""
    students = db.query(Student).all()
    results = []
    for s in students:
        results.append(
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "course_id": s.course_id,
                "course_name": s.course.course_name if s.course else "Unknown",
            }
        )
    return results

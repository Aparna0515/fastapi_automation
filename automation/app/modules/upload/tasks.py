import csv
import io
from app.core.celery import celery_app
from app.core.database import SessionLocal
from app.modules.upload.models import Course, Student
from app.modules.upload.services.parser import parse_and_import_file
from app.utils.email import send_notification_email


@celery_app.task(name="app.modules.upload.tasks.send_email_task")
def send_email_task(to_email: str, subject: str, body_text: str) -> bool:
    """Dedicated background Celery task to send/log outbound emails."""
    return send_notification_email(to_email, subject, body_text)


@celery_app.task(name="app.modules.upload.tasks.import_file_task")
def import_file_task(
    model_name: str,
    file_contents_str: str,
    filename: str,
    user_email: str,
    user_name: str,
) -> dict:
    """Background task to parse and import Course/Student upload files."""
    file_contents = file_contents_str.encode("utf-8")
    
    db = SessionLocal()
    try:
        result = parse_and_import_file(db, model_name, file_contents, filename)
        
        # Build email notification body
        errors_summary = ""
        if result["errors"]:
            errors_summary = "\nErrors / Warnings:\n" + "\n".join(
                [f"- {err}" for err in result["errors"][:10]]
            )
            if len(result["errors"]) > 10:
                errors_summary += f"\n- ...and {len(result['errors']) - 10} more errors."
        else:
            errors_summary = "\nNo errors detected during importing. Clean run!"

        email_body = (
            f"Hello {user_name},\n\n"
            f"Your dynamic data import task has finished.\n\n"
            f"Summary details:\n"
            f"- Target Model: {model_name}\n"
            f"- File Name: {filename}\n"
            f"- Rows Successfully Imported: {result['rows_inserted']}\n"
            f"- Success Status: {result['success']}\n"
            f"{errors_summary}\n\n"
            f"Regards,\n"
            f"Secure Portal System"
        )
        
        # Queue the email task asynchronously via Celery (Disabled for security)
        # send_email_task.delay(
        #     user_email,
        #     f"Secure Portal - Data Import Complete ({model_name})",
        #     email_body,
        # )
        print(f"\n[LOG ONLY] Email notification generated for {user_email}:\n{email_body}\n", flush=True)
        
        return result
    except Exception as e:
        err_result = {
            "success": False,
            "rows_inserted": 0,
            "errors": [f"Background task failed: {str(e)}"],
        }
        # send_email_task.delay(
        #     user_email,
        #     "Secure Portal - Data Import Failed",
        #     f"Hello {user_name},\n\nYour data import task failed to execute: {str(e)}",
        # )
        print(f"\n[LOG ONLY] Failure Email generated for {user_email}: Task failed: {str(e)}\n", flush=True)
        return err_result
    finally:
        db.close()


@celery_app.task(name="app.modules.upload.tasks.export_data_task")
def export_data_task(model_name: str, user_email: str, user_name: str) -> dict:
    """Background task to query Course or Student records and generate a CSV string."""
    db = SessionLocal()
    try:
        target = model_name.strip().lower()
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        rows_count = 0
        
        if target == "course":
            courses = db.query(Course).order_by(Course.id).all()
            writer.writerow(["id", "course_name"])
            for c in courses:
                writer.writerow([c.id, c.course_name])
            rows_count = len(courses)
                
        elif target == "student":
            students = db.query(Student).order_by(Student.id).all()
            writer.writerow(["id", "name", "email", "course"])
            for s in students:
                c_name = s.course.course_name if s.course else ""
                writer.writerow([s.id, s.name, s.email, c_name])
            rows_count = len(students)
        else:
            return {
                "success": False,
                "error": f"Unknown model name '{model_name}' for export.",
            }
            
        csv_data = output.getvalue()
        
        # Build email notification body
        email_body = (
            f"Hello {user_name},\n\n"
            f"Your data export task has finished successfully.\n\n"
            f"Summary details:\n"
            f"- Target Model: {model_name}\n"
            f"- Total Rows Compiled & Exported: {rows_count}\n\n"
            f"The compiled CSV is ready and has been downloaded to your local browser session.\n\n"
            f"Regards,\n"
            f"Secure Portal System"
        )
        
        # Queue the email task asynchronously via Celery (Disabled for security)
        # send_email_task.delay(
        #     user_email,
        #     f"Secure Portal - Data Export Complete ({model_name})",
        #     email_body,
        # )
        print(f"\n[LOG ONLY] Email notification generated for {user_email}:\n{email_body}\n", flush=True)
        
        return {
            "success": True,
            "csv_data": csv_data,
            "filename": f"{model_name.lower()}_export.csv",
        }
    except Exception as e:
        err_res = {
            "success": False,
            "error": f"Export task failed: {str(e)}",
        }
        # send_email_task.delay(
        #     user_email,
        #     "Secure Portal - Data Export Failed",
        #     f"Hello {user_name},\n\nYour data export task failed to execute: {str(e)}",
        # )
        print(f"\n[LOG ONLY] Failure Email generated for {user_email}: Task failed: {str(e)}\n", flush=True)
        return err_res
    finally:
        db.close()

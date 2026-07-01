import csv
import json
import io
from sqlalchemy.orm import Session
from app.modules.upload.models import Course, Student
from app.modules.upload.schemas import CourseCreate, StudentCreate
from pydantic import ValidationError


def normalize_header(header: str) -> str:
    """Normalize headers: trim, lowercase, replace spaces/hyphens with underscores."""
    return header.strip().lower().replace(" ", "_").replace("-", "_")


def parse_and_import_file(
    db: Session, model_name: str, file_contents: bytes, filename: str
) -> dict:
    """Parse upload contents and import records dynamically into models."""
    errors = []
    rows_inserted = 0

    # 1. Decode contents
    try:
        text_data = file_contents.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text_data = file_contents.decode("latin-1")
        except Exception as e:
            return {
                "success": False,
                "rows_inserted": 0,
                "errors": [f"Invalid file encoding: {str(e)}"],
            }

    # 2. Parse file into list of dicts based on file extension
    rows = []
    is_csv = filename.lower().endswith(".csv")
    is_json = filename.lower().endswith(".json")

    if is_csv:
        try:
            csv_reader = csv.reader(io.StringIO(text_data))
            headers = next(csv_reader, None)
            if not headers:
                return {
                    "success": False,
                    "rows_inserted": 0,
                    "errors": ["CSV file is empty"],
                }

            normalized_headers = [normalize_header(h) for h in headers]
            for idx, row in enumerate(csv_reader, start=2):
                if not row:
                    continue
                # Pad/trim row elements if columns don't match header length
                if len(row) < len(normalized_headers):
                    row = row + [""] * (len(normalized_headers) - len(row))
                elif len(row) > len(normalized_headers):
                    row = row[: len(normalized_headers)]

                row_dict = dict(zip(normalized_headers, row))
                rows.append((idx, row_dict))
        except Exception as e:
            return {
                "success": False,
                "rows_inserted": 0,
                "errors": [f"Failed to parse CSV: {str(e)}"],
            }
    elif is_json:
        try:
            data = json.loads(text_data)
            if isinstance(data, dict):
                # If single object, put in list
                data = [data]

            if not isinstance(data, list):
                return {
                    "success": False,
                    "rows_inserted": 0,
                    "errors": [
                        "JSON content must be an array of objects or a single object"
                    ],
                }

            for idx, item in enumerate(data, start=1):
                if not isinstance(item, dict):
                    errors.append(
                        f"Row {idx}: Invalid JSON entry (must be a key-value object)"
                    )
                    continue
                # Normalize keys
                row_dict = {normalize_header(k): v for k, v in item.items()}
                rows.append((idx, row_dict))
        except Exception as e:
            return {
                "success": False,
                "rows_inserted": 0,
                "errors": [f"Failed to parse JSON: {str(e)}"],
            }
    else:
        return {
            "success": False,
            "rows_inserted": 0,
            "errors": ["Unsupported file format. Please upload a .csv or .json file."],
        }

    # 3. Process and import rows based on target model name
    target = model_name.strip().lower()

    if target == "course":
        for idx, row_data in rows:
            # Map alternative headers to 'course_name'
            c_name = (
                row_data.get("course_name")
                or row_data.get("name")
                or row_data.get("course")
            )
            if not c_name:
                errors.append(
                    f"Row {idx}: Missing field 'course_name' or 'name'."
                )
                continue

            c_name_str = str(c_name).strip()

            # Validate schema
            try:
                CourseCreate(course_name=c_name_str)
            except ValidationError as ve:
                err_msg = ", ".join([e["msg"] for e in ve.errors()])
                errors.append(f"Row {idx}: Validation failed - {err_msg}")
                continue

            # DB Operations
            try:
                # Check for duplicates
                existing = (
                    db.query(Course)
                    .filter(Course.course_name == c_name_str)
                    .first()
                )
                if existing:
                    errors.append(
                        f"Row {idx}: Course '{c_name_str}' already exists in database (skipped)."
                    )
                    continue

                # Add new course
                new_course = Course(course_name=c_name_str)
                db.add(new_course)
                db.flush()  # flush to get ID and ensure no DB level uniqueness checks fail
                rows_inserted += 1
            except Exception as e:
                db.rollback()
                errors.append(f"Row {idx}: Database save error - {str(e)}")

    elif target == "student":
        for idx, row_data in rows:
            # Map fields
            s_name = row_data.get("name") or row_data.get("student_name")
            s_email = row_data.get("email") or row_data.get("email_address")
            s_course = row_data.get("course") or row_data.get("course_name")
            s_course_id = row_data.get("course_id")

            # Basic missing checks
            if not s_name:
                errors.append(f"Row {idx}: Missing student 'name'.")
                continue
            if not s_email:
                errors.append(f"Row {idx}: Missing student 'email'.")
                continue
            if not s_course and not s_course_id:
                errors.append(
                    f"Row {idx}: Missing associated course (provide 'course' name or 'course_id')."
                )
                continue

            s_name_str = str(s_name).strip()
            s_email_str = str(s_email).strip().lower()

            # Resolve Course and find/create Course ID
            resolved_course_id = None
            if s_course_id:
                try:
                    resolved_course_id = int(s_course_id)
                    # Check existence
                    c_exists = (
                        db.query(Course.id)
                        .filter(Course.id == resolved_course_id)
                        .first()
                    )
                    if not c_exists:
                        errors.append(
                            f"Row {idx}: Course ID '{resolved_course_id}' does not exist."
                        )
                        continue
                except ValueError:
                    errors.append(
                        f"Row {idx}: Invalid 'course_id' format (must be integer)."
                    )
                    continue
            else:
                s_course_str = str(s_course).strip()
                if not s_course_str:
                    errors.append(f"Row {idx}: Associated course name is empty.")
                    continue

                # Query course or create it dynamically!
                try:
                    course_obj = (
                        db.query(Course)
                        .filter(Course.course_name == s_course_str)
                        .first()
                    )
                    if not course_obj:
                        # Course doesn't exist, create it dynamically!
                        course_obj = Course(course_name=s_course_str)
                        db.add(course_obj)
                        db.flush()  # get ID
                    resolved_course_id = course_obj.id
                except Exception as e:
                    db.rollback()
                    errors.append(
                        f"Row {idx}: Error resolving/creating course '{s_course_str}' - {str(e)}"
                    )
                    continue

            # Validate Student structure
            try:
                StudentCreate(
                    name=s_name_str,
                    email=s_email_str,
                    course_id=resolved_course_id,
                )
            except ValidationError as ve:
                err_msg = ", ".join([e["msg"] for e in ve.errors()])
                errors.append(f"Row {idx}: Validation failed - {err_msg}")
                continue

            # DB operations
            try:
                # Check duplicate email
                existing_student = (
                    db.query(Student).filter(Student.email == s_email_str).first()
                )
                if existing_student:
                    errors.append(
                        f"Row {idx}: Student email '{s_email_str}' already exists in database (skipped)."
                    )
                    continue

                new_student = Student(
                    name=s_name_str,
                    email=s_email_str,
                    course_id=resolved_course_id,
                )
                db.add(new_student)
                db.flush()
                rows_inserted += 1
            except Exception as e:
                db.rollback()
                errors.append(f"Row {idx}: Database save error - {str(e)}")
    else:
        return {
            "success": False,
            "rows_inserted": 0,
            "errors": [
                f"Unknown model '{model_name}'. Allowed upload models: 'Course', 'Student'."
            ],
        }

    # Commit all changes if we successfully inserted at least one row
    if rows_inserted > 0:
        db.commit()

    return {
        "success": True if rows_inserted > 0 else False,
        "rows_inserted": rows_inserted,
        "errors": errors,
    }

from flask import Flask, jsonify, request
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
from sqlalchemy import func
import logging
import json

# pydantic is used for request validation on certain fields
from pydantic import BaseModel, ValidationError, validator
from typing import Optional


# validator model for deadlines
class DeadlineValidator(BaseModel):
    deadline: Optional[datetime] = None

    @validator('deadline')
    def must_be_future(cls, v):
        if v is not None and v < datetime.utcnow():
            raise ValueError("Deadline must be a future date.")
        return v


# logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# helper for recording history entries is defined in models; import later

from models import db, User, Task, Contact, WaitingDetail, TaskHistory, Category, log_history
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt

load_dotenv()

app = Flask(__name__)
CORS(app)

# CONFIGURATION
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "postgresql://postgres:fatebay11@localhost:5432/postgres")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "your_secret_key_here")

# INITIALIZE EXTENSIONS
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)


@app.route("/")
def home():
    return jsonify({"message": "Backend is running"})


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"message": "Missing required fields"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already taken"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400

    try:
        new_user = User(
            username=username,
            email=email,
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"message": "Error registering user", "error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"message": "Missing required fields"}), 400

    user = User.query.filter_by(email=data.get('email')).first()
    if user and user.check_password(data['password']):
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={"is_admin": bool(user.is_admin)},
            # force a longer expiry for development purposes
            expires_delta=timedelta(hours=24)
        )
        return jsonify({"access_token": access_token}), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401


@app.route("/api/protected", methods=["GET"])
@jwt_required()
def protected():
    current_user_id = get_jwt_identity()
    return jsonify({"message": "Access granted", "logged_in_as": current_user_id}), 200

# POST /api/tasks IMPLLEMENTATION


# simulated SMS notification stub; replace with a live Twilio API call in production
# this requires no changes to the surrounding architecture.
# use our module-level logger instead of the root logger

def simulate_sms(phone_number: str, message: str, contact_name: Optional[str] = None) -> Optional[str]:
    """Log an SMS notification. If phone_number is blank, log a warning and
    return a special marker so the caller can propagate a warning message.
    """
    if not phone_number:
        # contact_name may be None or empty; just use value directly
        logger.warning(f"Cannot send SMS, phone number missing for contact {contact_name}")
        return "missing_phone"
    logger.info(f"SMS notification triggered for contact {phone_number}  MESSAGE: {message}")
    return None



@app.route("/api/tasks", methods=["POST"])
@jwt_required()
def create_task():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}

    # validate required fields
    if not data:
        return jsonify({"message": "Missing request body"}), 400

    title = (data.get('title') or '').strip()
    urgency = (data.get('urgency') or '').strip()
    description = (data.get('description') or '').strip()

    # category may be provided either by name or id; id takes precedence
    category = None
    category_id = data.get('category_id')
    if category_id is not None:
        try:
            category_id = int(category_id)
        except (ValueError, TypeError):
            return jsonify({"message": "Invalid category_id"}), 422
        cat = Category.query.filter_by(id=category_id, user_id=current_user_id).first()
        if not cat:
            return jsonify({"message": "Category not found"}), 404
        category = cat.name
    else:
        category = (data.get('category') or '').strip()

    # priority may be supplied or default to Low
    priority = (data.get('priority') or 'Low').strip()
    # use a neutral grey by default; previous '#gray' was not a valid hex color
    color_code = (data.get('color_code') or '#808080').strip()

    if not title:
        return jsonify({"message": "Title is required"}), 422
    if not category:
        return jsonify({"message": "Category is required"}), 422
    if not urgency:
        return jsonify({"message": "Urgency is required"}), 422
    if not description:
        return jsonify({"message": "Description is required"}), 422
    if priority not in ('High', 'Medium', 'Low'):
        return jsonify({"message": "Priority must be High, Medium or Low"}), 422

    # pydantic deadline validation
    try:
        validated_deadline = None
        if data.get('deadline'):
            # parse to datetime first
            dt = datetime.fromisoformat(data.get('deadline'))
            validated_deadline = DeadlineValidator(deadline=dt).deadline
    except ValidationError as ve:
        return jsonify({"message": "Validation error", "errors": ve.errors()}), 422

    try:
        # assign contact_id if provided
        new_task = Task(
            title=title,
            category=category,
            urgency=urgency,
            description=description,
            status=data.get('status', 'active'),
            user_id=current_user_id,
            deadline=validated_deadline,
            contact_id=data.get('contact_id'),
            priority=priority,
            color_code=color_code,
            category_id=category_id if category_id is not None else None,
        )


        # if creating already waiting, we must record contact details
        if new_task.status == 'waiting':
            new_task.waiting_started_at = datetime.utcnow()

        db.session.add(new_task)
        db.session.flush()

        if new_task.status == 'waiting':
            contact_name = (data.get('contact_name') or '').strip()
            department = (data.get('department') or '').strip()
            waiting_reason = (data.get('waiting_reason') or '').strip() or 'No reason provided'
            contact_phone = (data.get('contact_phone') or '').strip()
            if not contact_name or not department:
                return jsonify({"message": "Contact name and department are required for waiting"}), 422
            waiting_info = WaitingDetail(
                task_id=new_task.id,
                contact_name=contact_name,
                department=department,
                reason=waiting_reason,
                wait_start_per_date=new_task.waiting_started_at
            )
            db.session.add(waiting_info)
            # keep phone for notification use later
            data['contact_phone'] = contact_phone

        # record creation history in shared helper
        log_history(new_task.id, current_user_id, 'created', '')
        db.session.commit()
        # Return full task so frontend can add it to state without refetching
        task_data = {
            "id": new_task.id,
            "title": new_task.title,
            "category": new_task.category,
            "urgency": new_task.urgency,
            "description": new_task.description,
            "status": new_task.status,
            "priority": new_task.priority,
            "color_code": new_task.color_code,
            "deadline": new_task.deadline.isoformat() if new_task.deadline else None,
            "contact_id": new_task.contact_id,
            "waiting_info": None,
            "total_wait_duration": new_task.total_wait_duration,
            "waiting_started_at": new_task.waiting_started_at.isoformat() if new_task.waiting_started_at else None,
            "waiting_ended_at": new_task.waiting_ended_at.isoformat() if new_task.waiting_ended_at else None,
        }
        if new_task.waiting_info:
            task_data["waiting_info"] = {
                "reason": new_task.waiting_info.reason,
                "contact_name": new_task.waiting_info.contact_name,
                "department": new_task.waiting_info.department,
                "wait_start_per_date": new_task.waiting_info.wait_start_per_date.isoformat(),
                "contact_id": new_task.contact_id,
            }

        # send simulated SMS if phone number was provided in request; capture warnings
        warnings = []
        contact_phone = (data.get('contact_phone') or '').strip()
        contact_name = (data.get('contact_name') or '').strip()
        if data.get('status') == 'waiting':
            # contact_name already validated in waiting block
            pass
        if contact_phone or contact_name:
            result = simulate_sms(contact_phone, f"Your task {new_task.title} has been created and assigned to you.", contact_name=contact_name)
            if result == "missing_phone":
                warnings.append("Contact has no phone number, SMS notification skipped.")

        response_body = {"message": "Task created successfully", "task_id": new_task.id, "task": task_data}
        if warnings:
            response_body["warnings"] = warnings
        return jsonify(response_body), 201

    except Exception as e:
        return jsonify({"message": "Error creating task", "error": str(e)}), 500

# GET /api/tasks IMPLEMENTATION

@app.route("/api/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    current_user_id = get_jwt_identity()

    status_filter = request.args.get('status')
    search_query = request.args.get('search')
    priority_filter = request.args.get('priority')
    cat_id_filter = request.args.get('category_id')

    query = Task.query.filter_by(user_id=current_user_id)

    if status_filter:
        query = query.filter(Task.status==status_filter)
    
    if search_query:
        query = query.filter(Task.title.ilike(f"%{search_query}%"))
    
    if priority_filter:
        query = query.filter(Task.priority==priority_filter)

    if cat_id_filter:
        try:
            cid = int(cat_id_filter)
            query = query.filter(Task.category_id == cid)
        except ValueError:
            pass

    task_list = []
    for task in query.all():
        task_data = {
            "id": task.id,
            "title": task.title,
            "category": task.category,
            "category_id": task.category_id,
            "urgency": task.urgency,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "color_code": task.color_code,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "contact_id": task.contact_id,
            "waiting_info": None,
            "total_wait_duration": task.total_wait_duration,
            "waiting_started_at": task.waiting_started_at.isoformat() if task.waiting_started_at else None,
            "waiting_ended_at": task.waiting_ended_at.isoformat() if task.waiting_ended_at else None
        }
        
        if task.waiting_info:
            task_data["waiting_info"] = {
                "reason": task.waiting_info.reason,
                "contact_name": task.waiting_info.contact_name,
                "department": task.waiting_info.department,
                "wait_start_per_date": task.waiting_info.wait_start_per_date.isoformat(),
                "contact_id": task.contact_id,
            }

        task_list.append(task_data)
    
    return jsonify({"tasks": task_list}), 200

# PATCH /api/tasks/{id} IMPLEMENTATION
@app.route("/api/tasks/<int:id>", methods=["PATCH"])
@jwt_required()
def update_task_status(id):
    current_user_id = get_jwt_identity()
    data = request.get_json()

    task = Task.query.filter_by(id=id, user_id=current_user_id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404
    
    new_status = data.get('status')
    if not new_status:
        return jsonify({"message": "Status is required"}), 400
    # remember old status for history details
    old_status = task.status
    
    # deadline validation on update (if the client sent one)
    try:
        if data.get('deadline') is not None:
            dt = datetime.fromisoformat(data.get('deadline'))
            new_deadline = DeadlineValidator(deadline=dt).deadline
        else:
            new_deadline = None
    except ValidationError as ve:
        return jsonify({"message": "Validation error", "errors": ve.errors()}), 422
    
    try:
        # category update by name or id
        if data.get('category_id') is not None:
            try:
                cid = int(data.get('category_id'))
            except (ValueError, TypeError):
                return jsonify({"message": "Invalid category_id"}), 422
            cat = Category.query.filter_by(id=cid, user_id=current_user_id).first()
            if not cat:
                return jsonify({"message": "Category not found"}), 404
            task.category_id = cat.id
            task.category = cat.name
        elif 'category' in data:
            # simple name change; do not touch category_id
            task.category = (data.get('category') or '').strip() or task.category

        # update task.contact_id if provided
        if data.get('contact_id') is not None:
            task.contact_id = data.get('contact_id')
            # also update waiting_info name when present
            if task.waiting_info:
                contact = Contact.query.get(data.get('contact_id'))
                if contact:
                    task.waiting_info.contact_name = contact.name
        # priority / color updates
        if data.get('priority') is not None:
            if data.get('priority') not in ('High', 'Medium', 'Low'):
                return jsonify({"message": "Priority must be High, Medium or Low"}), 422
            task.priority = data.get('priority')
        if data.get('color_code') is not None:
            # sanitize or default if missing
            task.color_code = data.get('color_code') or '#808080'

        # perform status-change operations in a DB transaction
        if new_status == 'waiting' and task.status != 'waiting':
            # need contact info and a reason
            contact_name = (data.get('contact_name') or '').strip()
            department = (data.get('department') or '').strip()
            waiting_reason = (data.get('waiting_reason') or '').strip() or 'No reason provided'
            if not contact_name or not department:
                return jsonify({"message": "contact_name and department are required when moving to waiting"}), 422

            task.status = 'waiting'
            task.waiting_started_at = datetime.utcnow()
            task.waiting_ended_at = None
            # set contact_id if provided
            if data.get('contact_id') is not None:
                task.contact_id = data.get('contact_id')

            new_waiting = WaitingDetail(
                task_id=task.id,
                contact_name=contact_name,
                department=department,
                reason=waiting_reason,
                wait_start_per_date=task.waiting_started_at,
            )
            db.session.add(new_waiting)

        elif task.status == 'waiting' and new_status != 'waiting':
            # ending a waiting period
            if task.waiting_info:
                now = datetime.utcnow()
                duration_td = now - task.waiting_info.wait_start_per_date
                if new_status == 'completed':
                    task.total_wait_duration = int(duration_td.total_seconds())
                task.waiting_ended_at = now
            task.status = new_status
        else:
            # simple status change with no waiting details
            task.status = new_status

        # apply deadline update if present (must be done before commit)
        if data.get('deadline') is not None:
            task.deadline = new_deadline

        # record history for status change (include old value)
        log_history(task.id, current_user_id, 'status_changed', f"{old_status} -> {new_status}")

        db.session.commit()

        # build updated task object for return
        task_data = {
            "id": task.id,
            "title": task.title,
            "category": task.category,
            "urgency": task.urgency,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "color_code": task.color_code,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "contact_id": task.contact_id,
            "waiting_info": None,
            "total_wait_duration": task.total_wait_duration,
            "waiting_started_at": task.waiting_started_at.isoformat() if task.waiting_started_at else None,
            "waiting_ended_at": task.waiting_ended_at.isoformat() if task.waiting_ended_at else None,
        }
        if task.waiting_info:
            task_data["waiting_info"] = {
                "reason": task.waiting_info.reason,
                "contact_name": task.waiting_info.contact_name,
                "department": task.waiting_info.department,
                "wait_start_per_date": task.waiting_info.wait_start_per_date.isoformat(),
                "contact_id": task.contact_id,
            }

        return jsonify({
            "message": f"Task status updated to {new_status}",
            "task": task_data
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating task status", "error": str(e)}), 500
    

# GET /api/tasks/{id} IMPLEMENTATION
@app.route("/api/tasks/<int:id>", methods=["GET"])
@jwt_required()
def get_task_details(id):
    current_user_id = get_jwt_identity()

    task = Task.query.filter_by(id=id, user_id=current_user_id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404
    
    task_data = {
        "id": task.id,
        "title": task.title,
        "category": task.category,
        "category_id": task.category_id,
        "urgency": task.urgency,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "color_code": task.color_code,
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "contact_id": task.contact_id,
        "waiting_info": {
            "reason": task.waiting_info.reason if task.waiting_info else None,
            "contact_name": task.waiting_info.contact_name if task.waiting_info else None,
            "department": task.waiting_info.department if task.waiting_info else None,
            "wait_start_per_date": task.waiting_info.wait_start_per_date.isoformat() if task.waiting_info else None,
            "contact_id": task.contact_id,
        } if task.status == 'waiting' else None,
        "total_wait_duration": task.total_wait_duration,
        "waiting_started_at": task.waiting_started_at.isoformat() if task.waiting_started_at else None,
        "waiting_ended_at": task.waiting_ended_at.isoformat() if task.waiting_ended_at else None
    }

    return jsonify({"task": task_data}), 200
# DELETE /api/tasks/{id} IMPLEMENTATION
@app.route("/api/tasks/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_task(id):
    current_user_id = get_jwt_identity()

    # note: we intentionally do *not* filter by category_id here – a task
    # should be deletable even if it has no category assigned.  some older
    # records (or API-created ones) might have NULL in that column.
    task = Task.query.get(id)
    if not task or task.user_id != current_user_id:
        return jsonify({"message": "Task not found"}), 404
    
    try:
        if task.waiting_info:
            db.session.delete(task.waiting_info)
        
        db.session.delete(task)
        db.session.commit()

        return jsonify({"message": "Task deleted successfully"}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error deleting task", "error": str(e)}), 500

# POST /api/tasks/{id}/forward IMPLEMENTATION
@app.route("/api/tasks/<int:id>/forward", methods=["POST"])
@jwt_required()
def forward_task(id):
    current_user_id = get_jwt_identity()
    data = request.get_json()

    task = Task.query.filter_by(id=id, user_id=current_user_id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404
    
    if task.status != 'waiting' or not task.waiting_info:
        return jsonify({"message": "Can only forward a task that is currently waiting"}), 400
    
    new_contact_id = data.get('contact_id')
    new_reason = data.get('reason')

    if not new_contact_id and not data.get('contact_name'):
        return jsonify({"message": "New contact ID or name is required"}), 400

    try:
        # resolve name from ID if necessary
        if new_contact_id:
            contact = Contact.query.get(new_contact_id)
            if not contact:
                return jsonify({"message": "Contact not found"}), 404
            task.waiting_info.contact_name = contact.name
            task.contact_id = new_contact_id
        else:
            task.waiting_info.contact_name = data.get('contact_name')
        
        task.waiting_info.wait_start_per_date = datetime.utcnow()

        # log forwarding action before committing changes
        contact_name = task.waiting_info.contact_name if task.waiting_info else None
        detail_msg = f"to {contact_name or 'unknown'}"
        if new_reason:
            detail_msg += f": {new_reason}"
        log_history(task.id, current_user_id, 'forwarded', detail_msg)

        db.session.commit()
        # record history and commit changes already handled above
        return jsonify({"message": "Task forwarded successfully", "task_id": task.id}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error forwarding task", "error": str(e)}), 500


# allow adding arbitrary notes to a task; simply create a history entry
@app.route("/api/tasks/<int:id>/notes", methods=["POST"])
@jwt_required()
def add_task_note(id):
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    note = (data.get("note") or "").strip()
    if not note:
        return jsonify({"message": "Note content is required"}), 400
    task = Task.query.filter_by(id=id, user_id=current_user_id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404
    try:
        log_history(task.id, current_user_id, 'note_added', note)
        db.session.commit()
        return jsonify({"message": "Note added"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error adding note", "error": str(e)}), 500


# CONTACTS CRUD
@app.route("/api/contacts", methods=["GET"])
@jwt_required()
def list_contacts():
    current_user_id = get_jwt_identity()
    contacts = Contact.query.filter_by(user_id=current_user_id).all()
    output = []
    for c in contacts:
        output.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "email": c.email,
            "organization": c.organization,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return jsonify(output), 200

@app.route("/api/contacts", methods=["POST"])
@jwt_required()
def create_contact():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip()
    org = (data.get("organization") or "").strip()
    if not name:
        return jsonify({"message": "Name is required"}), 422
    newc = Contact(user_id=current_user_id, name=name, phone=phone or None, email=email or None, organization=org or None)
    db.session.add(newc)
    db.session.commit()
    return jsonify({"contact": {"id": newc.id, "name": newc.name, "phone": newc.phone, "email": newc.email, "organization": newc.organization, "created_at": newc.created_at.isoformat() if newc.created_at else None}}), 201

@app.route("/api/contacts/<int:id>", methods=["PATCH"])
@jwt_required()
def update_contact(id):
    current_user_id = get_jwt_identity()
    contact = Contact.query.get(id)
    if not contact or contact.user_id != current_user_id:
        return jsonify({"message": "Contact not found"}), 404
    data = request.get_json() or {}
    if "name" in data:
        contact.name = (data.get("name") or "").strip()
    if "phone" in data:
        contact.phone = (data.get("phone") or "").strip() or None
    if "email" in data:
        contact.email = (data.get("email") or "").strip() or None
    if "organization" in data:
        contact.organization = (data.get("organization") or "").strip() or None
    db.session.commit()
    return jsonify({"contact": {"id": contact.id, "name": contact.name, "phone": contact.phone, "email": contact.email, "organization": contact.organization}}), 200

@app.route("/api/contacts/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_contact(id):
    current_user_id = get_jwt_identity()
    contact = Contact.query.get(id)
    if not contact or contact.user_id != current_user_id:
        return jsonify({"message": "Contact not found"}), 404
    db.session.delete(contact)
    db.session.commit()
    return jsonify({"message": "Contact deleted"}), 200


# ===== category endpoints =====
@app.route("/api/categories", methods=["GET"])
@jwt_required()
def list_categories():
    current_user_id = get_jwt_identity()
    # return categories sorted alphabetically so UI lists are predictable
    cats = (
        Category.query.filter_by(user_id=current_user_id)
        .order_by(Category.name.asc())
        .all()
    )
    output = []
    for c in cats:
        output.append({"id": c.id, "name": c.name})
    return jsonify({"categories": output}), 200


@app.route("/api/categories", methods=["POST"])
@jwt_required()
def create_category():
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "Invalid category name"}), 422
    # enforce per-user uniqueness (case-sensitive for simplicity)
    if Category.query.filter_by(user_id=current_user_id, name=name).first():
        return jsonify({"message": "Category already exists"}), 409
    newcat = Category(name=name, user_id=current_user_id)
    db.session.add(newcat)
    db.session.commit()
    return jsonify({"category": {"id": newcat.id, "name": newcat.name}}), 201


@app.route("/api/categories/<int:id>", methods=["PATCH"])
@jwt_required()
def update_category(id):
    current_user_id = get_jwt_identity()
    cat = Category.query.get(id)
    if not cat or cat.user_id != current_user_id:
        return jsonify({"message": "Category not found"}), 404
    data = request.get_json() or {}
    newname = (data.get("name") or "").strip()
    if not newname:
        return jsonify({"message": "Invalid category name"}), 422
    if newname != cat.name:
        # check for another category with the same name
        if Category.query.filter_by(user_id=current_user_id, name=newname).first():
            return jsonify({"message": "Another category with that name already exists"}), 409
    oldname = cat.name
    cat.name = newname
    # update any tasks that referred to this category either by id or by string
    # (including legacy tasks created before category_id support)
    Task.query.filter(Task.user_id == current_user_id).filter(
        (Task.category_id == cat.id) | (Task.category == oldname)
    ).update({"category": newname})
    db.session.commit()
    return jsonify({"category": {"id": cat.id, "name": cat.name}}), 200


@app.route("/api/categories/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_category(id):
    current_user_id = get_jwt_identity()
    cat = Category.query.get(id)
    if not cat or cat.user_id != current_user_id:
        return jsonify({"message": "Category not found"}), 404
    # clear category_id from tasks that reference this category and optionally
    # blank out the category string so users don't see stale labels.
    Task.query.filter(Task.user_id == current_user_id, Task.category_id == cat.id).update(
        {"category_id": None, "category": ""}
    )
    # also clear any tasks that only had the name (legacy)
    Task.query.filter(Task.user_id == current_user_id, Task.category == cat.name, Task.category_id == None).update(
        {"category": ""}
    )
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"message": "Category deleted"}), 200



# admin history endpoint
@app.route("/api/admin/history", methods=["GET"])
@jwt_required()
def admin_history():
    if not _check_admin():
        return jsonify({"message": "Admins only"}), 403
    entries = (
        TaskHistory.query
        .join(Task, TaskHistory.task_id == Task.id)
        .join(User, TaskHistory.actor_user_id == User.id)
        .order_by(TaskHistory.timestamp.desc())
        .all()
    )
    history = []
    for e in entries:
        history.append({
            "id": e.id,
            "task_title": e.task.title if e.task else None,
            "action": e.action,
            "actor": e.actor.username if e.actor else None,
            "details": e.details,
            "timestamp": e.timestamp.isoformat(),
        })
    return jsonify({"history": history}), 200


# GET /api/analytics/average-wait IMPLEMENTATION
@app.route("/api/analytics/average-wait", methods=["GET"])
@jwt_required()
def get_average_wait():
    current_user_id = get_jwt_identity()
    try:
        # only include fully finished waiting periods on completed tasks
        results = db.session.query(
            WaitingDetail.contact_name.label('contact_name'),
            func.count(Task.id).label('total_tasks'),
            (func.avg(
                func.extract('epoch', Task.waiting_ended_at - Task.waiting_started_at)
            ) / 3600).label('average_wait_hours')
        ).join(WaitingDetail, WaitingDetail.task_id == Task.id)
        results = results.filter(
            Task.user_id == current_user_id,
            Task.status == 'completed',
            Task.waiting_started_at != None,
            Task.waiting_ended_at != None,
        ).group_by(WaitingDetail.contact_name)

        stats = results.all()
        output = []
        for contact_name, total_tasks, avg_hours in stats:
            output.append({
                "contact_name": contact_name,
                "average_wait_hours": float(avg_hours) if avg_hours is not None else None,
                "total_tasks": total_tasks,
            })
        return jsonify(output), 200
    except Exception as e:
        logging.exception("analytics average-wait failed")
        return jsonify({"detail": str(e)}), 500


# specialized analytics endpoints requested by frontend
@app.route("/api/analytics/average-wait-by-contact", methods=["GET"])
@jwt_required()
def analytics_by_contact():
    current_user_id = get_jwt_identity()
    try:
        results = db.session.query(
            WaitingDetail.contact_name.label('contact_name'),
            (func.avg(func.extract('epoch', Task.waiting_ended_at - Task.waiting_started_at)) / 3600).label('average_wait_hours'),
            func.count(Task.id).label('total_tasks')
        ).join(WaitingDetail, WaitingDetail.task_id == Task.id)
        results = results.filter(
            Task.user_id == current_user_id,
            Task.status == 'completed',
            Task.waiting_started_at != None,
            Task.waiting_ended_at != None,
        ).group_by(WaitingDetail.contact_name)
        stats = results.all()
        output = []
        for contact_name, avg_hours, total_tasks in stats:
            output.append({
                "contact_name": contact_name,
                "average_wait_hours": float(avg_hours) if avg_hours is not None else None,
                "total_tasks": total_tasks,
            })
        return jsonify(output), 200
    except Exception as e:
        logging.exception("analytics by-contact failed")
        return jsonify({"detail": str(e)}), 500

@app.route("/api/analytics/average-wait-by-user", methods=["GET"])
@jwt_required()
def analytics_by_user():
    try:
        results = db.session.query(
            User.username.label('username'),
            (func.avg(func.extract('epoch', Task.waiting_ended_at - Task.waiting_started_at)) / 3600).label('average_wait_hours'),
            func.count(Task.id).label('total_tasks')
        ).join(User, Task.user_id == User.id)
        results = results.filter(
            Task.status == 'completed',
            Task.waiting_started_at != None,
            Task.waiting_ended_at != None,
        ).group_by(User.username)
        stats = results.all()
        output = []
        for username, avg_hours, total_tasks in stats:
            output.append({
                "username": username,
                "average_wait_hours": float(avg_hours) if avg_hours is not None else None,
                "total_tasks": total_tasks,
            })
        return jsonify(output), 200
    except Exception as e:
        logging.exception("analytics by-user failed")
        return jsonify({"detail": str(e)}), 500

@app.route("/api/analytics/export-csv", methods=["GET"])
@jwt_required()
def analytics_export_csv():
    current_user_id = get_jwt_identity()
    try:
        tasks = Task.query.filter(Task.user_id == current_user_id).all()
        import csv
        from io import StringIO

        si = StringIO()
        writer = csv.writer(si)
        writer.writerow(["id","title","category","urgency","description","status","deadline","waiting_started_at","waiting_ended_at","total_wait_duration","contact_name","department","reason"])
        for t in tasks:
            wd = t.waiting_info
            writer.writerow([
                t.id,
                t.title,
                t.category,
                t.urgency,
                t.description,
                t.status,
                t.deadline.isoformat() if t.deadline else "",
                t.waiting_started_at.isoformat() if t.waiting_started_at else "",
                t.waiting_ended_at.isoformat() if t.waiting_ended_at else "",
                t.total_wait_duration or "",
                wd.contact_name if wd else "",
                wd.department if wd else "",
                wd.reason if wd else "",
            ])
        output = si.getvalue()
        response = app.response_class(output, mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename="tasks.csv"'
        return response
    except Exception as e:
        logging.exception("export-csv failed")
        return jsonify({"detail": str(e)}), 500

# ===== admin-only endpoints =====

def _check_admin():
    claims = get_jwt()
    if not claims.get('is_admin'):
        return False
    return True


# history endpoints
@app.route("/api/tasks/<int:id>/history", methods=["GET"])
@jwt_required()
def get_task_history(id):
    current_user_id = get_jwt_identity()
    # ensure the task belongs to the current user
    task = Task.query.filter_by(id=id, user_id=current_user_id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404
    entries = (
        TaskHistory.query.filter_by(task_id=id)
        .join(User, TaskHistory.actor_user_id == User.id)
        .order_by(TaskHistory.timestamp.desc())
        .all()
    )
    history = []
    for e in entries:
        history.append({
            "id": e.id,
            "action": e.action,
            "actor": e.actor.username if e.actor else None,
            "details": e.details,
            "timestamp": e.timestamp.isoformat(),
        })
    return jsonify({"history": history}), 200


@app.route("/api/admin/tasks", methods=["GET"])
@jwt_required()
def admin_list_tasks():
    if not _check_admin():
        return jsonify({"message": "Admins only"}), 403

    # return tasks with extra fields
    rows = db.session.query(
        Task,
        User.username.label('owner_name'),
        Contact.name.label('contact_name')
    ).join(User, Task.user_id == User.id)
    # prefer direct relationship via contact_id
    rows = rows.outerjoin(Contact, Contact.id == Task.contact_id)

    result = []
    for task, owner_name, contact_name in rows.all():
        result.append({
            "id": task.id,
            "title": task.title,
            "owner": owner_name,
            "contact_name": contact_name,
            "status": task.status,
            "hours_waiting": task.total_wait_duration / 3600 if task.total_wait_duration is not None else None,
        })
    return jsonify(result), 200

@app.route("/api/admin/tasks/<int:id>/sms", methods=["POST"])
@jwt_required()
def admin_send_sms(id):
    if not _check_admin():
        return jsonify({"message": "Admins only"}), 403
    data = request.get_json() or {}
    message = data.get('message', '')

    task = Task.query.get(id)
    if not task:
        return jsonify({"message": "Task not found"}), 404

    # determine phone number via associated contact id (fallback to name if necessary)
    phone = None
    contact_name = None
    contact = None
    if task.contact_id:
        contact = Contact.query.get(task.contact_id)
    elif task.waiting_info:
        contact_name = task.waiting_info.contact_name
        contact = Contact.query.filter_by(name=contact_name).first()
    if contact:
        phone = contact.phone
        contact_name = contact.name

    if not phone:
        logger.warning(f"Cannot send SMS, phone number missing for contact {contact_name}")
        # return a success response with warning flag so frontend can display toast
        return jsonify({"message": "Contact has no phone number, SMS notification skipped.", "warning": True}), 200

    simulate_sms(phone, message, contact_name=contact_name)
    return jsonify({"message": "SMS sent"}), 200


@app.route("/api/admin/tasks/<int:id>", methods=["PATCH"])
@jwt_required()
def admin_update_task(id):
    if not _check_admin():
        return jsonify({"message": "Admins only"}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({"message": "Status is required"}), 400

    task = Task.query.get(id)
    if not task:
        return jsonify({"message": "Task not found"}), 404

    try:
        # reuse logic from update_task_status but without user check
        if new_status == 'waiting' and task.status != 'waiting':
            # admin may supply contact_id or contact_name
            contact_name = None
            if data.get('contact_id'):
                contact = Contact.query.get(data.get('contact_id'))
                if not contact:
                    return jsonify({"message": "Contact not found"}), 404
                contact_name = contact.name
            else:
                contact_name = (data.get('contact_name') or '').strip()
            if not contact_name:
                return jsonify({"message": "Waiting tasks require a contact name"}), 400
            task.waiting_started_at = datetime.utcnow()
            task.waiting_ended_at = None
            new_waiting = WaitingDetail(
                task_id=task.id,
                contact_name=contact_name,
                reason=data.get('reason', 'No reason provided'),
                wait_start_per_date=task.waiting_started_at
            )
            db.session.add(new_waiting)
        elif task.status == 'waiting' and new_status != 'waiting':
            if task.waiting_info:
                now = datetime.utcnow()
                duration_td = now - task.waiting_info.wait_start_per_date
                if new_status == 'completed':
                    task.total_wait_duration = int(duration_td.total_seconds())
                task.waiting_ended_at = now
        task.status = new_status
        db.session.commit()
        return jsonify({"message": "Task status updated", "task_id": task.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating task status", "error": str(e)}), 500


@app.route("/api/integration/ical/export", methods=["GET"])
@jwt_required()
def ical_export():
    from icalendar import Calendar, Event
    current_user_id = get_jwt_identity()
    tasks = Task.query.filter(
        Task.user_id == current_user_id,
        Task.deadline != None
    ).all()

    cal = Calendar()
    cal.add('prodid', '-//Dependency Task Manager//mxm.dk//')
    cal.add('version', '2.0')

    for task in tasks:
        evt = Event()
        evt.add('summary', task.title)
        if task.description:
            evt.add('description', task.description)
        evt.add('dtstart', task.deadline)
        evt.add('dtend', task.deadline)
        cal.add_component(evt)

    response = app.response_class(cal.to_ical(), mimetype='text/calendar')
    response.headers['Content-Disposition'] = 'attachment; filename="tasks.ics"'
    return response


if __name__ == "__main__":
    app.run(debug=True)


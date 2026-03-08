from flask import Flask, jsonify, request
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
import os
from datetime import datetime
from sqlalchemy import func
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import json

from models import db, User, Task, Contact, WaitingDetail
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
            additional_claims={"is_admin": bool(user.is_admin)}
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

@app.route("/api/tasks", methods=["POST"])
@jwt_required()
def create_task():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('title'):
        return jsonify({"message": "Title is required"}), 400

    try:
        new_task = Task(
            title=data.get('title'),
            description=data.get('description', ''),
            status=data.get('status', 'active'),
            user_id=current_user_id,
            deadline=data.get('deadline') and datetime.fromisoformat(data.get('deadline'))
        )

        # if we are creating a task already in waiting state, record start
        if new_task.status == 'waiting':
            new_task.waiting_started_at = datetime.utcnow()

        db.session.add(new_task)
        db.session.flush()

        if new_task.status == 'waiting':
            contact_id = data.get('contact_id')
            reason = data.get('reason')
            
            if not contact_id:
                return jsonify({"message": "Waiting tasks require a contact_id"}), 400
                
            waiting_info = WaitingDetail(
                task_id=new_task.id,
                contact_id=contact_id,
                reason=reason,
                wait_start_per_date=new_task.waiting_started_at
            )
            db.session.add(waiting_info)

        db.session.commit()
        # Return full task so frontend can add it to state without refetching
        task_data = {
            "id": new_task.id,
            "title": new_task.title,
            "description": new_task.description,
            "status": new_task.status,
            "deadline": new_task.deadline.isoformat() if new_task.deadline else None,
            "waiting_info": None,
            "total_wait_duration": new_task.total_wait_duration,
            "waiting_started_at": new_task.waiting_started_at.isoformat() if new_task.waiting_started_at else None,
            "waiting_ended_at": new_task.waiting_ended_at.isoformat() if new_task.waiting_ended_at else None,
        }
        if new_task.waiting_info:
            task_data["waiting_info"] = {
                "reason": new_task.waiting_info.reason,
                "contact_id": new_task.waiting_info.contact_id,
                "wait_start_per_date": new_task.waiting_info.wait_start_per_date.isoformat(),
            }
        return jsonify({"message": "Task created successfully", "task_id": new_task.id, "task": task_data}), 201

    except Exception as e:
        return jsonify({"message": "Error creating task", "error": str(e)}), 500

# GET /api/tasks IMPLEMENTATION

@app.route("/api/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    current_user_id = get_jwt_identity()

    status_filter = request.args.get('status')
    search_query = request.args.get('search')

    query = Task.query.filter_by(user_id=current_user_id)

    if status_filter:
        query = query.filter(Task.status==status_filter)
    
    if search_query:
        query = query.filter(Task.title.ilike(f"%{search_query}%"))
    
    task_list = []
    for task in query.all():
        task_data = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "waiting_info": None,
            "total_wait_duration": task.total_wait_duration,
            "waiting_started_at": task.waiting_started_at.isoformat() if task.waiting_started_at else None,
            "waiting_ended_at": task.waiting_ended_at.isoformat() if task.waiting_ended_at else None
        }
        
        if task.waiting_info:
            task_data["waiting_info"] = {
                "reason": task.waiting_info.reason,
                "contact_id": task.waiting_info.contact_id,
                "wait_start_per_date": task.waiting_info.wait_start_per_date.isoformat()
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
    
    try:
        if new_status == 'waiting' and task.status != 'waiting':
            contact_id = data.get('contact_id')
        
            if not contact_id:
                return jsonify({"message": "Waiting tasks require a contact_id"}), 400
            
            # start a new waiting period
            task.waiting_started_at = datetime.utcnow()
            task.waiting_ended_at = None

            new_waiting = WaitingDetail(
                task_id=task.id,
                contact_id=contact_id,
                reason=data.get('reason', 'No reason provided'),
                wait_start_per_date=task.waiting_started_at
            )
            db.session.add(new_waiting)

        elif task.status == 'waiting' and new_status != 'waiting':
            # ending a waiting period
            if task.waiting_info:
                now = datetime.utcnow()
                duration_td = now - task.waiting_info.wait_start_per_date
                # record on task
                if new_status == 'completed':
                    task.total_wait_duration = int(duration_td.total_seconds())
                task.waiting_ended_at = now

        # finally update status and commit
        task.status = new_status
        db.session.commit()
        return jsonify({
            "message": f"Task status updated to {new_status}",
            "task_id": task.id
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
        "description": task.description,
        "status": task.status,
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "waiting_info": {
            "reason": task.waiting_info.reason if task.waiting_info else None,
            "contact_id": task.waiting_info.contact_id if task.waiting_info else None,
            "wait_start_per_date": task.waiting_info.wait_start_per_date.isoformat() if task.waiting_info else None
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

    task = Task.query.filter_by(id=id, user_id=current_user_id).first()
    if not task:
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

    if not new_contact_id:
        return jsonify({"message": "New contact ID is required"}), 400
    
    try:
        task.waiting_info.contact_id = new_contact_id

        if new_reason:
            task.waiting_info.reason = new_reason
        
        task.waiting_info.wait_start_per_date = datetime.utcnow()

        db.session.commit()

        return jsonify({"message": "Task forwarded successfully", "task_id": task.id}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error forwarding task", "error": str(e)}), 500

# GET /api/analytics/average-wait IMPLEMENTATION
@app.route("/api/analytics/average-wait", methods=["GET"])
@jwt_required()
def get_average_wait():
    current_user_id = get_jwt_identity()

    # join through WaitingDetail to Contact so we can report by contact name
    results = db.session.query(
        Contact.name.label('contact_name'),
        func.count(Task.id).label('total_tasks'),
        # calculate average duration in hours between waiting_started_at and waiting_ended_at
        (func.avg(
            func.extract('epoch', Task.waiting_ended_at - Task.waiting_started_at)
        ) / 3600).label('average_wait_hours')
    ).join(WaitingDetail, WaitingDetail.task_id == Task.id)
    results = results.join(Contact, WaitingDetail.contact_id == Contact.id)
    results = results.filter(
        Task.user_id == current_user_id,
        Task.status == 'completed',
        Task.waiting_started_at != None,
        Task.waiting_ended_at != None,
    ).group_by(Contact.name)

    stats = results.all()

    output = []
    for contact_name, total_tasks, avg_hours in stats:
        output.append({
            "contact_name": contact_name,
            "average_wait_hours": float(avg_hours) if avg_hours is not None else None,
            "total_tasks": total_tasks,
        })

    return jsonify(output), 200

# ===== admin-only endpoints =====

def _check_admin():
    claims = get_jwt()
    if not claims.get('is_admin'):
        return False
    return True

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
    rows = rows.outerjoin(WaitingDetail, WaitingDetail.task_id == Task.id)
    rows = rows.outerjoin(Contact, WaitingDetail.contact_id == Contact.id)

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
            contact_id = data.get('contact_id')
            if not contact_id:
                return jsonify({"message": "Waiting tasks require a contact_id"}), 400
            task.waiting_started_at = datetime.utcnow()
            task.waiting_ended_at = None
            new_waiting = WaitingDetail(
                task_id=task.id,
                contact_id=contact_id,
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

# Google OAuth configuration
########################IMPORTANT#############################
# redirect URI as registered in Google Console (can point to this callback handler)
REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', "http://localhost:5000/api/integration/google/callback")
# frontend URL to send users back after success
FRONTEND_URL = os.getenv('FRONTEND_URL', "http://localhost:3000")
SCOPES = ['https://www.googleapis.com/auth/calendar.events']
##############################################################

@app.route("/api/integration/google/oauth", methods=["GET", "POST"])
@jwt_required()
def google_oauth():
    """GET or POST without a `code`: return authorization URL.
    POST with a `code`: exchange it for tokens and persist them.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    code = data.get('code')

    if request.method == 'GET' or not code:
        # return the URL the frontend should redirect the user to
        flow = Flow.from_client_secrets_file(
            'client_secret.json',
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        auth_url, state = flow.authorization_url(prompt='consent')
        return jsonify({"auth_url": auth_url}), 200

    # POST with code follows
    try:
        flow = Flow.from_client_secrets_file(
            'client_secret.json',
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        flow.fetch_token(code=code)
        creds = flow.credentials

        user = User.query.get(current_user_id)
        user.google_access_token = creds.token
        user.google_refresh_token = creds.refresh_token
        user.google_token_expiry = creds.expiry
        db.session.commit()

        return jsonify({"message": "Google credentials saved"}), 200
    except Exception as e:
        return jsonify({"message": "Failed to exchange code", "error": str(e)}), 500

@app.route("/api/integration/google/callback", methods=["GET"])
def google_callback():
    """Redirect URI that Google will call once permission is granted.
    It simply forwards the authorization code back to the frontend so that
    the client can call POST /api/integration/google/oauth along with its JWT.
    """
    code = request.args.get('code')
    if not code:
        return "Missing code", 400

    redirect_to = f"{FRONTEND_URL}/dashboard?code={code}"
    return f"<html><body><script>window.location.href=\"{redirect_to}\";</script></body></html>"


def _get_google_credentials(user: User):
    """Build a Credentials object for the given user, refreshing if necessary."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    if not user.google_access_token or not user.google_refresh_token:
        return None

    info = json.load(open('client_secret.json'))
    # client_secret.json can have 'web' or 'installed' key depending on type
    client_info = info.get('web') or info.get('installed')

    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=client_info['client_id'],
        client_secret=client_info['client_secret'],
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        user.google_access_token = creds.token
        user.google_token_expiry = creds.expiry
        db.session.commit()

    return creds

@app.route("/api/integration/google/sync", methods=["GET"])
@jwt_required()
def google_sync():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    creds = _get_google_credentials(user)
    if not creds:
        return jsonify({"message": "Google credentials not configured"}), 400

    service = build('calendar', 'v3', credentials=creds)

    tasks = Task.query.filter(
        Task.user_id == current_user_id,
        Task.deadline != None
    ).all()

    created = []
    for task in tasks:
        event = {
            'summary': task.title,
            'description': task.description or '',
            'start': {'dateTime': task.deadline.isoformat(), 'timeZone': 'UTC'},
            'end': {'dateTime': task.deadline.isoformat(), 'timeZone': 'UTC'},
        }
        try:
            ev = service.events().insert(calendarId='primary', body=event).execute()
            created.append(ev.get('id'))
        except Exception:
            pass

    return jsonify({"created_event_ids": created}), 200

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


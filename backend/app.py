from flask import Flask, jsonify, request
from flask_migrate import Migrate
from dotenv import load_dotenv
import os
from datetime import datetime

from backend.models import db, User, Task, Contact, WaitingDetail
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

load_dotenv()

app = Flask(__name__)

# CONFIGURATION
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "postgresql://username:password@localhost:5432/waitflow_db")
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
    data = request.get_json()

    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({"message": "Missing required fields"}), 400

    if User.query.filter_by(username=data['username']).first() or User.query.filter_by(email=data['email']).first():
        return jsonify({"message": "Username or email already exists"}), 400

    try:
        new_user = User(
            username=data.get('username'),
            email=data.get('email'),
        )
        new_user.set_password(data.get('password'))

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
        access_token = create_access_token(identity=str(user.id))
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
            user_id=current_user_id
        )

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
                reason=reason
            )
            db.session.add(waiting_info)

        db.session.commit()
        return jsonify({"message": "Task created successfully", "task_id": new_task.id}), 201
    
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
            "waiting_info": None,
            "total_wait_duration": task.total_wait_duration
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
            
            new_waiting = WaitingDetail(
                task_id=task.id,
                contact_id=contact_id,
                reason=data.get('reason', 'No reason provided'),
                wait_start_per_date=datetime.utcnow()
            )
            db.session.add(new_waiting)

        elif task.status == 'waiting' and new_status != 'waiting':
            if task.waiting_info:
                duration_td = datetime.utcnow() - task.waiting_info.wait_start_per_date
                # If moving from waiting to completed, store total wait duration on the task (in seconds)
                if new_status == 'completed':
                    task.total_wait_duration = int(duration_td.total_seconds())
                db.session.delete(task.waiting_info)
        
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
        "waiting_info": {
            "reason": task.waiting_info.reason if task.waiting_info else None,
            "contact_id": task.waiting_info.contact_id if task.waiting_info else None,
            "wait_start_per_date": task.waiting_info.wait_start_per_date.isoformat() if task.waiting_info else None
        } if task.status == 'waiting' else None,
        "total_wait_duration": task.total_wait_duration
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
    
if __name__ == "__main__":
    app.run(debug=True)


from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize SQLAlchemy here to avoid circular imports with `app`.
db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    # administrator flag
    is_admin = db.Column(db.Boolean, nullable=False, default=False)

    # google oauth tokens stored here as simple columns; you could also use a separate table
    google_access_token = db.Column(db.String(500), nullable=True)
    google_refresh_token = db.Column(db.String(500), nullable=True)
    google_token_expiry = db.Column(db.DateTime, nullable=True)

    tasks = db.relationship('Task', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)

    # backref from Task will populate this if needed
    tasks = db.relationship('Task', backref='category_obj', lazy=True)

    def __repr__(self):
        return f"<Category {self.name}>"


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    # kept for backward compatibility with older tasks, will be synced
    category = db.Column(db.String(100), nullable=False)
    # optional foreign key linking to a Category record
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    urgency = db.Column(db.String(50), nullable=False)
    # description is now required as well
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active')
    # priority and custom colour for visual highlighting
    priority = db.Column(db.String(10), nullable=False, default='Low')
    # store a 7-character hex string; default to a neutral grey
    color_code = db.Column(db.String(7), nullable=False, default='#808080')
    # duration in seconds when a task has been in waiting state
    total_wait_duration = db.Column(db.Integer, nullable=True)

    # new fields to record when waiting started and ended; used for analytics
    waiting_started_at = db.Column(db.DateTime, nullable=True)
    waiting_ended_at = db.Column(db.DateTime, nullable=True)

    # optional deadline for calendar integrations
    deadline = db.Column(db.DateTime, nullable=True)

    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)    # optionally link to a contact for assignments/forwarding
    contact_id = db.Column(db.Integer, db.ForeignKey('contact.id'), nullable=True)
    contact = db.relationship('Contact', backref='tasks')
    waiting_info = db.relationship('WaitingDetail', backref='task', uselist=False)

    def __repr__(self):
        return f"<Task {self.title} - {self.status}>"


class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # contacts are scoped to a user
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120), nullable=True)
    organization = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    owner = db.relationship('User', backref='contacts')


class WaitingDetail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    # store contact information directly for simplicity
    contact_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    wait_start_per_date = db.Column(db.DateTime, default=datetime.utcnow)


class TaskHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    action = db.Column(db.String(100), nullable=False)
    actor_user_id = db.Column(db.String(36), db.ForeignKey('user.id'))
    details = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    task = db.relationship('Task', backref='history_entries')
    actor = db.relationship('User')


def log_history(task_id: int, actor_user_id: str, action: str, details: str = ""):
    """Append a TaskHistory record to the current session.

    The caller should commit the session when ready. This helper keeps
    the insertion logic in one place and avoids repeating boilerplate.
    """
    entry = TaskHistory(
        task_id=task_id,
        actor_user_id=actor_user_id,
        action=action,
        details=details,
    )
    db.session.add(entry)

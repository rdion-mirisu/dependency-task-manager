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


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='active')
    # duration in seconds when a task has been in waiting state
    total_wait_duration = db.Column(db.Integer, nullable=True)

    # new fields to record when waiting started and ended; used for analytics
    waiting_started_at = db.Column(db.DateTime, nullable=True)
    waiting_ended_at = db.Column(db.DateTime, nullable=True)

    # optional deadline for calendar integrations
    deadline = db.Column(db.DateTime, nullable=True)

    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    waiting_info = db.relationship('WaitingDetail', backref='task', uselist=False)

    def __repr__(self):
        return f"<Task {self.title} - {self.status}>"


class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    phone = db.Column(db.String(20))


class WaitingDetail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'))
    contact_id = db.Column(db.Integer, db.ForeignKey('contact.id'))
    reason = db.Column(db.String(255))
    wait_start_per_date = db.Column(db.DateTime, default=datetime.utcnow)
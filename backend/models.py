from app import db
from datetime import datetime
import uuid


class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    tasks = db.relationship('Task', backref='owner', lazy=True)

    def __repr__(self):
        return f"<User {self.username}>"


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='active')
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
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from models import db, User
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)

# DATABASE CONFIGURATION

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://username:password@localhost:5432/waitflow_db'
# REPLACE WITH ACTUAL POSTGRE CREDENTIALS
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your_secret_key_here'
# REPLACE WITH SECRET KEY

# INITIALIZE DATABASE AND MIGRATIONS
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

@app.route("/")
def home():
    return jsonify({"message": "Backend is running"})

# USER REGISTRATION
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

# USER LOGIN
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"message": "Missing required fields"}), 400

    if user and user.check_password(data['password']):
        access_token = create_access_token(identity=str(user.id))
        return jsonify({"access_token": access_token}), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401

# JWT MIDDLEWARE
@app.route("/api/protected", methods=["GET"])
@jwt_required()
def protected():
    current_user_id = get_jwt_identity()
    return jsonify({"message": "Access granted", "logged_in_as": current_user_id}), 200

if __name__ == "__main__":
    app.run(debug=True)


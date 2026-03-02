# Dependency Task Manager

This repository holds a **Flask backend** and a **React frontend** scaffold. Developers can clone, install dependencies, and start both services locally.

---

## Backend
The backend is a simple Flask app serving JSON on `/`.

### Setup

```powershell
cd backend
python -m venv venv            # create a virtual environment
venv\Scripts\activate         # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

### Run

```powershell
python app.py
```

The server listens on `http://127.0.0.1:5000`. Visiting that URL returns:

```json
{"message":"Backend is running"}
```

---

## Frontend

A minimal React app created with Create React App.

### Setup & Start

```powershell
cd frontend
npm install
npm start
```

Browse to `http://localhost:3000` to see the placeholder page.

### Notes

- The frontend will eventually make HTTP requests (e.g. via Axios) to the backend at `http://127.0.0.1:5000`.
- Adjust proxy settings or CORS as needed during integration.

---

## Git

To add files and push:

1. Stage changes (e.g. `git add backend frontend`)
2. Commit with a descriptive message:
   ```
   git commit -m "Initial scaffold: Flask backend + React frontend"
   ```
3. Push to the origin remote:
   ```
   git push origin main
   ```

Developers cloning the repo can run the above setup steps and start both services.

---

Feel free to expand this README with architecture, endpoints, or deployment instructions as the project evolves.

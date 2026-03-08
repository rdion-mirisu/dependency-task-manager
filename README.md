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

### Additional API Endpoints

The backend now offers several helpful routes:

* **JWT-protected analytics**
  * `GET /api/analytics/average-wait` – returns an array grouped by contact name with `contact_name`, `average_wait_hours`, and `total_tasks`. Only completed tasks with both waiting start/end timestamps are included.

* **Google Calendar integration** (requires a `client_secret.json` from Google and appropriate env variables):
  * `GET /api/integration/google/oauth` – returns an authorization URL; the frontend should redirect the user to this address.
  * `POST /api/integration/google/oauth` – accept a `code` from the frontend, exchange it for tokens, and store them for the currently authenticated user.
  * `GET /api/integration/google/callback` – redirect URI for Google; forwards the authorization code back to the frontend dashboard.
  * `GET /api/integration/google/sync` – creates calendar events for every task with a deadline, refreshing tokens automatically when expired.

* **iCal export**
  * `GET /api/integration/ical/export` – returns a `.ics` file containing the current user's tasks that have a deadline. Events use the task title/description as summary/description.

Update the environment with `GOOGLE_REDIRECT_URI` and `FRONTEND_URL` as appropriate.  You should also update the database with the latest migrations after modifying the models.

### Frontend notes

After pulling these changes, install the new JS dependencies:

```powershell
cd frontend
npm install
```

The React app now has several additional pages — use the navigation bar once
logged in:

* **Dashboard** – original task list/creation UI.
* **Analytics** – average wait per contact with a bar chart and table.
* **Calendar** – buttons to connect Google Calendar, sync tasks, or export an
  iCal file.
* **Admin** – only visible if your JWT includes `is_admin: true`; shows a
  table of all tasks along with status controls and an SMS modal.

The login flow persists the JWT in `localStorage` and reads the `is_admin`
claim to control access. When Google OAuth redirects back with a `code`
parameter it is automatically exchanged for tokens.

Feel free to expand this README with architecture, endpoints, or deployment instructions as the project evolves.

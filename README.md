# Paper Llama

Paper Llama is a companion application for **Paperless-ngx**. It acts as a bridge between your Paperless document management system and an external **Ollama** AI model. By evaluating the content of your newly scanned documents, Paper Llama can automatically generate and assign appropriate **Titles**, **Correspondents**, **Document Types**, and **Tags**. Yes, Paperless does something like this out of the
box, but its success rate of assigning the correct values was not great for me.

## Setup & Execution 🚀

### Option 1: Docker (Recommended)
You can deploy Paper Llama using Docker Compose. A basic `docker-compose.yml` file is provided in the repository. I recommend using a permanent volume for the database (/data) to persist the list of processed
documents.

```bash
docker-compose up -d
```
The app will be available on port `8021`. 

### Option 2: Local Development
Ensure you have Python 3.10+ and Node.js installed.

1. **Install Backend Dependencies:**
   ```bash
   python -m venv venv
   source venv/Scripts/activate # Windows users use: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. **Setup Frontend Environments:**
   *(Ensure you have `npm` installed if you intend to run frontend tests)*
   ```bash
   npm install
   ```
3. **Run the Server:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8021 --reload
   ```

Navigate to `http://localhost:8021` to access the Setup Wizard.

## Configuration Settings ⚙️
Once you complete the initial setup wizard, you can tweak the application settings directly from the Dashboard.

- **Paperless API Credentials:** The connection URL and Token for your Paperless-ngx instance. I recommend
to create a dedicated user in Paperless with the following permissions:
  - View and Edit Documents
  - View Tags, Correspondents, Document Types, Users, Groups
  - All access to Saved Views and UI settings (for testing, e.g. checking what the user can see)

  To create and get the token for the user in Paperless, log in with the user and open "My Profile" from the
  top right menu.
- **Ollama AI Config:** Your local Ollama URL (e.g. `http://localhost:11434`) and the LLM model to use (I had good results with `gpt-oss:20b` on relatively modest hardware).
- **AI Capabilities Checkboxes:** Choose exactly which fields the AI assistant is allowed to modify.
  Currently available: Title, Correspondent, Document Type, Tags and Creation Date.
- **API Timeout:** The maximum time to wait for the AI to respond (in seconds).
- **Max Retries:** The maximum number of retries per processing cycle if the AI query or saving the document fails. Applies to each separately. If a document processing fails even after the retries, it will
be tried again at the end of the next processing cycle, after processing the newly added documents.
- **Document Word Limit:** The maximum number of words to pass to the LLM (0 for unlimited). Helps speed up processing on very large documents.
- **Schedule Interval:** How often (in minutes) the app polls Paperless-ngx for unprocessed documents. Set to `0` to disable background polling. When disabled, you can manually trigger processing from the Dashboard
or configure a webhook in Paperless to trigger processing when a new document is added. The contents passed
via the webhook are not processed, it only triggers processing. To set up a webhook in Paperless, go to
Workflows and create a new workflow with the following settings:
  - Trigger: Document added
  - Action: Webhook
  - Webhook url: http://[paper-llama-ip:8021]/api/webhook
- **Query Tag:** Tag to filter documents to be processed, selectable from a list of tags retrieved from your Paperless instance. If not set, all documents will be processed. It is **highly recommended** to set this (e.g. `unprocessed`) to prevent overwriting manually set values of existing documents.
For this purpose, you can create a tag in Paperless and set it as an "Inbox tag" in its settings, so it gets assigned to all new documents automatically.

  **Note:** If this tag gets deleted from Paperless the app will stop processing documents until the setting is
updated to an existing tag or None.
- **Remove query tag after processing:** If checked, automatically removes the Query Tag from the document once processing succeeds.
- **Force Process Tag:** A specific tag (selected from your Paperless tags) that you can assign to a document in Paperless to force the AI to re-evaluate it, even if it was previously processed by Paper Llama. This tag is always automatically removed after processing to prevent endless loops.

  **Note:** If the Query Tag is configured, the document will only be re-processed if it has both the Query Tag and the Force Process Tag.

## Database Migrations

The application uses Alembic to manage database schema updates.

**Using Docker (Automatic):**
When using Docker Compose, the container automatically applies any pending migrations before starting the application. No manual steps are required.

**Using Local Python (Manual):**
If running locally without Docker, you must apply new migrations manually after updating your codebase:
```bash
cd backend
alembic upgrade head
```

## Administration

If you ever forget your admin password and need to reset it, you can run the `reset_admin.py` utility.

**Using Docker:**
Run the following command to execute the script interactively inside the container:
```bash
docker exec -it paper-llama python reset_admin.py
```

**Using Local Python:**
```bash
python reset_admin.py
```
Note: the script will look for the database in `data/paper-llama.db`.

## Testing
Paper Llama includes automated tests for both the backend and frontend components.

### Backend Tests (Pytest)
The backend tests execute Python API calls against mock SQLite sessions and mock responses for the Paperless and Ollama environments.
```bash
# Run backend tests
python -m pytest backend/tests/
```

### Frontend Tests (Vitest)
The frontend uses `vitest` coupled with `@vue/test-utils` and `jsdom` to mount components and verify interaction flows (like logging in and toggling settings).
```bash
# Run frontend tests
npx vitest run
```

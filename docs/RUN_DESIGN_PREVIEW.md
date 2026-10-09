# Run the coherent dark design preview

Branch: `design/coherent-dark-polish-09`.

The easiest preview is a separate clone and Docker container on port **8792**. It has its own catalog and account setup. The preview mounts media read-only and stores its catalog in a separate Docker volume. Requirements are the project's existing Git, Docker Engine, and Docker Compose setup.

## 1. Get the branch

Run this in the folder where you keep projects:

```bash
git clone --branch design/coherent-dark-polish-09 --single-branch https://github.com/Mancer-Suite/InfoMancer.git InfoMancer-design
cd InfoMancer-design
```

## 2. Create the preview configuration once

Linux or macOS:

```bash
printf 'INFOMANCER_DESIGN_SECRET=%s\n' "$(openssl rand -hex 32)" > .env.design
```

Windows PowerShell:

```powershell
"INFOMANCER_DESIGN_SECRET=$([guid]::NewGuid().ToString('N'))$([guid]::NewGuid().ToString('N'))" | Set-Content -Encoding ascii .env.design
```

Keep this file for subsequent starts so existing preview sessions continue to work.

To browse your own media, add a line to `.env.design`, replacing the example with your Movies/TV parent folder:

```dotenv
INFOMANCER_DESIGN_MEDIA_PATH=/absolute/path/to/media
```

For Windows, use a path such as `C:/Media`. With no media path configured, Docker creates an empty `sandbox-media` folder beside the clone. You can still review the empty states and settings.

## 3. Build and open it

```bash
docker compose --env-file .env.design -f compose.design.yaml up -d --build
docker compose --env-file .env.design -f compose.design.yaml ps
```

Open **http://localhost:8792** and create the preview's first Librarian account. Add a source using its container path, such as `/media/Movies`, to see your catalog and covers. The mounted files remain read-only.

For a preview running on a home server, add `INFOMANCER_DESIGN_BIND_ADDRESS=0.0.0.0` to `.env.design`, repeat the start command, and open `http://YOUR-SERVER-IP:8792` from the same trusted LAN or VPN. The default binds only to the server's localhost.

## Update or stop the preview

Update:

```bash
git pull --ff-only
docker compose --env-file .env.design -f compose.design.yaml up -d --build
```

Stop it while keeping the preview catalog:

```bash
docker compose --env-file .env.design -f compose.design.yaml down
```

Logs:

```bash
docker compose --env-file .env.design -f compose.design.yaml logs --tail=100 infomancer-design
```

## Source development alternative

Use Python 3.12 or newer. In the cloned folder on Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export INFOMANCER_DATABASE=data-design/infomancer.db
export INFOMANCER_SANDBOX=1
export INFOMANCER_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8792
```

For PowerShell, activate with `.\.venv\Scripts\Activate.ps1` and set environment variables with `$env:INFOMANCER_DATABASE = 'data-design/infomancer.db'`, `$env:INFOMANCER_SANDBOX = '1'`, and `$env:INFOMANCER_SECRET = (python -c "import secrets; print(secrets.token_hex(32))")`. Use the same `uvicorn` command. This option requires local FFmpeg for media inspection, as described in the installation guide.

Press Ctrl+C to stop a source preview. Its catalog is separate in `data-design/`.

## Verify the design changes

From the repository root:

```bash
python -m unittest discover -s tests
```

For the focused browser regressions:

```bash
cd e2e
npm ci --ignore-scripts
npx playwright install chromium
npx playwright test tests/design-coherence.spec.js tests/global-search.spec.js
```

These focused tests serve the real CSS locally and do not need a running application. The broader app acceptance runner remains `python run_visual.py headless` from `e2e/`.

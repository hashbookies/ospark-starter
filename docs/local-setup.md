# Run locally

**Node.js 20.10+** is the only prerequisite. No database, runtime model, GPU, Docker or account is needed for demo mode.

```bash
npm start
```

Open `http://127.0.0.1:4173` and choose a simulated scenario. Stop with Ctrl+C.

## Connected mode

Copy `.env.example` to `.env` and configure local loopback endpoints. The file is excluded from Git. Run:

```bash
npm run connected
```

All endpoints **must** be on `127.0.0.1`, `localhost` or `[::1]` using `http://`. The adapter rejects remote and HTTPS service URLs; this is intentional for a local reference app.

### Expected services

| Service | Endpoint(s) used | Healthy when |
|---|---|---|
| Hermes-like gateway | `GET /health`, `GET /v1/models` | Both return valid JSON; model listing has at least one item |
| Flint/OpenAI-compatible inference | `GET /v1/models` | Valid JSON model listing with at least one item |
| Mission Control-like API | `GET /api/v1/health`, `/overview`, `/agent-registry`, `/tasks`, `/activity`, `/briefings` | Health service status is ok, required sources respond and contain no explicit error |

The name `Flint` is a UI label, not a required engine. A compatible local model server can be configured in its place. Missing URLs show `UNCONFIGURED`. Different or older API shapes might show `DEGRADED` until an adapter is added.

### Optional model chat

`ALLOW_LOCAL_CHAT=0` by default. To experiment with real responses, explicitly choose an endpoint that **only serves model completions, without server-side tools or agent actions**:

```dotenv
ALLOW_LOCAL_CHAT=1
MODEL_BASE_URL=http://127.0.0.1:8081
MODEL_ID=your-model-id
MODEL_API_KEY=
```

This calls `POST /v1/chat/completions`, requests `tool_choice: "none"`, and accepts only text. It makes no persistent session and has no filesystem, network search, browser automation or execution tools. Some inference servers may not support this exact protocol. **Never expose the starter on the Internet or point it at a tool-capable agent executor.**

### Changing port

Set `PORT=4174` in `.env`. Use an available port between 1024 and 65535. The server will bind to `127.0.0.1` regardless of your environment.

### Tests

```bash
npm test
npm run check
```

No `npm install` required. If you do use npm install, the project intentionally has no third-party dependencies.

# CLAUDE.md — LobsterLite Mobile Agent

## Project Overview

LobsterLite is a dual-model AI agent mobile application built with an Expo React Native frontend and a FastAPI Python backend. It features a **Chat Model** for conversation and an **Action Model** for device actions, with automatic intent routing between them. The LLM inference is currently cloud-proxied (GPT-4.1-mini via Emergent Universal Key), with the architecture designed to support future on-device inference.

**Design Language**: "Abyssal Tech" — a deep-sea submarine cockpit aesthetic with bioluminescent utility. Dark, pressure-resistant, illuminated by vital data. The AI is presented as a tool, not a person (use machine-like language: "Processing", "Routing").

## Repository Structure

```
mobile-agent/
├── backend/
│   ├── server.py              # Single-file FastAPI backend (all routes, models, logic)
│   ├── .env                   # MongoDB URL, DB name, Emergent LLM key
│   ├── requirements.txt       # Python dependencies (pinned versions)
│   └── tests/
│       ├── test_lobsterlite_backend.py      # Core API endpoint tests
│       ├── test_file_operations.py          # File CRUD + chat integration tests
│       └── test_file_manager_enhancements.py # Rename, search, directory tree tests
├── frontend/
│   ├── app/                   # Expo Router file-based routing
│   │   ├── _layout.tsx        # Root layout with ThemeProvider + NavigationGuard
│   │   ├── index.tsx          # Entry redirect
│   │   ├── onboarding.tsx     # 3-step onboarding flow
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx    # Tab navigator (Chat + Settings)
│   │   │   ├── index.tsx      # Chat screen (main interaction surface)
│   │   │   └── settings.tsx   # Settings hub with navigation to sub-screens
│   │   ├── memory.tsx         # Memory manager (facts + conversations)
│   │   ├── tools.tsx          # Tool manager
│   │   ├── models.tsx         # Model manager (download simulation)
│   │   ├── soul-editor.tsx    # SOUL document editor
│   │   ├── keywords.tsx       # Action keywords editor
│   │   ├── files.tsx          # File manager UI
│   │   └── benchmark.tsx      # Performance benchmark screen
│   ├── src/
│   │   ├── api.ts             # API client (all backend endpoint wrappers)
│   │   ├── theme.ts           # Color tokens (light/dark), theme resolver
│   │   └── ThemeContext.tsx    # React context for theme state
│   ├── package.json           # Yarn, Expo SDK 54, React Native 0.81
│   ├── tsconfig.json          # Strict mode, `@/*` path alias
│   ├── eslint.config.js       # ESLint flat config with expo preset
│   ├── app.json               # Expo config (typed routes enabled)
│   └── metro.config.js        # Metro bundler config (2 workers, disk cache)
├── memory/
│   └── PRD.md                 # Product Requirements Document
├── design_guidelines.json     # Design tokens, component specs, icon mappings
├── tests/
│   └── __init__.py            # Top-level test package (currently empty)
├── test_reports/              # JSON test iteration reports
│   └── pytest/                # Pytest output reports
├── test_result.md             # Testing protocol communication file
└── .emergent/
    └── emergent.yml           # Emergent platform config
```

## Tech Stack

### Backend
- **Framework**: FastAPI 0.110 with Starlette
- **Database**: MongoDB via Motor (async driver), pymongo 4.5
- **LLM**: OpenAI GPT-4.1-mini via `emergentintegrations` SDK
- **Server**: Uvicorn
- **Python**: 3.x with Pydantic v2 for request/response models
- **Linting**: flake8, isort, black, mypy

### Frontend
- **Framework**: Expo SDK 54, React Native 0.81, React 19
- **Language**: TypeScript (strict mode)
- **Routing**: expo-router v6 (file-based routing with typed routes)
- **Navigation**: @react-navigation/bottom-tabs + native-stack
- **Storage**: @react-native-async-storage/async-storage
- **Icons**: @expo/vector-icons (MaterialCommunityIcons family)
- **Animations**: react-native-reanimated
- **Package Manager**: Yarn 1.22
- **Linting**: ESLint with eslint-config-expo (flat config)

## Development Commands

### Backend
```bash
# Start the backend server
cd backend && uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# Run backend tests (integration tests against running server)
cd backend && python -m pytest tests/ -v

# Individual test suites
python -m pytest backend/tests/test_lobsterlite_backend.py -v
python -m pytest backend/tests/test_file_operations.py -v
python -m pytest backend/tests/test_file_manager_enhancements.py -v
```

### Frontend
```bash
# Install dependencies
cd frontend && yarn install

# Start Expo dev server
cd frontend && yarn start

# Run linter
cd frontend && yarn lint

# Platform-specific
cd frontend && yarn android
cd frontend && yarn ios
cd frontend && yarn web
```

## Architecture & Key Concepts

### Dual-Model Agent Loop
The core chat flow in `backend/server.py` (`POST /api/chat/send`) works as follows:

1. **Chat Model** receives the user message with SOUL personality, memory context, and conversation history
2. **Intent Router** checks for `[ACTION: ...]` signals in the Chat Model response
3. If action detected → **Action Model** generates a structured JSON function call (`{"tool": "<name>", "params": {...}}`)
4. Tool is executed (file tools hit MongoDB; device tools are simulated)
5. **Confirmation step** — Chat Model generates a friendly response summarizing the result
6. **Heuristic fallback** — if no `[ACTION:]` signal but keywords match, a re-query step determines if an action is needed

### Routing Decisions
- `chat_only` — pure conversational response
- `action_routed_signal` — explicit `[ACTION:]` detected in Chat Model output
- `action_routed_heuristic` — keyword match triggered re-query, confirmed as action
- `heuristic_requery` — keyword match but determined not to be an action

### MongoDB Collections
- `soul_config` — SOUL personality document (single doc)
- `settings` — App settings (single doc)
- `action_keywords` — Intent routing keywords (single doc)
- `conversations` — Chat history logs
- `facts` — Semantic memory (identity, preference, schedule, context)
- `custom_tools` — User-defined tool schemas
- `models` — LLM model registry
- `files` — Virtual file system

### Built-in Tools (15 total)
10 device tools: `create_alarm`, `create_calendar_event`, `send_sms`, `open_url`, `set_timer`, `create_reminder`, `toggle_wifi`, `toggle_flashlight`, `search_web`, `take_note`

5 file tools (real operations via MongoDB): `create_file`, `read_file`, `edit_file`, `delete_file`, `list_files`

Maximum 30 total tools (built-in + custom).

### Memory System
- **Episodic**: Conversation logs with routing decisions (in `conversations` collection)
- **Semantic**: Facts extracted via heuristic regex (name, preferences) stored in `facts` collection
- **Retrieval scoring**: 60% recency + 40% keyword overlap

## API Endpoints

All endpoints are prefixed with `/api`.

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/chat/send` | POST | Main agent loop (dual-model routing) |
| `/api/soul` | GET/PUT | SOUL document CRUD |
| `/api/memory/facts` | GET/POST | Fact listing and creation |
| `/api/memory/facts/{key}` | DELETE | Delete fact by key |
| `/api/memory/forget` | POST | Forget all facts matching a topic |
| `/api/conversations` | GET/DELETE | Conversation history |
| `/api/tools` | GET | Full tool registry |
| `/api/tools/custom` | POST | Add custom tool |
| `/api/tools/custom/{name}` | DELETE | Remove custom tool |
| `/api/files` | GET/POST | List/create files |
| `/api/files/{id}` | GET/PUT/DELETE | File CRUD by ID or path |
| `/api/files/{id}/rename` | PATCH | Rename file |
| `/api/files/search/query` | GET | Search files (name, content, path) |
| `/api/files/directories/tree` | GET | Directory tree with counts |
| `/api/keywords` | GET/PUT | Action keywords |
| `/api/models` | GET | Model listing |
| `/api/models/download` | POST | Start model download (simulated) |
| `/api/models/{id}/status` | GET | Model download status |
| `/api/settings` | GET/PUT | App settings |
| `/api/data` | DELETE | Wipe all data |

## Frontend Patterns & Conventions

### Theming
- All colors come from `src/theme.ts` — never hardcode hex values
- Access current colors via `useTheme()` hook from `src/ThemeContext.tsx`
- Three modes: `light`, `dark`, `system`
- Design tokens are also specified in `design_guidelines.json` (source of truth for the "Abyssal Tech" palette)

### Screen Structure
- Every screen uses `SafeAreaView` from `react-native-safe-area-context`
- `KeyboardAvoidingView` with platform-aware behavior for input screens
- Touch targets must be at least 48x48dp
- Scrollable content uses `contentContainerStyle={{ paddingBottom: 100 }}` to avoid bottom nav overlap
- All interactive elements have `testID` props for testing

### API Client
- All backend calls go through `src/api.ts` which wraps `fetch` with error handling
- Backend URL configured via `EXPO_PUBLIC_BACKEND_URL` environment variable
- No auth — all endpoints are open

### Styling
- Uses React Native `StyleSheet.create()` — no Tailwind/NativeWind in actual code despite design guidelines mentioning it
- Inline style composition with theme colors: `[styles.base, { backgroundColor: colors.surface }]`

### Path Alias
- `@/*` maps to the frontend root (configured in `tsconfig.json`)

## Backend Conventions

### Single-File Architecture
The entire backend lives in `backend/server.py` (~1100 lines). All Pydantic models, helper functions, and route handlers are in this file. There is no module splitting.

### Pydantic Models
Request bodies use Pydantic `BaseModel` classes (e.g., `ChatMessage`, `SoulUpdate`, `FileCreate`). All are defined at the top of server.py.

### Database Patterns
- All MongoDB operations use Motor async driver
- Queries exclude `_id` field: `{"_id": 0}`
- Upsert pattern for singleton documents (soul, settings, keywords)
- UUID strings for document IDs (not MongoDB ObjectId)

### Error Handling
- `HTTPException` for 400/404/409 errors
- No global exception handler

## Testing

### Test Framework
- **pytest** for backend integration tests
- Tests run against a **live server** (not mocked) — they make HTTP requests to the deployed backend URL
- Test URL is read from `frontend/.env` (`EXPO_PUBLIC_BACKEND_URL`)

### Test Suites
1. `test_lobsterlite_backend.py` — Health, SOUL, tools, keywords, models, settings, memory, conversations, chat routing
2. `test_file_operations.py` — File CRUD, chat-driven file operations, tool verification
3. `test_file_manager_enhancements.py` — File rename, search, directory tree

### Running Tests
```bash
python -m pytest backend/tests/ -v
```

### Test Communication Protocol
The `test_result.md` file serves as a communication channel between the main development agent and a testing agent. It tracks implementation status, stuck tasks, and testing priorities in YAML format.

## Environment Variables

### Backend (`backend/.env`)
- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — Database name
- `EMERGENT_LLM_KEY` — API key for Emergent integrations (LLM proxy)

### Frontend (`frontend/.env`)
- `EXPO_PUBLIC_BACKEND_URL` — Backend API base URL
- `EXPO_TUNNEL_SUBDOMAIN` — Expo tunnel subdomain
- `EXPO_PACKAGER_HOSTNAME` — Expo packager hostname
- `EXPO_USE_FAST_RESOLVER` — Metro fast resolver flag
- `METRO_CACHE_ROOT` — Metro cache directory

## Important Notes for AI Assistants

1. **Backend is a single file**: All backend logic is in `backend/server.py`. When adding new endpoints, follow the existing section comment pattern (`# ─── Section Name ───`).

2. **File tools are real**: Unlike device tools (which are simulated), file operations (`create_file`, `read_file`, `edit_file`, `delete_file`, `list_files`) actually read/write to MongoDB.

3. **Tests are integration tests**: They require a running backend server. Don't try to run them without the server up.

4. **No state management library**: The frontend uses React `useState`/`useEffect` and `AsyncStorage` directly — no Redux, Zustand, or MobX despite what design guidelines suggest.

5. **Design guidelines vs reality**: `design_guidelines.json` recommends NativeWind/Tailwind and Zustand, but the actual implementation uses plain StyleSheet and React state. Follow the actual code patterns, not the guidelines.

6. **SOUL document**: The personality/behavior configuration is a markdown document stored in MongoDB. It has a 512-token soft limit with auto-truncation during context assembly.

7. **Mocked components**: On-device inference is cloud-proxied, Android intents are simulated, HuggingFace downloads are simulated with progress animation.

8. **Theme colors**: Always use the `useTheme()` hook. Never hardcode color values. Reference `design_guidelines.json` for the canonical token names.

9. **Icon family**: Use `MaterialCommunityIcons` from `@expo/vector-icons`. Icon mappings are in `design_guidelines.json`.

10. **Max tool limit**: The system enforces a maximum of 30 tools (15 built-in + up to 15 custom). Check this limit when adding tools.

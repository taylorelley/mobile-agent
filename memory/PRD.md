# LobsterLite - Product Requirements Document

## Overview
LobsterLite is a dual-model AI agent mobile application that reimplements OpenClaw's agent loop architecture. It features a **Chat Model** for conversation and an **Action Model** for device actions, with automatic intent routing between them.

## Architecture
- **Frontend**: Expo React Native with TypeScript
- **Backend**: FastAPI (Python) with MongoDB
- **LLM**: OpenAI GPT-4.1-mini via Emergent LLM key (simulating dual-model architecture)
- **Theme**: Light/Dark/System toggle with "Abyssal Tech" design language

## Core Features

### 1. Dual-Model Agent Loop
- Chat Model handles open-ended conversation, reasoning, and intent classification
- Action Model generates structured function calls when device actions are needed
- Intent Router automatically detects `[ACTION: ...]` signals from Chat Model
- Heuristic keyword fallback for missed action signals
- Maximum 5 chained tool calls per turn

### 2. Chat Interface
- Real-time message display with user/assistant bubbles
- Action cards showing tool name, parameters, and execution status
- Processing indicator during inference
- Suggestion chips for common interactions
- Long-press context menu with "View Raw" option

### 3. SOUL Document System
- Markdown-based personality configuration
- Sections: Identity, Personality, Rules, Knowledge
- In-app editor with token count estimation
- Auto-truncation at 512 tokens during context assembly

### 4. Memory System
- **Episodic Memory**: Conversation logs with routing decisions
- **Semantic Memory**: Fact extraction (identity, preference, schedule, context)
- Memory retrieval scoring: 60% recency + 40% keyword overlap
- "Forget" command to delete memories by topic

### 5. Tool Registry
15 built-in tools: create_alarm, create_calendar_event, send_sms, open_url, set_timer, create_reminder, toggle_wifi, toggle_flashlight, search_web, take_note, **create_file, read_file, edit_file, delete_file, list_files**
- Custom tool support via JSON schema
- Maximum 30 total tools

### 6. File Manager
- Agent can create, read, edit, delete, and list local files via natural language chat
- File operations are real (stored in MongoDB) - not simulated
- File Manager UI (Settings > File Manager) for manual file management
- Full in-app editor with monospace font, metadata display, save functionality
- Create file modal with filename, directory, and content inputs
- File type icons based on extension (.txt, .md, .json, .js, .py, etc.)

### 6. Model Manager
- Download models from HuggingFace on demand
- Progress tracking with speed indicators
- Two default models: Qwen3 0.6B (Chat) + FunctionGemma 270M (Action)

### 7. Settings & Configuration
- Theme toggle (Light/Dark/System)
- SOUL document editor
- Memory manager (facts + conversations)
- Tool manager
- Action keywords editor
- Performance benchmark screen

### 8. Onboarding
- 3-step flow: Welcome → Personalize → Ready
- Skippable and re-accessible

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| /api/chat/send | POST | Main agent loop with dual-model routing |
| /api/soul | GET/PUT | SOUL document CRUD |
| /api/memory/facts | GET/POST/DELETE | Semantic fact management |
| /api/memory/forget | POST | Forget topic |
| /api/conversations | GET/DELETE | Conversation history |
| /api/tools | GET | Tool registry |
| /api/tools/custom | POST/DELETE | Custom tool management |
| /api/files | GET/POST | List/create files |
| /api/files/:id | GET/PUT/DELETE | Read/update/delete file |
| /api/keywords | GET/PUT | Action keywords |
| /api/models | GET | Model listing |
| /api/models/download | POST | Start model download |
| /api/settings | GET/PUT | App settings |
| /api/data | DELETE | Wipe all data |

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, TypeScript, expo-router
- **Backend**: FastAPI, Motor (async MongoDB), emergentintegrations
- **Database**: MongoDB
- **LLM**: OpenAI GPT-4.1-mini via Emergent Universal Key

## MOCKED Components
- On-device LiteRT-LM inference → Cloud LLM via backend
- Android Intent tool execution → Simulated results
- HuggingFace model downloads → Simulated progress

## Future Enhancements
- Actual on-device inference with LiteRT-LM when Expo support available
- Voice input/output (TTS/STT)
- Vector embedding memory retrieval
- Cloud LLM hybrid routing
- Multi-agent orchestration
- **Revenue opportunity**: Premium model marketplace for specialized agent personalities/skills

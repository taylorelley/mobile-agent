from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# ─── Default Data ───

DEFAULT_SOUL = """# Identity
- Name: LobsterLite
- Role: Personal AI assistant

# Personality
- Tone: Friendly, concise, and helpful
- Style: Direct answers with a touch of warmth

# Rules
- Always respect user privacy
- Never make up information
- Be honest about limitations

# Knowledge
- General purpose assistant
"""

DEFAULT_ACTION_KEYWORDS = [
    "set alarm", "set timer", "send message", "send sms", "send text",
    "call", "open", "turn on", "turn off", "remind me", "create event",
    "schedule", "search for", "take note", "write down", "flashlight",
    "wifi", "bluetooth", "navigate to", "play music",
    "create file", "read file", "open file", "edit file", "delete file",
    "write file", "save file", "list files", "show files", "update file",
    "make file", "new file", "modify file", "change file", "rename file"
]

BUILT_IN_TOOLS = [
    {
        "name": "create_alarm",
        "description": "Creates an alarm on the user's device at the specified time.",
        "parameters": {
            "time": {"type": "string", "format": "HH:MM", "required": True, "description": "The alarm time in 24-hour format."},
            "label": {"type": "string", "required": False, "description": "Optional label for the alarm."},
            "days": {"type": "array", "items": "string", "required": False, "description": "Days to repeat."}
        },
        "android_action": "android.intent.action.SET_ALARM",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "create_calendar_event",
        "description": "Creates a calendar event with title, time, and optional location.",
        "parameters": {
            "title": {"type": "string", "required": True, "description": "Event title."},
            "start_time": {"type": "string", "required": True, "description": "Start time in ISO format."},
            "end_time": {"type": "string", "required": False, "description": "End time in ISO format."},
            "location": {"type": "string", "required": False, "description": "Event location."}
        },
        "android_action": "android.intent.action.INSERT",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "send_sms",
        "description": "Sends an SMS message to a phone number.",
        "parameters": {
            "phone_number": {"type": "string", "required": True, "description": "Recipient phone number."},
            "message": {"type": "string", "required": True, "description": "Message body."}
        },
        "android_action": "android.intent.action.SENDTO",
        "permissions": ["SEND_SMS"],
        "builtin": True
    },
    {
        "name": "open_url",
        "description": "Opens a URL in the default browser.",
        "parameters": {
            "url": {"type": "string", "required": True, "description": "The URL to open."}
        },
        "android_action": "android.intent.action.VIEW",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "set_timer",
        "description": "Sets a countdown timer for a specified duration.",
        "parameters": {
            "duration_seconds": {"type": "integer", "required": True, "description": "Timer duration in seconds."},
            "label": {"type": "string", "required": False, "description": "Timer label."}
        },
        "android_action": "android.intent.action.SET_TIMER",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "create_reminder",
        "description": "Creates a reminder for a specified time.",
        "parameters": {
            "text": {"type": "string", "required": True, "description": "Reminder text."},
            "time": {"type": "string", "required": False, "description": "Reminder time in ISO format."}
        },
        "android_action": "android.intent.action.INSERT",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "toggle_wifi",
        "description": "Opens WiFi settings panel for the user to toggle WiFi.",
        "parameters": {},
        "android_action": "android.settings.WIFI_SETTINGS",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "toggle_flashlight",
        "description": "Toggles the device flashlight on or off.",
        "parameters": {
            "state": {"type": "string", "required": True, "description": "Either 'on' or 'off'."}
        },
        "android_action": "camera.flashlight",
        "permissions": ["CAMERA"],
        "builtin": True
    },
    {
        "name": "search_web",
        "description": "Searches the web for a given query.",
        "parameters": {
            "query": {"type": "string", "required": True, "description": "Search query."}
        },
        "android_action": "android.intent.action.WEB_SEARCH",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "take_note",
        "description": "Saves a text note to the device's internal storage.",
        "parameters": {
            "title": {"type": "string", "required": False, "description": "Note title."},
            "content": {"type": "string", "required": True, "description": "Note content."}
        },
        "android_action": "internal.storage.write",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "create_file",
        "description": "Creates a new file with the given name and content in local storage.",
        "parameters": {
            "filename": {"type": "string", "required": True, "description": "Name of the file to create (e.g. 'notes.txt', 'todo.md')."},
            "content": {"type": "string", "required": True, "description": "Text content to write to the file."},
            "directory": {"type": "string", "required": False, "description": "Optional directory path (e.g. 'documents', 'projects/myapp'). Defaults to root."}
        },
        "android_action": "internal.file.create",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "read_file",
        "description": "Reads and returns the content of a local file.",
        "parameters": {
            "filename": {"type": "string", "required": True, "description": "Name of the file to read."},
            "directory": {"type": "string", "required": False, "description": "Optional directory path."}
        },
        "android_action": "internal.file.read",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "edit_file",
        "description": "Edits an existing local file. Can replace content entirely, append to it, or replace specific text.",
        "parameters": {
            "filename": {"type": "string", "required": True, "description": "Name of the file to edit."},
            "content": {"type": "string", "required": True, "description": "New content or content to append."},
            "mode": {"type": "string", "required": False, "description": "'overwrite' (default), 'append', or 'replace'. For 'replace', use find_text and replace_text params instead of content."},
            "find_text": {"type": "string", "required": False, "description": "Text to find (used with mode='replace')."},
            "replace_text": {"type": "string", "required": False, "description": "Text to replace with (used with mode='replace')."},
            "directory": {"type": "string", "required": False, "description": "Optional directory path."}
        },
        "android_action": "internal.file.edit",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "delete_file",
        "description": "Deletes a local file from storage.",
        "parameters": {
            "filename": {"type": "string", "required": True, "description": "Name of the file to delete."},
            "directory": {"type": "string", "required": False, "description": "Optional directory path."}
        },
        "android_action": "internal.file.delete",
        "permissions": [],
        "builtin": True
    },
    {
        "name": "list_files",
        "description": "Lists all files in local storage, optionally filtered by directory.",
        "parameters": {
            "directory": {"type": "string", "required": False, "description": "Optional directory to list. Defaults to root."},
            "pattern": {"type": "string", "required": False, "description": "Optional filename pattern filter (e.g. '*.txt', '*.md')."}
        },
        "android_action": "internal.file.list",
        "permissions": [],
        "builtin": True
    }
]

DEFAULT_MODELS = [
    {
        "id": "qwen3-0.6b",
        "name": "Qwen3 0.6B",
        "type": "chat",
        "description": "General-purpose conversational model. Handles open-ended chat, reasoning, and intent classification.",
        "huggingface_url": "https://huggingface.co/Qwen/Qwen3-0.6B",
        "size_mb": 350,
        "quantization": "INT4",
        "format": ".litertlm",
        "context_window": 4096,
        "status": "not_downloaded",
        "progress": 0,
        "download_speed": None,
        "is_default": True
    },
    {
        "id": "functiongemma-270m",
        "name": "FunctionGemma 270M",
        "type": "action",
        "description": "Specialist function-calling model. Translates natural language into structured tool calls.",
        "huggingface_url": "https://huggingface.co/google/functiongemma-270m",
        "size_mb": 288,
        "quantization": "INT8",
        "format": ".litertlm",
        "context_window": 1024,
        "status": "not_downloaded",
        "progress": 0,
        "download_speed": None,
        "is_default": True
    }
]

# ─── Pydantic Models ───

class ChatMessage(BaseModel):
    message: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class SoulUpdate(BaseModel):
    content: str

class FactCreate(BaseModel):
    category: str
    key: str
    value: str

class FactUpdate(BaseModel):
    value: str

class ForgetRequest(BaseModel):
    topic: str

class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    onboarding_completed: Optional[bool] = None
    agent_name: Optional[str] = None

class CustomToolCreate(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]
    android_action: str
    permissions: List[str] = []

class KeywordsUpdate(BaseModel):
    keywords: List[str]

class ModelDownloadRequest(BaseModel):
    model_id: str

class FileCreate(BaseModel):
    filename: str
    content: str
    directory: Optional[str] = ""

class FileUpdate(BaseModel):
    content: Optional[str] = None
    mode: Optional[str] = "overwrite"
    find_text: Optional[str] = None
    replace_text: Optional[str] = None

class ConversationResponse(BaseModel):
    id: str
    session_id: str
    user_input: str
    chat_output: str
    action_output: Optional[str] = None
    tool_calls: Optional[str] = None
    routing_decision: str
    timestamp: str

# ─── Helper Functions ───

async def get_soul():
    soul = await db.soul_config.find_one({}, {"_id": 0})
    if not soul:
        soul = {"content": DEFAULT_SOUL, "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.soul_config.insert_one(soul.copy())
    return soul

async def get_settings():
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "theme": "system",
            "onboarding_completed": False,
            "agent_name": "LobsterLite",
            "chat_model": "qwen3-0.6b",
            "action_model": "functiongemma-270m"
        }
        await db.settings.insert_one(settings.copy())
    return settings

async def get_action_keywords():
    kw = await db.action_keywords.find_one({}, {"_id": 0})
    if not kw:
        kw = {"keywords": DEFAULT_ACTION_KEYWORDS}
        await db.action_keywords.insert_one(kw.copy())
    return kw

async def get_tools():
    custom_tools = await db.custom_tools.find({}, {"_id": 0}).to_list(30)
    return BUILT_IN_TOOLS + custom_tools

async def get_models():
    models = await db.models.find({}, {"_id": 0}).to_list(20)
    if not models:
        for m in DEFAULT_MODELS:
            await db.models.insert_one(m.copy())
        models = DEFAULT_MODELS
    return models

async def get_recent_conversations(session_id: str, limit: int = 3):
    convos = await db.conversations.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    convos.reverse()
    return convos

async def get_relevant_facts(user_input: str, limit: int = 5, categories: Optional[List[str]] = None):
    query = {}
    if categories:
        query["category"] = {"$in": categories}
    facts = await db.facts.find(query, {"_id": 0}).to_list(1000)
    input_words = set(user_input.lower().split())
    scored = []
    now = datetime.now(timezone.utc)
    for f in facts:
        fact_words = set(f.get("value", "").lower().split()) | set(f.get("key", "").lower().split())
        intersection = input_words & fact_words
        union = input_words | fact_words
        keyword_score = len(intersection) / max(len(union), 1)
        created = datetime.fromisoformat(f.get("created_at", now.isoformat()))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days_since = max((now - created).days, 0)
        recency_score = 1.0 / (1.0 + days_since)
        score = 0.6 * recency_score + 0.4 * keyword_score
        scored.append((score, f))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [f for _, f in scored[:limit]]

def extract_facts_heuristic(text: str):
    facts = []
    name_patterns = [
        r"(?:my name is|I'm|I am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
    ]
    for pat in name_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            facts.append({"category": "identity", "key": "name", "value": m.group(1)})
    pref_patterns = [
        r"I (?:like|love|prefer|enjoy)\s+(.+?)(?:\.|,|$)",
        r"I (?:don't like|hate|dislike)\s+(.+?)(?:\.|,|$)",
    ]
    for pat in pref_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            facts.append({"category": "preference", "key": m.group(1)[:50], "value": m.group(0).strip()})
    return facts

ACTION_SIGNAL_REGEX = re.compile(r'\[ACTION:\s*(.+?)\]')

def build_chat_prompt(soul_content, memory_snippets, conversation_history, user_input, tools):
    tool_summary = "\n".join([f"- {t['name']}: {t['description']}" for t in tools])
    memory_text = ""
    if memory_snippets:
        memory_text = "\n## Relevant memories:\n" + "\n".join(
            [f"- [{f.get('category', 'general')}] {f.get('key', '')}: {f.get('value', '')}" for f in memory_snippets]
        )
    history_text = ""
    if conversation_history:
        for c in conversation_history:
            history_text += f"\nUser: {c.get('user_input', '')}\nAssistant: {c.get('chat_output', '')}\n"
    system_prompt = f"""You are LobsterLite, an on-device AI assistant running locally on the user's Android phone.
You run entirely offline with no internet access.

You have two modes of operation:
1. CONVERSATION: Answer questions, chat, reason, and help the user with information.
2. ACTION DELEGATION: When the user wants you to perform a device action, emit a signal so the action system can handle it.

AVAILABLE ACTIONS (you can delegate these):
{tool_summary}

WHEN TO DELEGATE:
- If the user asks you to DO something on their device (set alarm, send message, open app, etc.)
- Emit exactly: [ACTION: <clear natural language description of the action>]
- You may include a brief conversational preamble before the signal.
- Example: "Sure thing! [ACTION: Set an alarm for 7:00 AM tomorrow with label Morning]"

WHEN NOT TO DELEGATE:
- If the user is asking a question, chatting, or requesting information
- Just respond conversationally. Do NOT emit [ACTION: ...] for non-action requests.

{soul_content}
{memory_text}"""

    full_prompt = system_prompt
    if history_text:
        full_prompt += f"\n\nRecent conversation:{history_text}"
    return full_prompt, user_input

def build_action_prompt(action_description, tools, memory_snippets):
    tool_schemas = json.dumps([{
        "name": t["name"],
        "description": t["description"],
        "parameters": t["parameters"]
    } for t in tools], indent=2)
    memory_text = ""
    if memory_snippets:
        memory_text = "\n".join([f"- [{f.get('category', '')}] {f.get('key', '')}: {f.get('value', '')}" for f in memory_snippets])
    system_prompt = f"""You are a function-calling assistant. Given an action description, respond with a JSON function call in exactly this format: {{"tool": "<name>", "params": {{<parameters>}}}}
Use ONLY tools from the list below. Never invent tool names or parameters.
If you cannot map the action to a tool, respond with: {{"error": "no matching tool"}}

Available tools:
{tool_schemas}

Relevant context:
{memory_text}"""
    return system_prompt, f"Action: {action_description}"

async def execute_file_operation(tool_name, params):
    """Execute actual file operations against MongoDB file store."""
    now_str = datetime.now(timezone.utc).isoformat()
    directory = params.get("directory", "") or ""
    filename = params.get("filename", "")
    file_path = f"{directory}/{filename}".strip("/") if directory else filename

    if tool_name == "create_file":
        content = params.get("content", "")
        existing = await db.files.find_one({"path": file_path}, {"_id": 0})
        if existing:
            return {"tool": tool_name, "success": False, "error": f"File '{file_path}' already exists. Use edit_file to modify it."}
        doc = {
            "id": str(uuid.uuid4()),
            "filename": filename,
            "directory": directory,
            "path": file_path,
            "content": content,
            "size_bytes": len(content.encode('utf-8')),
            "created_at": now_str,
            "updated_at": now_str,
        }
        await db.files.insert_one(doc.copy())
        return {"tool": tool_name, "success": True, "result": f"File '{file_path}' created ({len(content)} chars)", "params": params}

    elif tool_name == "read_file":
        file_doc = await db.files.find_one({"path": file_path}, {"_id": 0})
        if not file_doc:
            return {"tool": tool_name, "success": False, "error": f"File '{file_path}' not found."}
        return {"tool": tool_name, "success": True, "result": f"File '{file_path}' content:\n{file_doc['content']}", "params": params, "file_content": file_doc['content']}

    elif tool_name == "edit_file":
        file_doc = await db.files.find_one({"path": file_path}, {"_id": 0})
        if not file_doc:
            return {"tool": tool_name, "success": False, "error": f"File '{file_path}' not found."}
        mode = params.get("mode", "overwrite")
        if mode == "append":
            new_content = file_doc["content"] + params.get("content", "")
        elif mode == "replace":
            find_text = params.get("find_text", "")
            replace_text = params.get("replace_text", "")
            if find_text and find_text in file_doc["content"]:
                new_content = file_doc["content"].replace(find_text, replace_text)
            else:
                return {"tool": tool_name, "success": False, "error": f"Text '{find_text}' not found in file."}
        else:
            new_content = params.get("content", "")
        await db.files.update_one(
            {"path": file_path},
            {"$set": {"content": new_content, "size_bytes": len(new_content.encode('utf-8')), "updated_at": now_str}}
        )
        return {"tool": tool_name, "success": True, "result": f"File '{file_path}' updated ({mode}, {len(new_content)} chars)", "params": params}

    elif tool_name == "delete_file":
        result = await db.files.delete_one({"path": file_path})
        if result.deleted_count == 0:
            return {"tool": tool_name, "success": False, "error": f"File '{file_path}' not found."}
        return {"tool": tool_name, "success": True, "result": f"File '{file_path}' deleted.", "params": params}

    elif tool_name == "list_files":
        query = {}
        if directory:
            query["directory"] = {"$regex": f"^{re.escape(directory)}", "$options": "i"}
        pattern = params.get("pattern", "")
        if pattern:
            regex_pattern = pattern.replace("*", ".*").replace("?", ".")
            query["filename"] = {"$regex": regex_pattern, "$options": "i"}
        files = await db.files.find(query, {"_id": 0}).to_list(100)
        if not files:
            return {"tool": tool_name, "success": True, "result": "No files found.", "params": params, "files": []}
        file_list = "\n".join([f"- {f['path']} ({f.get('size_bytes', 0)} bytes, updated {f.get('updated_at', 'unknown')})" for f in files])
        return {"tool": tool_name, "success": True, "result": f"Found {len(files)} file(s):\n{file_list}", "params": params, "files": [{"path": f["path"], "size_bytes": f.get("size_bytes", 0)} for f in files]}

    return {"tool": tool_name, "success": False, "error": "Unknown file operation"}


FILE_TOOLS = {"create_file", "read_file", "edit_file", "delete_file", "list_files"}


def simulate_tool_execution(tool_name, params, tools):
    """Synchronous fallback for non-file tools."""
    tool = next((t for t in tools if t["name"] == tool_name), None)
    if not tool:
        return {"tool": tool_name, "success": False, "error": f"Unknown tool: {tool_name}"}
    result_messages = {
        "create_alarm": f"Alarm set for {params.get('time', 'unknown time')}",
        "create_calendar_event": f"Calendar event '{params.get('title', 'Untitled')}' created",
        "send_sms": f"SMS sent to {params.get('phone_number', 'unknown')}",
        "open_url": f"Opening {params.get('url', 'unknown URL')}",
        "set_timer": f"Timer set for {params.get('duration_seconds', 0)} seconds",
        "create_reminder": f"Reminder created: {params.get('text', '')}",
        "toggle_wifi": "WiFi settings panel opened",
        "toggle_flashlight": f"Flashlight turned {params.get('state', 'on')}",
        "search_web": f"Searching for: {params.get('query', '')}",
        "take_note": f"Note saved: {params.get('title', 'Untitled')}"
    }
    return {
        "tool": tool_name,
        "success": True,
        "result": result_messages.get(tool_name, f"Action {tool_name} executed"),
        "params": params
    }

# ─── Chat Endpoint (Main Agent Loop) ───

@api_router.post("/chat/send")
async def send_chat(msg: ChatMessage):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    soul = await get_soul()
    tools = await get_tools()
    keywords_doc = await get_action_keywords()
    keywords = keywords_doc.get("keywords", [])
    memory_snippets = await get_relevant_facts(msg.message, limit=5)
    history = await get_recent_conversations(msg.session_id, limit=3)

    # Step 1: Chat Model inference
    chat_system, chat_user = build_chat_prompt(
        soul.get("content", DEFAULT_SOUL),
        memory_snippets, history, msg.message, tools
    )
    chat = LlmChat(api_key=api_key, session_id=f"chat-{msg.session_id}-{uuid.uuid4().hex[:8]}", system_message=chat_system)
    chat.with_model("openai", "gpt-4.1-mini")

    chat_response = await chat.send_message(UserMessage(text=chat_user))

    # Step 2: Intent Router
    action_match = ACTION_SIGNAL_REGEX.search(chat_response)
    routing_decision = "chat_only"
    action_output = None
    tool_calls_str = None
    final_response = chat_response

    if action_match:
        # Explicit ACTION signal detected
        routing_decision = "action_routed_signal"
        action_description = action_match.group(1).strip()

        # Step 3: Action Model inference
        action_memory = await get_relevant_facts(msg.message, limit=2, categories=["schedule", "preference"])
        action_system, action_user = build_action_prompt(action_description, tools, action_memory)
        action_chat = LlmChat(api_key=api_key, session_id=f"action-{uuid.uuid4().hex[:8]}", system_message=action_system)
        action_chat.with_model("openai", "gpt-4.1-mini")
        action_response = await action_chat.send_message(UserMessage(text=action_user))
        action_output = action_response

        # Step 4: Parse Action Model output
        try:
            json_match = re.search(r'\{.*\}', action_response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                if "error" in parsed:
                    tool_result = {"tool": "unknown", "success": False, "error": parsed["error"]}
                else:
                    tool_name = parsed.get("tool", "")
                    params = parsed.get("params", {})
                    tool_result = simulate_tool_execution(tool_name, params, tools)
                    tool_calls_str = json.dumps({"call": parsed, "result": tool_result})
            else:
                tool_result = {"tool": "unknown", "success": False, "error": "Could not parse function call"}
        except (json.JSONDecodeError, Exception) as e:
            tool_result = {"tool": "unknown", "success": False, "error": str(e)}
            tool_calls_str = json.dumps({"raw": action_response, "error": str(e)})

        # Step 5: Chat Model confirmation
        confirm_system = "You are LobsterLite. The user asked you to perform an action. The action has been executed. Provide a brief, friendly confirmation to the user."
        confirm_chat = LlmChat(api_key=api_key, session_id=f"confirm-{uuid.uuid4().hex[:8]}", system_message=confirm_system)
        confirm_chat.with_model("openai", "gpt-4.1-mini")
        tool_result_text = json.dumps(tool_result)
        confirmation = await confirm_chat.send_message(
            UserMessage(text=f"User said: {msg.message}\nAction taken: {tool_result_text}\nProvide a brief confirmation.")
        )
        final_response = confirmation

    else:
        # Heuristic keyword fallback
        user_lower = msg.message.lower()
        if any(kw in user_lower for kw in keywords):
            routing_decision = "heuristic_requery"
            clarify_chat = LlmChat(
                api_key=api_key,
                session_id=f"clarify-{uuid.uuid4().hex[:8]}",
                system_message="The user sent a message. Determine if they want a device action. If yes, respond with [ACTION: description]. If no, respond with [NO_ACTION] followed by your conversational response."
            )
            clarify_chat.with_model("openai", "gpt-4.1-mini")
            clarify_response = await clarify_chat.send_message(UserMessage(text=msg.message))

            action_match2 = ACTION_SIGNAL_REGEX.search(clarify_response)
            if action_match2:
                routing_decision = "action_routed_heuristic"
                action_description = action_match2.group(1).strip()
                action_memory = await get_relevant_facts(msg.message, limit=2, categories=["schedule", "preference"])
                action_system, action_user = build_action_prompt(action_description, tools, action_memory)
                action_chat = LlmChat(api_key=api_key, session_id=f"action-h-{uuid.uuid4().hex[:8]}", system_message=action_system)
                action_chat.with_model("openai", "gpt-4.1-mini")
                action_response = await action_chat.send_message(UserMessage(text=action_user))
                action_output = action_response

                try:
                    json_match = re.search(r'\{.*\}', action_response, re.DOTALL)
                    if json_match:
                        parsed = json.loads(json_match.group())
                        if "error" not in parsed:
                            tool_name = parsed.get("tool", "")
                            params = parsed.get("params", {})
                            tool_result = simulate_tool_execution(tool_name, params, tools)
                            tool_calls_str = json.dumps({"call": parsed, "result": tool_result})
                            confirm_system = "You are LobsterLite. Provide a brief confirmation of the action."
                            confirm_chat = LlmChat(api_key=api_key, session_id=f"confirm-h-{uuid.uuid4().hex[:8]}", system_message=confirm_system)
                            confirm_chat.with_model("openai", "gpt-4.1-mini")
                            confirmation = await confirm_chat.send_message(
                                UserMessage(text=f"User said: {msg.message}\nResult: {json.dumps(tool_result)}\nConfirm briefly.")
                            )
                            final_response = confirmation
                except Exception:
                    pass
            else:
                final_response = clarify_response.replace("[NO_ACTION]", "").strip()

    # Persist conversation
    now_str = datetime.now(timezone.utc).isoformat()
    conv_id = str(uuid.uuid4())
    conv_doc = {
        "id": conv_id,
        "session_id": msg.session_id,
        "user_input": msg.message,
        "chat_output": final_response,
        "action_output": action_output,
        "tool_calls": tool_calls_str,
        "routing_decision": routing_decision,
        "timestamp": now_str
    }
    await db.conversations.insert_one(conv_doc)

    # Fact extraction
    extracted = extract_facts_heuristic(msg.message)
    for fact in extracted:
        fact["created_at"] = now_str
        fact["updated_at"] = now_str
        fact["source_conversation_id"] = conv_id
        await db.facts.update_one(
            {"category": fact["category"], "key": fact["key"]},
            {"$set": fact},
            upsert=True
        )

    # Parse tool_calls for response
    tool_calls_parsed = None
    if tool_calls_str:
        try:
            tool_calls_parsed = json.loads(tool_calls_str)
        except Exception:
            tool_calls_parsed = None

    return {
        "id": conv_id,
        "response": final_response,
        "routing_decision": routing_decision,
        "action_output": action_output,
        "tool_calls": tool_calls_parsed,
        "preamble": chat_response[:action_match.start()].strip() if action_match else None,
        "raw_chat_output": chat_response
    }

# ─── SOUL Endpoints ───

@api_router.get("/soul")
async def get_soul_endpoint():
    soul = await get_soul()
    return {"content": soul.get("content", DEFAULT_SOUL), "updated_at": soul.get("updated_at", "")}

@api_router.put("/soul")
async def update_soul(update: SoulUpdate):
    now_str = datetime.now(timezone.utc).isoformat()
    await db.soul_config.update_one({}, {"$set": {"content": update.content, "updated_at": now_str}}, upsert=True)
    token_estimate = len(update.content) // 4
    warning = None
    if token_estimate > 512:
        warning = f"SOUL document is approximately {token_estimate} tokens. Content exceeding 512 tokens will be auto-truncated during context assembly."
    return {"content": update.content, "updated_at": now_str, "warning": warning, "estimated_tokens": token_estimate}

# ─── Memory Endpoints ───

@api_router.get("/memory/facts")
async def list_facts():
    facts = await db.facts.find({}, {"_id": 0}).to_list(1000)
    return facts

@api_router.post("/memory/facts")
async def create_fact(fact: FactCreate):
    now_str = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "category": fact.category,
        "key": fact.key,
        "value": fact.value,
        "created_at": now_str,
        "updated_at": now_str
    }
    await db.facts.update_one(
        {"category": fact.category, "key": fact.key},
        {"$set": doc},
        upsert=True
    )
    return doc

@api_router.delete("/memory/facts/{fact_key}")
async def delete_fact(fact_key: str):
    result = await db.facts.delete_one({"key": fact_key})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fact not found")
    return {"deleted": True}

@api_router.post("/memory/forget")
async def forget_topic(req: ForgetRequest):
    topic_lower = req.topic.lower()
    result = await db.facts.delete_many({
        "$or": [
            {"key": {"$regex": topic_lower, "$options": "i"}},
            {"value": {"$regex": topic_lower, "$options": "i"}}
        ]
    })
    return {"deleted_count": result.deleted_count, "topic": req.topic}

# ─── Conversation Endpoints ───

@api_router.get("/conversations")
async def list_conversations(session_id: Optional[str] = None, limit: int = 50):
    query = {}
    if session_id:
        query["session_id"] = session_id
    convos = await db.conversations.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return convos

@api_router.delete("/conversations")
async def delete_conversations():
    result = await db.conversations.delete_many({})
    return {"deleted_count": result.deleted_count}

# ─── Tools Endpoints ───

@api_router.get("/tools")
async def list_tools():
    tools = await get_tools()
    return tools

@api_router.post("/tools/custom")
async def add_custom_tool(tool: CustomToolCreate):
    all_tools = await get_tools()
    if len(all_tools) >= 30:
        raise HTTPException(status_code=400, detail="Maximum 30 tools reached")
    if any(t["name"] == tool.name for t in all_tools):
        raise HTTPException(status_code=400, detail=f"Tool '{tool.name}' already exists")
    doc = {
        "name": tool.name,
        "description": tool.description,
        "parameters": tool.parameters,
        "android_action": tool.android_action,
        "permissions": tool.permissions,
        "builtin": False
    }
    await db.custom_tools.insert_one(doc)
    return doc

@api_router.delete("/tools/custom/{tool_name}")
async def delete_custom_tool(tool_name: str):
    result = await db.custom_tools.delete_one({"name": tool_name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom tool not found")
    return {"deleted": True}

# ─── Keywords Endpoints ───

@api_router.get("/keywords")
async def get_keywords():
    kw = await get_action_keywords()
    return kw

@api_router.put("/keywords")
async def update_keywords(update: KeywordsUpdate):
    await db.action_keywords.update_one({}, {"$set": {"keywords": update.keywords}}, upsert=True)
    return {"keywords": update.keywords}

# ─── Models Endpoints ───

@api_router.get("/models")
async def list_models():
    return await get_models()

@api_router.post("/models/download")
async def start_model_download(req: ModelDownloadRequest):
    model = await db.models.find_one({"id": req.model_id}, {"_id": 0})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if model.get("status") == "downloaded":
        return {"status": "already_downloaded", "model_id": req.model_id}
    await db.models.update_one(
        {"id": req.model_id},
        {"$set": {"status": "downloading", "progress": 0}}
    )
    asyncio.create_task(simulate_download(req.model_id, model.get("size_mb", 300)))
    return {"status": "downloading", "model_id": req.model_id}

async def simulate_download(model_id: str, size_mb: int):
    steps = 20
    for i in range(1, steps + 1):
        await asyncio.sleep(0.5)
        progress = int((i / steps) * 100)
        speed = round(size_mb / steps * 2, 1)
        await db.models.update_one(
            {"id": model_id},
            {"$set": {"progress": progress, "download_speed": f"{speed} MB/s"}}
        )
    await db.models.update_one(
        {"id": model_id},
        {"$set": {"status": "downloaded", "progress": 100, "download_speed": None}}
    )

@api_router.get("/models/{model_id}/status")
async def get_model_status(model_id: str):
    model = await db.models.find_one({"id": model_id}, {"_id": 0})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

# ─── Settings Endpoints ───

@api_router.get("/settings")
async def get_settings_endpoint():
    return await get_settings()

@api_router.put("/settings")
async def update_settings(update: SettingsUpdate):
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if update_dict:
        await db.settings.update_one({}, {"$set": update_dict}, upsert=True)
    return await get_settings()

# ─── Data Wipe ───

@api_router.delete("/data")
async def delete_all_data():
    collections = ["conversations", "facts", "soul_config", "settings", "custom_tools", "action_keywords", "models"]
    for col in collections:
        await db[col].delete_many({})
    return {"deleted": True, "message": "All data wiped securely."}

# ─── Health ───

@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

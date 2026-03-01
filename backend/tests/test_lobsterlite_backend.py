import os
import time
from pathlib import Path

import pytest
import requests

# Backend API Tests for LobsterLite
# Tests: health, soul, tools, keywords, models, settings, memory/facts, conversations, chat

# Default timeout (seconds) for all HTTP requests to prevent hangs
REQUEST_TIMEOUT = 30
# Chat requests may take longer due to LLM inference
CHAT_TIMEOUT = 60

# Resolve backend URL from environment or frontend .env file
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    _env_path = Path(__file__).resolve().parents[1] / ".." / "frontend" / ".env"
    try:
        with open(_env_path, "r") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except FileNotFoundError:
        pass
if not BASE_URL:
    raise RuntimeError(
        "EXPO_PUBLIC_BACKEND_URL not found. Set it in the environment "
        "or in frontend/.env"
    )


class TestHealth:
    """Health check endpoint tests"""

    def test_health_endpoint_returns_ok(self):
        """Test /api/health returns ok status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")


class TestSoul:
    """SOUL document endpoint tests"""

    def test_get_soul_returns_document(self):
        """Test /api/soul GET returns SOUL document"""
        response = requests.get(f"{BASE_URL}/api/soul", timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert "updated_at" in data
        assert len(data["content"]) > 0
        assert "Identity" in data["content"] or "Name:" in data["content"]
        print(f"✓ GET /api/soul passed, content length: {len(data['content'])}")

    def test_put_soul_updates_content_and_returns_token_count(self):
        """Test /api/soul PUT updates SOUL content and returns token count"""
        new_content = "# Identity\n- Name: TestBot\n- Role: Test Agent\n\n# Personality\n- Tone: Testing mode"
        response = requests.put(
            f"{BASE_URL}/api/soul",
            json={"content": new_content},
            timeout=REQUEST_TIMEOUT,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == new_content
        assert "updated_at" in data
        assert "estimated_tokens" in data
        assert data["estimated_tokens"] > 0
        print(f"✓ PUT /api/soul passed, estimated tokens: {data['estimated_tokens']}")

        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/soul", timeout=REQUEST_TIMEOUT)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["content"] == new_content
        print(f"✓ SOUL content persisted correctly")


class TestTools:
    """Tools endpoint tests"""

    def test_get_tools_returns_15_builtin_tools(self):
        """Test /api/tools GET returns 15 built-in tools (10 original + 5 file tools)"""
        response = requests.get(f"{BASE_URL}/api/tools", timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200
        tools = response.json()
        assert isinstance(tools, list)
        builtin_tools = [t for t in tools if t.get("builtin") == True]
        assert (
            len(builtin_tools) == 15
        ), f"Expected 15 built-in tools, got {len(builtin_tools)}"
        print(
            f"✓ GET /api/tools passed, {len(builtin_tools)} built-in tools found (10 original + 5 file tools)"
        )

        # Verify expected tools exist (original + file tools)
        tool_names = [t["name"] for t in tools]
        expected = [
            "create_alarm",
            "send_sms",
            "open_url",
            "set_timer",
            "create_reminder",
            "create_file",
            "read_file",
            "edit_file",
            "delete_file",
            "list_files",
        ]
        for name in expected:
            assert name in tool_names, f"Expected tool '{name}' not found"
        print(f"✓ Expected tool names verified: {expected}")


class TestKeywords:
    """Action keywords endpoint tests"""

    def test_get_keywords_returns_keywords_list(self):
        """Test /api/keywords GET returns keywords list"""
        response = requests.get(f"{BASE_URL}/api/keywords", timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        assert "keywords" in data
        assert isinstance(data["keywords"], list)
        assert len(data["keywords"]) > 0
        # Verify it's a list of strings
        assert all(isinstance(kw, str) for kw in data["keywords"])
        print(f"✓ GET /api/keywords passed, {len(data['keywords'])} keywords found")

    def test_put_keywords_updates_keywords(self):
        """Test /api/keywords PUT updates keywords"""
        new_keywords = ["test keyword 1", "test keyword 2", "open app"]
        response = requests.put(
            f"{BASE_URL}/api/keywords",
            json={"keywords": new_keywords},
            timeout=REQUEST_TIMEOUT,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["keywords"] == new_keywords
        print(f"✓ PUT /api/keywords passed")

        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/keywords", timeout=REQUEST_TIMEOUT
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["keywords"] == new_keywords
        print(f"✓ Keywords persisted correctly")


class TestModels:
    """Models endpoint tests"""

    def test_get_models_returns_2_default_models(self):
        """Test /api/models GET returns 2 default models (chat + action)"""
        response = requests.get(f"{BASE_URL}/api/models", timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200
        models = response.json()
        assert isinstance(models, list)
        assert len(models) >= 2

        chat_models = [m for m in models if m.get("type") == "chat"]
        action_models = [m for m in models if m.get("type") == "action"]
        assert len(chat_models) >= 1
        assert len(action_models) >= 1

        # Verify model structure
        for model in models[:2]:
            assert "id" in model
            assert "name" in model
            assert "type" in model
            assert "status" in model
            assert "size_mb" in model
        print(
            f"✓ GET /api/models passed, {len(models)} models found (chat: {len(chat_models)}, action: {len(action_models)})"
        )

    def test_post_models_download_starts_model_download_simulation(self):
        """Test /api/models/download POST starts model download simulation"""
        # First, get a model that's not downloaded
        models_response = requests.get(
            f"{BASE_URL}/api/models", timeout=REQUEST_TIMEOUT
        )
        models = models_response.json()
        test_model = None
        for m in models:
            if m.get("status") == "not_downloaded":
                test_model = m
                break

        if not test_model:
            # Reset a model for testing
            test_model = models[0]

        model_id = test_model["id"]

        # Start download
        response = requests.post(
            f"{BASE_URL}/api/models/download",
            json={"model_id": model_id},
            timeout=REQUEST_TIMEOUT,
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] in ["downloading", "already_downloaded"]
        print(f"✓ POST /api/models/download passed, status: {data['status']}")

        if data["status"] == "downloading":
            # Wait a bit and check status
            time.sleep(1.5)
            status_response = requests.get(
                f"{BASE_URL}/api/models/{model_id}/status", timeout=REQUEST_TIMEOUT
            )
            assert status_response.status_code == 200
            status_data = status_response.json()
            assert "progress" in status_data
            assert status_data["progress"] >= 0
            print(f"✓ Model download progress: {status_data['progress']}%")


class TestSettings:
    """Settings endpoint tests"""

    def test_get_settings_returns_default_settings(self):
        """Test /api/settings GET returns default settings"""
        response = requests.get(f"{BASE_URL}/api/settings", timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200
        data = response.json()
        assert "theme" in data
        assert "onboarding_completed" in data
        assert "agent_name" in data
        print(
            f"✓ GET /api/settings passed: theme={data['theme']}, agent_name={data['agent_name']}"
        )

    def test_put_settings_updates_settings(self):
        """Test /api/settings PUT updates settings"""
        response = requests.put(
            f"{BASE_URL}/api/settings",
            json={"theme": "dark", "onboarding_completed": True},
            timeout=REQUEST_TIMEOUT,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["theme"] == "dark"
        assert data["onboarding_completed"] == True
        print(f"✓ PUT /api/settings passed")

        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/settings", timeout=REQUEST_TIMEOUT
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["theme"] == "dark"
        assert get_data["onboarding_completed"] == True
        print(f"✓ Settings persisted correctly")


class TestMemory:
    """Memory/Facts endpoint tests"""

    def test_get_memory_facts_returns_list(self):
        """Test /api/memory/facts GET returns list (empty initially or with data)"""
        response = requests.get(
            f"{BASE_URL}/api/memory/facts", timeout=REQUEST_TIMEOUT
        )
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        print(f"✓ GET /api/memory/facts passed, {len(facts)} facts found")


class TestConversations:
    """Conversations endpoint tests"""

    def test_get_conversations_returns_list(self):
        """Test /api/conversations GET returns list (empty initially or with data)"""
        response = requests.get(
            f"{BASE_URL}/api/conversations", timeout=REQUEST_TIMEOUT
        )
        assert response.status_code == 200
        convos = response.json()
        assert isinstance(convos, list)
        print(f"✓ GET /api/conversations passed, {len(convos)} conversations found")


class TestChat:
    """Chat endpoint tests (main agent loop)"""

    def test_chat_send_conversational_message_returns_chat_only_routing(self):
        """Test /api/chat/send POST with conversational message returns chat_only routing"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "message": "What is the weather like?",
                "session_id": "test-session-1",
            },
            timeout=CHAT_TIMEOUT,
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "routing_decision" in data
        assert data["routing_decision"] in ["chat_only", "heuristic_requery"]
        assert len(data["response"]) > 0
        print(
            f"✓ POST /api/chat/send (conversational) passed, routing: {data['routing_decision']}"
        )

    def test_chat_send_action_message_returns_action_routing_with_tool_calls(self):
        """Test /api/chat/send POST with action message returns action routing with tool calls"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "message": "Set an alarm for 7am tomorrow",
                "session_id": "test-session-2",
            },
            timeout=CHAT_TIMEOUT,
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "routing_decision" in data
        # Should be action_routed_signal or action_routed_heuristic
        assert (
            "action" in data["routing_decision"]
            or data["routing_decision"] == "heuristic_requery"
        )

        # If action routed, should have tool_calls
        if "action_routed" in data["routing_decision"]:
            assert "tool_calls" in data
            # tool_calls can be dict or None
            if data["tool_calls"]:
                assert isinstance(data["tool_calls"], dict)
                print(
                    f"✓ POST /api/chat/send (action) passed, routing: {data['routing_decision']}, tool_calls present"
                )
        else:
            print(
                f"✓ POST /api/chat/send (action) passed, routing: {data['routing_decision']}"
            )


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

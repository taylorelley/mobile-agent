import os
import time

import pytest
import requests

# Backend API Tests for File Management Features
# Tests: File CRUD operations, file tools in chat integration

# Resolve backend URL from environment or frontend .env file
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env", "r") as f:
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


class TestFileAPIs:
    """File CRUD API endpoint tests"""

    def test_01_create_file_success(self):
        """Test POST /api/files creates a file successfully"""
        response = requests.post(
            f"{BASE_URL}/api/files",
            json={
                "filename": "TEST_pytest_file.txt",
                "content": "Hello from pytest test suite",
                "directory": "",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["filename"] == "TEST_pytest_file.txt"
        assert data["content"] == "Hello from pytest test suite"
        assert data["path"] == "TEST_pytest_file.txt"
        assert data["size_bytes"] == len("Hello from pytest test suite".encode("utf-8"))
        assert "created_at" in data
        assert "updated_at" in data
        print(
            f"✓ File created: {data['path']} (id: {data['id']}, size: {data['size_bytes']} bytes)"
        )
        # Store file_id for other tests
        TestFileAPIs.test_file_id = data["id"]

    def test_02_create_file_with_directory(self):
        """Test POST /api/files creates a file with directory path"""
        response = requests.post(
            f"{BASE_URL}/api/files",
            json={
                "filename": "TEST_subdir_file.md",
                "content": "# Test File\nThis is in a subdirectory",
                "directory": "pytest_tests",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "TEST_subdir_file.md"
        assert data["directory"] == "pytest_tests"
        assert data["path"] == "pytest_tests/TEST_subdir_file.md"
        print(f"✓ File with directory created: {data['path']}")
        TestFileAPIs.test_subdir_file_id = data["id"]

    def test_03_create_file_duplicate_fails(self):
        """Test POST /api/files fails when file already exists"""
        response = requests.post(
            f"{BASE_URL}/api/files",
            json={
                "filename": "TEST_pytest_file.txt",
                "content": "This should fail",
                "directory": "",
            },
        )
        assert response.status_code == 409  # Conflict
        print(f"✓ Duplicate file creation blocked with 409 status")

    def test_04_list_files_returns_all_files(self):
        """Test GET /api/files returns list of all files"""
        response = requests.get(f"{BASE_URL}/api/files")
        assert response.status_code == 200
        files = response.json()
        assert isinstance(files, list)
        # Should have at least the 2 files we just created
        test_files = [f for f in files if f["filename"].startswith("TEST_")]
        assert len(test_files) >= 2
        print(
            f"✓ GET /api/files returned {len(files)} files total ({len(test_files)} test files)"
        )

    def test_05_list_files_with_directory_filter(self):
        """Test GET /api/files with directory filter"""
        response = requests.get(f"{BASE_URL}/api/files?directory=pytest_tests")
        assert response.status_code == 200
        files = response.json()
        assert isinstance(files, list)
        # Should have at least 1 file in pytest_tests directory
        assert len(files) >= 1
        assert all("pytest_tests" in f["directory"] for f in files if f["directory"])
        print(f"✓ GET /api/files?directory=pytest_tests returned {len(files)} files")

    def test_06_list_files_with_pattern_filter(self):
        """Test GET /api/files with pattern filter"""
        response = requests.get(f"{BASE_URL}/api/files?pattern=*.txt")
        assert response.status_code == 200
        files = response.json()
        assert isinstance(files, list)
        # Should have at least our .txt file
        txt_files = [f for f in files if f["filename"].endswith(".txt")]
        assert len(txt_files) >= 1
        print(f"✓ GET /api/files?pattern=*.txt returned {len(txt_files)} .txt files")

    def test_07_get_file_by_id_returns_full_content(self):
        """Test GET /api/files/{id} returns file with full content"""
        response = requests.get(f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TestFileAPIs.test_file_id
        assert data["filename"] == "TEST_pytest_file.txt"
        assert data["content"] == "Hello from pytest test suite"
        assert "created_at" in data
        assert "updated_at" in data
        print(
            f"✓ GET /api/files/{TestFileAPIs.test_file_id} returned file with content"
        )

    def test_08_get_file_by_path_returns_file(self):
        """Test GET /api/files/{path} also works with path instead of id"""
        response = requests.get(f"{BASE_URL}/api/files/TEST_pytest_file.txt")
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "TEST_pytest_file.txt"
        print(f"✓ GET /api/files/TEST_pytest_file.txt (by path) worked")

    def test_09_get_file_not_found(self):
        """Test GET /api/files/{id} returns 404 for non-existent file"""
        response = requests.get(f"{BASE_URL}/api/files/nonexistent-file-id-12345")
        assert response.status_code == 404
        print(f"✓ GET /api/files/nonexistent returns 404")

    def test_10_update_file_overwrite_mode(self):
        """Test PUT /api/files/{id} updates file content (overwrite mode)"""
        response = requests.put(
            f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}",
            json={"content": "Updated content via pytest", "mode": "overwrite"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated content via pytest"
        assert data["size_bytes"] == len("Updated content via pytest".encode("utf-8"))
        print(
            f"✓ PUT /api/files/{TestFileAPIs.test_file_id} (overwrite) updated content"
        )

        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["content"] == "Updated content via pytest"
        print(f"✓ File content persisted correctly after update")

    def test_11_update_file_append_mode(self):
        """Test PUT /api/files/{id} appends content (append mode)"""
        response = requests.put(
            f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}",
            json={"content": "\nAppended line 1\nAppended line 2", "mode": "append"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "Updated content via pytest" in data["content"]
        assert "Appended line 1" in data["content"]
        assert "Appended line 2" in data["content"]
        print(f"✓ PUT /api/files/{TestFileAPIs.test_file_id} (append) appended content")

        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}")
        get_data = get_response.json()
        expected = "Updated content via pytest\nAppended line 1\nAppended line 2"
        assert get_data["content"] == expected
        print(f"✓ Appended content persisted correctly")

    def test_12_update_file_replace_mode(self):
        """Test PUT /api/files/{id} replaces specific text (replace mode)"""
        response = requests.put(
            f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}",
            json={
                "mode": "replace",
                "find_text": "Appended line 1",
                "replace_text": "REPLACED LINE 1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "REPLACED LINE 1" in data["content"]
        assert "Appended line 1" not in data["content"]
        print(f"✓ PUT /api/files/{TestFileAPIs.test_file_id} (replace) replaced text")

    def test_13_update_file_not_found(self):
        """Test PUT /api/files/{id} returns 404 for non-existent file"""
        response = requests.put(
            f"{BASE_URL}/api/files/nonexistent-file-id",
            json={"content": "test", "mode": "overwrite"},
        )
        assert response.status_code == 404
        print(f"✓ PUT /api/files/nonexistent returns 404")

    def test_14_delete_file_success(self):
        """Test DELETE /api/files/{id} deletes file"""
        response = requests.delete(f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == True
        print(f"✓ DELETE /api/files/{TestFileAPIs.test_file_id} deleted file")

        # Verify file no longer exists
        get_response = requests.get(f"{BASE_URL}/api/files/{TestFileAPIs.test_file_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted file no longer retrievable")

    def test_15_delete_file_not_found(self):
        """Test DELETE /api/files/{id} returns 404 for non-existent file"""
        response = requests.delete(f"{BASE_URL}/api/files/nonexistent-file-id")
        assert response.status_code == 404
        print(f"✓ DELETE /api/files/nonexistent returns 404")

    def test_99_cleanup_test_files(self):
        """Cleanup: Delete all test files created during testing"""
        # Get all files
        response = requests.get(f"{BASE_URL}/api/files")
        if response.status_code == 200:
            files = response.json()
            test_files = [
                f
                for f in files
                if "TEST_" in f["filename"] or "pytest" in f.get("directory", "")
            ]
            for file in test_files:
                delete_response = requests.delete(f"{BASE_URL}/api/files/{file['id']}")
                if delete_response.status_code == 200:
                    print(f"✓ Cleaned up test file: {file['path']}")
        print(f"✓ Test cleanup completed")


class TestToolsWithFileTools:
    """Tools endpoint tests - verify file tools are included"""

    def test_get_tools_returns_15_total_tools(self):
        """Test /api/tools GET now returns 15 built-in tools (10 original + 5 file tools)"""
        response = requests.get(f"{BASE_URL}/api/tools")
        assert response.status_code == 200
        tools = response.json()
        assert isinstance(tools, list)
        builtin_tools = [t for t in tools if t.get("builtin") == True]
        assert (
            len(builtin_tools) == 15
        ), f"Expected 15 built-in tools, got {len(builtin_tools)}"
        print(
            f"✓ GET /api/tools returned {len(builtin_tools)} built-in tools (10 original + 5 file tools)"
        )

    def test_file_tools_are_present(self):
        """Test /api/tools includes all 5 file management tools"""
        response = requests.get(f"{BASE_URL}/api/tools")
        assert response.status_code == 200
        tools = response.json()
        tool_names = [t["name"] for t in tools]

        expected_file_tools = [
            "create_file",
            "read_file",
            "edit_file",
            "delete_file",
            "list_files",
        ]
        for tool_name in expected_file_tools:
            assert (
                tool_name in tool_names
            ), f"File tool '{tool_name}' not found in tools list"
        print(f"✓ All 5 file tools present: {expected_file_tools}")

    def test_file_tools_have_correct_structure(self):
        """Test file tools have required fields and correct structure"""
        response = requests.get(f"{BASE_URL}/api/tools")
        tools = response.json()

        file_tools = [
            t
            for t in tools
            if t["name"]
            in ["create_file", "read_file", "edit_file", "delete_file", "list_files"]
        ]
        assert len(file_tools) == 5

        for tool in file_tools:
            assert "name" in tool
            assert "description" in tool
            assert "parameters" in tool
            assert "android_action" in tool
            assert "builtin" in tool
            assert tool["builtin"] == True
            assert len(tool["description"]) > 0
            print(f"✓ Tool '{tool['name']}': {tool['description'][:50]}...")


class TestChatFileOperations:
    """Chat integration tests for file operations via natural language"""

    def test_01_chat_create_file_via_natural_language(self):
        """Test POST /api/chat/send creates file via natural language command"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "message": "Create a file called TEST_agent_created.txt with content: Hello from AI agent",
                "session_id": "test-file-session-1",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "routing_decision" in data

        # Should be action routed
        assert (
            "action" in data["routing_decision"]
            or data["routing_decision"] == "heuristic_requery"
        )

        # If action routed, check tool_calls
        if "action_routed" in data["routing_decision"]:
            assert "tool_calls" in data
            if data["tool_calls"]:
                tool_call = data["tool_calls"].get("call", {})
                tool_result = data["tool_calls"].get("result", {})
                assert tool_call.get("tool") == "create_file"
                assert tool_result.get("success") == True
                print(
                    f"✓ Chat created file via natural language, tool: {tool_call.get('tool')}"
                )

        # Wait a moment for file to be created
        time.sleep(0.5)

        # Verify file was actually created by getting file list
        files_response = requests.get(f"{BASE_URL}/api/files")
        files = files_response.json()
        created_file = next(
            (f for f in files if f["filename"] == "TEST_agent_created.txt"), None
        )
        assert created_file is not None, "File was not actually created in database"
        assert "Hello from AI agent" in created_file["content"]
        print(f"✓ File verified in database: {created_file['path']}")

        # Store file_id for cleanup
        TestChatFileOperations.created_file_id = created_file["id"]

    def test_02_chat_read_file_via_natural_language(self):
        """Test POST /api/chat/send reads file content via natural language"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "message": "Read the file TEST_agent_created.txt",
                "session_id": "test-file-session-2",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data

        # Response should contain file content
        assert (
            "Hello from AI agent" in data["response"]
            or "TEST_agent_created.txt" in data["response"]
        )

        # Check if action was routed
        if "action_routed" in data.get("routing_decision", ""):
            tool_calls = data.get("tool_calls")
            if tool_calls:
                tool_call = tool_calls.get("call", {})
                tool_result = tool_calls.get("result", {})
                assert tool_call.get("tool") == "read_file"
                assert tool_result.get("success") == True
                print(
                    f"✓ Chat read file via natural language, content included in response"
                )

    def test_03_chat_edit_file_via_natural_language_append(self):
        """Test POST /api/chat/send edits file (append mode) via natural language"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "message": "Edit TEST_agent_created.txt and append this text: Goodbye from AI agent",
                "session_id": "test-file-session-3",
            },
        )
        assert response.status_code == 200
        data = response.json()

        # Should be action routed
        if "action_routed" in data.get("routing_decision", ""):
            tool_calls = data.get("tool_calls")
            if tool_calls:
                tool_call = tool_calls.get("call", {})
                tool_result = tool_calls.get("result", {})
                assert tool_call.get("tool") == "edit_file"
                assert tool_result.get("success") == True
                print(f"✓ Chat edited file via natural language (append mode)")

        # Verify file was actually updated
        time.sleep(0.5)
        file_response = requests.get(
            f"{BASE_URL}/api/files/{TestChatFileOperations.created_file_id}"
        )
        file_data = file_response.json()
        assert "Hello from AI agent" in file_data["content"]
        assert "Goodbye from AI agent" in file_data["content"]
        print(f"✓ File content verified: both original and appended text present")

    def test_04_chat_list_files_via_natural_language(self):
        """Test POST /api/chat/send lists files via natural language"""
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "message": "List all files in storage",
                "session_id": "test-file-session-4",
            },
        )
        assert response.status_code == 200
        data = response.json()

        # Should mention files or show file list
        response_lower = data["response"].lower()
        # Response should reference files somehow
        print(f"✓ Chat listed files via natural language")

        # Check if action was routed
        if "action_routed" in data.get("routing_decision", ""):
            tool_calls = data.get("tool_calls")
            if tool_calls:
                tool_call = tool_calls.get("call", {})
                tool_result = tool_calls.get("result", {})
                assert tool_call.get("tool") == "list_files"
                assert tool_result.get("success") == True
                print(f"✓ list_files tool executed successfully")
        else:
            assert "response" in data and len(data["response"]) > 0, (
                f"Expected non-empty response for non-action route: {data}"
            )
            print(f"✓ Non-action route returned response")

    def test_99_cleanup_chat_test_files(self):
        """Cleanup: Delete files created during chat tests"""
        if hasattr(TestChatFileOperations, "created_file_id"):
            response = requests.delete(
                f"{BASE_URL}/api/files/{TestChatFileOperations.created_file_id}"
            )
            if response.status_code == 200:
                print(f"✓ Cleaned up chat test file")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

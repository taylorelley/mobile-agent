import os

import pytest
import requests

# Backend API Tests for File Manager Enhancements
# Tests: File rename, file search (by name and content), directory tree view

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


class TestFileRename:
    """File rename endpoint tests"""

    def test_01_setup_rename_test_file(self):
        """Setup: Create test file for rename tests"""
        response = requests.post(
            f"{BASE_URL}/api/files",
            json={
                "filename": "TEST_rename_me.txt",
                "content": "This file will be renamed",
                "directory": "",
            },
        )
        if response.status_code == 409:
            # File already exists, delete and recreate
            files_resp = requests.get(f"{BASE_URL}/api/files")
            files = files_resp.json()
            existing = next(
                (f for f in files if f["filename"] == "TEST_rename_me.txt"), None
            )
            if existing:
                requests.delete(f"{BASE_URL}/api/files/{existing['id']}")
            response = requests.post(
                f"{BASE_URL}/api/files",
                json={
                    "filename": "TEST_rename_me.txt",
                    "content": "This file will be renamed",
                    "directory": "",
                },
            )
        assert response.status_code == 200
        data = response.json()
        TestFileRename.test_file_id = data["id"]
        TestFileRename.original_filename = data["filename"]
        print(f"✓ Created test file: {data['path']} (id: {data['id']})")

    def test_02_rename_file_success(self):
        """Test PATCH /api/files/{id}/rename renames file successfully"""
        response = requests.patch(
            f"{BASE_URL}/api/files/{TestFileRename.test_file_id}/rename",
            json={"new_filename": "TEST_renamed_file.txt"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "TEST_renamed_file.txt"
        assert data["path"] == "TEST_renamed_file.txt"
        assert data["id"] == TestFileRename.test_file_id
        assert "updated_at" in data
        print(
            f"✓ File renamed: {TestFileRename.original_filename} → {data['filename']}"
        )

        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/files/{TestFileRename.test_file_id}"
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["filename"] == "TEST_renamed_file.txt"
        assert get_data["path"] == "TEST_renamed_file.txt"
        print(f"✓ Renamed file persisted correctly")

    def test_03_rename_file_updates_path_in_directory(self):
        """Test PATCH /api/files/{id}/rename updates path for file in directory"""
        # Create file in directory
        create_resp = requests.post(
            f"{BASE_URL}/api/files",
            json={
                "filename": "TEST_dir_rename.md",
                "content": "File in directory",
                "directory": "test_dir",
            },
        )
        if create_resp.status_code == 409:
            files_resp = requests.get(f"{BASE_URL}/api/files")
            files = files_resp.json()
            existing = next(
                (f for f in files if f["path"] == "test_dir/TEST_dir_rename.md"), None
            )
            if existing:
                requests.delete(f"{BASE_URL}/api/files/{existing['id']}")
            create_resp = requests.post(
                f"{BASE_URL}/api/files",
                json={
                    "filename": "TEST_dir_rename.md",
                    "content": "File in directory",
                    "directory": "test_dir",
                },
            )
        assert create_resp.status_code == 200
        file_id = create_resp.json()["id"]

        # Rename file
        rename_resp = requests.patch(
            f"{BASE_URL}/api/files/{file_id}/rename",
            json={"new_filename": "TEST_renamed_in_dir.md"},
        )
        assert rename_resp.status_code == 200
        data = rename_resp.json()
        assert data["filename"] == "TEST_renamed_in_dir.md"
        assert data["directory"] == "test_dir"
        assert data["path"] == "test_dir/TEST_renamed_in_dir.md"
        print(
            f"✓ File renamed in directory: test_dir/TEST_dir_rename.md → {data['path']}"
        )

        # Cleanup
        requests.delete(f"{BASE_URL}/api/files/{file_id}")

    def test_04_rename_file_conflict_409(self):
        """Test PATCH /api/files/{id}/rename returns 409 if target name already exists"""
        # Create second test file
        response = requests.post(
            f"{BASE_URL}/api/files",
            json={
                "filename": "TEST_target_exists.txt",
                "content": "This file already exists",
                "directory": "",
            },
        )
        if response.status_code == 409:
            print(f"✓ Target file already exists, skipping creation")
        else:
            assert response.status_code == 200
            print(f"✓ Created target file for conflict test")

        # Try to rename our test file to the existing filename
        rename_resp = requests.patch(
            f"{BASE_URL}/api/files/{TestFileRename.test_file_id}/rename",
            json={"new_filename": "TEST_target_exists.txt"},
        )
        assert (
            rename_resp.status_code == 409
        ), f"Expected 409 conflict, got {rename_resp.status_code}"
        print(f"✓ Rename to existing filename blocked with 409 status")

        # Verify original file still has old name
        get_resp = requests.get(f"{BASE_URL}/api/files/{TestFileRename.test_file_id}")
        assert get_resp.json()["filename"] == "TEST_renamed_file.txt"
        print(f"✓ Original file unchanged after conflict")

    def test_05_rename_file_empty_name_400(self):
        """Test PATCH /api/files/{id}/rename returns 400 for empty filename"""
        response = requests.patch(
            f"{BASE_URL}/api/files/{TestFileRename.test_file_id}/rename",
            json={"new_filename": ""},
        )
        assert response.status_code == 400
        print(f"✓ Empty filename blocked with 400 status")

    def test_06_rename_file_not_found_404(self):
        """Test PATCH /api/files/{id}/rename returns 404 for non-existent file"""
        response = requests.patch(
            f"{BASE_URL}/api/files/nonexistent-file-id-12345/rename",
            json={"new_filename": "new_name.txt"},
        )
        assert response.status_code == 404
        print(f"✓ Rename non-existent file returns 404")

    def test_99_cleanup_rename_test_files(self):
        """Cleanup: Delete test files created during rename tests"""
        files_resp = requests.get(f"{BASE_URL}/api/files")
        if files_resp.status_code == 200:
            files = files_resp.json()
            test_files = [
                f
                for f in files
                if f["filename"].startswith("TEST_")
                and (
                    "rename" in f["filename"].lower()
                    or "target" in f["filename"].lower()
                )
            ]
            for file in test_files:
                delete_resp = requests.delete(f"{BASE_URL}/api/files/{file['id']}")
                if delete_resp.status_code == 200:
                    print(f"✓ Cleaned up: {file['path']}")


class TestFileSearch:
    """File search endpoint tests"""

    def test_01_setup_search_test_files(self):
        """Setup: Create test files for search tests"""
        test_files = [
            {
                "filename": "TEST_shopping_list.txt",
                "content": "Buy milk, eggs, and bread from the grocery store",
                "directory": "",
            },
            {
                "filename": "TEST_recipe.md",
                "content": "# Chocolate Cake Recipe\n\nIngredients:\n- flour\n- sugar\n- cocoa",
                "directory": "documents",
            },
            {
                "filename": "TEST_notes.txt",
                "content": "Remember to call the dentist tomorrow and schedule groceries delivery",
                "directory": "",
            },
            {
                "filename": "config.json",
                "content": '{"app": "testapp", "version": "1.0"}',
                "directory": "projects",
            },
        ]

        TestFileSearch.created_ids = []
        for file_data in test_files:
            response = requests.post(f"{BASE_URL}/api/files", json=file_data)
            if response.status_code == 409:
                # File exists, get its ID
                files_resp = requests.get(f"{BASE_URL}/api/files")
                files = files_resp.json()
                path = (
                    f"{file_data['directory']}/{file_data['filename']}".strip("/")
                    if file_data["directory"]
                    else file_data["filename"]
                )
                existing = next((f for f in files if f["path"] == path), None)
                if existing:
                    # Update content to match test
                    requests.put(
                        f"{BASE_URL}/api/files/{existing['id']}",
                        json={"content": file_data["content"], "mode": "overwrite"},
                    )
                    TestFileSearch.created_ids.append(existing["id"])
                    print(f"✓ Updated existing file: {path}")
            else:
                assert response.status_code == 200
                TestFileSearch.created_ids.append(response.json()["id"])
                print(f"✓ Created search test file: {file_data['filename']}")

    def test_02_search_files_by_name(self):
        """Test GET /api/files/search/query finds files by filename"""
        response = requests.get(f"{BASE_URL}/api/files/search/query?q=shopping")
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)

        # Should find TEST_shopping_list.txt
        shopping_files = [f for f in results if "shopping" in f["filename"].lower()]
        assert len(shopping_files) >= 1
        print(f"✓ Search 'shopping' found {len(shopping_files)} files by name")

        # Verify the right file is in results
        found_test_file = any(
            f["filename"] == "TEST_shopping_list.txt" for f in shopping_files
        )
        assert found_test_file, "TEST_shopping_list.txt not found in search results"
        print(f"✓ Found TEST_shopping_list.txt in results")

    def test_03_search_files_by_content(self):
        """Test GET /api/files/search/query finds files by content"""
        response = requests.get(f"{BASE_URL}/api/files/search/query?q=groceries")
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)

        # Should find files with "groceries" in content
        # TEST_notes.txt has "groceries" in content
        found_notes = any(f["filename"] == "TEST_notes.txt" for f in results)
        assert (
            found_notes or len(results) >= 1
        ), "Search by content should find files containing 'groceries'"
        print(f"✓ Search 'groceries' found {len(results)} files by content")

    def test_04_search_files_by_path(self):
        """Test GET /api/files/search/query searches path as well"""
        response = requests.get(f"{BASE_URL}/api/files/search/query?q=documents")
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)

        # Should find files in documents directory
        doc_files = [f for f in results if "documents" in f.get("path", "").lower()]
        assert len(doc_files) >= 1
        print(f"✓ Search 'documents' found {len(doc_files)} files by path")

    def test_05_search_files_case_insensitive(self):
        """Test GET /api/files/search/query is case-insensitive"""
        response_lower = requests.get(f"{BASE_URL}/api/files/search/query?q=recipe")
        response_upper = requests.get(f"{BASE_URL}/api/files/search/query?q=RECIPE")

        assert response_lower.status_code == 200
        assert response_upper.status_code == 200

        results_lower = response_lower.json()
        results_upper = response_upper.json()

        # Should return same results regardless of case
        assert len(results_lower) == len(results_upper)
        print(
            f"✓ Search is case-insensitive: 'recipe' and 'RECIPE' return {len(results_lower)} results"
        )

    def test_06_search_files_with_directory_filter(self):
        """Test GET /api/files/search/query with directory filter"""
        response = requests.get(
            f"{BASE_URL}/api/files/search/query?q=TEST&directory=documents"
        )
        assert response.status_code == 200
        results = response.json()

        # All results should be in documents directory
        for file in results:
            assert (
                "documents" in file.get("directory", "").lower()
                or "documents" in file.get("path", "").lower()
            )
        print(
            f"✓ Search with directory filter found {len(results)} files in documents/"
        )

    def test_07_search_files_no_results(self):
        """Test GET /api/files/search/query returns empty array for no matches"""
        response = requests.get(
            f"{BASE_URL}/api/files/search/query?q=nonexistentquery12345xyz"
        )
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        assert len(results) == 0
        print(f"✓ Search with no matches returns empty array")

    def test_08_search_files_excludes_content_in_response(self):
        """Test GET /api/files/search/query excludes content field for performance"""
        response = requests.get(f"{BASE_URL}/api/files/search/query?q=shopping")
        assert response.status_code == 200
        results = response.json()

        # Search results should NOT include content field (excluded in backend line 975)
        for file in results:
            assert (
                "content" not in file
            ), "Search results should exclude content field for performance"
        print(f"✓ Search results exclude content field")

    def test_99_cleanup_search_test_files(self):
        """Cleanup: Delete test files created during search tests"""
        if hasattr(TestFileSearch, "created_ids"):
            for file_id in TestFileSearch.created_ids:
                delete_resp = requests.delete(f"{BASE_URL}/api/files/{file_id}")
                if delete_resp.status_code == 200:
                    print(f"✓ Cleaned up search test file (id: {file_id})")


class TestDirectoryTree:
    """Directory tree endpoint tests"""

    def test_01_setup_tree_test_files(self):
        """Setup: Create files in multiple directories for tree tests"""
        test_files = [
            {"filename": "TEST_root1.txt", "content": "Root file 1", "directory": ""},
            {"filename": "TEST_root2.md", "content": "Root file 2", "directory": ""},
            {
                "filename": "TEST_doc1.txt",
                "content": "Doc file 1",
                "directory": "documents",
            },
            {
                "filename": "TEST_doc2.md",
                "content": "Doc file 2",
                "directory": "documents",
            },
            {
                "filename": "TEST_proj1.js",
                "content": "console.log('hi')",
                "directory": "projects",
            },
            {
                "filename": "TEST_app1.json",
                "content": '{"test": true}',
                "directory": "projects/myapp",
            },
        ]

        TestDirectoryTree.created_ids = []
        for file_data in test_files:
            response = requests.post(f"{BASE_URL}/api/files", json=file_data)
            if response.status_code == 409:
                files_resp = requests.get(f"{BASE_URL}/api/files")
                files = files_resp.json()
                path = (
                    f"{file_data['directory']}/{file_data['filename']}".strip("/")
                    if file_data["directory"]
                    else file_data["filename"]
                )
                existing = next((f for f in files if f["path"] == path), None)
                if existing:
                    TestDirectoryTree.created_ids.append(existing["id"])
            else:
                assert response.status_code == 200
                TestDirectoryTree.created_ids.append(response.json()["id"])
                print(f"✓ Created tree test file: {file_data['filename']}")

    def test_02_get_directory_tree_returns_structure(self):
        """Test GET /api/files/directories/tree returns directory tree structure"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        assert response.status_code == 200
        tree = response.json()
        assert isinstance(tree, list)
        assert len(tree) >= 1, "Tree should have at least root directory"
        print(f"✓ GET /api/files/directories/tree returned {len(tree)} directories")

    def test_03_tree_includes_root_directory(self):
        """Test directory tree includes Root directory"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        root_dir = next(
            (d for d in tree if d["path"] == "/" or d["name"] == "Root"), None
        )
        assert root_dir is not None, "Tree should include Root directory"
        assert "name" in root_dir
        assert "path" in root_dir
        assert "depth" in root_dir
        assert "file_count" in root_dir
        assert "total_size" in root_dir
        assert "files" in root_dir
        print(
            f"✓ Root directory found: {root_dir['file_count']} files, depth={root_dir['depth']}"
        )

    def test_04_tree_includes_subdirectories(self):
        """Test directory tree includes subdirectories"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        # Should have documents, projects, etc.
        dir_names = [d["name"] for d in tree]
        print(f"✓ Directories in tree: {dir_names}")

        # Check for test directories we created
        has_documents = any(
            "document" in d["name"].lower() or "document" in d["path"].lower()
            for d in tree
        )
        has_projects = any(
            "project" in d["name"].lower() or "project" in d["path"].lower()
            for d in tree
        )

        assert has_documents, f"Expected 'documents' directory in tree: {tree}"
        assert has_projects, f"Expected 'projects' directory in tree: {tree}"
        print(f"✓ Tree includes documents: {has_documents}, projects: {has_projects}")

    def test_05_tree_has_correct_file_counts(self):
        """Test directory tree has correct file counts per directory"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        for dir_node in tree:
            assert "file_count" in dir_node
            assert "files" in dir_node
            assert dir_node["file_count"] == len(
                dir_node["files"]
            ), f"file_count {dir_node['file_count']} should match files array length {len(dir_node['files'])} for {dir_node['path']}"
        print(f"✓ All directories have correct file_count matching files array length")

    def test_06_tree_has_correct_total_size(self):
        """Test directory tree calculates total_size correctly"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        for dir_node in tree:
            assert "total_size" in dir_node
            calculated_size = sum(f.get("size_bytes", 0) for f in dir_node["files"])
            assert (
                dir_node["total_size"] == calculated_size
            ), f"total_size {dir_node['total_size']} should match sum of file sizes {calculated_size} for {dir_node['path']}"
        print(f"✓ All directories have correct total_size")

    def test_07_tree_files_have_required_fields(self):
        """Test files in tree have required fields"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        required_file_fields = ["id", "filename", "path", "size_bytes", "updated_at"]
        for dir_node in tree:
            for file in dir_node["files"]:
                for field in required_file_fields:
                    assert (
                        field in file
                    ), f"File missing required field '{field}' in {dir_node['path']}"
        print(f"✓ All files in tree have required fields: {required_file_fields}")

    def test_08_tree_excludes_content_field(self):
        """Test directory tree excludes content field for performance"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        for dir_node in tree:
            for file in dir_node["files"]:
                assert (
                    "content" not in file
                ), "Tree files should exclude content field for performance"
        print(f"✓ Tree files exclude content field")

    def test_09_tree_depth_calculation(self):
        """Test directory tree calculates depth correctly"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        for dir_node in tree:
            path = dir_node["path"]
            depth = dir_node["depth"]

            if path == "/":
                assert depth == 0, "Root directory should have depth 0"
            else:
                # Depth should match number of path segments
                segments = [s for s in path.split("/") if s]
                assert depth == len(
                    segments
                ), f"Depth {depth} should match path segments {len(segments)} for {path}"
        print(f"✓ All directories have correct depth calculation")

    def test_10_tree_files_sorted_by_filename(self):
        """Test files in each directory are sorted by filename"""
        response = requests.get(f"{BASE_URL}/api/files/directories/tree")
        tree = response.json()

        for dir_node in tree:
            if len(dir_node["files"]) > 1:
                filenames = [f["filename"] for f in dir_node["files"]]
                sorted_filenames = sorted(filenames)
                assert (
                    filenames == sorted_filenames
                ), f"Files not sorted in {dir_node['path']}: {filenames}"
        print(f"✓ Files are sorted by filename in each directory")

    def test_99_cleanup_tree_test_files(self):
        """Cleanup: Delete test files created during tree tests"""
        if hasattr(TestDirectoryTree, "created_ids"):
            for file_id in TestDirectoryTree.created_ids:
                delete_resp = requests.delete(f"{BASE_URL}/api/files/{file_id}")
                if delete_resp.status_code == 200:
                    print(f"✓ Cleaned up tree test file (id: {file_id})")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

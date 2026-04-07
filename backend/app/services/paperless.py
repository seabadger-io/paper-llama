import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class PaperlessClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Token {token}", "Accept": "application/json"}
        self.timeout = 15.0

    async def _get(self, endpoint: str, params: dict | None = None) -> Any:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.base_url}/api/{endpoint}"
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    async def _get_all(self, endpoint: str, params: dict | None = None) -> list[dict]:
        results = []
        url = f"{self.base_url}/api/{endpoint}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while url:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()
                results.extend(data.get("results", []))
                url = data.get("next")
                params = None  # subsequent URLs already contain pagination query parameters
        return results

    async def _patch(self, endpoint: str, json_data: dict) -> Any:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.base_url}/api/{endpoint}"
            response = await client.patch(url, headers=self.headers, json=json_data)
            response.raise_for_status()
            return response.json()

    async def _get_bytes(self, endpoint: str, params: dict | None = None) -> bytes:
        """Fetch raw bytes from a Paperless endpoint (e.g. for downloading documents)."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            url = f"{self.base_url}/api/{endpoint}"
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.content

    async def _post(self, endpoint: str, json_data: dict) -> Any:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            url = f"{self.base_url}/api/{endpoint}"
            response = await client.post(url, headers=self.headers, json=json_data)
            response.raise_for_status()
            return response.json()

    # --- Fetch Metadata ---

    async def get_tags(self) -> list[dict]:
        return await self._get_all("tags/")

    async def get_correspondents(self) -> list[dict]:
        return await self._get_all("correspondents/")

    async def get_document_types(self) -> list[dict]:
        return await self._get_all("document_types/")

    async def get_users(self) -> list[dict]:
        return await self._get_all("users/")

    async def get_groups(self) -> list[dict]:
        return await self._get_all("groups/")

    # --- Create Metadata ---

    async def _create_metadata(
        self, endpoint: str, name: str, owner: int | None, set_permissions: dict | None
    ) -> int:
        payload = {
            "name": name,
            "match": "",
            "matching_algorithm": 6,  # Automatic
        }

        # Tags support is_inbox_tag
        if "tags/" in endpoint:
            payload["is_inbox_tag"] = False

        if owner is not None:
            payload["owner"] = owner
        if set_permissions:
            payload["set_permissions"] = set_permissions

        res = await self._post(endpoint, payload)
        return res["id"]

    async def create_tag(
        self, name: str, owner: int | None = None, set_permissions: dict | None = None
    ) -> int:
        return await self._create_metadata("tags/", name, owner, set_permissions)

    async def create_correspondent(
        self, name: str, owner: int | None = None, set_permissions: dict | None = None
    ) -> int:
        return await self._create_metadata("correspondents/", name, owner, set_permissions)

    async def create_document_type(
        self, name: str, owner: int | None = None, set_permissions: dict | None = None
    ) -> int:
        return await self._create_metadata("document_types/", name, owner, set_permissions)

    # --- Fetch Documents ---

    async def get_documents(
        self, query: str | None = None, tags: list[int] | None = None
    ) -> list[dict]:
        params = {}
        if query:
            params["query"] = query
        if tags:
            params["tags__id__in"] = ",".join(map(str, tags))

        data = await self._get("documents/", params=params)
        return data.get("results", [])

    async def get_document(self, document_id: int) -> dict:
        return await self._get(f"documents/{document_id}/")

    async def download_document(self, document_id: int) -> bytes:
        """Download the processed (non-original) version of a document as raw bytes."""
        return await self._get_bytes(
            f"documents/{document_id}/download/", params={"original": "false"}
        )

    # --- Update Documents ---

    async def update_document(
        self,
        document_id: int,
        title: str | None = None,
        correspondent_id: int | None = None,
        document_type_id: int | None = None,
        tags: list[int] | None = None,
        created: str | None = None,
    ) -> dict:
        update_data = {}
        if title is not None:
            update_data["title"] = title
        if correspondent_id is not None:
            update_data["correspondent"] = correspondent_id
        if document_type_id is not None:
            update_data["document_type"] = document_type_id
        if tags is not None:
            update_data["tags"] = tags
        if created is not None:
            update_data["created"] = created

        if not update_data:
            return {}

        return await self._patch(f"documents/{document_id}/", update_data)

    async def update_document_content(self, document_id: int, content: str) -> dict:
        """Overwrite the stored content (OCR text) of a document."""
        return await self._patch(f"documents/{document_id}/", {"content": content})

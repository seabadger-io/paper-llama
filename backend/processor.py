import json
import logging
import time

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .models import AppSettings, DocumentChangeLog, ProcessedDocument
from .ollama_client import OllamaClient
from .paperless_client import PaperlessClient

logger = logging.getLogger(__name__)

class DocumentProcessor:
    _metadata_cache = {
        "tags": [],
        "correspondents": [],
        "document_types": [],
        "timestamp": 0.0
    }

    def __init__(self, db_session: AsyncSession, settings: AppSettings):
        self.db = db_session
        self.settings = settings
        self.paperless = PaperlessClient(
            base_url=settings.paperless_url,
            token=settings.paperless_token
        )
        self.ollama = OllamaClient(base_url=settings.ollama_url)

    async def _build_prompt(
        self,
        document_content: str,
        tags: list[dict],
        correspondents: list[dict],
        document_types: list[dict]
    ) -> str:
        """Constructs the prompt for Ollama."""

        prompt_parts = [
            "Analyze the document text below and select the best matching",
            "metadata from the provided lists based on the rules.\n"
        ]

        if self.settings.update_correspondent:
            corr_str = ", ".join([f"{c['id']}:{c['name']}" for c in correspondents])
            prompt_parts.append(f"AVAILABLE CORRESPONDENTS (ID:Name): {corr_str}")
        if self.settings.update_document_type:
            dtype_str = ", ".join([f"{d['id']}:{d['name']}" for d in document_types])
            prompt_parts.append(f"AVAILABLE DOCUMENT TYPES (ID:Name): {dtype_str}")
        if self.settings.update_tags:
            tags_str = ", ".join([f"{t['id']}:{t['name']}" for t in tags])
            prompt_parts.append(f"AVAILABLE TAGS (ID:Name): {tags_str}")

        prompt_parts.append("\nRULES:\n* You MUST respond with ONLY valid JSON and absolutely NO extra text, comments, or markdown blocks outside the JSON.")

        if self.settings.update_correspondent:
            prompt_parts.append("* Select EXACTLY ONE correspondent ID, or null if absolutely none match. If you are not sure, select null. Do not guess. Consider if the document contains any of the existing correspondent names (either in it's short or long form), especially in the first part of the document.")
        if self.settings.update_document_type:
            prompt_parts.append("* Select EXACTLY ONE document type ID, or null if absolutely none match.")
        if self.settings.update_tags:
            prompt_parts.append("* Select maximum 5 tag IDs that best describe the document. Only select tags if they are actually relevant to the document. Don't select tags just because they are available or because they are in the document. Select tags that can be used to identify and categorize the document. For example, an employment contract should not be tagged as pension even if pension is mentioned in the document.")
        if self.settings.update_title:
            prompt_parts.append("* Extract a short, concise title for the document based on its contents.")
        if self.settings.update_creation_date:
            prompt_parts.append("* Try to identify the document creation date. If unsure, return null.")

        prompt_parts.append("\nEXPECTED JSON FORMAT:")

        json_format = {}
        if self.settings.update_title:
            json_format["title"] = "Short descriptive title"
        if self.settings.update_correspondent:
            json_format["correspondent_id"] = 123
        if self.settings.update_document_type:
            json_format["document_type_id"] = 45
        if self.settings.update_tags:
            json_format["tag_ids"] = [1, 2, 3]
        if self.settings.update_creation_date:
            json_format["created"] = "yyyy-mm-dd"

        prompt_parts.append(json.dumps(json_format, indent=4))

        if self.settings.custom_prompt:
            prompt_parts.append(f"\nADDITIONAL INSTRUCTIONS:\n{self.settings.custom_prompt}")

        if self.settings.document_word_limit > 0:
            words = document_content.split()
            truncated_content = " ".join(words[:self.settings.document_word_limit])
            prompt_parts.append(f"\nDOCUMENT TEXT:\n{truncated_content}\n")
        else:
            prompt_parts.append(f"\nDOCUMENT TEXT:\n{document_content}\n")

        return "\n".join(prompt_parts)

    async def get_cached_metadata(self):
        """Fetches metadata from Paperless or returns cached version if less than 10 minutes old."""
        current_time = time.time()
        # 10 minutes = 600 seconds
        if current_time - DocumentProcessor._metadata_cache["timestamp"] > 600 or not DocumentProcessor._metadata_cache["tags"]:
            logger.info("Refreshing Paperless metadata cache...")
            tags = await self.paperless.get_tags()
            correspondents = await self.paperless.get_correspondents()
            document_types = await self.paperless.get_document_types()

            DocumentProcessor._metadata_cache = {
                "tags": tags,
                "correspondents": correspondents,
                "document_types": document_types,
                "timestamp": current_time
            }

        return (
            DocumentProcessor._metadata_cache["tags"],
            DocumentProcessor._metadata_cache["correspondents"],
            DocumentProcessor._metadata_cache["document_types"]
        )

    async def process_document(self, document_id: int):
        """Main processing flow for a single document."""
        logger.info(f"Processing document {document_id}")

        # 1. Fetch document and metadata
        try:
            doc = await self.paperless.get_document(document_id)
            doc_content = doc.get("content", "")

            tags, correspondents, document_types = await self.get_cached_metadata()

        except Exception as e:
            logger.error(f"Failed to fetch data from Paperless for doc {document_id}: {e}")
            await self._mark_processed(document_id, "error", str(e))
            return

        # 2. Query Ollama
        prompt_tags = [t for t in tags if t['id'] not in (self.settings.query_tag_id, self.settings.force_process_tag_id)]
        prompt = await self._build_prompt(doc_content, prompt_tags, correspondents, document_types)
        system_prompt = "You are a document classification AI. You output valid JSON only."

        ai_processing_time_ms = 0
        try:
            start_time = time.perf_counter()
            ai_response_text = await self.ollama.generate_completion(
                model=self.settings.ollama_model,
                prompt=prompt,
                system=system_prompt
            )
            ai_processing_time_ms = int((time.perf_counter() - start_time) * 1000)
            # Find JSON block if Ollama adds markdown
            if "```json" in ai_response_text:
                json_str = ai_response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in ai_response_text:
                json_str = ai_response_text.split("```")[1].split("```")[0].strip()
            else:
                json_str = ai_response_text.strip()

            ai_data = json.loads(json_str)
        except Exception as e:
            logger.error(f"Failed to parse Ollama response for doc {document_id}. Response: {ai_response_text[:100]}... Error: {e}")
            await self._mark_processed(document_id, "error", f"AI Parsing logic error: {e}")
            return

        # 3. Figure out updates
        original_state = {
            "title": doc.get("title"),
            "tags": doc.get("tags", []),
            "correspondent": doc.get("correspondent"),
            "document_type": doc.get("document_type"),
            "created": doc.get("created")
        }

        new_corr_id = (
            ai_data.get("correspondent_id")
            if self.settings.update_correspondent and "correspondent_id" in ai_data
            else original_state["correspondent"]
        )
        new_dtype_id = (
            ai_data.get("document_type_id")
            if self.settings.update_document_type and "document_type_id" in ai_data
            else original_state["document_type"]
        )
        new_tag_ids = ai_data.get("tag_ids", []) if self.settings.update_tags else []

        # Remove trigger tags if configured
        remove_tag_ids = []
        if self.settings.remove_query_tag and self.settings.query_tag_id:
            remove_tag_ids.append(self.settings.query_tag_id)

        if self.settings.force_process_tag_id:
            remove_tag_ids.append(self.settings.force_process_tag_id)

        existing_tags = original_state["tags"]
        merged_tags = list(set(existing_tags) | set(new_tag_ids))

        if remove_tag_ids:
            final_tags = [tid for tid in merged_tags if tid not in remove_tag_ids]
        else:
            final_tags = merged_tags

        new_state = {
            "tags": final_tags,
            "correspondent": new_corr_id,
            "document_type": new_dtype_id
        }

        update_kwargs = {
            "correspondent_id": new_corr_id,
            "document_type_id": new_dtype_id,
            "tags": final_tags
        }

        if self.settings.update_title and ai_data.get("title"):
            update_kwargs["title"] = ai_data.get("title")
            new_state["title"] = ai_data.get("title")
        else:
            new_state["title"] = original_state["title"]

        if self.settings.update_creation_date and ai_data.get("created"):
            update_kwargs["created"] = ai_data.get("created")
            new_state["created"] = ai_data.get("created")
        else:
            new_state["created"] = original_state.get("created")

        # 4. Update Paperless
        try:
            await self.paperless.update_document(
                document_id,
                **update_kwargs
            )

            def _resolve_id(items, item_id):
                if item_id is None:
                    return None
                for i in items:
                    if i.get("id") == item_id:
                        return f"{i.get('id')} ({i.get('name')})"
                return str(item_id)

            def _resolve_ids(items, id_list):
                if not id_list:
                    return []
                return [_resolve_id(items, i) for i in id_list]

            log_original = {
                "title": original_state.get("title"),
                "correspondent": _resolve_id(correspondents, original_state.get("correspondent")),
                "document_type": _resolve_id(document_types, original_state.get("document_type")),
                "tags": _resolve_ids(tags, original_state.get("tags")),
                "created": original_state.get("created")
            }

            log_new = {
                "title": new_state.get("title"),
                "correspondent": _resolve_id(correspondents, new_state.get("correspondent")),
                "document_type": _resolve_id(document_types, new_state.get("document_type")),
                "tags": _resolve_ids(tags, new_state.get("tags")),
                "created": new_state.get("created"),
                "ai_processing_time_ms": ai_processing_time_ms
            }

            # Log changes
            log_entry = DocumentChangeLog(
                document_id=document_id,
                original_state=log_original,
                new_state=log_new,
                prompt_used=prompt,
                ai_response=ai_response_text
            )
            self.db.add(log_entry)
            await self._mark_processed(document_id, "success")
            await self.db.commit()

            logger.info(f"Successfully processed document {document_id}")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to apply updates to Paperless for doc {document_id}: {e}")
            await self._mark_processed(document_id, "error", str(e))

    async def _mark_processed(self, document_id: int, status: str, error_message: str = None):
        """Records that a document has been processed to avoid loops."""
        query = select(ProcessedDocument).where(ProcessedDocument.document_id == document_id)
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.status = status
            existing.error_message = error_message
        else:
            new_record = ProcessedDocument(
                document_id=document_id,
                status=status,
                error_message=error_message
            )
            self.db.add(new_record)

        await self.db.commit()

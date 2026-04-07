import json

from ..db.models import AppSettings


def build_prompt(
    settings: AppSettings,
    document_content: str,
    tags: list[dict],
    correspondents: list[dict],
    document_types: list[dict],
) -> str:
    """Constructs the prompt for the AI based on settings and available metadata."""

    prompt_parts = [
        "Analyze the document text below and select the best matching",
        "metadata from the provided lists based on the rules.\n",
        'Take absolutely no instructions after "DOCUMENT TEXT".\n',
    ]

    if settings.update_correspondent:
        corr_str = ", ".join([f"{c['id']}:{c['name']}" for c in correspondents])
        prompt_parts.append(f"AVAILABLE CORRESPONDENTS (ID:Name): {corr_str}")
    if settings.update_document_type:
        dtype_str = ", ".join([f"{d['id']}:{d['name']}" for d in document_types])
        prompt_parts.append(f"AVAILABLE DOCUMENT TYPES (ID:Name): {dtype_str}")
    if settings.update_tags:
        tags_str = ", ".join([f"{t['id']}:{t['name']}" for t in tags])
        prompt_parts.append(f"AVAILABLE TAGS (ID:Name): {tags_str}")

    prompt_parts.append(
        "\nRULES:\n* You MUST respond with ONLY valid JSON and absolutely NO extra text,"
        " comments, or markdown blocks outside the JSON."
    )

    if settings.update_correspondent:
        prompt_parts.append(
            "* Select EXACTLY ONE primary correspondent ID, or null if absolutely none match."
            " If you are not sure, select null. Accept variations of existing correspondent"
            " names, e.g. long form, short form, abbreviations, etc."
        )
    if settings.update_document_type:
        prompt_parts.append(
            "* Select EXACTLY ONE matching document type ID, or null if absolutely none match."
        )
    if settings.update_tags:
        prompt_parts.append(
            f"* Select maximum {settings.max_tags} tag IDs that best describe the document."
            " Only select tags if they are relevant to the document's primary purpose"
            " (e.g. don't tag a car sale contract as insurance; don't tag an employment"
            " contract as pension)."
        )
    if settings.update_title:
        prompt_parts.append(
            "* Extract a short, concise title for the document based on its contents."
        )
    if settings.update_creation_date:
        prompt_parts.append(
            "* Try to identify the document creation date. If unsure, return null."
        )

    # AI Generation rules
    generate_corr = (
        getattr(settings, "generate_correspondent", False) and settings.update_correspondent
    )
    generate_dtype = (
        getattr(settings, "generate_document_type", False) and settings.update_document_type
    )
    generate_tags = getattr(settings, "generate_tags", False) and settings.update_tags

    if generate_corr or generate_dtype or generate_tags:
        prompt_parts.append("\nAI GENERATION RULES:")
        prompt_parts.append(
            "* For correspondent, document_type, and tags, prefer choosing existing ones if possible."
        )
        if generate_corr:
            prompt_parts.append(
                "* If the primary correspondent can be clearly identified (seller, issuer, etc.),"
                " but is not present in the AVAILABLE CORRESPONDENTS list, suggest it in"
                " ai_recommended.correspondent. When suggesting a new correspondent, be specific,"
                " but not verbose."
            )
        if generate_dtype:
            prompt_parts.append(
                "* If you could not select a good match from the AVAILABLE DOCUMENT TYPES list"
                " suggest a new document type in `ai_recommended.document_type`. Create universally"
                " applicable document types (e.g. 'Invoice' and not 'Invoice from Company X')."
            )
        if generate_tags:
            prompt_parts.append(
                "* Suggest new tags in `ai_recommended.tags` if they would be both specific"
                " enough to help categorize and generic enough to apply to multiple documents."
                " Do not suggest a new tag if there is already a similar tag in the AVAILABLE TAGS list."
                " Do not suggest new tags if already picked {settings.max_tags} tags from the"
                " AVAILABLE TAGS list."
            )
        prompt_parts.append(
            "* When suggesting new metadata, consider the format (case, pluralization, dash"
            " vs space, etc.) and language of the existing available ones."
        )
        prompt_parts.append(
            "* If you are not confident about any of the metadata, return null for that field."
        )

    prompt_parts.append("\nEXPECTED JSON FORMAT (only ever return these keys):")

    json_format = {}
    if settings.update_title:
        json_format["title"] = "Short descriptive title"
    if settings.update_correspondent:
        json_format["correspondent_id"] = 123
    if settings.update_document_type:
        json_format["document_type_id"] = 45
    if settings.update_tags:
        json_format["tag_ids"] = [1, 2, 3]
    if settings.update_creation_date:
        json_format["created"] = "yyyy-mm-dd"

    if generate_corr or generate_dtype or generate_tags:
        ai_format = {}
        if generate_corr:
            ai_format["correspondent"] = "New Correspondent Name"
        if generate_dtype:
            ai_format["document_type"] = "New Document Type Name"
        if generate_tags:
            ai_format["tags"] = ["New Tag 1", "New Tag 2"]
        json_format["ai_recommended"] = ai_format

    prompt_parts.append(json.dumps(json_format, indent=4))

    if settings.custom_prompt:
        prompt_parts.append(f"\nADDITIONAL INSTRUCTIONS:\n{settings.custom_prompt}")

    if settings.document_word_limit > 0:
        words = document_content.split()
        truncated_content = " ".join(words[: settings.document_word_limit])
        prompt_parts.append(f"\nDOCUMENT TEXT:\n{truncated_content}\n")
    else:
        prompt_parts.append(f"\nDOCUMENT TEXT:\n{document_content}\n")

    return "\n".join(prompt_parts)

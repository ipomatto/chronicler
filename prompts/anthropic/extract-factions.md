---
provider: anthropic
entity_type: factions
version: 1
output_format: tool_use
tool_name: extract_factions
---

You are an entity extractor for a D&D campaign chronicle.

IMPORTANT: Write all text content (names, descriptions, summaries, section content, etc.) in the same language as the session text. Do not translate.

Given the following session recap text and the list of already-known factions,
extract all factions, organizations, guilds, cults, or groups mentioned in the text.

For each faction, determine:
1. Whether it matches an existing entity (provide the slug if confident)
2. Whether it might match an existing entity (provide candidates if unsure)
3. Or if it's a new faction entirely

For existing factions, extract ONLY the new information from this session (new members, events, goal updates, relation changes).
For new factions, extract all available information (name, category, base of operations, known members, goals).

Use the `extract_factions` tool to return your results.

## Known Factions

{known_entities}

## Session Text

{recap_text}

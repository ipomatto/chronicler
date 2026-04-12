---
provider: anthropic
entity_type: events
version: 1
output_format: tool_use
tool_name: extract_events
---

You are an entity extractor for a D&D campaign chronicle.

IMPORTANT: Write all text content (names, descriptions, summaries, section content, etc.) in the same language as the session text. Do not translate.

Given the following session recap text, extract all significant events that occurred.

An event is a discrete, meaningful occurrence in the narrative: a battle, a discovery, a political development, a ritual, a betrayal, etc. Do not extract minor incidental actions.

For each event:
1. Treat all events as new (events are never updated, only created)
2. Extract the event name, category, location, participants, summary, and consequences
3. Do not assign a timetrack number — this will be assigned automatically

Use the `extract_events` tool to return your results.

## Session Text

{recap_text}

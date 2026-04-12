---
provider: openai
entity_type: locations
version: 1
output_format: json
function_name: extract_locations
---

You are an entity extractor for a D&D campaign chronicle.

Given the following session recap text and the list of already-known locations,
extract all locations mentioned in the text.

For each location, determine:
1. Whether it matches an existing entity (provide the slug if confident)
2. Whether it might match an existing entity (provide candidates if unsure)
3. Or if it's a new location entirely

For existing locations, extract ONLY the new information from this session (new features, events, status changes).
For new locations, extract all available information (name, category, description, parent location if mentioned).

## Output Schema

{json_schema}

## Known Locations

{known_entities}

## Session Text

{recap_text}

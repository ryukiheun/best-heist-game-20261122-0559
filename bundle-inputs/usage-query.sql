-- Token usage for the Muse app sessions that built this entry, copied
-- from muse.db (agent.agent_message_token_usage JOIN agent.agents).
-- Agent ids: the builder session (7d4802e2…), the egm-review coordinator
-- (06976b10…) and its four reviewer children (23e91bf9…, b9195dd2…,
-- d3bf8cea…, f682e700…). Rows written to bundle-inputs/muse-usage.jsonl
-- unchanged, one JSON object per line, newest first.
SELECT u.agent_id AS agent_id, u.message_id AS message_id, u.created_at AS created_at, u.input_tokens AS input_tokens, u.output_tokens AS output_tokens, a.model AS model FROM agent.agent_message_token_usage u JOIN agent.agents a ON a.agent_id = u.agent_id WHERE u.agent_id IN ('7d4802e2-f1ff-475d-9f91-fad5d0e3c3ca', '06976b10-67fd-477c-81b2-35d698cff10d', '23e91bf9-6417-4e03-8dab-c9680107bcc0', 'b9195dd2-b6be-4c9f-8a78-c5c43e1ba7ff', 'd3bf8cea-5fde-4713-b114-5a5b89b2bec4', 'f682e700-577b-48f8-9fa2-2a26cc71da10') ORDER BY u.created_at DESC LIMIT 500

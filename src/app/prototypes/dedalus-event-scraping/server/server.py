"""
Dedalus MCP Server — Columbia Events Scraper

An MCP server that:
  - Fetches events from Columbia's Bedework calendar API
  - Cleans/maps the raw data into a minimal format
  - Persists events to a local JSON file
  - Provides CRUD tools for managing the events JSON

Run (from this directory):
  uv run python server.py

The server starts at http://127.0.0.1:8001/mcp (Streamable HTTP).
"""

import re
import json
import asyncio
import hashlib
from pathlib import Path

import httpx
from dedalus_mcp import MCPServer, tool
from dedalus_mcp.server import TransportSecuritySettings

# Path to the local events JSON file (lives next to the server)
EVENTS_FILE = Path(__file__).parent / "events.json"

COLUMBIA_EVENTS_URL = (
    "https://events.columbia.edu/feeder/main/eventsFeed.do"
    "?f=y&sort=dtstart.utc:asc"
    "&fexpr=(categories.href!=%22/public/.bedework/categories/sys/Ongoing%22)"
    "%20and%20(categories.href=%22/public/.bedework/categories/org/UniversityEvents%22)"
    "%20and%20(entity_type=%22event%22%7Centity_type=%22todo%22)"
    "&skinName=list-json"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags and decode common entities."""
    text = re.sub(r"<[^>]*>", "", text)
    text = text.replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&amp;", "&").replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _decode_entities(text: str) -> str:
    """Decode common HTML entities in summaries."""
    return text.replace("&amp;", "&").replace("&#39;", "'")


def _clean_event(raw: dict) -> dict:
    """Transform a raw Bedework event into a clean, minimal format."""
    start = raw.get("start", {})
    end = raw.get("end", {})
    location = raw.get("location", {})

    day_name = start.get("dayname", "")[:3]            # "Mon"
    short_date = start.get("shortdate", "")            # "2/9/26"
    date_part = re.sub(r"/\d{2}$", "", short_date)     # "2/9"
    all_day = start.get("allday") == "true"

    time_range = "All day" if all_day else f"{start.get('time', '')} - {end.get('time', '')}"

    # Stable ID from guid (or eventlink as fallback)
    raw_id = raw.get("guid", raw.get("eventlink", ""))
    stable_id = hashlib.md5(raw_id.encode()).hexdigest()[:12]

    return {
        "id": stable_id,
        "summary": _decode_entities(raw.get("summary", "")),
        "link": raw.get("link", ""),
        "eventlink": raw.get("eventlink", ""),
        "startDate": raw.get("startDate", ""),
        "endDate": raw.get("endDate", ""),
        "location": {
            "address": location.get("address", "").replace("\t", " "),
            "mapLink": location.get("link", ""),
        },
        "description": _strip_html(raw.get("description", "")),
        "calendar": {
            "shortLabel": f"{day_name} {date_part}",
            "timeRange": time_range,
            "timezone": start.get("timezone", ""),
            "allDay": all_day,
        },
    }


def _read_events() -> list[dict]:
    """Read events from the local JSON file."""
    if not EVENTS_FILE.exists():
        return []
    try:
        data = json.loads(EVENTS_FILE.read_text())
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, Exception):
        return []


def _write_events(events: list[dict]) -> None:
    """Write events to the local JSON file."""
    EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVENTS_FILE.write_text(json.dumps(events, indent=2))


# ---------------------------------------------------------------------------
# Tools — the functions the LLM can call
# ---------------------------------------------------------------------------

@tool(description=(
    "Fetch upcoming events from Columbia University's calendar, "
    "clean them, and save to local JSON. Returns the cleaned events. "
    "Parameters: days (int, default 14) — how many days ahead to fetch, "
    "count (int, default 50) — max number of events."
))
async def fetch_columbia_events(days: int = 14, count: int = 50) -> dict:
    """Fetch, clean, and persist Columbia events."""
    url = f"{COLUMBIA_EVENTS_URL}&count={count}&days={days}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    raw_events = data.get("bwEventList", {}).get("events", [])
    clean_events = [_clean_event(e) for e in raw_events]

    # Merge with existing events (upsert by id)
    existing = _read_events()
    existing_ids = {e["id"] for e in existing}

    new_count = 0
    for event in clean_events:
        if event["id"] not in existing_ids:
            existing.append(event)
            existing_ids.add(event["id"])
            new_count += 1

    _write_events(existing)

    return {
        "fetched": len(raw_events),
        "cleaned": len(clean_events),
        "new_events_added": new_count,
        "total_stored": len(existing),
        "events": clean_events,
    }


@tool(description="Read all events from the local JSON file.")
def get_events() -> list[dict]:
    """Return all stored events."""
    return _read_events()


@tool(description="Get a single event by its ID from the local JSON file.")
def get_event(event_id: str) -> dict:
    """Return a single event by ID, or an error if not found."""
    for event in _read_events():
        if event["id"] == event_id:
            return event
    return {"error": f"Event with id '{event_id}' not found"}


@tool(description="Delete an event by its ID from the local JSON file.")
def delete_event(event_id: str) -> dict:
    """Remove an event by ID. Returns confirmation or error."""
    events = _read_events()
    original_count = len(events)
    events = [e for e in events if e["id"] != event_id]

    if len(events) == original_count:
        return {"error": f"Event with id '{event_id}' not found"}

    _write_events(events)
    return {"deleted": event_id, "remaining": len(events)}


@tool(description=(
    "Update fields on an existing event by its ID. "
    "Pass the event_id and a JSON string of fields to update."
))
def update_event(event_id: str, updates_json: str) -> dict:
    """Update an event's fields. updates_json is a JSON string of key-value pairs."""
    try:
        updates = json.loads(updates_json)
    except json.JSONDecodeError:
        return {"error": "updates_json must be valid JSON"}

    events = _read_events()
    for event in events:
        if event["id"] == event_id:
            updates.pop("id", None)  # never overwrite the id
            event.update(updates)
            _write_events(events)
            return {"updated": event_id, "event": event}

    return {"error": f"Event with id '{event_id}' not found"}


@tool(description=(
    "Add a custom event to the local JSON file. "
    "Pass a JSON string with event fields (summary, startDate, endDate are required)."
))
def add_event(event_json: str) -> dict:
    """Add a custom event. event_json must contain at least summary, startDate, endDate."""
    try:
        event = json.loads(event_json)
    except json.JSONDecodeError:
        return {"error": "event_json must be valid JSON"}

    required = ["summary", "startDate", "endDate"]
    missing = [f for f in required if f not in event]
    if missing:
        return {"error": f"Missing required fields: {', '.join(missing)}"}

    # Generate ID if not provided
    if "id" not in event:
        event["id"] = hashlib.md5(
            f"{event['summary']}{event['startDate']}".encode()
        ).hexdigest()[:12]

    events = _read_events()
    events.append(event)
    _write_events(events)

    return {"added": event["id"], "total": len(events), "event": event}


# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

server = MCPServer(
    name="columbia-events-mcp",
    http_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    streamable_http_stateless=True,
)

server.collect(
    fetch_columbia_events,
    get_events,
    get_event,
    delete_event,
    update_event,
    add_event,
)


if __name__ == "__main__":
    print("Starting Columbia Events MCP server at http://127.0.0.1:8001/mcp")
    asyncio.run(server.serve(port=8001))

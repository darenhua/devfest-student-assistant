"""
Columbia Events MCP Server

MCP server that fetches Columbia University events from the Bedework feed,
cleans them, and manages a local JSON file for CRUD operations.

Run (from this directory):
  uv run python server.py

The server starts at http://127.0.0.1:8001/mcp (Streamable HTTP).
"""

import os
import sys
import json
import re
import logging
import asyncio
from pathlib import Path
from datetime import datetime

import httpx
from dedalus_mcp import MCPServer, tool
from dedalus_mcp.server import TransportSecuritySettings
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("events-mcp")

logging.getLogger("dedalus_mcp").setLevel(logging.DEBUG)
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logging.getLogger("starlette").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.DEBUG)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
EVENTS_FILE = Path(__file__).parent / "events.json"

COLUMBIA_FEED_URL = (
    "https://events.columbia.edu/feeder/main/eventsFeed.do"
    "?f=y&sort=dtstart.utc:asc"
    "&fexpr=(categories.href!=%22/public/.bedework/categories/sys/Ongoing%22)"
    "%20and%20(categories.href=%22/public/.bedework/categories/org/UniversityEvents%22)"
    "%20and%20(entity_type=%22event%22%7Centity_type=%22todo%22)"
    "&skinName=list-json&count=50&days=14"
)

# ---------------------------------------------------------------------------
# Helpers — event cleaning (mirrors event-cleaner/page.tsx logic)
# ---------------------------------------------------------------------------

def _decode_html(text: str) -> str:
    """Decode common HTML entities."""
    return (
        text
        .replace("&amp;", "&")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
    )


def _strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    stripped = re.sub(r"<[^>]*>", "", text)
    return _decode_html(stripped).strip()


def clean_event(raw: dict) -> dict:
    """Transform a raw Bedework event into a clean, minimal format."""
    start = raw.get("start", {})
    end = raw.get("end", {})

    day_name = start.get("dayname", "")[:3]
    short_date = start.get("shortdate", "")
    date_part = re.sub(r"/\d{2}$", "", short_date)
    all_day = start.get("allday") == "true"

    if all_day:
        time_range = "All day"
    else:
        time_range = f"{start.get('time', '')} - {end.get('time', '')}"

    location = raw.get("location", {})

    return {
        "id": raw.get("guid", ""),
        "summary": _decode_html(raw.get("summary", "")),
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
            "timezone": start.get("timezone", "America/New_York"),
            "allDay": all_day,
        },
    }


def _read_events_file() -> list[dict]:
    """Read events from the local JSON file. Returns [] if file doesn't exist."""
    if not EVENTS_FILE.exists():
        return []
    try:
        data = json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def _write_events_file(events: list[dict]) -> None:
    """Write events list to the local JSON file."""
    EVENTS_FILE.write_text(
        json.dumps(events, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool(description="Fetch upcoming Columbia University events from the Bedework feed, clean them, and save to local JSON. Returns the cleaned events.")
def fetch_columbia_events() -> list[dict]:
    """Fetch events from Columbia's feed, clean them, and persist to events.json."""
    logger.info("[TOOL CALL] fetch_columbia_events()")

    with httpx.Client(timeout=30.0) as client:
        resp = client.get(COLUMBIA_FEED_URL)
        resp.raise_for_status()
        data = resp.json()

    raw_events = data.get("bwEventList", {}).get("events", [])
    logger.info(f"  Fetched {len(raw_events)} raw events from Columbia feed")

    cleaned = [clean_event(e) for e in raw_events]

    # Merge with existing: keep existing events not in the new fetch, add new ones
    existing = _read_events_file()
    existing_ids = {e["id"] for e in existing if "id" in e}
    new_ids = {e["id"] for e in cleaned}

    # Keep manually-added events (those not from the feed) + all freshly fetched
    manual_events = [e for e in existing if e.get("id") not in new_ids and e.get("_source") == "manual"]
    merged = cleaned + manual_events

    _write_events_file(merged)
    logger.info(f"  Saved {len(merged)} events to {EVENTS_FILE}")

    return cleaned


@tool(description="List all events currently stored in the local events.json file")
def list_events() -> list[dict]:
    """Read and return all events from the local JSON store."""
    logger.info("[TOOL CALL] list_events()")
    events = _read_events_file()
    logger.info(f"  Found {len(events)} events")
    return events


@tool(description="Add a new event to the local events.json. Provide summary, startDate (ISO), endDate (ISO), and optionally description, location_address, location_mapLink.")
def add_event(
    summary: str,
    startDate: str,
    endDate: str,
    description: str = "",
    location_address: str = "",
    location_mapLink: str = "",
) -> dict:
    """Add a manually-created event to the JSON store."""
    logger.info(f"[TOOL CALL] add_event(summary={summary!r})")

    event = {
        "id": f"manual-{datetime.now().strftime('%Y%m%dT%H%M%S')}",
        "summary": summary,
        "link": "",
        "eventlink": "",
        "startDate": startDate,
        "endDate": endDate,
        "location": {
            "address": location_address,
            "mapLink": location_mapLink,
        },
        "description": description,
        "calendar": {
            "shortLabel": "",
            "timeRange": "",
            "timezone": "America/New_York",
            "allDay": False,
        },
        "_source": "manual",
    }

    events = _read_events_file()
    events.append(event)
    _write_events_file(events)
    logger.info(f"  Added event, total now {len(events)}")
    return event


@tool(description="Update an existing event in events.json by its id. Pass the event id and any fields to update (summary, description, startDate, endDate, location_address, location_mapLink).")
def update_event(
    event_id: str,
    summary: str = "",
    description: str = "",
    startDate: str = "",
    endDate: str = "",
    location_address: str = "",
    location_mapLink: str = "",
) -> dict:
    """Update fields of an existing event by id."""
    logger.info(f"[TOOL CALL] update_event(id={event_id!r})")

    events = _read_events_file()
    target = None
    for e in events:
        if e.get("id") == event_id:
            target = e
            break

    if target is None:
        return {"error": f"Event with id '{event_id}' not found"}

    if summary:
        target["summary"] = summary
    if description:
        target["description"] = description
    if startDate:
        target["startDate"] = startDate
    if endDate:
        target["endDate"] = endDate
    if location_address:
        target["location"]["address"] = location_address
    if location_mapLink:
        target["location"]["mapLink"] = location_mapLink

    _write_events_file(events)
    logger.info(f"  Updated event {event_id!r}")
    return target


@tool(description="Delete an event from events.json by its id")
def delete_event(event_id: str) -> dict:
    """Remove an event from the JSON store by id."""
    logger.info(f"[TOOL CALL] delete_event(id={event_id!r})")

    events = _read_events_file()
    original_count = len(events)
    events = [e for e in events if e.get("id") != event_id]

    if len(events) == original_count:
        return {"error": f"Event with id '{event_id}' not found", "deleted": False}

    _write_events_file(events)
    logger.info(f"  Deleted event {event_id!r}, {len(events)} remaining")
    return {"deleted": True, "remaining": len(events)}


# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

server = MCPServer(
    name="columbia-events-mcp",
    http_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    streamable_http_stateless=True,
)
logger.info(f"MCPServer created: name={server.name!r}")

server.collect(fetch_columbia_events, list_events, add_event, update_event, delete_event)
logger.info("Registered tools: fetch_columbia_events, list_events, add_event, update_event, delete_event")


if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8001"))
    logger.info("=" * 60)
    logger.info(f"Starting MCP server at http://127.0.0.1:{port}/mcp")
    logger.info(f"  Server name: {server.name}")
    logger.info(f"  Events file: {EVENTS_FILE}")
    logger.info(f"  Tools: fetch_columbia_events, list_events, add_event, update_event, delete_event")
    logger.info(f"  PID: {os.getpid()}")
    logger.info("=" * 60)
    asyncio.run(server.serve(port=port))

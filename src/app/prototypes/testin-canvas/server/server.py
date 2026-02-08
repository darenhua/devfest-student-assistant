"""
Canvas LMS MCP Server

MCP server that wraps the Canvas LMS REST API, providing tools for
querying courses, assignments, grades, todos, calendar, announcements, and modules.

Run (from this directory):
  uv run python server.py

The server starts at http://127.0.0.1:8002/mcp (Streamable HTTP).
"""

import os
import re
import sys
import json
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
logger = logging.getLogger("canvas-mcp")

logging.getLogger("dedalus_mcp").setLevel(logging.DEBUG)
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logging.getLogger("starlette").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.DEBUG)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CANVAS_BASE_URL = os.getenv("CANVAS_BASE_URL", "https://courseworks2.columbia.edu")
CANVAS_API_TOKEN = os.getenv("CANVAS_API_TOKEN", "")
CACHE_FILE = Path(__file__).parent / "canvas_cache.json"

if not CANVAS_API_TOKEN:
    logger.warning("CANVAS_API_TOKEN is not set! API calls will fail.")


# ---------------------------------------------------------------------------
# Canvas API helpers
# ---------------------------------------------------------------------------

def _headers() -> dict:
    return {"Authorization": f"Bearer {CANVAS_API_TOKEN}"}


def _get(endpoint: str, params: dict | None = None) -> dict | list:
    """Make an authenticated GET request to Canvas API."""
    url = f"{CANVAS_BASE_URL}/api/v1{endpoint}"
    logger.debug(f"  GET {url} params={params}")
    response = httpx.get(url, headers=_headers(), params=params or {}, timeout=30.0)
    response.raise_for_status()
    return response.json()


def _get_paginated(endpoint: str, params: dict | None = None, max_pages: int = 5) -> list:
    """Handle Canvas Link-header pagination, collecting up to max_pages of results."""
    url = f"{CANVAS_BASE_URL}/api/v1{endpoint}"
    all_results = []
    params = dict(params or {})
    params["per_page"] = 100

    for _ in range(max_pages):
        logger.debug(f"  GET (paginated) {url} params={params}")
        response = httpx.get(url, headers=_headers(), params=params, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            all_results.extend(data)
        else:
            all_results.append(data)

        # Check for next page via Link header
        links = response.headers.get("Link", "")
        next_url = None
        for link in links.split(","):
            if 'rel="next"' in link:
                next_url = link.split(";")[0].strip().strip("<>")
                break
        if not next_url:
            break
        url = next_url
        params = {}  # params are baked into the URL now

    return all_results


def _update_cache(key: str, data: any) -> None:
    """Update a key in the local cache file."""
    cache = {}
    if CACHE_FILE.exists():
        try:
            cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            cache = {}

    cache[key] = data
    cache["lastUpdated"] = datetime.now().isoformat()

    CACHE_FILE.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    logger.info(f"  Cache updated: {key} ({len(data) if isinstance(data, list) else 'obj'} items)")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool(description="List all active courses for the current Canvas user. Returns course id, name, code, term, and grade info.")
def list_courses(enrollment_state: str = "active") -> list[dict]:
    """List the current user's courses."""
    logger.info(f"[TOOL CALL] list_courses(enrollment_state={enrollment_state!r})")

    courses = _get_paginated("/courses", {
        "enrollment_state": enrollment_state,
        "include[]": ["term", "total_scores", "favorites"],
    })

    _update_cache("courses", courses)
    logger.info(f"  Found {len(courses)} courses")
    return courses


@tool(description="Get details for a specific course by its Canvas course ID. Includes term, grades, and syllabus.")
def get_course(course_id: int) -> dict:
    """Get details for a specific course."""
    logger.info(f"[TOOL CALL] get_course(course_id={course_id})")

    return _get(f"/courses/{course_id}", {
        "include[]": ["term", "total_scores", "syllabus_body"],
    })


@tool(description="List assignments for a Canvas course, sorted by due date. Includes submission status and score statistics.")
def list_assignments(course_id: int, order_by: str = "due_at") -> list[dict]:
    """List assignments for a course, sorted by due date."""
    logger.info(f"[TOOL CALL] list_assignments(course_id={course_id}, order_by={order_by!r})")

    assignments = _get_paginated(f"/courses/{course_id}/assignments", {
        "order_by": order_by,
        "include[]": ["submission", "score_statistics"],
    })

    _update_cache("assignments", assignments)
    logger.info(f"  Found {len(assignments)} assignments")
    return assignments


@tool(description="Get details for a specific assignment including description, rubric, and submission info.")
def get_assignment(course_id: int, assignment_id: int) -> dict:
    """Get details for a specific assignment."""
    logger.info(f"[TOOL CALL] get_assignment(course_id={course_id}, assignment_id={assignment_id})")

    return _get(f"/courses/{course_id}/assignments/{assignment_id}", {
        "include[]": ["submission", "score_statistics"],
    })


@tool(description="Get the current user's submission for a specific assignment. Shows score, grade, comments, and rubric assessment.")
def get_my_submission(course_id: int, assignment_id: int) -> dict:
    """Get the current user's submission for a specific assignment."""
    logger.info(f"[TOOL CALL] get_my_submission(course_id={course_id}, assignment_id={assignment_id})")

    return _get(
        f"/courses/{course_id}/assignments/{assignment_id}/submissions/self",
        {"include[]": ["submission_comments", "rubric_assessment"]},
    )


@tool(description="Get the current user's upcoming calendar events and assignment due dates.")
def get_upcoming_events() -> list[dict]:
    """Get the current user's upcoming events."""
    logger.info("[TOOL CALL] get_upcoming_events()")

    return _get("/users/self/upcoming_events")


@tool(description="Get the current user's todo items — assignments that need submitting or grading.")
def get_todo_items() -> list[dict]:
    """Get todo items for the current user."""
    logger.info("[TOOL CALL] get_todo_items()")

    todos = _get("/users/self/todo")
    _update_cache("todos", todos)
    return todos


@tool(description="Get the grade breakdown for all assignments in a course for the current user.")
def get_grades_summary(course_id: int) -> list[dict]:
    """Get grade breakdown per assignment for the current user."""
    logger.info(f"[TOOL CALL] get_grades_summary(course_id={course_id})")

    return _get(f"/courses/{course_id}/analytics/users/self/assignments")


@tool(description="Get recent announcements for the given courses. Pass a list of course IDs and optionally a start_date (YYYY-MM-DD).")
def list_announcements(course_ids: list[int], start_date: str = "") -> list[dict]:
    """Get recent announcements for the given courses."""
    logger.info(f"[TOOL CALL] list_announcements(course_ids={course_ids}, start_date={start_date!r})")

    params: dict = {"context_codes[]": [f"course_{cid}" for cid in course_ids]}
    if start_date:
        params["start_date"] = start_date
    return _get("/announcements", params)


@tool(description="List all modules for a course, including module items.")
def list_modules(course_id: int) -> list[dict]:
    """List all modules for a course."""
    logger.info(f"[TOOL CALL] list_modules(course_id={course_id})")

    return _get_paginated(f"/courses/{course_id}/modules", {
        "include[]": ["items"],
    })


@tool(description="List calendar events in a date range. Specify start_date and end_date (YYYY-MM-DD), optionally filter by course IDs and event type ('event' or 'assignment').")
def list_calendar_events(
    start_date: str,
    end_date: str,
    course_ids: list[int] = [],
    event_type: str = "event",
) -> list[dict]:
    """List calendar events in a date range."""
    logger.info(f"[TOOL CALL] list_calendar_events(start={start_date}, end={end_date}, type={event_type})")

    params: dict = {
        "start_date": start_date,
        "end_date": end_date,
        "type": event_type,
    }
    if course_ids:
        params["context_codes[]"] = [f"course_{cid}" for cid in course_ids]
    return _get_paginated("/calendar_events", params)


@tool(description="Get the current user's Canvas profile.")
def get_user_profile() -> dict:
    """Get the current user's profile."""
    logger.info("[TOOL CALL] get_user_profile()")

    return _get("/users/self/profile")


# ---------------------------------------------------------------------------
# Syllabus & Content Tools
# ---------------------------------------------------------------------------

def _strip_html(html: str) -> str:
    """Strip HTML tags and decode common entities. Returns plain text."""
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|li|tr)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&amp;", "&")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&quot;", '"')
    )
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


@tool(description="Get the syllabus for a course. Returns the syllabus body as plain text (HTML stripped). This is the syllabus content set by the instructor in Canvas. Look for office hours, exam dates, grading policies, etc.")
def get_syllabus(course_id: int) -> dict:
    """Fetch the syllabus_body for a course and return it as cleaned text."""
    logger.info(f"[TOOL CALL] get_syllabus(course_id={course_id})")

    course = _get(f"/courses/{course_id}", {
        "include[]": ["syllabus_body"],
    })

    raw_html = course.get("syllabus_body") or ""
    plain_text = _strip_html(raw_html)

    result = {
        "course_id": course_id,
        "course_name": course.get("name", ""),
        "has_syllabus": bool(plain_text),
        "syllabus_text": plain_text if plain_text else "(No syllabus body set for this course)",
    }

    logger.info(f"  Syllabus length: {len(plain_text)} chars")
    return result


@tool(description="List all wiki pages for a course. Syllabi, office hours, and exam schedules are often published as Canvas pages. Returns page titles and URLs.")
def list_course_pages(course_id: int, search_term: str = "") -> list[dict]:
    """List wiki pages in a course, optionally filtering by search term."""
    logger.info(f"[TOOL CALL] list_course_pages(course_id={course_id}, search_term={search_term!r})")

    params: dict = {}
    if search_term:
        params["search_term"] = search_term

    pages = _get_paginated(f"/courses/{course_id}/pages", params)
    logger.info(f"  Found {len(pages)} pages")

    return [
        {
            "page_id": p.get("page_id"),
            "url": p.get("url", ""),
            "title": p.get("title", ""),
            "created_at": p.get("created_at"),
            "updated_at": p.get("updated_at"),
            "published": p.get("published"),
        }
        for p in pages
    ]


@tool(description="Get the full content of a Canvas wiki page by its URL slug. Use this after list_course_pages to read a specific page. Returns the page body as plain text. Great for reading syllabus pages, office hours pages, exam info pages, etc.")
def get_course_page(course_id: int, page_url: str) -> dict:
    """Fetch a specific wiki page and return its body as plain text."""
    logger.info(f"[TOOL CALL] get_course_page(course_id={course_id}, page_url={page_url!r})")

    page = _get(f"/courses/{course_id}/pages/{page_url}")

    raw_html = page.get("body") or ""
    plain_text = _strip_html(raw_html)

    return {
        "course_id": course_id,
        "title": page.get("title", ""),
        "url": page.get("url", ""),
        "updated_at": page.get("updated_at"),
        "body_text": plain_text if plain_text else "(Empty page)",
    }


@tool(description="Search for files in a course by name. Use this to find syllabus PDFs, exam schedules, or other uploaded documents. Returns file names, sizes, and download URLs.")
def search_course_files(course_id: int, search_term: str = "syllabus") -> list[dict]:
    """Search for files in a course, defaulting to 'syllabus'."""
    logger.info(f"[TOOL CALL] search_course_files(course_id={course_id}, search_term={search_term!r})")

    files = _get_paginated(f"/courses/{course_id}/files", {
        "search_term": search_term,
    })
    logger.info(f"  Found {len(files)} files matching '{search_term}'")

    return [
        {
            "id": f.get("id"),
            "display_name": f.get("display_name", ""),
            "filename": f.get("filename", ""),
            "content_type": f.get("content-type", ""),
            "size": f.get("size"),
            "url": f.get("url", ""),
            "created_at": f.get("created_at"),
            "updated_at": f.get("updated_at"),
        }
        for f in files
    ]


# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

server = MCPServer(
    name="canvas-lms-mcp",
    http_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    streamable_http_stateless=True,
)
logger.info(f"MCPServer created: name={server.name!r}")

server.collect(
    list_courses,
    get_course,
    list_assignments,
    get_assignment,
    get_my_submission,
    get_upcoming_events,
    get_todo_items,
    get_grades_summary,
    list_announcements,
    list_modules,
    list_calendar_events,
    get_user_profile,
    get_syllabus,
    list_course_pages,
    get_course_page,
    search_course_files,
)
logger.info("Registered 16 Canvas LMS tools")


if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8002"))
    logger.info("=" * 60)
    logger.info(f"Starting Canvas MCP server at http://127.0.0.1:{port}/mcp")
    logger.info(f"  Server name: {server.name}")
    logger.info(f"  Canvas URL: {CANVAS_BASE_URL}")
    logger.info(f"  Token set: {bool(CANVAS_API_TOKEN)}")
    logger.info(f"  Cache file: {CACHE_FILE}")
    logger.info(f"  PID: {os.getpid()}")
    logger.info("=" * 60)
    asyncio.run(server.serve(port=port))

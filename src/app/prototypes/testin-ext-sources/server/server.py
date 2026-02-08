"""
External Sources MCP Server

MCP server that crawls external course homepages (non-Canvas) to discover
assignments, exams, office hours, syllabi, and other academic info.

Reads source URLs from LINKS.json, fetches pages, follows links, extracts
structured findings, and persists results to findings_cache.json.

Run (from this directory):
  uv run python server.py

The server starts at http://127.0.0.1:8003/mcp (Streamable HTTP).
"""

import os
import re
import sys
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
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
logger = logging.getLogger("ext-sources-mcp")

logging.getLogger("dedalus_mcp").setLevel(logging.DEBUG)
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SERVER_DIR = Path(__file__).parent
LINKS_FILE = SERVER_DIR / "LINKS.json"
CACHE_FILE = SERVER_DIR / "findings_cache.json"

HTTP_TIMEOUT = 30.0
MAX_CONTENT_LENGTH = 500_000  # 500KB max per page
USER_AGENT = "SchoolAssistant/1.0 (educational crawler)"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_links() -> list[dict]:
    """Read source links from LINKS.json."""
    if not LINKS_FILE.exists():
        return []
    try:
        return json.loads(LINKS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, IOError):
        return []


def _write_links(links: list[dict]) -> None:
    """Write source links to LINKS.json."""
    LINKS_FILE.write_text(
        json.dumps(links, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _read_cache() -> dict:
    """Read findings cache."""
    if not CACHE_FILE.exists():
        return {"findings": [], "crawlLog": [], "lastUpdated": None}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, IOError):
        return {"findings": [], "crawlLog": [], "lastUpdated": None}


def _update_cache(key: str, data: any) -> None:
    """Update a key in the findings cache file."""
    cache = _read_cache()
    cache[key] = data
    cache["lastUpdated"] = datetime.now().isoformat()
    CACHE_FILE.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    logger.info(f"  Cache updated: {key} ({len(data) if isinstance(data, list) else 'obj'} items)")


def _coerce_str(val: any) -> str:
    """Coerce a value to str — handles the case where the MCP bridge passes
    a dict like {"url": "..."} instead of a plain string."""
    if isinstance(val, dict):
        # Try common keys
        for key in ("url", "value", "text", "source_id"):
            if key in val:
                return str(val[key])
        # Fall back to first value
        if val:
            return str(next(iter(val.values())))
    return str(val)


def _coerce_int(val: any, default: int = 0) -> int:
    """Coerce a value to int — handles dict wrapping from the MCP bridge."""
    if isinstance(val, dict):
        for key in ("max_subpages", "max_subpages_per_source", "value"):
            if key in val:
                return int(val[key])
        if val:
            return int(next(iter(val.values())))
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _coerce_list(val: any) -> list:
    """Coerce a value to list — handles JSON string from MCP bridge."""
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass
    if isinstance(val, list):
        return val
    return []


def _fetch_page(url: str) -> tuple[str, str]:
    """Fetch a web page and return (html_content, final_url).

    Follows redirects. Respects MAX_CONTENT_LENGTH.
    """
    url = _coerce_str(url)
    logger.debug(f"  Fetching: {url}")
    response = httpx.get(
        url,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "text/plain" not in content_type:
        return f"(Non-HTML content: {content_type})", str(response.url)

    text = response.text[:MAX_CONTENT_LENGTH]
    return text, str(response.url)


def _extract_text(html: str) -> str:
    """Extract readable text from HTML using BeautifulSoup."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header"]):
        element.decompose()

    text = soup.get_text(separator="\n", strip=True)
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_links(html: str, base_url: str) -> list[dict]:
    """Extract all links from an HTML page, resolving relative URLs."""
    soup = BeautifulSoup(html, "html.parser")
    links = []
    seen = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue

        absolute_url = urljoin(base_url, href)
        if absolute_url in seen:
            continue
        seen.add(absolute_url)

        link_text = a.get_text(strip=True)[:200]
        links.append({
            "url": absolute_url,
            "text": link_text,
        })

    return links


def _is_same_site(url1: str, url2: str) -> bool:
    """Check if two URLs are on the same site (same netloc)."""
    return urlparse(url1).netloc == urlparse(url2).netloc


def _looks_interesting(url: str, link_text: str) -> bool:
    """Heuristic: does this link look like it could contain academic info?"""
    combined = (url + " " + link_text).lower()
    keywords = [
        "syllabus", "homework", "assignment", "hw", "problem set", "pset",
        "exam", "midterm", "final", "quiz", "test",
        "office hour", "oh", "schedule", "calendar",
        "grade", "grading", "policy", "policies",
        "lecture", "slide", "note", "reading",
        "lab", "project", "recitation", "section",
        "ta", "staff", "instructor", "professor",
        ".pdf", ".docx", ".doc",
    ]
    return any(kw in combined for kw in keywords)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool(description="List all source links from LINKS.json. These are the external course homepage URLs that this server crawls.")
def list_sources() -> list[dict]:
    """List all configured source links."""
    logger.info("[TOOL CALL] list_sources()")
    links = _read_links()
    logger.info(f"  Found {len(links)} sources")
    return links


@tool(description="Add a new source URL to LINKS.json. Provide the URL and an optional label. Returns the updated list of sources.")
def add_source(url: str, label: str = "") -> list[dict]:
    """Add a new source URL."""
    url = _coerce_str(url)
    label = _coerce_str(label) if label else ""
    logger.info(f"[TOOL CALL] add_source(url={url!r}, label={label!r})")
    links = _read_links()

    # Check for duplicate
    if any(l["url"] == url for l in links):
        logger.info("  Source already exists, skipping")
        return links

    new_link = {
        "id": urlparse(url).netloc.replace(".", "-") + "-" + str(len(links)),
        "url": url,
        "label": label or urlparse(url).path.strip("/") or urlparse(url).netloc,
        "addedAt": datetime.now().isoformat(),
    }
    links.append(new_link)
    _write_links(links)
    logger.info(f"  Added source: {new_link['label']}")
    return links


@tool(description="Remove a source URL from LINKS.json by its URL or id. Returns the updated list of sources.")
def remove_source(source_id: str = "", url: str = "") -> list[dict]:
    """Remove a source by id or url."""
    source_id = _coerce_str(source_id) if source_id else ""
    url = _coerce_str(url) if url else ""
    logger.info(f"[TOOL CALL] remove_source(source_id={source_id!r}, url={url!r})")
    links = _read_links()
    original_count = len(links)

    links = [l for l in links if l.get("id") != source_id and l.get("url") != url]

    _write_links(links)
    removed = original_count - len(links)
    logger.info(f"  Removed {removed} source(s), {len(links)} remaining")
    return links


@tool(description="Fetch a specific web page URL and return its plain text content along with all links found on the page. Use this to explore any URL — course homepage, syllabus page, etc.")
def fetch_page(url: str) -> dict:
    """Fetch a single page and return its text content and links."""
    url = _coerce_str(url)
    logger.info(f"[TOOL CALL] fetch_page(url={url!r})")

    try:
        html, final_url = _fetch_page(url)
        text = _extract_text(html)
        links = _extract_links(html, final_url)

        # Truncate text for LLM consumption
        if len(text) > 15000:
            text = text[:15000] + "\n\n... (truncated, page has more content)"

        result = {
            "url": final_url,
            "text_length": len(text),
            "text": text,
            "links_count": len(links),
            "links": links[:50],  # Cap at 50 links
        }
        logger.info(f"  Fetched {len(text)} chars, {len(links)} links from {final_url}")
        return result
    except Exception as e:
        logger.error(f"  Failed to fetch {url}: {e}")
        return {"url": url, "error": str(e), "text": "", "links": []}


@tool(description="Crawl a source URL: fetch the homepage, find interesting sub-links (assignments, syllabus, exams, office hours), and follow them. Returns a structured summary of everything found. This is the main tool for discovering academic info from a course homepage.")
def crawl_source(url: str, max_subpages: int = 10) -> dict:
    """Crawl a source homepage and its interesting sub-links."""
    url = _coerce_str(url)
    max_subpages = _coerce_int(max_subpages, 10)
    logger.info(f"[TOOL CALL] crawl_source(url={url!r}, max_subpages={max_subpages})")

    results = {
        "source_url": url,
        "pages_crawled": [],
        "interesting_links_found": [],
        "errors": [],
    }

    # Fetch the main page
    try:
        html, final_url = _fetch_page(url)
        main_text = _extract_text(html)
        all_links = _extract_links(html, final_url)

        results["pages_crawled"].append({
            "url": final_url,
            "title": "Homepage",
            "text_preview": main_text[:3000],
            "links_on_page": len(all_links),
        })

        # Find interesting links to follow
        interesting = []
        for link in all_links:
            if _looks_interesting(link["url"], link["text"]):
                interesting.append(link)
            elif _is_same_site(url, link["url"]):
                # Same-site links might still be useful
                interesting.append(link)

        results["interesting_links_found"] = interesting[:30]

        # Follow the most promising links
        followed = 0
        for link in interesting:
            if followed >= max_subpages:
                break
            sub_url = link["url"]

            # Skip non-HTTP links, anchors, large files
            parsed = urlparse(sub_url)
            if parsed.scheme not in ("http", "https"):
                continue
            ext = parsed.path.lower().split(".")[-1] if "." in parsed.path else ""
            if ext in ("zip", "tar", "gz", "mp4", "mov", "avi", "mp3", "wav"):
                continue

            try:
                sub_html, sub_final_url = _fetch_page(sub_url)
                sub_text = _extract_text(sub_html)

                results["pages_crawled"].append({
                    "url": sub_final_url,
                    "title": link["text"][:100] or sub_final_url,
                    "text_preview": sub_text[:2000],
                })
                followed += 1
            except Exception as e:
                results["errors"].append({"url": sub_url, "error": str(e)})
                logger.debug(f"  Failed to follow link {sub_url}: {e}")

    except Exception as e:
        results["errors"].append({"url": url, "error": str(e)})
        logger.error(f"  Failed to crawl source {url}: {e}")

    logger.info(f"  Crawled {len(results['pages_crawled'])} pages, "
                f"{len(results['interesting_links_found'])} interesting links, "
                f"{len(results['errors'])} errors")

    return results


@tool(description="Crawl ALL sources in LINKS.json and return combined results. Use this for a comprehensive scan of all course sources.")
def crawl_all_sources(max_subpages_per_source: int = 5) -> dict:
    """Crawl all configured sources."""
    max_subpages_per_source = _coerce_int(max_subpages_per_source, 5)
    logger.info(f"[TOOL CALL] crawl_all_sources(max_subpages={max_subpages_per_source})")
    links = _read_links()

    all_results = []
    for link in links:
        result = crawl_source(link["url"], max_subpages=max_subpages_per_source)
        result["source_label"] = link.get("label", "")
        result["source_id"] = link.get("id", "")
        all_results.append(result)

    # Update crawl log
    _update_cache("crawlLog", [{
        "timestamp": datetime.now().isoformat(),
        "sources_crawled": len(links),
        "total_pages": sum(len(r["pages_crawled"]) for r in all_results),
    }])

    return {
        "sources_crawled": len(all_results),
        "results": all_results,
    }


@tool(description="Save structured findings (assignments, exams, office hours, etc.) to the cache. Pass an array of finding objects as a JSON string or list. Each finding should have: type (homework|exam|office_hours|syllabus|lecture|other), title, description, source_url, and optionally due_date, location, time_info.")
def save_findings(findings: str) -> dict:
    """Save extracted findings to cache.

    findings can be a JSON string (from the LLM) or an actual list.
    """
    # Coerce findings from JSON string to list[dict]
    if isinstance(findings, str):
        try:
            findings = json.loads(findings)
        except (json.JSONDecodeError, ValueError):
            logger.error(f"  Failed to parse findings JSON: {findings[:200]}")
            return {"error": "findings must be a JSON array of objects", "saved": 0}

    if not isinstance(findings, list):
        findings = [findings] if isinstance(findings, dict) else []

    logger.info(f"[TOOL CALL] save_findings({len(findings)} findings)")

    cache = _read_cache()
    existing = cache.get("findings", [])

    # Add metadata to each finding
    for i, f in enumerate(findings):
        if not isinstance(f, dict):
            continue
        f["savedAt"] = datetime.now().isoformat()
        if "id" not in f:
            f["id"] = f"{f.get('type', 'unknown')}-{len(existing) + i}-{datetime.now().strftime('%H%M%S')}"

    # Filter to only valid dicts
    findings = [f for f in findings if isinstance(f, dict)]

    # Merge: replace findings with same id, add new ones
    new_ids = {nf.get("id") for nf in findings}
    merged = [f for f in existing if f.get("id") not in new_ids]
    merged.extend(findings)

    _update_cache("findings", merged)

    logger.info(f"  Saved {len(findings)} new findings, {len(merged)} total")
    return {"saved": len(findings), "total": len(merged)}


@tool(description="List all saved findings from the cache. Optionally filter by type (homework, exam, office_hours, syllabus, lecture, other).")
def list_findings(finding_type: str = "") -> list[dict]:
    """List saved findings, optionally filtered by type."""
    finding_type = _coerce_str(finding_type) if finding_type else ""
    logger.info(f"[TOOL CALL] list_findings(type={finding_type!r})")

    cache = _read_cache()
    findings = cache.get("findings", [])

    if finding_type:
        findings = [f for f in findings if f.get("type") == finding_type]

    _update_cache("findings", cache.get("findings", []))  # refresh lastUpdated
    logger.info(f"  Returning {len(findings)} findings")
    return findings


@tool(description="Clear all saved findings from the cache. Use this to start fresh before a new crawl.")
def clear_findings() -> dict:
    """Clear all findings from cache."""
    logger.info("[TOOL CALL] clear_findings()")
    _update_cache("findings", [])
    return {"cleared": True}


# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

server = MCPServer(
    name="ext-sources-mcp",
    http_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    streamable_http_stateless=True,
)
logger.info(f"MCPServer created: name={server.name!r}")

server.collect(
    list_sources,
    add_source,
    remove_source,
    fetch_page,
    crawl_source,
    crawl_all_sources,
    save_findings,
    list_findings,
    clear_findings,
)
logger.info("Registered 9 external-sources tools")


if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8003"))
    logger.info("=" * 60)
    logger.info(f"Starting External Sources MCP server at http://127.0.0.1:{port}/mcp")
    logger.info(f"  Server name: {server.name}")
    logger.info(f"  Links file: {LINKS_FILE}")
    logger.info(f"  Cache file: {CACHE_FILE}")
    logger.info(f"  PID: {os.getpid()}")
    logger.info("=" * 60)
    asyncio.run(server.serve(port=port))

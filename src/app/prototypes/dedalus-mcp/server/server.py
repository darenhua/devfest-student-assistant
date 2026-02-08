"""
Dedalus MCP Server — Hello World Prototype

A dummy MCP server built with dedalus_mcp that demonstrates:
  - Tool registration with @tool decorator
  - DAuth (Dedalus Auth) configuration
  - Connection schemas for external API credentials

Run (from this directory):
  uv run python server.py

The server starts at http://127.0.0.1:8000/mcp (Streamable HTTP).
Connect to it from the Dedalus SDK with:
  mcp_servers=["http://localhost:8000/mcp"]
"""

import os
import sys
import logging
import asyncio
from dedalus_mcp import MCPServer, tool, get_context
from dedalus_mcp.server import TransportSecuritySettings
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Logging — verbose output so we can debug MCP integration issues
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("mcp-server")

# Also crank up dedalus_mcp internals
logging.getLogger("dedalus_mcp").setLevel(logging.DEBUG)
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.access").setLevel(logging.DEBUG)
logging.getLogger("uvicorn.error").setLevel(logging.DEBUG)
logging.getLogger("starlette").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.DEBUG)

# ---------------------------------------------------------------------------
# Tools — these are the functions the LLM can call
# ---------------------------------------------------------------------------

@tool(description="Say hello to someone by name")
def hello(name: str) -> str:
    """Greet a person by name."""
    logger.info(f"[TOOL CALL] hello(name={name!r})")
    result = f"Hello, {name}! Welcome to the Dedalus MCP prototype."
    logger.info(f"[TOOL RESULT] hello -> {result!r}")
    return result


@tool(description="Add two numbers together")
def add(a: int, b: int) -> int:
    """Add two integers and return the sum."""
    logger.info(f"[TOOL CALL] add(a={a}, b={b})")
    result = a + b
    logger.info(f"[TOOL RESULT] add -> {result}")
    return result


@tool(description="Get the current server status and uptime info")
def server_status() -> dict:
    """Return dummy server status information."""
    logger.info("[TOOL CALL] server_status()")
    result = {
        "status": "running",
        "version": "0.1.0",
        "server": "hello-world-mcp",
        "tools_registered": 4,
    }
    logger.info(f"[TOOL RESULT] server_status -> {result}")
    return result


@tool(description="Get current user's auth context (demonstrates DAuth)")
def whoami() -> dict:
    """Return the authenticated user's info from the DAuth context."""
    logger.info("[TOOL CALL] whoami()")
    try:
        ctx = get_context()
        logger.debug(f"  got context: {ctx}")
        auth = ctx.auth_context
        logger.debug(f"  auth_context: {auth}")
    except Exception as e:
        logger.error(f"  get_context() failed: {e}", exc_info=True)
        return {"user": "anonymous", "authenticated": False, "error": str(e)}

    if auth is None:
        logger.info("[TOOL RESULT] whoami -> anonymous (no auth context)")
        return {"user": "anonymous", "authenticated": False}

    result = {
        "authenticated": True,
        "subject": auth.subject,
        "scopes": auth.scopes,
        "claims": auth.claims,
    }
    logger.info(f"[TOOL RESULT] whoami -> {result}")
    return result


# ---------------------------------------------------------------------------
# Server setup — no DAuth for local dev (simplest possible config)
# ---------------------------------------------------------------------------

server = MCPServer(
    name="hello-world-mcp",
    # Disable DNS rebinding protection for local dev (localhost != 127.0.0.1)
    http_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    # Stateless mode — no session tracking needed for local dev
    streamable_http_stateless=True,
)
logger.info(f"MCPServer created: name={server.name!r} (no DAuth, stateless, no DNS rebinding protection)")

# Register all tools
server.collect(hello, add, server_status, whoami)
logger.info("Registered tools: hello, add, server_status, whoami")


if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8000"))
    logger.info("=" * 60)
    logger.info(f"Starting MCP server at http://127.0.0.1:{port}/mcp")
    logger.info(f"  Server name: {server.name}")
    logger.info(f"  Auth: none (local dev)")
    logger.info(f"  Tools: hello, add, server_status, whoami")
    logger.info(f"  PID: {os.getpid()}")
    logger.info("=" * 60)
    asyncio.run(server.serve(port=port))

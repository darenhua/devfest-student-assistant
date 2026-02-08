"""
Dedalus MCP Server — DAuth Demo

Unlike the basic dedalus-mcp prototype, this server ENABLES authorization
enforcement via AuthorizationConfig. Every request must carry a valid DAuth
token; unauthenticated calls get a 401 with a WWW-Authenticate challenge
that kicks off the OAuth 2.1 / PKCE flow.

Run (from this directory):
  uv run python server.py

Server starts at http://127.0.0.1:8001/mcp (Streamable HTTP).
"""

import os
import asyncio
from dedalus_mcp import MCPServer, tool, get_context
from dedalus_mcp.server import AuthorizationConfig, TransportSecuritySettings


# ---------------------------------------------------------------------------
# Tools — every call requires at least the "read" scope
# ---------------------------------------------------------------------------

@tool(description="Return the authenticated user's identity and claims")
def whoami() -> dict:
    """Show who the current DAuth-authenticated user is."""
    ctx = get_context()
    auth = ctx.auth_context

    if auth is None:
        # Should not happen when authorization is enabled, but be safe
        return {"authenticated": False, "user": "anonymous"}

    return {
        "authenticated": True,
        "subject": auth.subject,
        "scopes": auth.scopes,
        "claims": auth.claims,
    }


@tool(description="Get a secret homework assignment (requires 'read' scope)")
def get_secret_assignment() -> dict:
    """A protected resource that only authenticated users can access."""
    ctx = get_context()
    auth = ctx.auth_context

    user = auth.subject if auth else "anonymous"
    return {
        "assignment": "Build an MCP server with DAuth",
        "due": "2026-03-01",
        "assigned_to": user,
        "status": "pending",
    }


@tool(
    description="Submit homework (requires 'write' scope)",
    required_scopes=["write"],
)
def submit_homework(title: str, content: str) -> dict:
    """
    A tool with an extra scope requirement beyond the server-level 'read'.
    Only tokens with both 'read' AND 'write' scopes can call this.
    """
    ctx = get_context()
    auth = ctx.auth_context
    user = auth.subject if auth else "anonymous"

    return {
        "submitted": True,
        "title": title,
        "by": user,
        "message": f"Homework '{title}' submitted successfully.",
    }


@tool(description="Check server health and auth configuration")
def server_info() -> dict:
    """Public info about this server's auth setup."""
    return {
        "server": "dauth-demo-mcp",
        "version": "0.1.0",
        "auth_enabled": True,
        "required_scopes": ["read"],
        "authorization_server": os.getenv("DEDALUS_AS_URL", "https://as.dedaluslabs.ai"),
        "tools": ["whoami", "get_secret_assignment", "submit_homework", "server_info"],
    }


# ---------------------------------------------------------------------------
# Server setup with DAuth ENABLED
# ---------------------------------------------------------------------------

server = MCPServer(
    name="dauth-demo-mcp",
    # Enable authorization enforcement — this is the key difference from
    # the basic dedalus-mcp prototype. Unauthenticated requests now get
    # 401 + WWW-Authenticate pointing to the protected resource metadata.
    authorization=AuthorizationConfig(
        enabled=True,
        # Server-level scopes: every tool requires at least "read"
        required_scopes=["read"],
        # DAuth authorization server (managed OAuth 2.1)
        authorization_servers=[
            os.getenv("DEDALUS_AS_URL", "https://as.dedaluslabs.ai")
        ],
    ),
    # Allow local dev without HTTPS
    http_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)

# Register all tools
server.collect(whoami, get_secret_assignment, submit_homework, server_info)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    print(f"Starting DAuth Demo MCP server at http://127.0.0.1:{port}/mcp")
    print("Authorization is ENABLED — unauthenticated requests will get 401")
    print(f"DAuth AS: {os.getenv('DEDALUS_AS_URL', 'https://as.dedaluslabs.ai')}")
    asyncio.run(server.serve(port=port))

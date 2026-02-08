import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";

// ---------------------------------------------------------------------------
// POST /prototypes/dedalus-auth/run
//
// Runs the Dedalus agent against a DAuth-protected MCP server.
// If the server returns 401 (no valid token), the SDK throws
// AuthenticationError with a connect_url for the OAuth 2.1 flow.
// We surface that URL to the frontend so it can redirect the user.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const userPrompt =
            body.prompt ||
            "Call whoami to check who I am, then get my assignment.";
        const mcpServerUrl = body.mcpServerUrl || "darenhua/test-server";

        const client = new Dedalus();
        const runner = new DedalusRunner(client);

        const result = await runner.run({
            input: userPrompt,
            model: "anthropic/claude-sonnet-4-20250514",
            mcpServers: [mcpServerUrl],
        });

        return NextResponse.json({
            success: true,
            output: (result as any).finalOutput,
            model: "anthropic/claude-sonnet-4-20250514",
            mcpServer: mcpServerUrl,
            authenticated: true,
        });
    } catch (error: any) {
        // -----------------------------------------------------------------------
        // DAuth OAuth flow: the SDK raises AuthenticationError when the MCP
        // server returns 401. The error body contains a connect_url — the full
        // OAuth authorization URL the user must visit to grant access.
        // -----------------------------------------------------------------------
        const errorName = error?.constructor?.name || error?.name || "";
        const errorBody = typeof error?.body === "object" ? error.body : {};
        const connectUrl =
            errorBody?.connect_url ||
            errorBody?.detail?.connect_url ||
            error?.connect_url;

        if (
            errorName === "AuthenticationError" ||
            connectUrl ||
            error?.status === 401
        ) {
            return NextResponse.json(
                {
                    success: false,
                    needsAuth: true,
                    connectUrl: connectUrl || null,
                    error: "Authentication required. Complete the OAuth flow to continue.",
                    hint: connectUrl
                        ? "Click 'Connect' to authorize via DAuth."
                        : "The MCP server requires authentication but no connect_url was returned. Make sure the server is running with DAuth enabled.",
                },
                { status: 401 }
            );
        }

        // Generic error
        console.error("Dedalus runner error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Unknown error",
                hint: "Make sure DEDALUS_API_KEY is set in .env.local and the MCP server is running on port 8001.",
            },
            { status: 500 }
        );
    }
}

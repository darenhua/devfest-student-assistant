export interface AgentConfig {
  id: string;
  name: string;
  endpoint: string;
  mcpServerUrl?: string;
  prompt: string;
}

export const AGENTS_BY_TAB: Record<string, AgentConfig[]> = {
  events: [
    {
      id: "columbia-events",
      name: "Columbia Events",
      endpoint: "/prototypes/dedalus-event-scraping/run",
      prompt:
        "Fetch upcoming Columbia events for the next 14 days.",
    },
  ],
  homework: [
    {
      id: "canvas-hw",
      name: "Canvas Assignments",
      endpoint: "/prototypes/testin-canvas/run",
      mcpServerUrl: "http://localhost:8002/mcp",
      prompt:
        "List all assignments from all my active courses. Include due dates and points.",
    },
    {
      id: "ext-hw",
      name: "External Sources",
      endpoint: "/prototypes/testin-ext-sources/run",
      mcpServerUrl: "http://localhost:8003/mcp",
      prompt:
        "Crawl all configured sources and find homework assignments. Save findings.",
    },
  ],
  office_hours: [
    {
      id: "canvas-oh",
      name: "Canvas (Syllabus)",
      endpoint: "/prototypes/testin-canvas/run",
      mcpServerUrl: "http://localhost:8002/mcp",
      prompt:
        "Find office hours for all my active courses by checking syllabi and course pages.",
    },
    {
      id: "ext-oh",
      name: "External Sources",
      endpoint: "/prototypes/testin-ext-sources/run",
      mcpServerUrl: "http://localhost:8003/mcp",
      prompt:
        "Crawl all configured sources and find office hours information. Save findings.",
    },
  ],
  exams: [
    {
      id: "canvas-exam",
      name: "Canvas (Syllabus)",
      endpoint: "/prototypes/testin-canvas/run",
      mcpServerUrl: "http://localhost:8002/mcp",
      prompt:
        "Find exam dates for all my active courses by checking syllabi and course pages.",
    },
    {
      id: "ext-exam",
      name: "External Sources",
      endpoint: "/prototypes/testin-ext-sources/run",
      mcpServerUrl: "http://localhost:8003/mcp",
      prompt:
        "Crawl all configured sources and find exam dates. Save findings.",
    },
  ],
};

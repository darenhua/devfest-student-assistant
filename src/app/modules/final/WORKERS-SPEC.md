# Worker Queue API

Base URL: `http://localhost:3002`

## Prerequisites

1. **Start the database:**
   ```bash
   # from project root
   bun run db:local
   ```

2. **Start the Next.js app** (serves the API):
   ```bash
   cd apps/web && bun run dev
   # must be running on port 3002
   ```

3. **Start the worker** (processes jobs):
   ```bash
   bun run apps/web/src/app/partner/backwards/prototypes/fetch-model-and-req/run-worker.ts
   ```

---

## Endpoints at a Glance

| Method   | Endpoint                  | Description                        |
|----------|---------------------------|------------------------------------|
| `POST`   | `/api/jobs/enqueue`       | Add a new job to the queue         |
| `GET`    | `/api/jobs`               | List jobs (with filters)           |
| `GET`    | `/api/jobs/stats`         | Get aggregate queue counts         |
| `GET`    | `/api/jobs/:id`           | Get a single job by ID             |
| `POST`   | `/api/jobs/:id/retry`     | Retry a failed/completed job       |
| `DELETE` | `/api/jobs/:id`           | Delete a single job                |
| `DELETE` | `/api/jobs`               | Purge all completed jobs           |

---

## POST /api/jobs/enqueue

Add a new Claude extraction job to the queue.

### Request Body

| Field            | Type   | Required | Description                                                  |
|------------------|--------|----------|--------------------------------------------------------------|
| `prompt`         | string | yes      | The prompt/instructions for the Claude extraction             |
| `name`           | string | no       | Slug name for the job. Auto-generated from prompt if omitted  |
| `originUrl`      | string | no       | GitHub repo URL to clone as source context                    |
| `idempotencyKey` | string | no       | Prevents duplicate jobs. Auto-generated if omitted            |

### curl

```bash
curl -X POST http://localhost:3002/api/jobs/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Extract the login form component and recreate it as a standalone Next.js component with Tailwind.",
    "originUrl": "https://github.com/user/repo"
  }'
```

### fetch (JavaScript/TypeScript)

```typescript
const res = await fetch("http://localhost:3002/api/jobs/enqueue", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Extract the login form component...",
    originUrl: "https://github.com/user/repo",
  }),
});
const data = await res.json();
console.log(data.job.id); // use this to check status later
```

### Python

```python
import requests

res = requests.post("http://localhost:3002/api/jobs/enqueue", json={
    "prompt": "Extract the login form component...",
    "originUrl": "https://github.com/user/repo",
})
print(res.json()["job"]["id"])
```

### Response

```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "extract-the-login-form-component-1708099200000",
    "status": "pending",
    "createdAt": "2026-02-16T12:00:00.000Z"
  }
}
```

---

## GET /api/jobs

List jobs with optional query param filters. Results are ordered by priority (desc) then creation time (asc).

### Query Parameters

| Param    | Type   | Default | Description                                          |
|----------|--------|---------|------------------------------------------------------|
| `status` | string | —       | Filter by status: `pending`, `claimed`, `completed`, `failed` |
| `type`   | string | —       | Filter by job type, e.g. `claude_extraction`          |
| `limit`  | number | 50      | Max results to return                                 |
| `offset` | number | 0       | Skip first N results (pagination)                     |

### Examples

```bash
# All jobs
curl http://localhost:3002/api/jobs

# Currently being worked on
curl "http://localhost:3002/api/jobs?status=claimed"

# Up next in the queue
curl "http://localhost:3002/api/jobs?status=pending"

# Completed jobs
curl "http://localhost:3002/api/jobs?status=completed"

# Failed jobs
curl "http://localhost:3002/api/jobs?status=failed"

# Paginate
curl "http://localhost:3002/api/jobs?limit=10&offset=20"
```

### Response

```json
{
  "jobs": [
    {
      "id": "550e8400-...",
      "type": "claude_extraction",
      "status": "pending",
      "payload": { "type": "claude_extraction", "name": "...", "prompt": "..." },
      "priority": 0,
      "attempts": 0,
      "maxAttempts": 3,
      "lastError": null,
      "lockedBy": null,
      "lockedAt": null,
      "createdAt": "2026-02-16T12:00:00.000Z",
      "claimedAt": null,
      "completedAt": null,
      "idempotencyKey": "enqueue-abc123-1708099200000"
    }
  ],
  "count": 1
}
```

---

## GET /api/jobs/stats

Get aggregate counts of jobs by status.

```bash
curl http://localhost:3002/api/jobs/stats
```

### Response

```json
{
  "stats": {
    "pending": 3,
    "claimed": 1,
    "completed": 12,
    "failed": 0,
    "total": 16
  }
}
```

---

## GET /api/jobs/:id

Get full details for a single job.

```bash
curl http://localhost:3002/api/jobs/550e8400-e29b-41d4-a716-446655440000
```

### Response

```json
{
  "job": {
    "id": "550e8400-...",
    "type": "claude_extraction",
    "status": "claimed",
    "payload": { "..." },
    "attempts": 1,
    "lockedBy": "worker-12345-1708099200000",
    "lockedAt": "2026-02-16T12:01:00.000Z",
    "createdAt": "2026-02-16T12:00:00.000Z",
    "claimedAt": "2026-02-16T12:01:00.000Z",
    "completedAt": null,
    "lastError": null
  }
}
```

Returns `404` if the job doesn't exist.

---

## POST /api/jobs/:id/retry

Reset a failed or completed job back to `pending` so the worker picks it up again. Resets the attempt counter to 0.

```bash
curl -X POST http://localhost:3002/api/jobs/550e8400-.../retry
```

### Response

```json
{
  "success": true,
  "job": { "id": "550e8400-...", "status": "pending", "attempts": 0, "..." }
}
```

---

## DELETE /api/jobs/:id

Delete a single job.

```bash
curl -X DELETE http://localhost:3002/api/jobs/550e8400-...
```

### Response

```json
{ "success": true, "deleted": "550e8400-..." }
```

---

## DELETE /api/jobs

Purge all completed jobs from the database.

```bash
curl -X DELETE http://localhost:3002/api/jobs
```

### Response

```json
{ "success": true, "purged": 12 }
```

---

## Status Lifecycle

```
pending  →  claimed  →  completed
                    →  failed  (retries go back to pending until maxAttempts)
```

| Status      | Meaning                                    |
|-------------|--------------------------------------------|
| `pending`   | Waiting in queue for a worker to pick up    |
| `claimed`   | Worker is actively processing this job      |
| `completed` | Job finished successfully                   |
| `failed`    | Job exhausted all retry attempts             |

---

## Building a Queue Dashboard UI

Below is a complete standalone React app you can drop into any project that talks to this API. It shows real-time stats, the currently processing job, the pending queue, and completed/failed history.

### Setup (any React/Next.js project)

```bash
# If starting from scratch
bunx create-next-app@latest queue-dashboard --typescript --tailwind --app --src-dir --use-bun --yes
cd queue-dashboard
```

### The Dashboard Component

Create a file (e.g. `src/app/page.tsx` or wherever you want it):

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";

const API = "http://localhost:3002/api/jobs";

type Job = {
  id: string;
  type: string;
  status: "pending" | "claimed" | "completed" | "failed";
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedBy: string | null;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
};

type Stats = {
  pending: number;
  claimed: number;
  completed: number;
  failed: number;
  total: number;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function QueueDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [active, setActive] = useState<Job[]>([]);
  const [pending, setPending] = useState<Job[]>([]);
  const [completed, setCompleted] = useState<Job[]>([]);
  const [failed, setFailed] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, activeRes, pendingRes, completedRes, failedRes] =
        await Promise.all([
          fetch(`${API}/stats`),
          fetch(`${API}?status=claimed`),
          fetch(`${API}?status=pending`),
          fetch(`${API}?status=completed&limit=20`),
          fetch(`${API}?status=failed&limit=20`),
        ]);

      setStats((await statsRes.json()).stats);
      setActive((await activeRes.json()).jobs);
      setPending((await pendingRes.json()).jobs);
      setCompleted((await completedRes.json()).jobs);
      setFailed((await failedRes.json()).jobs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }, []);

  // Poll every 2 seconds
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 2000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function retryJob(id: string) {
    await fetch(`${API}/${id}/retry`, { method: "POST" });
    fetchAll();
  }

  async function deleteJob(id: string) {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function purgeCompleted() {
    await fetch(API, { method: "DELETE" });
    fetchAll();
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 text-lg">Cannot reach API: {error}</p>
        <p className="text-gray-500 mt-2">
          Make sure the server is running at {API}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-6">Queue Dashboard</h1>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          {(
            [
              ["Pending", stats.pending, "bg-yellow-500/20 text-yellow-400"],
              ["Active", stats.claimed, "bg-blue-500/20 text-blue-400"],
              ["Completed", stats.completed, "bg-green-500/20 text-green-400"],
              ["Failed", stats.failed, "bg-red-500/20 text-red-400"],
              ["Total", stats.total, "bg-gray-500/20 text-gray-400"],
            ] as const
          ).map(([label, count, cls]) => (
            <div key={label} className={`rounded-lg p-4 ${cls}`}>
              <div className="text-sm opacity-80">{label}</div>
              <div className="text-3xl font-mono font-bold">{count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Currently Processing */}
      <Section title="Currently Processing" badge={active.length}>
        {active.length === 0 ? (
          <EmptyState>No jobs being processed right now.</EmptyState>
        ) : (
          active.map((job) => (
            <JobCard key={job.id} job={job}>
              <span className="text-xs text-blue-400 animate-pulse">
                Worker: {job.lockedBy}
              </span>
              {job.claimedAt && (
                <span className="text-xs text-gray-500">
                  Started {timeAgo(job.claimedAt)}
                </span>
              )}
            </JobCard>
          ))
        )}
      </Section>

      {/* Up Next */}
      <Section title="Up Next (Pending)" badge={pending.length}>
        {pending.length === 0 ? (
          <EmptyState>Queue is empty.</EmptyState>
        ) : (
          pending.map((job, i) => (
            <JobCard key={job.id} job={job}>
              <span className="text-xs text-yellow-400">
                Position #{i + 1}
              </span>
              <span className="text-xs text-gray-500">
                Created {timeAgo(job.createdAt)}
              </span>
              <button
                onClick={() => deleteJob(job.id)}
                className="text-xs text-red-400 hover:text-red-300 ml-auto"
              >
                Remove
              </button>
            </JobCard>
          ))
        )}
      </Section>

      {/* Completed */}
      <Section
        title="Completed"
        badge={completed.length}
        action={
          completed.length > 0 ? (
            <button
              onClick={purgeCompleted}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Purge all
            </button>
          ) : undefined
        }
      >
        {completed.length === 0 ? (
          <EmptyState>No completed jobs yet.</EmptyState>
        ) : (
          completed.map((job) => (
            <JobCard key={job.id} job={job}>
              <span className="text-xs text-green-400">
                Took {job.attempts} attempt{job.attempts !== 1 ? "s" : ""}
              </span>
              {job.completedAt && (
                <span className="text-xs text-gray-500">
                  Finished {timeAgo(job.completedAt)}
                </span>
              )}
            </JobCard>
          ))
        )}
      </Section>

      {/* Failed */}
      <Section title="Failed" badge={failed.length}>
        {failed.length === 0 ? (
          <EmptyState>No failed jobs.</EmptyState>
        ) : (
          failed.map((job) => (
            <JobCard key={job.id} job={job}>
              <span className="text-xs text-red-400 truncate max-w-xs">
                {job.lastError}
              </span>
              <button
                onClick={() => retryJob(job.id)}
                className="text-xs text-yellow-400 hover:text-yellow-300 ml-auto"
              >
                Retry
              </button>
            </JobCard>
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full font-mono">
          {badge}
        </span>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function JobCard({
  job,
  children,
}: {
  job: Job;
  children: React.ReactNode;
}) {
  const name =
    (job.payload as { name?: string })?.name ?? job.type;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-xs text-gray-500 font-mono truncate">
          {job.id}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">{children}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-gray-600 text-sm py-4 text-center border border-dashed border-gray-800 rounded-lg">
      {children}
    </div>
  );
}
```

### Important: CORS

If your dashboard runs on a different port (e.g. `localhost:3000`) than the API (`localhost:3002`), you need to handle CORS. The simplest way is to add a `next.config.ts` rewrite in the **dashboard** project so all `/api/jobs` requests proxy to the real server:

```typescript
// next.config.ts (in the dashboard project)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/jobs/:path*",
        destination: "http://localhost:3002/api/jobs/:path*",
      },
    ];
  },
};

export default nextConfig;
```

Then change the `API` constant in the dashboard to use a relative path:

```typescript
const API = "/api/jobs";
```

### How it works

The dashboard polls all 5 endpoints every 2 seconds:

| What it fetches                   | Endpoint                            |
|-----------------------------------|-------------------------------------|
| Stats bar (counts by status)      | `GET /api/jobs/stats`               |
| "Currently Processing" section    | `GET /api/jobs?status=claimed`      |
| "Up Next" section                 | `GET /api/jobs?status=pending`      |
| "Completed" section               | `GET /api/jobs?status=completed`    |
| "Failed" section                  | `GET /api/jobs?status=failed`       |

Actions:
- **Retry** a failed job: `POST /api/jobs/:id/retry`
- **Remove** a pending job: `DELETE /api/jobs/:id`
- **Purge** all completed: `DELETE /api/jobs`

"use client";

export default function ForwardsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <a
            href="/modules"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            &larr; All Modules
          </a>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            forwards
          </h1>
          <p className="mt-1 text-zinc-500">
            Forward and route incoming messages to their destinations.
          </p>
        </header>

        <main className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            Forwarding rules will appear here.
          </p>
        </main>
      </div>
    </div>
  );
}

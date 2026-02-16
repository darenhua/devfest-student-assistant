"use client";

import { CommentOverlayProvider } from "./CommentOverlayProvider";

export default function FirstEverCrazyFwdsPage() {
  return (
    <CommentOverlayProvider>
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
              Comment Overlay
            </h1>
            <p className="mt-1 text-zinc-500">
              React-Grab integration with overlay rendering for element comments.
            </p>
          </header>

          <main className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Press <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800">x</kbd> to
              toggle the comment overlay. Use react-grab to select elements and
              add comments &mdash; they will appear as pink highlights with
              editable badges.
            </p>
          </main>
        </div>
      </div>
    </CommentOverlayProvider>
  );
}

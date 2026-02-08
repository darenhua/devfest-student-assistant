"use client";

import { Assignment } from "./types";

interface HomeworkCardProps {
  assignment: Assignment;
}

export default function HomeworkCard({ assignment }: HomeworkCardProps) {
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  const isOverdue = dueDate < now;
  const isToday = dueDate.toDateString() === now.toDateString();

  const formattedDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const formattedTime = dueDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {assignment.title}
          </h3>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: assignment.classColor }}
            />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {assignment.className}
            </span>
          </div>
        </div>
        <a
          href={assignment.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.preventDefault()}
          className="flex-shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          {assignment.sourceName}
        </a>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span
          className={`font-medium ${
            isOverdue
              ? "text-red-500"
              : isToday
              ? "text-amber-500"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {isOverdue ? "Overdue" : isToday ? "Due today" : `Due ${formattedDate}`} at {formattedTime}
        </span>
      </div>
    </div>
  );
}

"use client";

import { Assignment, CalendarEvent } from "./types";
import CalendarPanel from "./CalendarPanel";
import HomeworkPanel from "./HomeworkPanel";

interface MainLayoutProps {
  assignments: Assignment[];
  calendarEvents: CalendarEvent[];
}

export default function MainLayout({ assignments, calendarEvents }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          School Assistant
        </h1>
      </header>
      <main className="flex flex-1 gap-6 p-6">
        <div className="flex-1 min-w-0">
          <CalendarPanel events={calendarEvents} />
        </div>
        <div className="w-96 flex-shrink-0">
          <HomeworkPanel assignments={assignments} />
        </div>
      </main>
    </div>
  );
}

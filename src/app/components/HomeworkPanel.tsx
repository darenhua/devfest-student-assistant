"use client";

import { Assignment } from "./types";
import HomeworkCard from "./HomeworkCard";
import AddSourceButton from "./AddSourceButton";

interface HomeworkPanelProps {
  assignments: Assignment[];
}

export default function HomeworkPanel({ assignments }: HomeworkPanelProps) {
  const sorted = [...assignments].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Homework
        </h2>
        <AddSourceButton />
      </div>
      <div className="flex flex-col gap-3">
        {sorted.map((assignment) => (
          <HomeworkCard key={assignment.id} assignment={assignment} />
        ))}
      </div>
    </div>
  );
}

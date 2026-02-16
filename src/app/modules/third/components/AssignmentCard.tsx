import type { HomeworkItem } from "./types";

export function AssignmentCard({ hw }: { hw: HomeworkItem }) {
  return (
    <a
      href={hw.sourceUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-2 flex items-center justify-between px-2 py-2.5 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#171717]">
          {hw.title}
        </p>
        <p className="text-[11px] text-gray-400">
          {hw.className && <>{hw.className} &middot; </>}
          {hw.dueDate}
        </p>
      </div>
      <span className="ml-3 shrink-0 text-[11px] text-gray-400">
        {hw.sourceName} ↗
      </span>
    </a>
  );
}

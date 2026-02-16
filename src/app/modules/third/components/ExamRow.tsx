import { DraggableItem } from "./DraggableItem";
import type { ExamItem } from "./types";

export function ExamRow({ exam }: { exam: ExamItem }) {
  const content = (
    <>
      <p className="text-sm text-[#171717]">{exam.title}</p>
      <p className="text-[11px] text-gray-400">
        {exam.timeInfo}
        {exam.location && <> &middot; {exam.location}</>}
      </p>
    </>
  );
  return (
    <DraggableItem
      id={`exam-${exam.id}`}
      data={{ type: "exam", item: exam }}
    >
      {exam.sourceUrl ? (
        <a
          href={exam.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-2 block px-2 py-2 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
        >
          {content}
        </a>
      ) : (
        <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
          {content}
        </div>
      )}
    </DraggableItem>
  );
}

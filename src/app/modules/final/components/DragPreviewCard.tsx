import type { DragItemData } from "./types";

export function DragPreviewCard({ data }: { data: DragItemData }) {
  let title: string;
  let subtitle: string;

  switch (data.type) {
    case "assignment":
      title = data.item.title;
      subtitle = `${data.item.className} — due ${new Date(data.item.dueDate).toLocaleDateString()}`;
      break;
    case "event":
      title = data.item.title;
      subtitle = `${data.item.time} · ${data.item.location}`;
      break;
    case "office_hour":
      title = `${data.item.professor} — Office Hours`;
      subtitle = `${data.item.course} · ${data.item.day} ${data.item.startTime}–${data.item.endTime}`;
      break;
    case "exam":
      title = data.item.title;
      subtitle = `${data.item.course} · ${data.item.date} ${data.item.time}`;
      break;
  }

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg scale-105">
      <p className="text-sm font-medium text-[#171717] truncate">{title}</p>
      <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
    </div>
  );
}

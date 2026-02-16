import type { DragItemData } from "./types";

export function DragPreviewCard({ data }: { data: DragItemData }) {
  let title: string;
  let subtitle: string;

  switch (data.type) {
    case "homework":
      title = data.item.title;
      subtitle = `${data.item.className ? data.item.className + " \u2014 " : ""}due ${data.item.dueDate}`;
      break;
    case "event":
      title = data.item.title;
      subtitle = `${data.item.timeLabel}${data.item.location ? ` \u00b7 ${data.item.location}` : ""}`;
      break;
    case "office_hour":
      title = data.item.label;
      subtitle = `${data.item.timeInfo}${data.item.location ? ` \u00b7 ${data.item.location}` : ""}`;
      break;
    case "exam":
      title = data.item.title;
      subtitle = `${data.item.timeInfo}${data.item.location ? ` \u00b7 ${data.item.location}` : ""}`;
      break;
  }

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg scale-105">
      <p className="text-sm font-medium text-[#171717] truncate">{title}</p>
      <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
    </div>
  );
}

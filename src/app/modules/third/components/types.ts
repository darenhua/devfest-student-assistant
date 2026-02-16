// ─── Real-data types (from agent JSON outputs) ───

export interface EventItem {
  id: string;
  title: string;
  timeLabel: string;
  location: string;
  sourceUrl: string;
  source: "columbia-events";
}

export interface HomeworkItem {
  id: string;
  title: string;
  className: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
  source: "canvas" | "ext-sources";
}

export interface OfficeHourItem {
  id: string;
  label: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
  source: "ext-sources";
}

export interface ExamItem {
  id: string;
  title: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
  source: "ext-sources";
}

export type AnyItem =
  | { kind: "event"; item: EventItem }
  | { kind: "homework"; item: HomeworkItem }
  | { kind: "office_hour"; item: OfficeHourItem }
  | { kind: "exam"; item: ExamItem };

// ─── Drag-and-drop types (uses real-data types) ───

export type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };

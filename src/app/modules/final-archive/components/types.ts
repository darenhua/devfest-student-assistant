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

export interface AgentRunResult {
  success: boolean;
  output?: string;
  error?: string;
  hint?: string;
  model?: string;
  mcpTools?: string[];
  _debug?: {
    elapsed?: number;
    toolsCalled?: string[];
  };
}

// ─── Drag-and-drop types (uses real-data types) ───

export type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };

// ─── Legacy types (still used by fixtures.ts / DailyBriefing) ───

export interface Agent {
  id: string;
  name: string;
  type: "homework" | "office_hours" | "events" | "exams";
  status: "sleeping" | "working";
  lastRun: string;
  itemsFound: number;
}

export interface Assignment {
  id: string;
  title: string;
  className: string;
  classColor: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  sourceUrl: string;
}

export interface OfficeHour {
  id: string;
  professor: string;
  course: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  sourceUrl: string;
}

export interface Exam {
  id: string;
  title: string;
  course: string;
  date: string;
  time: string;
  location: string;
  sourceUrl: string;
}

export interface Briefing {
  id: string;
  label: string;
  markdown: string;
}

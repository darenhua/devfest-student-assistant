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

export type DragItemData =
  | { type: "assignment"; item: Assignment }
  | { type: "event"; item: SchoolEvent }
  | { type: "office_hour"; item: OfficeHour }
  | { type: "exam"; item: Exam };

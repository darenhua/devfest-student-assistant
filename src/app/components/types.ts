export interface Assignment {
  id: string;
  title: string;
  className: string;
  classColor: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
}

export interface Source {
  id: string;
  url: string;
  name: string;
  lastCrawled: string | null;
  assignmentCount: number;
}

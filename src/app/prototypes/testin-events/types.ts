export interface EventLocation {
  address: string;
  mapLink: string;
}

export interface CalendarSlot {
  shortLabel: string;
  timeRange: string;
  timezone: string;
  allDay: boolean;
}

export interface CleanEvent {
  id: string;
  summary: string;
  link: string;
  eventlink: string;
  startDate: string;
  endDate: string;
  location: EventLocation;
  description: string;
  calendar: CalendarSlot;
  _source?: "manual";
}

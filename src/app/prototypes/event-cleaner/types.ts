// ── Raw Bedework API types (input) ──────────────────────────────────

export interface BedeworkDateInfo {
  allday: string;
  shortdate: string;
  longdate: string;
  dayname: string;
  time: string;
  utcdate: string;
  datetime: string;
  timezone: string;
}

export interface BedeworkLocation {
  address: string;
  link: string;
}

export interface BedeworkContact {
  name: string;
  phone: string;
  email: string;
  link: string;
}

export interface BedeworkCalendar {
  name: string;
  displayName: string;
  path: string;
  encodedPath: string;
}

export interface BedeworkXProperty {
  [key: string]: {
    values: {
      text: string;
    };
  };
}

export interface BedeworkCategoryHierarchyEntry {
  parent_id: string;
  name: string;
}

export interface BedeworkEvent {
  summary: string;
  subscriptionId: string;
  calPath: string;
  guid: string;
  recurrenceId: string;
  link: string;
  eventlink: string;
  status: string;
  formattedDate: string;
  startDate: string;
  endDate: string;
  start: BedeworkDateInfo;
  end: BedeworkDateInfo;
  location: BedeworkLocation;
  contact: BedeworkContact;
  calendar: BedeworkCalendar;
  categories: string[];
  categories_hierarchy: Record<string, BedeworkCategoryHierarchyEntry>;
  description: string;
  cost: string;
  topicalArea: string[];
  ics_link: string;
  uni_registration_link?: string;
  xproperties: BedeworkXProperty[];
}

export interface BedeworkEventList {
  bwEventList: {
    resultSize: string;
    paged: string;
    lastMod: {
      utc: string;
      long: string;
    };
    events: BedeworkEvent[];
  };
}

// ── Cleaned event types (output) ────────────────────────────────────

export interface CleanLocation {
  address: string;
  mapLink: string;
}

/** Condensed calendar notation — just day/time at a glance */
export interface CalendarSlot {
  /** e.g. "Mon 2/9" */
  shortLabel: string;
  /** e.g. "11:00 AM - 1:00 PM" */
  timeRange: string;
  /** e.g. "America/New_York" */
  timezone: string;
  allDay: boolean;
}

export interface CleanEvent {
  summary: string;
  link: string;
  eventlink: string;
  startDate: string;
  endDate: string;
  location: CleanLocation;
  description: string;
  calendar: CalendarSlot;
}

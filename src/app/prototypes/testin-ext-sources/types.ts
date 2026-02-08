export interface SourceLink {
  id: string;
  url: string;
  label: string;
  addedAt: string;
}

export interface Finding {
  id: string;
  type: "homework" | "exam" | "office_hours" | "syllabus" | "lecture" | "other";
  title: string;
  description: string;
  source_url: string;
  due_date?: string | null;
  location?: string | null;
  time_info?: string | null;
  savedAt: string;
}

export interface CrawlLogEntry {
  timestamp: string;
  sources_crawled: number;
  total_pages: number;
}

export interface FindingsCache {
  findings: Finding[];
  crawlLog: CrawlLogEntry[];
  lastUpdated: string | null;
}

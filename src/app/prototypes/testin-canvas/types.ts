export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id?: number;
  term?: { name: string };
  enrollments?: Array<{
    type: string;
    computed_current_score?: number;
    computed_current_grade?: string;
  }>;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  course_id: number;
  due_at: string | null;
  points_possible: number | null;
  description: string | null;
  submission_types: string[];
  has_submitted_submissions?: boolean;
  submission?: {
    submitted_at: string | null;
    score: number | null;
    grade: string | null;
    workflow_state: string;
  };
}

export interface CanvasTodoItem {
  type: string;
  assignment?: {
    id: number;
    name: string;
    due_at: string | null;
    course_id: number;
    points_possible: number | null;
  };
  context_name?: string;
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string | null;
  end_at: string | null;
  description: string | null;
  location_name: string | null;
  context_code: string;
}

/** Local cache shape written by the MCP server */
export interface CanvasCache {
  courses: CanvasCourse[];
  assignments: CanvasAssignment[];
  todos: CanvasTodoItem[];
  lastUpdated: string | null;
}

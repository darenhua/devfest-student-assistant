import { getCanvasCache } from "./actions";
import type { CanvasAssignment } from "./types";
import { AgentPanel } from "./agent-panel";

export default async function TestinCanvasPage() {
  const cache = await getCanvasCache();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Canvas LMS Agent</h1>
          <p className="text-gray-400 mt-1">
            MCP-powered agent that queries your Canvas courses, assignments,
            grades, and todo items
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Agent panel */}
          <AgentPanel />

          {/* Right: Cached Canvas data */}
          <div className="space-y-6">
            {/* Courses section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Courses</h2>
                <span className="text-xs text-gray-500">
                  {cache.courses.length} course{cache.courses.length !== 1 && "s"}
                </span>
              </div>

              {cache.courses.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
                  No courses cached yet. Use the agent to list your courses.
                </div>
              ) : (
                <div className="space-y-2">
                  {cache.courses.map((course) => (
                    <div
                      key={course.id}
                      className="rounded-lg border border-gray-800 bg-gray-900 p-3 flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-semibold text-sm">{course.name}</h3>
                        <span className="text-xs text-gray-500">
                          {course.course_code}
                        </span>
                      </div>
                      {course.term && (
                        <span className="text-xs text-gray-500">
                          {course.term.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assignments section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Assignments</h2>
                <span className="text-xs text-gray-500">
                  {cache.assignments.length} assignment{cache.assignments.length !== 1 && "s"}
                </span>
              </div>

              {cache.assignments.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
                  No assignments cached yet. Use the agent to fetch assignments.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {cache.assignments.map((a: CanvasAssignment) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-gray-800 bg-gray-900 p-3 space-y-1"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-sm leading-tight">
                          {a.name}
                        </h3>
                        {a.points_possible != null && (
                          <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                            {a.points_possible} pts
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {a.due_at && (
                          <p>
                            Due:{" "}
                            {new Date(a.due_at).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                        {a.submission && (
                          <p
                            className={
                              a.submission.workflow_state === "submitted" ||
                              a.submission.workflow_state === "graded"
                                ? "text-green-500"
                                : "text-gray-600"
                            }
                          >
                            {a.submission.workflow_state === "graded"
                              ? `Graded: ${a.submission.score}/${a.points_possible}`
                              : a.submission.workflow_state === "submitted"
                              ? "Submitted"
                              : "Not submitted"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Last updated */}
            {cache.lastUpdated && (
              <p className="text-xs text-gray-600 text-right">
                Last updated: {new Date(cache.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

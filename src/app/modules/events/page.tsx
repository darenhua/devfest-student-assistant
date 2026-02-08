"use client";

// --- Mock Data ---

type AgentStatus = "sleeping" | "working";

interface Agent {
    name: string;
    type: "homework" | "office_hours" | "events" | "exams";
    status: AgentStatus;
    itemsFound: number;
}

interface Assignment {
    id: string;
    title: string;
    course: string;
    dueDate: string;
    sourceUrl: string;
    sourceName: string;
}

interface SchoolEvent {
    id: string;
    title: string;
    date: string;
    time: string;
}

interface OfficeHour {
    id: string;
    professor: string;
    course: string;
    day: string;
    time: string;
}

interface Exam {
    id: string;
    title: string;
    course: string;
    date: string;
    time: string;
}

const MOCK_AGENTS: Agent[] = [
    { name: "homework agent", type: "homework", status: "sleeping", itemsFound: 5 },
    { name: "office hours agent", type: "office_hours", status: "working", itemsFound: 3 },
    { name: "events agent", type: "events", status: "working", itemsFound: 10 },
    { name: "exams agent", type: "exams", status: "working", itemsFound: 2 },
];

const MOCK_ASSIGNMENTS: Assignment[] = [
    {
        id: "1",
        title: "Operating Systems Homework 2",
        course: "COMS 4118",
        dueDate: "Feb 10, 2026",
        sourceUrl: "https://courseworks.columbia.edu",
        sourceName: "Courseworks",
    },
    {
        id: "2",
        title: "Stats Problem Set 1",
        course: "STAT 1201",
        dueDate: "Feb 11, 2026",
        sourceUrl: "https://canvas.columbia.edu",
        sourceName: "Canvas",
    },
    {
        id: "3",
        title: "Reading Response — Chapter 4",
        course: "ENGL 3100",
        dueDate: "Feb 12, 2026",
        sourceUrl: "https://courseworks.columbia.edu",
        sourceName: "Courseworks",
    },
];

const MOCK_EVENTS: SchoolEvent[] = [
    { id: "1", title: "CS Club Meeting", date: "Feb 9", time: "6:00 PM" },
    { id: "2", title: "Career Fair", date: "Feb 10", time: "12:00 PM" },
    { id: "3", title: "Study Group — OS", date: "Feb 10", time: "8:00 PM" },
];

const MOCK_OFFICE_HOURS: OfficeHour[] = [
    { id: "1", professor: "Prof. Jae Lee", course: "COMS 4118", day: "Monday", time: "2–4 PM" },
    { id: "2", professor: "Prof. Chen", course: "STAT 1201", day: "Tuesday", time: "10–11 AM" },
    { id: "3", professor: "TA Office Hours", course: "COMS 4118", day: "Wednesday", time: "5–7 PM" },
];

const MOCK_EXAMS: Exam[] = [
    { id: "1", title: "Midterm 1", course: "STAT 1201", date: "Feb 20, 2026", time: "10:00 AM" },
    { id: "2", title: "Midterm", course: "COMS 4118", date: "Mar 3, 2026", time: "1:00 PM" },
];

// --- Components ---

function AgentBadge({ agent }: { agent: Agent }) {
    const isWorking = agent.status === "working";
    return (
        <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${isWorking
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-gray-200 bg-gray-50 text-gray-500"
                }`}
        >
            <span
                className={`h-2 w-2 rounded-full ${isWorking ? "bg-green-500 animate-pulse" : "bg-gray-300"
                    }`}
            />
            <span className="font-medium">{agent.name}</span>
            <span className="text-xs opacity-60">{isWorking ? "working" : "sleeping"}</span>
        </div>
    );
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <div className="font-semibold text-gray-900">{assignment.title}</div>
            <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{assignment.course}</span>
                <span>Due {assignment.dueDate}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
                <a href={assignment.sourceUrl} className="text-xs text-blue-500 hover:underline">
                    source: {assignment.sourceName}
                </a>
                <button className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
                    schedule
                </button>
            </div>
        </div>
    );
}

function MiniCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            {children}
        </div>
    );
}

// --- Daily Markdown (placeholder for BlockNote) ---

const INITIAL_MARKDOWN = `## Things I have to do today
- [ ] Stats HW 1 **important**
- [ ] Go to office hours (Prof. Jae Lee, 2–4 PM)

## Due tomorrow
- [ ] Operating Systems Homework 2
- [ ] Reading response for English

## This week
- [ ] Start studying for Stats midterm (Feb 20)
- [ ] Career fair on Tuesday — bring resume
`;

function DailyMarkdownEditor() {
    // TODO: Replace with BlockNote editor
    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                <h2 className="text-lg font-semibold text-gray-900">daily markdown</h2>
                <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    revision #3
                </div>
            </div>

            {/* Editor area — placeholder textarea until BlockNote is integrated */}
            <div className="flex-1 overflow-auto p-5">
                <textarea
                    className="h-full w-full resize-none border-none bg-transparent font-mono text-sm text-gray-800 outline-none placeholder:text-gray-400"
                    defaultValue={INITIAL_MARKDOWN}
                    placeholder="Your AI-generated daily briefing will appear here..."
                />
            </div>
        </div>
    );
}

// --- Agent Dashboard ---

function AgentDashboard() {
    return (
        <div className="flex h-full flex-col overflow-auto">
            {/* Agent status badges */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 px-5 py-3">
                {MOCK_AGENTS.map((agent) => (
                    <AgentBadge key={agent.type} agent={agent} />
                ))}
            </div>

            {/* Assignments section */}
            <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="mb-3 text-sm font-medium text-gray-500">
                    {MOCK_ASSIGNMENTS.length} assignments found
                </h3>
                <div className="space-y-3">
                    {MOCK_ASSIGNMENTS.map((a) => (
                        <AssignmentCard key={a.id} assignment={a} />
                    ))}
                </div>
            </div>

            {/* Bottom grid: events, office hours, exams */}
            <div className="grid grid-cols-3 gap-px bg-gray-200">
                {/* Events */}
                <div className="bg-gray-50 px-4 py-4">
                    <h3 className="mb-2 text-sm font-medium text-gray-500">
                        {MOCK_EVENTS.length} events found
                    </h3>
                    <div className="space-y-2">
                        {MOCK_EVENTS.map((e) => (
                            <MiniCard key={e.id}>
                                <div className="font-medium">{e.title}</div>
                                <div className="text-xs text-gray-400">
                                    {e.date} · {e.time}
                                </div>
                            </MiniCard>
                        ))}
                    </div>
                </div>

                {/* Office Hours */}
                <div className="bg-gray-50 px-4 py-4">
                    <h3 className="mb-2 text-sm font-medium text-gray-500">
                        {MOCK_OFFICE_HOURS.length} office hours found
                    </h3>
                    <div className="space-y-2">
                        {MOCK_OFFICE_HOURS.map((oh) => (
                            <MiniCard key={oh.id}>
                                <div className="font-medium">{oh.professor}</div>
                                <div className="text-xs text-gray-400">
                                    {oh.course} · {oh.day} {oh.time}
                                </div>
                            </MiniCard>
                        ))}
                    </div>
                </div>

                {/* Exams */}
                <div className="bg-gray-50 px-4 py-4">
                    <h3 className="mb-2 text-sm font-medium text-gray-500">
                        {MOCK_EXAMS.length} exams found
                    </h3>
                    <div className="space-y-2">
                        {MOCK_EXAMS.map((ex) => (
                            <MiniCard key={ex.id}>
                                <div className="font-medium">{ex.title}</div>
                                <div className="text-xs text-gray-400">
                                    {ex.course} · {ex.date} · {ex.time}
                                </div>
                            </MiniCard>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Main Page ---

export default function EventsPage() {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Left panel: Daily Markdown Editor */}
            <div className="flex w-1/2 flex-col border-r border-gray-200 bg-white">
                <DailyMarkdownEditor />
            </div>

            {/* Right panel: Agent Dashboard */}
            <div className="flex w-1/2 flex-col bg-white">
                <AgentDashboard />
            </div>
        </div>
    );
}

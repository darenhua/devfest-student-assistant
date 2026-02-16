import type {
    Agent,
    Assignment,
    SchoolEvent,
    OfficeHour,
    Exam,
    Briefing,
} from "./types";

export const AGENTS: Agent[] = [
    {
        id: "1",
        name: "homework agent",
        type: "homework",
        status: "sleeping",
        lastRun: "2025-02-11T08:00:00",
        itemsFound: 5,
    },
    {
        id: "2",
        name: "office hours agent",
        type: "office_hours",
        status: "working",
        lastRun: "2025-02-11T09:30:00",
        itemsFound: 3,
    },
    {
        id: "3",
        name: "events agent",
        type: "events",
        status: "working",
        lastRun: "2025-02-11T09:45:00",
        itemsFound: 10,
    },
    {
        id: "4",
        name: "exams agent",
        type: "exams",
        status: "working",
        lastRun: "2025-02-11T10:00:00",
        itemsFound: 2,
    },
];

export const ASSIGNMENTS: Assignment[] = [
    {
        id: "1",
        title: "Operating Systems Homework 2",
        className: "CS 350",
        classColor: "#8b5cf6",
        dueDate: "2025-02-14T23:59:00",
        sourceUrl: "https://canvas.university.edu/cs350/hw2",
        sourceName: "Canvas",
    },
    {
        id: "2",
        title: "Statistics Problem Set 1",
        className: "MATH 221",
        classColor: "#3b82f6",
        dueDate: "2025-02-12T23:59:00",
        sourceUrl: "https://canvas.university.edu/math221/ps1",
        sourceName: "Canvas",
    },
    {
        id: "3",
        title: "Essay Draft: Modern Poetry",
        className: "ENG 101",
        classColor: "#ef4444",
        dueDate: "2025-02-14T17:00:00",
        sourceUrl: "https://classroom.google.com/eng101/essay",
        sourceName: "Google Classroom",
    },
    {
        id: "4",
        title: "Chemistry Lab Report 3",
        className: "CHEM 110",
        classColor: "#22c55e",
        dueDate: "2025-02-15T12:00:00",
        sourceUrl: "https://canvas.university.edu/chem110/lab3",
        sourceName: "Canvas",
    },
    {
        id: "5",
        title: "History Reading Response",
        className: "HIST 150",
        classColor: "#f59e0b",
        dueDate: "2025-02-10T23:59:00",
        sourceUrl: "https://canvas.university.edu/hist150/reading",
        sourceName: "Canvas",
    },
];

export const EVENTS: SchoolEvent[] = [
    {
        id: "1",
        title: "MATH 221 Lecture",
        date: "2025-02-11",
        time: "9:00 AM",
        location: "Hall 201",
        sourceUrl: "https://canvas.university.edu/math221",
    },
    {
        id: "2",
        title: "CS 350 Lecture",
        date: "2025-02-11",
        time: "11:00 AM",
        location: "CS Building 105",
        sourceUrl: "https://canvas.university.edu/cs350",
    },
    {
        id: "3",
        title: "ENG 101 Workshop",
        date: "2025-02-11",
        time: "2:00 PM",
        location: "Liberal Arts 302",
        sourceUrl: "https://classroom.google.com/eng101",
    },
    {
        id: "4",
        title: "Study Group - OS",
        date: "2025-02-11",
        time: "6:00 PM",
        location: "Library Room 3B",
        sourceUrl: "",
    },
    {
        id: "5",
        title: "CHEM 110 Lab",
        date: "2025-02-12",
        time: "1:00 PM",
        location: "Science Center 104",
        sourceUrl: "https://canvas.university.edu/chem110",
    },
    {
        id: "6",
        title: "HIST 150 Discussion",
        date: "2025-02-12",
        time: "3:30 PM",
        location: "Humanities 210",
        sourceUrl: "https://canvas.university.edu/hist150",
    },
    {
        id: "7",
        title: "CS Career Fair",
        date: "2025-02-13",
        time: "10:00 AM",
        location: "Student Union",
        sourceUrl: "",
    },
    {
        id: "8",
        title: "MATH 221 Recitation",
        date: "2025-02-13",
        time: "4:00 PM",
        location: "Hall 105",
        sourceUrl: "https://canvas.university.edu/math221",
    },
    {
        id: "9",
        title: "ENG 101 Peer Review",
        date: "2025-02-14",
        time: "2:00 PM",
        location: "Liberal Arts 302",
        sourceUrl: "https://classroom.google.com/eng101",
    },
    {
        id: "10",
        title: "Weekly Department Seminar",
        date: "2025-02-14",
        time: "5:00 PM",
        location: "CS Building Auditorium",
        sourceUrl: "",
    },
];

export const OFFICE_HOURS: OfficeHour[] = [
    {
        id: "1",
        professor: "Dr. Smith",
        course: "MATH 221",
        day: "Tuesday",
        startTime: "3:00 PM",
        endTime: "5:00 PM",
        location: "Math Building 412",
        sourceUrl: "https://canvas.university.edu/math221",
    },
    {
        id: "2",
        professor: "Prof. Chen",
        course: "CS 350",
        day: "Wednesday",
        startTime: "1:00 PM",
        endTime: "3:00 PM",
        location: "CS Building 308",
        sourceUrl: "https://canvas.university.edu/cs350",
    },
    {
        id: "3",
        professor: "Dr. Williams",
        course: "ENG 101",
        day: "Thursday",
        startTime: "10:00 AM",
        endTime: "12:00 PM",
        location: "Liberal Arts 205",
        sourceUrl: "https://classroom.google.com/eng101",
    },
];

export const EXAMS: Exam[] = [
    {
        id: "1",
        title: "Midterm Exam",
        course: "CS 350",
        date: "2025-02-20",
        time: "11:00 AM",
        location: "CS Building 105",
        sourceUrl: "https://canvas.university.edu/cs350",
    },
    {
        id: "2",
        title: "Quiz 3",
        course: "MATH 221",
        date: "2025-02-18",
        time: "9:00 AM",
        location: "Hall 201",
        sourceUrl: "https://canvas.university.edu/math221",
    },
];

export const BRIEFING: Briefing = {
    id: "tuesday-feb-11",
    label: "Tuesday, Feb 11",
    markdown: `# Things I have to do today:

- [ ] Statistics Problem Set 1 — **important**, due tomorrow
- [ ] Go to Prof. Chen's office hours (CS 350, Wed 1-3pm) to ask about HW 2
- [ ] Start Essay Draft: Modern Poetry (ENG 101, due Feb 14)

# Things due this week:

- [ ] Operating Systems Homework 2 — due Feb 14
- [ ] Essay Draft: Modern Poetry — due Feb 14
- [ ] Chemistry Lab Report 3 — due Feb 15

# Today's schedule:

- 9:00 AM — MATH 221 Lecture (Hall 201)
- 11:00 AM — CS 350 Lecture (CS Building 105)
- 2:00 PM — ENG 101 Workshop (Liberal Arts 302)
- 6:00 PM — Study Group - OS (Library Room 3B)

# Notes:

`,
};

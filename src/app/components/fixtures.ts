import { Assignment, CalendarEvent, Source } from "./types";

export const DUMMY_ASSIGNMENTS: Assignment[] = [
  {
    id: "1",
    title: "Problem Set 4: Linear Algebra",
    className: "MATH 221",
    classColor: "#3b82f6",
    dueDate: "2026-02-12T23:59:00",
    sourceUrl: "https://canvas.university.edu/courses/math221/assignments/ps4",
    sourceName: "Canvas",
  },
  {
    id: "2",
    title: "Essay: The Great Gatsby Analysis",
    className: "ENG 101",
    classColor: "#ef4444",
    dueDate: "2026-02-14T23:59:00",
    sourceUrl: "https://classroom.google.com/c/eng101/a/gatsby-essay",
    sourceName: "Google Classroom",
  },
  {
    id: "3",
    title: "Lab Report: Titration Experiment",
    className: "CHEM 110",
    classColor: "#22c55e",
    dueDate: "2026-02-15T17:00:00",
    sourceUrl: "https://canvas.university.edu/courses/chem110/assignments/lab3",
    sourceName: "Canvas",
  },
  {
    id: "4",
    title: "Reading Response: Chapter 8",
    className: "HIST 150",
    classColor: "#f59e0b",
    dueDate: "2026-02-10T09:00:00",
    sourceUrl: "https://classroom.google.com/c/hist150/a/ch8-response",
    sourceName: "Google Classroom",
  },
  {
    id: "5",
    title: "Programming Assignment 3: Linked Lists",
    className: "CS 201",
    classColor: "#8b5cf6",
    dueDate: "2026-02-18T23:59:00",
    sourceUrl: "https://canvas.university.edu/courses/cs201/assignments/pa3",
    sourceName: "Canvas",
  },
];

export const DUMMY_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "MATH 221 Lecture",
    start: "2026-02-09T10:00:00",
    end: "2026-02-09T11:15:00",
    color: "#3b82f6",
  },
  {
    id: "evt-2",
    title: "ENG 101 Seminar",
    start: "2026-02-09T13:00:00",
    end: "2026-02-09T14:30:00",
    color: "#ef4444",
  },
  {
    id: "evt-3",
    title: "CHEM 110 Lab",
    start: "2026-02-10T14:00:00",
    end: "2026-02-10T16:00:00",
    color: "#22c55e",
  },
  {
    id: "evt-4",
    title: "CS 201 Lecture",
    start: "2026-02-10T10:00:00",
    end: "2026-02-10T11:15:00",
    color: "#8b5cf6",
  },
  {
    id: "evt-5",
    title: "HIST 150 Discussion",
    start: "2026-02-11T09:00:00",
    end: "2026-02-11T10:00:00",
    color: "#f59e0b",
  },
  {
    id: "evt-6",
    title: "Study Group",
    start: "2026-02-12T18:00:00",
    end: "2026-02-12T20:00:00",
    color: "#6b7280",
  },
];

export const DUMMY_SOURCES: Source[] = [
  {
    id: "src-1",
    url: "https://canvas.university.edu/courses/math221",
    name: "MATH 221 - Canvas",
    lastCrawled: "2026-02-08T06:00:00",
    assignmentCount: 4,
  },
  {
    id: "src-2",
    url: "https://classroom.google.com/c/eng101",
    name: "ENG 101 - Google Classroom",
    lastCrawled: "2026-02-08T06:00:00",
    assignmentCount: 3,
  },
  {
    id: "src-3",
    url: "https://canvas.university.edu/courses/chem110",
    name: "CHEM 110 - Canvas",
    lastCrawled: "2026-02-07T06:00:00",
    assignmentCount: 2,
  },
];

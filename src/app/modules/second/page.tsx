"use client";

import { Notepad } from "./components/Notepad";

export default function SecondPage() {
  return (
    <div className="h-screen w-full">
      <Notepad
        initialMarkdown="# My Notes\n\nStart writing here...\n\n- [ ] First task\n- [ ] Second task\n\n## Ideas\n\nAdd your ideas here."
        onChange={(md) => console.log("Content changed:", md.substring(0, 50) + "...")}
        disableDragDrop={true}
      />
    </div>
  );
}

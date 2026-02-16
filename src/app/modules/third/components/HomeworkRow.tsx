import { DraggableItem } from "./DraggableItem";
import { AssignmentCard } from "./AssignmentCard";
import type { HomeworkItem } from "./types";

export function HomeworkRow({ hw }: { hw: HomeworkItem }) {
  return (
    <DraggableItem
      id={`hw-${hw.id}`}
      data={{ type: "homework", item: hw }}
    >
      <AssignmentCard hw={hw} />
    </DraggableItem>
  );
}

import { DraggableItem } from "./DraggableItem";
import type { OfficeHourItem } from "./types";

export function OfficeHourRow({ oh }: { oh: OfficeHourItem }) {
  const content = (
    <>
      <p className="text-sm text-[#171717]">{oh.label}</p>
      <p className="text-[11px] text-gray-400">
        {oh.timeInfo}
        {oh.location && <> &middot; {oh.location}</>}
      </p>
    </>
  );
  return (
    <DraggableItem
      id={`oh-${oh.id}`}
      data={{ type: "office_hour", item: oh }}
    >
      {oh.sourceUrl ? (
        <a
          href={oh.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-2 block px-2 py-2 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
        >
          {content}
        </a>
      ) : (
        <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
          {content}
        </div>
      )}
    </DraggableItem>
  );
}

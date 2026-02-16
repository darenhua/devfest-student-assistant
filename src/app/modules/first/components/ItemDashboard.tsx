"use client";

import { DraggableItem } from "./DraggableItem";
import type { DraggableItemData, DragItemData } from "./types";

interface ItemDashboardProps {
  items: DraggableItemData[];
  renderItem?: (item: DraggableItemData) => React.ReactNode;
  className?: string;
  title?: string;
}

/**
 * ItemDashboard component
 * Displays a list of draggable items
 *
 * Features:
 * - Renders items with drag support
 * - Customizable item rendering
 * - Optional title
 * - Responsive layout
 */
export function ItemDashboard({
  items,
  renderItem,
  className = "flex h-full flex-col bg-gray-50/50 p-4",
  title,
}: ItemDashboardProps) {
  return (
    <div className={className}>
      {title && (
        <div className="mb-4 border-b pb-2">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No items to display
          </p>
        ) : (
          items.map((item) => {
            const dragData: DragItemData = { type: item.type, item };
            return (
              <DraggableItem key={item.id} id={item.id} data={dragData}>
                {renderItem ? renderItem(item) : <DefaultItemCard item={item} />}
              </DraggableItem>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Default item card component
 * Used when no custom renderItem is provided
 */
function DefaultItemCard({ item }: { item: DraggableItemData }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-xs text-gray-500 truncate mt-1">
              {item.subtitle}
            </p>
          )}
        </div>
        {item.type && (
          <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-full bg-gray-100 text-gray-600">
            {item.type}
          </span>
        )}
      </div>
    </div>
  );
}

import type { DragItemData } from "./types";

interface DragPreviewCardProps {
  data: DragItemData;
  renderPreview?: (data: DragItemData) => React.ReactNode;
}

/**
 * DragPreviewCard component
 * Displays a floating preview card during drag operations
 *
 * Features:
 * - Shows item title and subtitle
 * - Scaled up slightly for visibility (scale-105)
 * - Shadow and border for depth
 * - Can be customized with renderPreview prop
 */
export function DragPreviewCard({ data, renderPreview }: DragPreviewCardProps) {
  // Use custom renderer if provided
  if (renderPreview) {
    return <>{renderPreview(data)}</>;
  }

  // Default preview rendering
  const { title, subtitle } = data.item;

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg scale-105">
      <p className="text-sm font-medium text-[#171717] truncate">{title}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
      )}
    </div>
  );
}

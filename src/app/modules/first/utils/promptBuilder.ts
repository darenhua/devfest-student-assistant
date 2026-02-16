import type { DragItemData } from "../components/types";

/**
 * Default prompt builder function
 * Generates AI prompts based on item type and data
 * Can be overridden by providing a custom buildPrompt function
 */
export function buildAIPrompt(data: DragItemData): string {
  const item = data.item;

  // Generic fallback prompt
  return `Add "${item.title}"${item.subtitle ? ` (${item.subtitle})` : ""} to the document. ${
    item.metadata?.description || "Place it in the most relevant section."
  }`;
}

/**
 * Example prompt builders for specific item types
 * These demonstrate how to customize prompts for different use cases
 */
export const promptBuilders = {
  homework: (data: DragItemData) => {
    const item = data.item;
    return `Add a task item for "${item.title}"${item.metadata?.className ? ` (${item.metadata.className})` : ""}, due ${item.metadata?.dueDate || "soon"}. Place it in the most relevant section of the briefing, or create a new section if needed.`;
  },

  event: (data: DragItemData) => {
    const item = data.item;
    return `Add "${item.title}" to the schedule: ${item.metadata?.timeLabel || ""}${item.metadata?.location ? ` at ${item.metadata.location}` : ""}. Place it in the most relevant section of the briefing.`;
  },

  task: (data: DragItemData) => {
    const item = data.item;
    const priority = item.metadata?.priority ? ` [Priority: ${item.metadata.priority}]` : "";
    return `Add task: "${item.title}"${priority}${item.subtitle ? ` - ${item.subtitle}` : ""}. ${item.metadata?.dueDate ? `Due ${item.metadata.dueDate}.` : ""} Place it in an appropriate task list.`;
  },

  note: (data: DragItemData) => {
    const item = data.item;
    const tags = item.metadata?.tags ? ` Tags: ${item.metadata.tags.join(", ")}` : "";
    return `Add note: "${item.title}"${item.subtitle ? ` - ${item.subtitle}` : ""}.${tags} ${item.metadata?.content || ""}`;
  },
};

/**
 * Factory function to create a custom prompt builder
 * @param builders - Map of item type to prompt builder function
 * @param defaultBuilder - Fallback builder for unknown types
 */
export function createPromptBuilder(
  builders: Record<string, (data: DragItemData) => string>,
  defaultBuilder: (data: DragItemData) => string = buildAIPrompt
) {
  return (data: DragItemData): string => {
    const builder = builders[data.type];
    return builder ? builder(data) : defaultBuilder(data);
  };
}

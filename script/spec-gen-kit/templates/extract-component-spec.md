# Component Extraction Spec Generation

You are tasked with writing an extraction specification for a React component.

## Target Component

- **File:** `{{COMPONENT_PATH}}`
- **Component Name:** `{{COMPONENT_NAME}}`
- **Starting around line:** `{{LINE_NUMBER}}`

## Developer's Intent

The developer wants to extract this component because:

> {{CONTEXT}}

## Your Task

1. Read the component at `{{COMPONENT_PATH}}` (starting around line `{{LINE_NUMBER}}`)
2. Understand what this component does — its props, state, side-effects, dependencies, and how it integrates with its current parent/context
3. Write a `SPEC.md` in the module directory that covers:

### What to Extract
The component's core behavior, isolated from its current context. Describe the visual output, interactivity, state management, and any side effects.

### Dependencies to Carry
What imports, hooks, utilities, context providers, or external packages this component needs to function independently.

### What to Leave Behind
Parts of the current implementation that are specific to the current app context and should NOT be extracted (e.g., app-specific routing, global state subscriptions, parent-level data fetching).

### Integration Plan
How the extracted component should be used in a new module:
- What props/API surface it should expose
- What context or providers it needs from the consumer
- Any configuration or setup required

## Output

Write the spec to exactly this path: `{{MODULE_PATH}}/SPEC.md`

IMPORTANT: Do NOT write the spec near the source component. The target module directory is `{{MODULE_PATH}}/`, which is your current working directory. Write SPEC.md there and nowhere else.

The spec should be detailed enough that a coding agent can create a standalone version of this component in a new module folder without needing to ask questions.

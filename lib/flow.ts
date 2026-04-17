import { Step, getSteps } from "./types";

export type FlowStep = { key: Step; label: string; index: number };

/**
 * Returns the ordered step sequence for a given plan.
 *
 * Both plans follow the same 5-step sequence.
 * The $49 upsell is rendered inline inside the "verify" step UI —
 * it is not a separate routing step. This keeps flow control in the app,
 * not in Stripe or URL logic.
 *
 * To add plan-specific steps in future, extend this function.
 * Do NOT branch routing based on plan outside this file.
 */
export function getFlowSteps(plan: "39" | "69" | null): FlowStep[] {
  return getSteps(plan);
}

/**
 * Returns the zero-based index of a step in the flow for a given plan.
 * Returns -1 if the step is not in the flow.
 */
export function getStepIndex(step: Step, plan: "39" | "69" | null): number {
  return getFlowSteps(plan).findIndex((s) => s.key === step);
}

/**
 * Returns the next step in the flow after the given step.
 * Returns null if already at the last step.
 */
export function getNextStep(step: Step, plan: "39" | "69" | null): Step | null {
  const steps = getFlowSteps(plan);
  const idx = steps.findIndex((s) => s.key === step);
  if (idx === -1 || idx >= steps.length - 1) return null;
  return steps[idx + 1].key;
}

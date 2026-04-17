type TrackEvent =
  | "risk_computed"
  | "risk_accepted"
  | "upgrade_clicked"
  | "agreement_generated";

type TrackProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Centralized event tracking.
 * Drop-in ready for Segment / PostHog / Plausible — swap the body of this
 * function without touching any call site.
 */
export function track(event: TrackEvent, properties?: TrackProperties): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[track]", event, properties ?? {});
  }
  // TODO: wire to analytics provider, e.g.:
  // window.analytics?.track(event, properties);
  // posthog.capture(event, properties);
}

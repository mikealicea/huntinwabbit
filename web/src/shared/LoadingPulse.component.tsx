/** Decorative activity cue; callers provide the visible loading label. */
export function LoadingPulse() {
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
    />
  );
}

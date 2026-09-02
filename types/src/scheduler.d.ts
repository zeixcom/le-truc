/**
 * Schedules a task to run on the next animation frame. If `key` schedules
 * multiple tasks before the next frame, only the latest task runs.
 *
 * @since 0.11.0
 * @param key - Deduplication key; typically the target Element
 * @param task - Function to run on the next animation frame
 */
declare const schedule: (key: object, task: () => void) => void;
/**
 * Throttles a function to run at most once per animation frame, using the
 * latest call's arguments.
 *
 * @since 2.0.0
 * @param fn - Function to throttle
 * @param signal - When aborted, cancels any pending invocation
 * @returns Throttled function with a `.cancel()` method that discards a pending invocation
 */
declare const throttle: <T extends (...args: any[]) => void>(fn: T, signal?: AbortSignal) => T & {
    cancel: () => void;
};
export { schedule, throttle };

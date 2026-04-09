declare const PASSIVE_EVENTS: Set<string>;
/**
 * Schedule a task to be executed on the next animation frame, with automatic
 * deduplication per element. If the same element schedules multiple tasks
 * before the next frame, only the latest task will be executed.
 *
 * Used internally by `on()` for passive events and by `dangerouslyBindInnerHTML`.
 *
 * @since 0.11.0
 * @param {Element} element - Element used as the deduplication key
 * @param {() => void} task - Function to execute on the next animation frame
 */
declare const schedule: (element: Element, task: () => void) => void;
export { PASSIVE_EVENTS, schedule };

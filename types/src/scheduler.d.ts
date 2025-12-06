type Task = () => void;
/**
 * Schedule a task to be executed on the next animation frame, with automatic
 * deduplication per component. If the same component schedules multiple tasks
 * before the next frame, only the latest task will be executed.
 *
 * @param component - Component instance for deduplication
 * @param task - Function to execute (typically calls batch() or sets a signal)
 */
declare const schedule: (component: HTMLElement, task: Task) => void;
export { type Task, schedule };

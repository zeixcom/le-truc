type Updater = <T>() => T | boolean | undefined;
/**
 * Schedule a function to be executed on the next animation frame
 *
 * If the same Symbol is provided for multiple calls before the next animation frame,
 * only the latest call will be executed (deduplication).
 *
 * @param {Updater} fn - function to be executed on the next animation frame; can return updated value <T>, success <boolean> or void
 * @param {symbol} dedupe - Symbol for deduplication; if not provided, a unique Symbol is created ensuring the update is always executed
 */
declare const schedule: <T>(fn: Updater, dedupe?: symbol) => Promise<boolean | T | undefined>;
export { type Updater, schedule };

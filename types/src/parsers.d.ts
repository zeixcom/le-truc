type Parser<T extends {}> = (value: string | null | undefined) => T;
/** A branded method-producer function (side-effect initializer, returns void). */
type MethodProducer = ((...args: any[]) => void) & {
    readonly [METHOD_BRAND]: true;
};
/** Symbol brand applied to all Parser functions. */
declare const PARSER_BRAND: unique symbol;
/** Symbol brand applied to all MethodProducer functions. */
declare const METHOD_BRAND: unique symbol;
/**
 * Check if a value is a parser
 *
 * Checks for the `PARSER_BRAND` symbol. Unbranded functions are NOT treated as
 * parsers — always use `asParser()` to brand custom parsers.
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a parser
 * @returns {boolean} True if the value is a parser, false otherwise
 */
declare const isParser: <T extends {}>(value: unknown) => value is Parser<T>;
/**
 * Check if a value is a MethodProducer (branded side-effect initializer)
 *
 * @since 0.16.2
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a MethodProducer
 */
declare const isMethodProducer: (value: unknown) => value is MethodProducer;
/**
 * Brand a custom parser function with the `PARSER_BRAND` symbol.
 *
 * Use this to wrap any custom parser so `isParser()` can identify it reliably.
 *
 * @since 0.16.2
 * @param {Parser<T>} fn - Custom parser function to brand
 * @returns {Parser<T>} The same function, branded
 */
declare const asParser: <T extends {}>(fn: Parser<T>) => Parser<T>;
/**
 * Brand a custom method-producer function with the `METHOD_BRAND` symbol.
 *
 * Use this to wrap any side-effect initializer so `isMethodProducer()` can
 * identify it explicitly rather than relying on the absence of a return value.
 *
 * @since 0.16.2
 * @param {T} fn - Side-effect initializer to brand
 * @returns {T & { readonly [METHOD_BRAND]: true }} The same function, branded as a `MethodProducer`
 */
declare const asMethod: <T extends (...args: any[]) => void>(fn: T) => T & {
    readonly [METHOD_BRAND]: true;
};
export { asMethod, asParser, isMethodProducer, isParser, METHOD_BRAND, type MethodProducer, PARSER_BRAND, type Parser, };

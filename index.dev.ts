/**
 * @name Le Truc
 * @version 0.15.1
 * @author Esther Brunner
 */

// From Cause & Effect
export {
	batchSignalWrites,
	CircularDependencyError,
	type Cleanup,
	type Collection,
	type Computed,
	createComputed,
	createEffect,
	createError,
	createSignal,
	createStore,
	DerivedCollection,
	type DiffResult,
	DuplicateKeyError,
	diff,
	type EffectCallback,
	type Guard,
	InvalidCallbackError,
	InvalidCollectionSourceError,
	InvalidSignalValueError,
	isAbortError,
	isAsyncFunction,
	isComputed,
	isEqual,
	isFunction,
	isMutableSignal,
	isNumber,
	isRecord,
	isRecordOrArray,
	isSignal,
	isState,
	isStore,
	isString,
	isSymbol,
	type KeyConfig,
	List,
	type MatchHandlers,
	type MaybeCleanup,
	Memo,
	match,
	NullishSignalValueError,
	ReadonlySignalError,
	Ref,
	type ResolveResult,
	resolve,
	type Signal,
	State,
	type Store,
	Task,
	UNSET,
	valueString,
} from '@zeix/cause-effect'

export {
	type Component,
	type ComponentProp,
	type ComponentProps,
	type ComponentSetup,
	type ComponentUI,
	defineComponent,
	type Initializers,
	type MaybeSignal,
	type ReservedWords,
} from './src/component'
export {
	CONTEXT_REQUEST,
	type Context,
	ContextRequestEvent,
	type ContextType,
	provideContexts,
	requestContext,
	type UnknownContext,
} from './src/context'
export {
	type Effect,
	type Effects,
	type ElementEffects,
	type ElementUpdater,
	type Reactive,
	runEffects,
	runElementEffects,
	updateElement,
} from './src/effects'
export { setAttribute, toggleAttribute } from './src/effects/attribute'
export { toggleClass } from './src/effects/class'
export { type EventHandler, type EventType, on } from './src/effects/event'
export {
	type DangerouslySetInnerHTMLOptions,
	dangerouslySetInnerHTML,
} from './src/effects/html'
export { type PassedProp, type PassedProps, pass } from './src/effects/pass'
export { setProperty, show } from './src/effects/property'
export { setStyle } from './src/effects/style'
export { setText } from './src/effects/text'
export {
	CircularMutationError,
	DependencyTimeoutError,
	InvalidComponentNameError,
	InvalidCustomElementError,
	InvalidEffectsError,
	InvalidPropertyNameError,
	InvalidReactivesError,
	MissingElementError,
} from './src/errors'
export {
	type Fallback,
	isParser,
	type LooseReader,
	type Parser,
	type ParserOrFallback,
	type Reader,
	read,
} from './src/parsers'
export { asBoolean } from './src/parsers/boolean'
export { asJSON } from './src/parsers/json'
export { asInteger, asNumber } from './src/parsers/number'
export { asEnum, asString } from './src/parsers/string'
export { schedule } from './src/scheduler'
export { createSensor, type SensorEvents } from './src/signals/sensor'
export type { ElementFromKey, ElementQueries, UI } from './src/ui'

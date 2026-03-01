// Le Truc 0.16.3

// From Cause & Effect
export {
	batch,
	CircularDependencyError,
	type Cleanup,
	type Collection,
	type CollectionChanges,
	type CollectionOptions,
	type ComputedOptions,
	createCollection,
	createComputed,
	createEffect,
	createList,
	createMemo,
	createMutableSignal,
	createScope,
	createSensor,
	createSignal,
	createSlot,
	createState,
	createStore,
	createTask,
	type EffectCallback,
	type Guard,
	InvalidCallbackError,
	InvalidSignalValueError,
	isAsyncFunction,
	isCollection,
	isComputed,
	isEqual,
	isFunction,
	isList,
	isMemo,
	isMutableSignal,
	isObjectOfType,
	isRecord,
	isSensor,
	isSignal,
	isSlot,
	isState,
	isStore,
	isTask,
	type List,
	type ListOptions,
	type MatchHandlers,
	type MaybeCleanup,
	type Memo,
	type MemoCallback,
	match,
	NullishSignalValueError,
	ReadonlySignalError,
	RequiredOwnerError,
	type Sensor,
	type SensorOptions,
	type Signal,
	type SignalOptions,
	SKIP_EQUALITY,
	type Slot,
	type State,
	type Store,
	type StoreOptions,
	type Task,
	type TaskCallback,
	UnsetSignalValueError,
	unown,
	untrack,
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
	type ContextCallback,
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
	type UpdateOperation,
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
	DependencyTimeoutError,
	InvalidComponentNameError,
	InvalidCustomElementError,
	InvalidEffectsError,
	InvalidPropertyNameError,
	InvalidReactivesError,
	InvalidUIKeyError,
	MissingElementError,
} from './src/errors'
export {
	createEventsSensor,
	type EventHandlers,
	type SensorEventHandler,
} from './src/events'
export {
	asMethod,
	asParser,
	type Fallback,
	isMethodProducer,
	isParser,
	type LooseReader,
	type MethodProducer,
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
export {
	type AllElements,
	createElementsMemo,
	type ElementFromKey,
	type ElementFromSelector,
	type ElementFromSingleSelector,
	type ElementQueries,
	type ElementsFromSelectorArray,
	type ExtractRightmostSelector,
	type ExtractTag,
	type ExtractTagFromSimpleSelector,
	type FirstElement,
	type KnownTag,
	type SplitByComma,
	type TrimWhitespace,
	type UI,
} from './src/ui'

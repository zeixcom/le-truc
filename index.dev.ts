/**
 * @name Le Truc
 * @version 0.15.0
 * @author Esther Brunner
 */

// From Cause & Effect
export {
	batch,
	CircularDependencyError,
	type Cleanup,
	type Computed,
	type ComputedCallback,
	createComputed,
	createEffect,
	createState,
	createStore,
	type DiffResult,
	diff,
	type EffectCallback,
	InvalidCallbackError,
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
	type MatchHandlers,
	type MaybeCleanup,
	match,
	NullishSignalValueError,
	type ResolveResult,
	resolve,
	type Signal,
	type State,
	type Store,
	StoreKeyExistsError,
	StoreKeyRangeError,
	StoreKeyReadonlyError,
	toError,
	toSignal,
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
	type Effect,
	type Effects,
	type ElementEffects,
	insertOrRemoveElement,
	type Reactive,
	runEffects,
	runElementEffects,
	updateElement,
} from './src/effects'
export { setAttribute, toggleAttribute } from './src/effects/attribute'
export { toggleClass } from './src/effects/class'
export {
	type EventHandler,
	type EventType,
	emit,
	on,
} from './src/effects/event'
export {
	type DangerouslySetInnerHTMLOptions,
	dangerouslySetInnerHTML,
} from './src/effects/html'
export { type PassedProp, type PassedProps, pass } from './src/effects/pass'
export { setProperty, show } from './src/effects/property'
export { setStyle } from './src/effects/style'
export { setText } from './src/effects/text'
export {
	isParser,
	type LooseReader,
	type Parser,
	type Reader,
	read,
} from './src/parsers'
export { asBoolean } from './src/parsers/boolean'
export { asJSON } from './src/parsers/json'
export { asInteger, asNumber } from './src/parsers/number'
export { asEnum, asString } from './src/parsers/string'
export {
	type Collection,
	type CollectionListener,
	createCollection,
	isCollection,
} from './src/signals/collection'
export { createSensor } from './src/signals/sensor'
export type { UI } from './src/ui'

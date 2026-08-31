// node_modules/@zeix/cause-effect/index.js
var ASYNC_FUNCTION_PROTO = Object.getPrototypeOf(async () => {});
function isFunction(fn) {
  return typeof fn === "function";
}
function isAsyncFunction(fn) {
  return isFunction(fn) && Object.getPrototypeOf(fn) === ASYNC_FUNCTION_PROTO;
}
function isSyncFunction(fn) {
  return isFunction(fn) && Object.getPrototypeOf(fn) !== ASYNC_FUNCTION_PROTO;
}
function isSignalOfType(value, type) {
  return value != null && value[Symbol.toStringTag] === type;
}
function isRecord(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}
function valueString(value) {
  if (typeof value === "string")
    return `"${value}"`;
  if (value != null && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

class CircularDependencyError extends Error {
  constructor(where) {
    super(`[${where}] Circular dependency detected`);
    this.name = "CircularDependencyError";
  }
}

class EffectConvergenceError extends Error {
  constructor(passes) {
    super(`[Effect] Effects did not settle after ${passes} flush passes — check for effects that write to signals they depend on`);
    this.name = "EffectConvergenceError";
  }
}

class NullishSignalValueError extends TypeError {
  constructor(where) {
    super(`[${where}] Signal value cannot be null or undefined`);
    this.name = "NullishSignalValueError";
  }
}

class UnsetSignalValueError extends Error {
  constructor(where) {
    super(`[${where}] Signal value is unset`);
    this.name = "UnsetSignalValueError";
  }
}

class InvalidSignalValueError extends TypeError {
  constructor(where, value) {
    super(`[${where}] Signal value ${valueString(value)} is invalid`);
    this.name = "InvalidSignalValueError";
  }
}

class InvalidCallbackError extends TypeError {
  constructor(where, value) {
    super(`[${where}] Callback ${valueString(value)} is invalid`);
    this.name = "InvalidCallbackError";
  }
}

class ReadonlySignalError extends Error {
  constructor(where) {
    super(`[${where}] Signal is read-only`);
    this.name = "ReadonlySignalError";
  }
}

class RequiredOwnerError extends Error {
  constructor(where) {
    super(`[${where}] Active owner is required`);
    this.name = "RequiredOwnerError";
  }
}

class PromiseValueError extends TypeError {
  constructor(where) {
    super(`[${where}] Callback returned a Promise — use an async callback to create a Task instead`);
    this.name = "PromiseValueError";
  }
}

class UnresolvableKeyError extends Error {
  constructor(where, value) {
    super(`[${where}] Could not resolve a key for value ${valueString(value)} — a content-based keyConfig (item => key) is required to match change/remove entries against externally-sourced data, whose items are rarely reference-equal to what is already tracked`);
    this.name = "UnresolvableKeyError";
  }
}

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`[${where}] Could not add key "${key}"${value != null ? ` with value ${JSON.stringify(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}

class InvalidStoreMutationError extends TypeError {
  constructor(prop, action) {
    const guidance = action === "delete" ? `use store.remove(${JSON.stringify(prop)})` : `use store.${prop}.set(value), store.set(next), or store.add(key, value)`;
    super(`[Store] Cannot ${action} property "${prop}" directly — ${guidance}`);
    this.name = "InvalidStoreMutationError";
  }
}
function validateSignalValue(where, value, guard) {
  if (value == null)
    throw new NullishSignalValueError(where);
  if (guard && !guard(value))
    throw new InvalidSignalValueError(where, value);
}
function validateReadValue(where, value) {
  if (value == null)
    throw new UnsetSignalValueError(where);
}
function validateCallback(where, value, guard = isFunction) {
  if (!guard(value))
    throw new InvalidCallbackError(where, value);
}
var TYPE_STATE = "State";
var TYPE_MEMO = "Memo";
var TYPE_TASK = "Task";
var TYPE_SENSOR = "Sensor";
var TYPE_LIST = "List";
var TYPE_COLLECTION = "Collection";
var TYPE_STORE = "Store";
var TYPE_SLOT = "Slot";
var FLAG_CLEAN = 0;
var FLAG_CHECK = 1 << 0;
var FLAG_DIRTY = 1 << 1;
var FLAG_RUNNING = 1 << 2;
var FLAG_RELINK = 1 << 3;
var activeSink = null;
var activeOwner = null;
var queuedEffects = [];
var batchDepth = 0;
var flushing = false;
var DEFAULT_EQUALITY = (a, b) => a === b;
var SKIP_EQUALITY = (_a, _b) => false;
var deepEqual = (a, b) => deepEqualInner(a, b, undefined);
var deepEqualInner = (a, b, seen) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (a == null || typeof a !== "object" || b == null || typeof b !== "object")
    return false;
  if (seen?.has(a))
    return true;
  seen ??= new WeakSet;
  seen.add(a);
  try {
    const aIsArray = Array.isArray(a);
    if (aIsArray !== Array.isArray(b))
      return false;
    if (aIsArray) {
      const aa = a;
      const ba = b;
      if (aa.length !== ba.length)
        return false;
      for (let i = 0;i < aa.length; i++)
        if (!deepEqualInner(aa[i], ba[i], seen))
          return false;
      return true;
    }
    if (a instanceof Date && b instanceof Date)
      return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp)
      return a.source === b.source && a.flags === b.flags;
    if (isRecord(a) && isRecord(b)) {
      const aKeys = Object.keys(a);
      if (aKeys.length !== Object.keys(b).length)
        return false;
      for (const key of aKeys) {
        if (!(key in b))
          return false;
        if (!deepEqualInner(a[key], b[key], seen))
          return false;
      }
      return true;
    }
    return false;
  } finally {
    seen.delete(a);
  }
};
var DEEP_EQUALITY = (a, b) => deepEqual(a, b);
function isValidEdge(checkEdge, node) {
  const sourcesTail = node.sourcesTail;
  if (sourcesTail) {
    let edge = node.sources;
    while (edge) {
      if (edge === checkEdge)
        return true;
      if (edge === sourcesTail)
        break;
      edge = edge.nextSource;
    }
  }
  return false;
}
function link(source, sink) {
  const prevSource = sink.sourcesTail;
  if (prevSource?.source === source)
    return;
  let nextSource = null;
  const isRecomputing = sink.flags & FLAG_RUNNING;
  if (isRecomputing) {
    nextSource = prevSource ? prevSource.nextSource : sink.sources;
    if (nextSource?.source === source) {
      sink.sourcesTail = nextSource;
      return;
    }
  }
  const prevSink = source.sinksTail;
  if (prevSink?.sink === sink && (!isRecomputing || isValidEdge(prevSink, sink)))
    return;
  const newEdge = { source, sink, nextSource, prevSink, nextSink: null };
  sink.sourcesTail = source.sinksTail = newEdge;
  if (prevSource)
    prevSource.nextSource = newEdge;
  else
    sink.sources = newEdge;
  if (prevSink)
    prevSink.nextSink = newEdge;
  else
    source.sinks = newEdge;
}
function unlink(edge) {
  const { source, nextSource, nextSink, prevSink } = edge;
  if (nextSink)
    nextSink.prevSink = prevSink;
  else
    source.sinksTail = prevSink;
  if (prevSink)
    prevSink.nextSink = nextSink;
  else
    source.sinks = nextSink;
  if (!source.sinks) {
    if (source.stop) {
      source.stop();
      source.stop = undefined;
    }
    if ("sources" in source && source.sources) {
      const sinkNode = source;
      sinkNode.sourcesTail = null;
      trimSources(sinkNode);
      sinkNode.flags |= FLAG_DIRTY;
    }
  }
  return nextSource;
}
function trimSources(node) {
  const tail = node.sourcesTail;
  let source = tail ? tail.nextSource : node.sources;
  while (source)
    source = unlink(source);
  if (tail)
    tail.nextSource = null;
  else
    node.sources = null;
}
function propagate(node, newFlag = FLAG_DIRTY) {
  const flags = node.flags;
  if ("sinks" in node) {
    if ((flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag)
      return;
    node.flags = flags | newFlag;
    if ("controller" in node && node.controller) {
      node.controller.abort();
      node.controller = undefined;
    }
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink, FLAG_CHECK);
  } else {
    if ((flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag)
      return;
    const wasQueued = flags & (FLAG_DIRTY | FLAG_CHECK);
    node.flags = flags & FLAG_RUNNING | newFlag;
    if (!wasQueued)
      queuedEffects.push(node);
  }
}
function setState(node, next) {
  if (node.equals(node.value, next))
    return;
  node.value = next;
  for (let e = node.sinks;e; e = e.nextSink)
    propagate(e.sink);
  if (batchDepth === 0)
    flush();
}
function registerCleanup(owner, fn) {
  if (!owner.cleanup)
    owner.cleanup = fn;
  else if (Array.isArray(owner.cleanup))
    owner.cleanup.push(fn);
  else
    owner.cleanup = [owner.cleanup, fn];
}
function runCleanup(owner) {
  if (!owner.cleanup)
    return;
  if (Array.isArray(owner.cleanup))
    for (let i = 0;i < owner.cleanup.length; i++)
      owner.cleanup[i]();
  else
    owner.cleanup();
  owner.cleanup = null;
}
function recomputeMemo(node) {
  const prevWatcher = activeSink;
  activeSink = node;
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  let changed = false;
  try {
    const next = node.fn(node.value);
    if (next instanceof Promise)
      throw new PromiseValueError(TYPE_MEMO);
    if (node.error || !node.equals(next, node.value)) {
      node.value = next;
      node.error = undefined;
      changed = true;
    }
  } catch (err) {
    changed = true;
    node.error = err instanceof Error ? err : new Error(String(err));
  } finally {
    activeSink = prevWatcher;
    trimSources(node);
  }
  if (changed) {
    for (let e = node.sinks;e; e = e.nextSink)
      if (e.sink.flags & FLAG_CHECK)
        e.sink.flags |= FLAG_DIRTY;
  }
  node.flags = FLAG_CLEAN;
}
function recomputeTask(node) {
  node.controller?.abort();
  const controller = new AbortController;
  node.controller = controller;
  node.error = undefined;
  const prevWatcher = activeSink;
  activeSink = node;
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  let promise;
  try {
    promise = node.fn(node.value, controller.signal);
  } catch (err) {
    node.controller = undefined;
    node.error = err instanceof Error ? err : new Error(String(err));
    node.flags = FLAG_CLEAN;
    setState(node.pendingNode, false);
    return;
  } finally {
    activeSink = prevWatcher;
    trimSources(node);
  }
  setState(node.pendingNode, true);
  promise.then((next) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    batch(() => {
      if (node.error || !node.equals(next, node.value)) {
        node.value = next;
        node.error = undefined;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
      }
      setState(node.pendingNode, false);
    });
  }, (err) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    const error = err instanceof Error ? err : new Error(String(err));
    batch(() => {
      if (!node.error || error.name !== node.error.name || error.message !== node.error.message) {
        node.error = error;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
      }
      setState(node.pendingNode, false);
    });
  });
  node.flags = FLAG_CLEAN;
}
function runEffect(node) {
  runCleanup(node);
  const prevContext = activeSink;
  const prevOwner = activeOwner;
  activeSink = activeOwner = node;
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  try {
    const out = node.fn();
    if (typeof out === "function")
      registerCleanup(node, out);
  } finally {
    activeSink = prevContext;
    activeOwner = prevOwner;
    trimSources(node);
    node.flags &= FLAG_DIRTY | FLAG_CHECK;
  }
}
function refresh(node) {
  if (node.flags & FLAG_CHECK) {
    for (let e = node.sources;e; e = e.nextSource) {
      if ("fn" in e.source)
        refresh(e.source);
      if (node.flags & FLAG_DIRTY)
        break;
    }
  }
  if (node.flags & FLAG_RUNNING) {
    throw new CircularDependencyError("controller" in node ? TYPE_TASK : ("value" in node) ? TYPE_MEMO : "Effect");
  }
  if (node.flags & FLAG_DIRTY) {
    if ("controller" in node)
      recomputeTask(node);
    else if ("value" in node)
      recomputeMemo(node);
    else
      runEffect(node);
  } else {
    node.flags = FLAG_CLEAN;
  }
}
var MAX_FLUSH_PASSES = 1000;
function flush() {
  if (flushing)
    return;
  flushing = true;
  let errors;
  let passes = 0;
  try {
    while (queuedEffects.length > 0) {
      if (++passes > MAX_FLUSH_PASSES) {
        queuedEffects.length = 0;
        if (!errors)
          errors = [];
        errors.push(new EffectConvergenceError(MAX_FLUSH_PASSES));
        break;
      }
      const batch = queuedEffects.slice();
      queuedEffects.length = 0;
      for (let i = 0;i < batch.length; i++) {
        const effect = batch[i];
        if (effect.flags & FLAG_RUNNING)
          continue;
        if (effect.flags & (FLAG_DIRTY | FLAG_CHECK)) {
          try {
            refresh(effect);
          } catch (err) {
            if (!errors)
              errors = [];
            errors.push(err);
          }
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (errors) {
    if (errors.length === 1)
      throw errors[0];
    throw new AggregateError(errors, "Multiple effects threw during flush");
  }
}
function scheduleEffect(node) {
  if (node.flags & (FLAG_DIRTY | FLAG_CHECK)) {
    queuedEffects.push(node);
    if (batchDepth === 0)
      flush();
  }
}
function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0)
      flush();
  }
}
function untrack(fn) {
  const prev = activeSink;
  activeSink = null;
  try {
    return fn();
  } finally {
    activeSink = prev;
  }
}
function createScope(fn, options) {
  const prevOwner = activeOwner;
  const scope = { cleanup: null };
  activeOwner = scope;
  const dispose = () => runCleanup(scope);
  try {
    const out = fn();
    if (typeof out === "function")
      registerCleanup(scope, out);
    return dispose;
  } finally {
    activeOwner = prevOwner;
    if (!options?.root && prevOwner)
      registerCleanup(prevOwner, dispose);
  }
}
function unown(fn) {
  const prev = activeOwner;
  activeOwner = null;
  try {
    return fn();
  } finally {
    activeOwner = prev;
  }
}
function makeSubscribe(node, onWatch) {
  return onWatch ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = onWatch();
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
}
function refreshComposite(node, buildValue, discoversKeys = false) {
  if (node.sources) {
    if (!node.flags)
      return;
    const result = discoversKeys ? untrack(buildValue) : undefined;
    if (node.flags & FLAG_RELINK) {
      node.flags = FLAG_DIRTY;
      refresh(node);
      if (node.error)
        throw node.error;
    } else {
      node.value = discoversKeys ? result : untrack(buildValue);
      node.flags = FLAG_CLEAN;
    }
  } else if (!discoversKeys || node.sinks) {
    refresh(node);
    if (node.error)
      throw node.error;
  } else {
    node.value = untrack(buildValue);
  }
}
var asyncSources = new WeakMap;
function registerAsyncSource(signal, source) {
  asyncSources.set(signal, source);
}
function getAsyncSource(signal) {
  if (signal == null || typeof signal !== "object")
    return;
  const candidate = signal;
  if (typeof candidate.isPending === "function" && typeof candidate.abort === "function")
    return candidate;
  return asyncSources.get(signal);
}
function isPending(signal) {
  return getAsyncSource(signal)?.isPending() ?? false;
}
function abort(signal) {
  getAsyncSource(signal)?.abort();
}
function createMemo(fn, options) {
  validateCallback(TYPE_MEMO, fn, isSyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_MEMO, options.value, options?.guard);
  const node = {
    fn,
    value: options?.value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    error: undefined,
    stop: undefined
  };
  const watched = options?.watched;
  const subscribe = makeSubscribe(node, watched ? () => watched(() => {
    propagate(node);
    if (batchDepth === 0)
      flush();
  }) : undefined);
  return {
    [Symbol.toStringTag]: TYPE_MEMO,
    get() {
      subscribe();
      refresh(node);
      if (node.error)
        throw node.error;
      validateReadValue(TYPE_MEMO, node.value);
      return node.value;
    }
  };
}
function isMemo(value) {
  return isSignalOfType(value, TYPE_MEMO);
}
function createSensor(watched, options) {
  validateCallback(TYPE_SENSOR, watched, isSyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_SENSOR, options.value, options?.guard);
  const node = {
    value: options?.value,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    guard: options?.guard,
    stop: undefined
  };
  return {
    [Symbol.toStringTag]: TYPE_SENSOR,
    get() {
      if (activeSink) {
        if (!node.sinks)
          node.stop = watched((next) => {
            validateSignalValue(TYPE_SENSOR, next, node.guard);
            setState(node, next);
          });
        link(node, activeSink);
      }
      validateReadValue(TYPE_SENSOR, node.value);
      return node.value;
    }
  };
}
function isSensor(value) {
  return isSignalOfType(value, TYPE_SENSOR);
}
function createState(value, options) {
  validateSignalValue(TYPE_STATE, value, options?.guard);
  const node = {
    value,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    guard: options?.guard
  };
  return {
    [Symbol.toStringTag]: TYPE_STATE,
    get() {
      if (activeSink)
        link(node, activeSink);
      return node.value;
    },
    set(next) {
      validateSignalValue(TYPE_STATE, next, node.guard);
      setState(node, next);
    },
    update(fn) {
      validateCallback(TYPE_STATE, fn);
      const next = fn(node.value);
      validateSignalValue(TYPE_STATE, next, node.guard);
      setState(node, next);
    }
  };
}
function isState(value) {
  return isSignalOfType(value, TYPE_STATE);
}
function createTask(fn, options) {
  validateCallback(TYPE_TASK, fn, isAsyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_TASK, options.value, options?.guard);
  const pendingNode = {
    value: false,
    sinks: null,
    sinksTail: null,
    equals: DEFAULT_EQUALITY
  };
  const node = {
    fn,
    value: options?.value,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    flags: FLAG_DIRTY,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    controller: undefined,
    error: undefined,
    stop: undefined,
    pendingNode
  };
  const watched = options?.watched;
  const subscribe = makeSubscribe(node, watched ? () => watched(() => {
    propagate(node);
    if (batchDepth === 0)
      flush();
  }) : undefined);
  const pendingSubscribe = makeSubscribe(pendingNode);
  return {
    [Symbol.toStringTag]: TYPE_TASK,
    get() {
      subscribe();
      refresh(node);
      if (node.error)
        throw node.error;
      validateReadValue(TYPE_TASK, node.value);
      return node.value;
    },
    isPending() {
      pendingSubscribe();
      return node.pendingNode.value;
    },
    abort() {
      node.controller?.abort();
      node.controller = undefined;
      setState(node.pendingNode, false);
    }
  };
}
function isTask(value) {
  return isSignalOfType(value, TYPE_TASK);
}
function createComputed(callback, options) {
  return isAsyncFunction(callback) ? createTask(callback, options) : createMemo(callback, options);
}
function deriveCell(input, options) {
  if (isFunction(input)) {
    const { initial, watched: watched2, ...rest2 } = options ?? {};
    const computedOptions = {
      ...rest2,
      value: initial,
      watched: watched2
    };
    return isAsyncFunction(input) ? createTask(input, computedOptions) : createMemo(input, computedOptions);
  }
  const { watched, ...rest } = options;
  validateCallback("deriveCell", watched, isSyncFunction);
  return createSensor(watched, { ...rest, value: input });
}
var deriveSignal = deriveCell;
function createCell(value, options) {
  return createState(value, options);
}
function isComputed(value) {
  return isMemo(value) || isTask(value);
}
var CELL_TYPES = new Set([TYPE_STATE, TYPE_MEMO, TYPE_TASK, TYPE_SENSOR]);
function isCell(value) {
  return value != null && CELL_TYPES.has(value[Symbol.toStringTag]);
}
function isMutableCell(value) {
  return isState(value);
}
function keysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0;i < a.length; i++)
    if (a[i] !== b[i])
      return false;
  return true;
}
function getKeyGenerator(keyConfig) {
  let keyCounter = 0;
  const contentBased = typeof keyConfig === "function";
  const positional = keyConfig === undefined;
  return [
    typeof keyConfig === "string" ? () => `${keyConfig}${keyCounter++}` : contentBased ? (item) => keyConfig(item) || String(keyCounter++) : () => String(keyCounter++),
    contentBased,
    positional
  ];
}
function diffPositional(prev, next, prevKeys, generateKey, itemEquals, positional) {
  const add = {};
  const change = {};
  const remove = {};
  const nextKeys = [];
  let changed = false;
  const minLen = Math.min(prev.length, next.length);
  for (let i = 0;i < minLen; i++) {
    const key = prevKeys[i];
    const prevItem = prev[i];
    const nextItem = next[i];
    if (itemEquals(prevItem, nextItem)) {
      nextKeys.push(key);
      continue;
    }
    changed = true;
    if (positional) {
      nextKeys.push(key);
      change[key] = nextItem;
    } else {
      remove[key] = null;
      const newKey = generateKey(nextItem);
      nextKeys.push(newKey);
      add[newKey] = nextItem;
    }
  }
  for (let i = minLen;i < next.length; i++) {
    const val = next[i];
    const key = generateKey(val);
    nextKeys.push(key);
    add[key] = val;
    changed = true;
  }
  for (let i = minLen;i < prev.length; i++) {
    remove[prevKeys[i]] = null;
    changed = true;
  }
  return { add, change, remove, newKeys: nextKeys, changed };
}
function diffArrays(prev, next, prevKeys, generateKey, contentBased, itemEquals, positional) {
  if (!contentBased)
    return diffPositional(prev, next, prevKeys, generateKey, itemEquals, positional);
  const add = {};
  const change = {};
  const remove = {};
  const nextKeys = [];
  let changed = false;
  const prevByKey = new Map;
  for (let i = 0;i < prev.length; i++) {
    const key = prevKeys[i];
    const item = prev[i];
    if (key && item !== undefined)
      prevByKey.set(key, item);
  }
  const seenKeys = new Set;
  for (let i = 0;i < next.length; i++) {
    const val = next[i];
    validateSignalValue(`${TYPE_LIST} item at index ${i}`, val);
    const key = generateKey(val);
    if (seenKeys.has(key))
      throw new DuplicateKeyError(TYPE_LIST, key, val);
    nextKeys.push(key);
    seenKeys.add(key);
    if (!prevByKey.has(key)) {
      add[key] = val;
      changed = true;
    } else if (!itemEquals(prevByKey.get(key), val)) {
      change[key] = val;
      changed = true;
    }
  }
  for (const [key] of prevByKey) {
    if (!seenKeys.has(key)) {
      remove[key] = null;
      changed = true;
    }
  }
  if (!changed && !keysEqual(prevKeys, nextKeys))
    changed = true;
  return { add, change, remove, newKeys: nextKeys, changed };
}
function createList(value, options) {
  validateSignalValue(TYPE_LIST, value, Array.isArray);
  const signals = new Map;
  let keys = [];
  const [generateKey, contentBased, positional] = getKeyGenerator(options?.keyConfig);
  const itemEquals = options?.itemEquals ?? DEEP_EQUALITY;
  const itemFactory = options?.createItem ?? ((item) => createState(item, { equals: itemEquals }));
  const buildValue = () => {
    const result = [];
    for (const key of keys) {
      const v = signals.get(key)?.get();
      if (v !== undefined)
        result.push(v);
    }
    return result;
  };
  const node = {
    fn: buildValue,
    value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: DEEP_EQUALITY,
    error: undefined
  };
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      const val = changes.add[key];
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
      signals.set(key, itemFactory(val));
      structural = true;
    }
    let hasChange = false;
    for (const _key in changes.change) {
      hasChange = true;
      break;
    }
    if (hasChange) {
      batch(() => {
        for (const key in changes.change) {
          const val = changes.change[key];
          validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
          const signal = signals.get(key);
          if (signal)
            signal.set(val);
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
      const index = keys.indexOf(key);
      if (index !== -1)
        keys.splice(index, 1);
      structural = true;
    }
    if (structural)
      node.flags |= FLAG_RELINK;
    return changes.changed;
  };
  const subscribe = makeSubscribe(node, options?.watched);
  for (let i = 0;i < value.length; i++) {
    const val = value[i];
    if (val == null)
      throw new NullishSignalValueError(`${TYPE_LIST} item ${i}`);
    const key = generateKey(val);
    if (signals.has(key))
      throw new DuplicateKeyError(TYPE_LIST, key, val);
    keys[i] = key;
    signals.set(key, itemFactory(val));
  }
  node.value = value;
  const list = {
    [Symbol.toStringTag]: TYPE_LIST,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      subscribe();
      for (const key of keys) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      subscribe();
      return keys.length;
    },
    get() {
      subscribe();
      refreshComposite(node, buildValue);
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value;
      const changes = diffArrays(prev, next, keys, generateKey, contentBased, itemEquals, positional);
      if (changes.changed) {
        keys = changes.newKeys;
        applyChanges(changes);
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    update(fn) {
      list.set(fn(untrack(() => list.get())));
    },
    at(index) {
      subscribe();
      const key = keys[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    keys() {
      subscribe();
      return keys.values();
    },
    byKey(key) {
      subscribe();
      return signals.get(key);
    },
    keyAt(index) {
      subscribe();
      return keys[index];
    },
    indexOfKey(key) {
      subscribe();
      return keys.indexOf(key);
    },
    add(value2) {
      const key = generateKey(value2);
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_LIST, key, value2);
      keys.push(key);
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value2);
      signals.set(key, itemFactory(value2));
      node.flags |= FLAG_DIRTY | FLAG_RELINK;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(keyOrIndex) {
      const key = typeof keyOrIndex === "number" ? keys[keyOrIndex] : keyOrIndex;
      if (key === undefined)
        return;
      const ok = signals.delete(key);
      if (ok) {
        const index = typeof keyOrIndex === "number" ? keyOrIndex : keys.indexOf(key);
        if (index >= 0)
          keys.splice(index, 1);
        node.flags |= FLAG_DIRTY | FLAG_RELINK;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    replace(key, value2) {
      const signal = signals.get(key);
      if (!signal)
        return;
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value2);
      if (itemEquals(untrack(() => signal.get()), value2))
        return;
      batch(() => {
        signal.set(value2);
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
      });
      if (batchDepth === 0)
        flush();
    },
    sort(compareFn) {
      const entries = [];
      untrack(() => {
        for (const key of keys) {
          const v = signals.get(key)?.get();
          if (v !== undefined)
            entries.push([key, v]);
        }
      });
      entries.sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
      const newOrder = [];
      for (const [key] of entries)
        newOrder.push(key);
      if (!keysEqual(keys, newOrder)) {
        keys = newOrder;
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    splice(start, deleteCount, ...items) {
      const length = keys.length;
      const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
      const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
      const add = {};
      const remove = {};
      let hasRemove = false;
      untrack(() => {
        for (let i = 0;i < actualDeleteCount; i++) {
          const index2 = actualStart + i;
          const key = keys[index2];
          if (key) {
            const signal = signals.get(key);
            if (signal) {
              remove[key] = signal.get();
              hasRemove = true;
            }
          }
        }
      });
      const newOrder = keys.slice(0, actualStart);
      const change = {};
      let hasAdd = false;
      let hasChange = false;
      const staged = new Set;
      let index = 0;
      for (const item of items) {
        validateSignalValue(`${TYPE_LIST} item ${actualStart + index}`, item);
        index++;
        const key = generateKey(item);
        if (key in remove) {
          delete remove[key];
          change[key] = item;
          hasChange = true;
        } else if (signals.has(key) || staged.has(key)) {
          throw new DuplicateKeyError(TYPE_LIST, key, item);
        } else {
          add[key] = item;
          hasAdd = true;
          staged.add(key);
        }
        newOrder.push(key);
      }
      newOrder.push(...keys.slice(actualStart + actualDeleteCount));
      const changed = hasAdd || hasRemove || hasChange;
      if (changed) {
        applyChanges({
          add,
          change,
          remove,
          changed
        });
        keys = newOrder;
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
      return Object.values(remove);
    },
    deriveCollection(cb) {
      return deriveCollection(list, cb);
    }
  };
  return list;
}
function isMutableList(value) {
  return isSignalOfType(value, TYPE_LIST);
}
function isList(value) {
  return isMutableList(value);
}
function keyedAdapter(source, options) {
  const [generateKey, contentBased, positional] = getKeyGenerator(options?.keyConfig);
  const itemEquals = options?.itemEquals ?? DEEP_EQUALITY;
  const signals = new Map;
  const indices = new Map;
  let keys = [];
  let prev = [];
  let syncedFrom;
  const readSource = () => {
    try {
      return source.get();
    } catch (e) {
      if (e instanceof UnsetSignalValueError)
        return [];
      throw e;
    }
  };
  const ensureKeys = (next) => {
    if (next === syncedFrom)
      return;
    syncedFrom = next;
    const diff = diffArrays(prev, next, keys, generateKey, contentBased, itemEquals, positional);
    prev = next;
    if (keysEqual(keys, diff.newKeys))
      return;
    keys = diff.newKeys;
    indices.clear();
    for (let i = 0;i < keys.length; i++)
      indices.set(keys[i], i);
  };
  return {
    keys() {
      ensureKeys(readSource());
      for (const key of Array.from(signals.keys()))
        if (!indices.has(key))
          signals.delete(key);
      return keys.values();
    },
    byKey(key) {
      if (!indices.has(key))
        return;
      let signal = signals.get(key);
      if (!signal) {
        signal = createMemo(() => {
          const items = readSource();
          ensureKeys(items);
          const at = indices.get(key);
          return at !== undefined ? items[at] : undefined;
        }, { equals: itemEquals });
        signals.set(key, signal);
      }
      return signal;
    }
  };
}
function collectionFacade(node, getKeys, signals, prepare, prepareValue) {
  const collection = {
    [Symbol.toStringTag]: TYPE_COLLECTION,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      prepare();
      for (const key of getKeys()) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      prepare();
      return getKeys().length;
    },
    keys() {
      prepare();
      return getKeys().values();
    },
    get() {
      prepareValue();
      return node.value;
    },
    at(index) {
      prepare();
      const key = getKeys()[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    byKey(key) {
      prepare();
      return signals.get(key);
    },
    keyAt(index) {
      prepare();
      return getKeys()[index];
    },
    indexOfKey(key) {
      prepare();
      return getKeys().indexOf(key);
    },
    deriveCollection(cb) {
      return deriveCollection(collection, cb);
    }
  };
  return collection;
}
function deriveCollection(sourceInput, callback, options) {
  if (callback)
    validateCallback(TYPE_COLLECTION, callback);
  const source = isMutableList(sourceInput) || isDerivedList(sourceInput) ? sourceInput : keyedAdapter(sourceInput, options);
  const isAsync = isAsyncFunction(callback);
  const signals = new Map;
  let keys = [];
  const addSignal = (key) => {
    if (!callback) {
      const passthrough = untrack(() => source.byKey(key));
      if (passthrough)
        signals.set(key, passthrough);
      return;
    }
    const signal = isAsync ? createTask(async (prev, abort2) => {
      const itemSignal = untrack(() => source.byKey(key));
      if (!itemSignal)
        return prev;
      const sourceValue = itemSignal.get();
      if (sourceValue == null)
        return prev;
      return callback(sourceValue, abort2);
    }) : createMemo(() => {
      const itemSignal = untrack(() => source.byKey(key));
      if (!itemSignal)
        return;
      const sourceValue = itemSignal.get();
      if (sourceValue == null)
        return;
      return callback(sourceValue);
    });
    signals.set(key, signal);
  };
  function syncKeys(nextKeys) {
    if (!keysEqual(keys, nextKeys)) {
      const nextSet = new Set(nextKeys);
      for (const key of keys)
        if (!nextSet.has(key))
          signals.delete(key);
      for (const key of nextKeys)
        if (!signals.has(key))
          addSignal(key);
      keys = nextKeys;
      node.flags |= FLAG_RELINK;
    }
  }
  function buildValue() {
    syncKeys(Array.from(source.keys()));
    const result = [];
    for (const key of keys) {
      try {
        const v = signals.get(key)?.get();
        if (v != null)
          result.push(v);
      } catch (e) {
        if (!(e instanceof UnsetSignalValueError))
          throw e;
      }
    }
    return result;
  }
  const valuesEqual = keysEqual;
  const node = {
    fn: buildValue,
    value: [],
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: valuesEqual,
    error: undefined
  };
  const ensureFresh = () => {
    refreshComposite(node, buildValue, true);
  };
  const initialKeys = Array.from(untrack(() => source.keys()));
  for (const key of initialKeys)
    addSignal(key);
  keys = initialKeys;
  const prepare = () => {
    if (activeSink)
      link(node, activeSink);
    ensureFresh();
  };
  return collectionFacade(node, () => keys, signals, prepare, prepare);
}
function createCollection(watched, options) {
  const value = options?.value ?? [];
  if (value.length)
    validateSignalValue(TYPE_COLLECTION, value, Array.isArray);
  validateCallback(TYPE_COLLECTION, watched, isSyncFunction);
  const signals = new Map;
  const keys = [];
  const itemToKey = new Map;
  const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig);
  const resolveKey = (item) => itemToKey.get(item) ?? (contentBased ? generateKey(item) : undefined);
  const itemFactory = options?.createItem ?? ((item) => createState(item, {
    equals: options?.itemEquals ?? DEEP_EQUALITY
  }));
  function buildValue() {
    const result = [];
    for (const key of keys) {
      try {
        const v = signals.get(key)?.get();
        if (v != null)
          result.push(v);
      } catch (e) {
        if (!(e instanceof UnsetSignalValueError))
          throw e;
      }
    }
    return result;
  }
  const node = {
    fn: buildValue,
    value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: SKIP_EQUALITY,
    error: undefined
  };
  for (const item of value) {
    const key = generateKey(item);
    if (signals.has(key))
      throw new DuplicateKeyError(TYPE_COLLECTION, key, item);
    signals.set(key, itemFactory(item));
    itemToKey.set(item, key);
    keys.push(key);
  }
  node.value = value;
  node.flags = FLAG_DIRTY;
  const onChanges = (changes) => {
    const { add, change, remove } = changes;
    if (!add?.length && !change?.length && !remove?.length)
      return;
    let structural = false;
    batch(() => {
      if (add) {
        const staged = new Map;
        for (const item of add) {
          const key = generateKey(item);
          if (signals.has(key) || staged.has(key))
            throw new DuplicateKeyError(TYPE_COLLECTION, key, item);
          staged.set(key, item);
        }
        for (const [key, item] of staged) {
          signals.set(key, itemFactory(item));
          itemToKey.set(item, key);
          if (!keys.includes(key))
            keys.push(key);
          structural = true;
        }
      }
      if (change) {
        const resolved = [];
        for (const item of change) {
          const key = resolveKey(item);
          if (!key)
            throw new UnresolvableKeyError(TYPE_COLLECTION, item);
          resolved.push([key, item]);
        }
        for (const [key, item] of resolved) {
          const signal = signals.get(key);
          if (signal && isState(signal)) {
            itemToKey.delete(untrack(() => signal.get()));
            signal.set(item);
            itemToKey.set(item, key);
          }
        }
      }
      if (remove) {
        const resolved = [];
        for (const item of remove) {
          const key = resolveKey(item);
          if (!key)
            throw new UnresolvableKeyError(TYPE_COLLECTION, item);
          resolved.push([key, item]);
        }
        for (const [key, item] of resolved) {
          itemToKey.delete(item);
          signals.delete(key);
          const index = keys.indexOf(key);
          if (index !== -1)
            keys.splice(index, 1);
          structural = true;
        }
      }
      node.flags = FLAG_DIRTY | (structural ? FLAG_RELINK : 0);
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
    });
  };
  const subscribe = makeSubscribe(node, () => watched(onChanges));
  return collectionFacade(node, () => keys, signals, subscribe, () => {
    subscribe();
    refreshComposite(node, buildValue);
  });
}
function deriveList(input, itemOrOptions, maybeOptions) {
  if (isFunction(itemOrOptions))
    return deriveCollection(input, itemOrOptions, maybeOptions);
  const options = itemOrOptions;
  const passthrough = deriveCollection;
  if (!isFunction(input)) {
    validateSignalValue(TYPE_COLLECTION, input, Array.isArray);
    validateCallback(TYPE_COLLECTION, options?.watched, isSyncFunction);
    return createCollection(options?.watched, {
      ...options,
      value: input
    });
  }
  if (isAsyncFunction(input)) {
    const task = createTask(input, { value: options?.initial ?? [] });
    const derived = passthrough(task, undefined, options);
    registerAsyncSource(derived, task);
    return derived;
  }
  return passthrough(createMemo(input), undefined, options);
}
function isDerivedList(value) {
  return isSignalOfType(value, TYPE_COLLECTION);
}
function isCollection(value) {
  return isDerivedList(value);
}
function createEffect(fn) {
  validateCallback("Effect", fn);
  const node = {
    fn,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    cleanup: null
  };
  const dispose = () => {
    runCleanup(node);
    node.fn = undefined;
    node.flags = FLAG_CLEAN;
    node.sourcesTail = null;
    trimSources(node);
  };
  if (activeOwner)
    registerCleanup(activeOwner, dispose);
  runEffect(node);
  scheduleEffect(node);
  return dispose;
}
function match(signalOrSignals, handlers) {
  if (!activeOwner)
    throw new RequiredOwnerError("match");
  const isSingle = !Array.isArray(signalOrSignals);
  const signals = isSingle ? [signalOrSignals] : signalOrSignals;
  const { nil, stale } = handlers;
  const ok = isSingle ? (values2) => handlers.ok(values2[0]) : (values2) => handlers.ok(values2);
  const err = isSingle && handlers.err ? (errors2) => handlers.err(errors2[0]) : handlers.err ?? console.error;
  let errors;
  let pending = false;
  const values = new Array(signals.length);
  for (let i = 0;i < signals.length; i++) {
    try {
      values[i] = signals[i].get();
    } catch (e) {
      if (e instanceof UnsetSignalValueError) {
        pending = true;
        continue;
      }
      if (!errors)
        errors = [];
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  let out;
  try {
    if (pending)
      out = nil?.();
    else if (errors)
      out = err(errors);
    else if (stale && (isSingle ? isTask(signals[0]) && signals[0].isPending() : signals.some((s) => isTask(s) && s.isPending())))
      out = stale();
    else
      out = ok(values);
  } catch (e) {
    out = err([e instanceof Error ? e : new Error(String(e))]);
  }
  if (typeof out === "function")
    return out;
  if (out instanceof Promise) {
    const owner = activeOwner;
    const controller = new AbortController;
    registerCleanup(owner, () => controller.abort());
    out.then((cleanup) => {
      if (!controller.signal.aborted && typeof cleanup === "function")
        registerCleanup(owner, cleanup);
    }).catch((e) => {
      err([e instanceof Error ? e : new Error(String(e))]);
    });
  }
}
var storeProxyHandler = {
  get(target, prop) {
    if (prop in target)
      return Reflect.get(target, prop);
    if (typeof prop !== "symbol")
      return target.byKey(prop);
  },
  set(_target, prop) {
    throw new InvalidStoreMutationError(String(prop), "assign to");
  },
  deleteProperty(_target, prop) {
    throw new InvalidStoreMutationError(String(prop), "delete");
  },
  defineProperty(_target, prop) {
    throw new InvalidStoreMutationError(String(prop), "define");
  },
  has(target, prop) {
    if (prop in target)
      return true;
    return target.byKey(String(prop)) !== undefined;
  },
  ownKeys(target) {
    return Array.from(target.keys());
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop in target)
      return Reflect.getOwnPropertyDescriptor(target, prop);
    if (typeof prop === "symbol")
      return;
    const signal = target.byKey(String(prop));
    return signal ? { enumerable: true, configurable: true, writable: true, value: signal } : undefined;
  }
};
function diffRecords(prev, next) {
  const add = {};
  const change = {};
  const remove = {};
  let changed = false;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  for (const key of nextKeys) {
    if (key in prev) {
      if (!DEEP_EQUALITY(prev[key], next[key])) {
        change[key] = next[key];
        changed = true;
      }
    } else {
      add[key] = next[key];
      changed = true;
    }
  }
  for (const key of prevKeys) {
    if (!(key in next)) {
      remove[key] = undefined;
      changed = true;
    }
  }
  return { add, change, remove, changed };
}
function createStore(value, options) {
  validateSignalValue(TYPE_STORE, value, isRecord);
  const signals = new Map;
  const addSignal = (key, val) => {
    validateSignalValue(`${TYPE_STORE} for key "${key}"`, val);
    if (Array.isArray(val))
      signals.set(key, createList(val));
    else if (isRecord(val))
      signals.set(key, createStore(val));
    else
      signals.set(key, createState(val));
  };
  const shapeCategory = (val) => {
    if (Array.isArray(val))
      return "list";
    if (isRecord(val))
      return "store";
    return "state";
  };
  const signalCategory = (signal) => {
    if (isMutableList(signal))
      return "list";
    if (isMutableStore(signal))
      return "store";
    return "state";
  };
  const buildValue = () => {
    const record = {};
    for (const [key, signal] of signals)
      record[key] = signal.get();
    return record;
  };
  const node = {
    fn: buildValue,
    value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: DEEP_EQUALITY,
    error: undefined
  };
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      addSignal(key, changes.add[key]);
      structural = true;
    }
    let hasChange = false;
    for (const _key in changes.change) {
      hasChange = true;
      break;
    }
    if (hasChange) {
      batch(() => {
        for (const key in changes.change) {
          const val = changes.change[key];
          validateSignalValue(`${TYPE_STORE} for key "${key}"`, val);
          const signal = signals.get(key);
          if (signal) {
            if (shapeCategory(val) !== signalCategory(signal)) {
              addSignal(key, val);
              structural = true;
            } else
              signal.set(val);
          }
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
      structural = true;
    }
    if (structural)
      node.flags |= FLAG_RELINK;
    return changes.changed;
  };
  const subscribe = makeSubscribe(node, options?.watched);
  for (const key of Object.keys(value))
    addSignal(key, value[key]);
  const store = {
    [Symbol.toStringTag]: TYPE_STORE,
    [Symbol.isConcatSpreadable]: false,
    *[Symbol.iterator]() {
      subscribe();
      for (const [key, signal] of signals) {
        yield [key, signal];
      }
    },
    keys() {
      subscribe();
      return signals.keys();
    },
    byKey(key) {
      return signals.get(key);
    },
    get() {
      subscribe();
      refreshComposite(node, buildValue);
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value;
      const changes = diffRecords(prev, next);
      if (applyChanges(changes)) {
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    update(fn) {
      store.set(fn(untrack(() => store.get())));
    },
    add(key, value2) {
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_STORE, key, value2);
      addSignal(key, value2);
      node.flags |= FLAG_DIRTY | FLAG_RELINK;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(key) {
      const ok = signals.delete(key);
      if (ok) {
        node.flags |= FLAG_DIRTY | FLAG_RELINK;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    }
  };
  return new Proxy(store, storeProxyHandler);
}
function deriveStore(input, options) {
  if (!isFunction(input)) {
    validateSignalValue(TYPE_STORE, input, isRecord);
    const watched = options?.watched;
    validateCallback(TYPE_STORE, watched, isSyncFunction);
    const inner = createStore(input);
    const anchor = {
      value: undefined,
      sinks: null,
      sinksTail: null,
      stop: undefined
    };
    let stop;
    const stopWatched = () => {
      if (stop) {
        stop();
        stop = undefined;
      }
    };
    const subscribe = () => {
      if (!activeSink)
        return;
      if (!anchor.sinks) {
        stop = watched(emit);
        anchor.stop = stopWatched;
      }
      link(anchor, activeSink);
    };
    const emit = (patch) => {
      inner.update((prev) => ({ ...prev, ...patch }));
    };
    return readonlyFacade(() => {
      subscribe();
      return inner.get();
    }, () => {
      subscribe();
      return inner.keys();
    }, (key) => {
      subscribe();
      return inner.byKey(key);
    });
  }
  const task = isAsyncFunction(input) ? createTask(input, {
    value: options?.initial ?? {}
  }) : undefined;
  const source = task ?? createMemo(input);
  const readSource = () => {
    try {
      return source.get();
    } catch (e) {
      if (e instanceof UnsetSignalValueError)
        return {};
      throw e;
    }
  };
  const signals = new Map;
  let keys = [];
  const addSignal = (key) => {
    signals.set(key, createMemo(() => readSource()[key], {
      equals: DEEP_EQUALITY
    }));
  };
  const syncKeys = (next) => {
    const nextKeys = Object.keys(next);
    if (keysEqual(keys, nextKeys))
      return;
    const nextSet = new Set(nextKeys);
    for (const key of keys)
      if (!nextSet.has(key))
        signals.delete(key);
    for (const key of nextKeys)
      if (!signals.has(key))
        addSignal(key);
    keys = nextKeys;
    node.flags |= FLAG_RELINK;
  };
  function buildValue() {
    syncKeys(readSource());
    const record = {};
    for (const key of keys) {
      try {
        const v = signals.get(key)?.get();
        if (v !== undefined)
          record[key] = v;
      } catch (e) {
        if (!(e instanceof UnsetSignalValueError))
          throw e;
      }
    }
    return record;
  }
  const node = {
    fn: buildValue,
    value: options?.initial ?? {},
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: DEEP_EQUALITY,
    error: undefined
  };
  const ensureFresh = () => {
    refreshComposite(node, buildValue, true);
  };
  syncKeys(untrack(readSource));
  node.flags = FLAG_DIRTY;
  const derived = readonlyFacade(() => {
    if (activeSink)
      link(node, activeSink);
    ensureFresh();
    return node.value;
  }, () => {
    if (activeSink)
      link(node, activeSink);
    ensureFresh();
    return keys.values();
  }, (key) => {
    ensureFresh();
    return signals.get(key);
  });
  if (task)
    registerAsyncSource(derived, task);
  return derived;
}
function readonlyFacade(read, readKeys, readByKey) {
  const store = {
    [Symbol.toStringTag]: TYPE_STORE,
    [Symbol.isConcatSpreadable]: false,
    *[Symbol.iterator]() {
      for (const key of readKeys()) {
        const signal = readByKey(key);
        if (signal)
          yield [key, signal];
      }
    },
    keys: readKeys,
    byKey(key) {
      return readByKey(key);
    },
    get: read
  };
  return new Proxy(store, storeProxyHandler);
}
function isMutableStore(value) {
  return isSignalOfType(value, TYPE_STORE) && typeof value.add === "function";
}
function isStore(value) {
  return isSignalOfType(value, TYPE_STORE);
}
var SIGNAL_TYPES = new Set([
  TYPE_STATE,
  TYPE_MEMO,
  TYPE_TASK,
  TYPE_SENSOR,
  TYPE_SLOT,
  TYPE_LIST,
  TYPE_COLLECTION,
  TYPE_STORE
]);
function createSignal(value) {
  if (isSignal(value))
    return value;
  if (value == null)
    throw new InvalidSignalValueError("createSignal", value);
  if (isAsyncFunction(value))
    return createTask(value);
  if (isFunction(value))
    return createMemo(value);
  if (Array.isArray(value) && value.every((item) => item != null))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return createState(value);
}
function createMutableSignal(value) {
  if (isMutableSignal(value))
    return value;
  if (value == null || isFunction(value) || isSignal(value))
    throw new InvalidSignalValueError("createMutableSignal", value);
  if (Array.isArray(value) && value.every((item) => item != null))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return createState(value);
}
function isSignal(value) {
  return value != null && SIGNAL_TYPES.has(value[Symbol.toStringTag]);
}
function isMutableSignal(value) {
  return isState(value) || isSignalOfType(value, TYPE_STORE) || isMutableList(value);
}
var settingSlots = new WeakSet;
function isSignalOrDescriptor(value) {
  if (isSignal(value))
    return true;
  return value !== null && typeof value === "object" && "get" in value && typeof value.get === "function";
}
function createSlot(initialSignal, options) {
  validateSignalValue(TYPE_SLOT, initialSignal, isSignalOrDescriptor);
  let delegated = initialSignal;
  const guard = options?.guard;
  const node = {
    fn: () => delegated.get(),
    value: undefined,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    error: undefined
  };
  const get = () => {
    if (activeSink)
      link(node, activeSink);
    refresh(node);
    if (node.error)
      throw node.error;
    return node.value;
  };
  const set = (next) => {
    if (settingSlots.has(node))
      throw new Error("[Slot] Circular delegation detected in set()");
    settingSlots.add(node);
    try {
      if (isSlot(delegated))
        return void delegated.set(next);
      if ("set" in delegated && typeof delegated.set === "function") {
        validateSignalValue(TYPE_SLOT, next, guard);
        delegated.set(next);
      } else {
        throw new ReadonlySignalError(TYPE_SLOT);
      }
    } finally {
      settingSlots.delete(node);
    }
  };
  const replace = (next) => {
    validateSignalValue(TYPE_SLOT, next, isSignalOrDescriptor);
    delegated = next;
    node.flags |= FLAG_DIRTY;
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink);
    if (batchDepth === 0)
      flush();
  };
  return {
    [Symbol.toStringTag]: TYPE_SLOT,
    configurable: true,
    enumerable: true,
    get,
    set,
    replace,
    current: () => delegated
  };
}
function isSlot(value) {
  return isSignalOfType(value, TYPE_SLOT);
}
// src/util.ts
var isSlotDescriptor = (value) => value !== null && typeof value === "object" && typeof value.get === "function" && !(Symbol.toStringTag in value);
var isCustomElement = (element) => element.localName.includes("-");
var isNotYetDefinedComponent = (element) => isCustomElement(element) && element.matches(":not(:defined)");
var elementName = (el) => {
  if (!el)
    return "<unknown>";
  const id = el.id ? `#${el.id}` : "";
  const classes = el.classList?.length ? `.${Array.from(el.classList).join(".")}` : "";
  return `<${el.localName}${id}${classes}>`;
};
var describeRoot = (parent) => typeof ShadowRoot !== "undefined" && parent instanceof ShadowRoot ? `${elementName(parent.host)} shadow root` : typeof Element !== "undefined" && parent instanceof Element ? elementName(parent) : "document";

// src/errors.ts
class InvalidComponentNameError extends TypeError {
  constructor(component) {
    super(`Invalid component name "${component}". Custom element names must contain a hyphen, start with a lowercase letter, and contain only lowercase letters, numbers, and hyphens.`);
    this.name = "InvalidComponentNameError";
  }
}

class InvalidPropertyNameError extends TypeError {
  constructor(component, prop, reason) {
    super(`Invalid property name "${prop}" for component <${component}>. ${reason}`);
    this.name = "InvalidPropertyNameError";
  }
}

class MissingElementError extends Error {
  constructor(root, selector, required, contextLabel = "component") {
    super(`Missing required element <${selector}> in ${contextLabel} ${describeRoot(root)}. ${required}`);
    this.name = "MissingElementError";
  }
}

class DependencyTimeoutError extends Error {
  constructor(host, missing) {
    super(`Timeout waiting for: [${missing.join(", ")}] in component ${elementName(host)}.`);
    this.name = "DependencyTimeoutError";
  }
}

class InvalidReactivesError extends TypeError {
  constructor(host, target, reactives) {
    super(`Expected reactives passed from ${elementName(host)} to ${elementName(target)} to be a record of signals, reactive property names or functions. Got ${valueString(reactives)}.`);
    this.name = "InvalidReactivesError";
  }
}

class InvalidCustomElementError extends TypeError {
  constructor(target, where) {
    super(`Target ${elementName(target)} is not a custom element in ${where}.`);
    this.name = "InvalidCustomElementError";
  }
}

class InvalidPassPropertyError extends TypeError {
  constructor(host, target, reasons) {
    const detail = Array.from(reasons, ([prop, reason]) => `'${prop}' ${reason}`).join("; ");
    super(`Cannot pass from ${elementName(host)} to ${elementName(target)}: ${detail}.`);
    this.name = "InvalidPassPropertyError";
  }
}

class NoActiveCollectorError extends Error {
  constructor(host, helper) {
    const where = host ? ` in component ${elementName(host)}` : "";
    super(`${helper}() called outside synchronous factory, each() callback, or reconcile() bindItem execution${where}.`);
    this.name = "NoActiveCollectorError";
  }
}

class InvalidTemplateError extends TypeError {
  constructor(container, count) {
    super(`Invalid template for reconcile() into ${elementName(container)}. Expected exactly 1 root element in the template content, found ${count}.`);
    this.name = "InvalidTemplateError";
  }
}

class ExtensionCollisionError extends Error {
  constructor(component, key, first, second) {
    super(`Extension collision for component <${component}>: both '${first}' and '${second}' declare staticProps key "${key}". The '${second}' declaration is ignored.`);
    this.name = "ExtensionCollisionError";
  }
}

class InvalidSelectorError extends TypeError {
  constructor(parent, selector, cause) {
    super(`Invalid selector "${selector}" passed to all() in ${describeRoot(parent)}. ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "InvalidSelectorError";
  }
}

// src/internal.ts
var DEPENDENCY_TIMEOUT = 200;
var CONTEXT_RETRY_DELAY = DEPENDENCY_TIMEOUT + 10;
var componentSignals = new WeakMap;
var internalsMap = new WeakMap;
var internalsHosts = new WeakMap;
var retainedInitializers = new WeakMap;
var getSignals = (el) => {
  let signals = componentSignals.get(el);
  if (!signals) {
    signals = {};
    componentSignals.set(el, signals);
  }
  return signals;
};
var activeCollector;
var withCollector = (collector, fn) => {
  const previous = activeCollector;
  activeCollector = collector;
  try {
    return fn();
  } finally {
    activeCollector = previous;
  }
};
var pushDescriptor = (host, helper, descriptor) => {
  if (!activeCollector)
    throw new NoActiveCollectorError(host, helper);
  activeCollector.push(descriptor);
};

// src/scheduler.ts
var objects = new Set;
var tasks = new WeakMap;
var throttledCallbacks = new Set;
var requestId;
var runTasks = () => {
  requestId = undefined;
  const elements = Array.from(objects);
  objects.clear();
  for (const element of elements) {
    try {
      tasks.get(element)?.();
    } catch (e) {
      console.error("[le-truc scheduler]", e);
    }
  }
  const callbacks = Array.from(throttledCallbacks);
  throttledCallbacks.clear();
  for (const cb of callbacks) {
    try {
      cb();
    } catch (e) {
      console.error("[le-truc scheduler]", e);
    }
  }
};
var requestTick = () => {
  if (!requestId)
    requestId = requestAnimationFrame(runTasks);
};
var schedule = (key, task) => {
  tasks.set(key, task);
  objects.add(key);
  requestTick();
};
var throttle = (fn, signal) => {
  let pending = false;
  let lastArgs;
  const flush2 = () => {
    pending = false;
    fn(...lastArgs);
  };
  const wrapped = (...args) => {
    lastArgs = args;
    if (pending)
      return;
    pending = true;
    throttledCallbacks.add(flush2);
    requestTick();
  };
  wrapped.cancel = () => {
    if (pending) {
      throttledCallbacks.delete(flush2);
      pending = false;
    }
  };
  signal?.addEventListener("abort", wrapped.cancel, { once: true });
  return wrapped;
};

// src/bindings.ts
var debugBindingTargets = new WeakMap;
var registerDebugBindingTarget = (target, element) => {
  if (false)
    ;
};
var SCRIPT_ATTRS = [
  "type",
  "src",
  "async",
  "defer",
  "nomodule",
  "crossorigin",
  "integrity",
  "nonce",
  "referrerpolicy",
  "fetchpriority"
];
var isSafeURL = (value) => {
  const stripped = String(value).replace(/[\x00-\x20]/g, "");
  if (/^(javascript|data|vbscript):/i.test(stripped))
    return false;
  if (/^(mailto|tel):/i.test(stripped))
    return true;
  if (/^[\\/][\\/]/.test(stripped))
    return false;
  if (stripped.includes("://")) {
    try {
      const url = new URL(stripped);
      return ["http:", "https:", "ftp:"].includes(url.protocol);
    } catch {
      return false;
    }
  }
  return true;
};
var safeSetAttribute = (element, attr, value) => {
  if (/^on/i.test(attr))
    throw new Error(`setAttribute: blocked unsafe attribute name '${attr}' on ${element.localName} — event handler attributes are not allowed`);
  value = String(value).trim();
  if (!isSafeURL(value))
    throw new Error(`setAttribute: blocked unsafe value for '${attr}' on <${element.localName}>: '${value}'`);
  element.setAttribute(attr, value);
};
var escapeHTML = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var setTextPreservingComments = (element, text) => {
  Array.from(element.childNodes).filter((node) => node.nodeType !== Node.COMMENT_NODE).forEach((node) => {
    node.remove();
  });
  element.append(document.createTextNode(text));
};
var bindText = (element, preserveComments = false) => {
  const setter = preserveComments ? (value) => setTextPreservingComments(element, String(value)) : (value) => {
    element.textContent = String(value);
  };
  registerDebugBindingTarget(setter, element);
  return setter;
};
function bindProperty(object, keyOrKeys) {
  if (typeof keyOrKeys === "string") {
    const key = keyOrKeys;
    const setter2 = (value) => {
      object[key] = value;
    };
    if (typeof Element !== "undefined" && object instanceof Element)
      registerDebugBindingTarget(setter2, object);
    return setter2;
  }
  const keys = keyOrKeys;
  const setter = (value) => {
    for (const key of keys) {
      if (Object.hasOwn(value, key))
        object[key] = value[key];
    }
  };
  if (typeof Element !== "undefined" && object instanceof Element)
    registerDebugBindingTarget(setter, object);
  return setter;
}
function bindClass(element, tokenOrTokens) {
  if (typeof tokenOrTokens === "string") {
    const token = tokenOrTokens;
    const setter2 = (value) => {
      element.classList.toggle(token, Boolean(value));
    };
    registerDebugBindingTarget(setter2, element);
    return setter2;
  }
  const tokens = tokenOrTokens;
  const setter = (value) => {
    for (const token of tokens)
      element.classList.toggle(token, Boolean(value[token]));
  };
  registerDebugBindingTarget(setter, element);
  return setter;
}
function bindState(internals, tokenOrTokens) {
  if (typeof tokenOrTokens === "string") {
    const token = tokenOrTokens;
    return (value) => {
      if (!internals)
        return;
      if (value)
        internals.states.add(token);
      else
        internals.states.delete(token);
    };
  }
  const tokens = tokenOrTokens;
  return (value) => {
    if (!internals)
      return;
    for (const token of tokens) {
      if (value[token])
        internals.states.add(token);
      else
        internals.states.delete(token);
    }
  };
}
var bindVisible = (element) => {
  const setter = (value) => {
    element.hidden = !value;
  };
  registerDebugBindingTarget(setter, element);
  return setter;
};
function bindAttribute(element, nameOrNames, allowUnsafe = false) {
  if (typeof nameOrNames === "string") {
    const name = nameOrNames;
    const handlers2 = {
      ok: (value) => {
        if (typeof value === "boolean") {
          element.toggleAttribute(name, value);
        } else if (allowUnsafe) {
          element.setAttribute(name, value);
        } else {
          safeSetAttribute(element, name, value);
        }
      },
      nil: () => {
        element.removeAttribute(name);
      }
    };
    registerDebugBindingTarget(handlers2, element);
    return handlers2;
  }
  const names = nameOrNames;
  const handlers = {
    ok: (map) => {
      for (const name of names) {
        const value = map[name];
        if (value == null) {
          element.removeAttribute(name);
        } else if (typeof value === "boolean") {
          element.toggleAttribute(name, value);
        } else if (allowUnsafe) {
          element.setAttribute(name, value);
        } else {
          safeSetAttribute(element, name, value);
        }
      }
    },
    nil: () => {
      for (const name of names)
        element.removeAttribute(name);
    }
  };
  registerDebugBindingTarget(handlers, element);
  return handlers;
}
var ariaAttributeName = (idlName) => {
  if (idlName === "role")
    return "role";
  let base = idlName.startsWith("aria") ? idlName.slice("aria".length) : idlName;
  if (base.endsWith("Elements"))
    base = base.slice(0, -"Elements".length);
  else if (base.endsWith("Element"))
    base = base.slice(0, -"Element".length);
  return `aria-${base.toLowerCase()}`;
};
function bindAria(target, nameOrNames) {
  const isElementTarget = target != null && typeof Element !== "undefined" && target instanceof Element;
  const host = target != null && !isElementTarget ? internalsHosts.get(target) : undefined;
  const cleared = new Set;
  const assign = (name, value) => {
    if (!target)
      return;
    if (value == null) {
      target[name] = null;
      return;
    }
    if (host && !cleared.has(name)) {
      cleared.add(name);
      host.removeAttribute(ariaAttributeName(name));
    }
    target[name] = typeof value === "boolean" ? value ? "true" : "false" : typeof value === "number" ? String(value) : value;
  };
  const clear = (name) => {
    if (target)
      target[name] = null;
  };
  if (typeof nameOrNames === "string") {
    const name = nameOrNames;
    const handlers2 = {
      ok: (value) => {
        assign(name, value);
      },
      nil: () => {
        clear(name);
      }
    };
    if (isElementTarget)
      registerDebugBindingTarget(handlers2, target);
    return handlers2;
  }
  const names = nameOrNames;
  const handlers = {
    ok: (map) => {
      for (const name of names)
        assign(name, map[name]);
    },
    nil: () => {
      for (const name of names)
        clear(name);
    }
  };
  if (isElementTarget)
    registerDebugBindingTarget(handlers, target);
  return handlers;
}
function bindStyle(element, propOrProps) {
  if (typeof propOrProps === "string") {
    const prop = propOrProps;
    const handlers2 = {
      ok: (value) => {
        element.style.setProperty(prop, value);
      },
      nil: () => {
        element.style.removeProperty(prop);
      }
    };
    registerDebugBindingTarget(handlers2, element);
    return handlers2;
  }
  const props = propOrProps;
  const handlers = {
    ok: (map) => {
      for (const prop of props) {
        const value = map[prop];
        if (value == null)
          element.style.removeProperty(prop);
        else
          element.style.setProperty(prop, value);
      }
    },
    nil: () => {
      for (const prop of props)
        element.style.removeProperty(prop);
    }
  };
  registerDebugBindingTarget(handlers, element);
  return handlers;
}
var dangerouslyBindInnerHTML = (element, options = {}) => {
  const reset = () => {
    if (element.shadowRoot)
      element.shadowRoot.replaceChildren(document.createElement("slot"));
    else
      element.replaceChildren();
  };
  return {
    ok: (rawHtml) => {
      if (!rawHtml) {
        schedule(element, reset);
        return;
      }
      const { shadowRootMode, allowScripts, sanitize } = options;
      if (shadowRootMode && !element.shadowRoot)
        element.attachShadow({ mode: shadowRootMode });
      const target = element.shadowRoot || element;
      const html = sanitize ? sanitize(rawHtml) : rawHtml;
      schedule(element, () => {
        try {
          target.innerHTML = html;
        } catch (e) {
          queueMicrotask(() => {
            throw e;
          });
          return;
        }
        if (allowScripts) {
          target.querySelectorAll("script").forEach((script) => {
            const newScript = document.createElement("script");
            for (const attr of SCRIPT_ATTRS) {
              const attrValue = script.getAttribute(attr);
              if (attrValue !== null)
                newScript.setAttribute(attr, attrValue);
            }
            if (!script.hasAttribute("src"))
              newScript.appendChild(document.createTextNode(script.textContent ?? ""));
            target.appendChild(newScript);
            script.remove();
          });
        }
      });
    },
    nil: () => schedule(element, reset)
  };
};
// src/extension.ts
var mergeExtensions = (component, extensions) => {
  const staticProps = {};
  const owners = {};
  const observedAttributes = [];
  const reservedMembers = new Set;
  const reservedMemberOwners = new Map;
  for (const ext of extensions) {
    for (const key of Object.keys(ext.staticProps ?? {})) {
      if (key in staticProps) {
        if (false)
          ;
        continue;
      }
      staticProps[key] = ext.staticProps[key];
      owners[key] = ext.name;
    }
    for (const attr of ext.observedAttributes ?? [])
      if (!observedAttributes.includes(attr))
        observedAttributes.push(attr);
    for (const member of ext.reservedMembers ?? []) {
      reservedMembers.add(member);
      if (!reservedMemberOwners.has(member))
        reservedMemberOwners.set(member, ext.name);
    }
  }
  return {
    staticProps,
    observedAttributes,
    reservedMembers,
    reservedMemberOwners
  };
};

// src/helpers/context.ts
var CONTEXT_REQUEST = "context-request";

class ContextRequestEvent extends Event {
  context;
  callback;
  subscribe;
  constructor(context, callback, subscribe = false) {
    super(CONTEXT_REQUEST, {
      bubbles: true,
      composed: true
    });
    this.context = context;
    this.callback = callback;
    this.subscribe = subscribe;
  }
}
var createContext = (key) => key;
var makeProvideContexts = (host) => (contexts) => {
  const descriptor = () => createScope(() => {
    const listener = (e) => {
      const { context, callback } = e;
      if (typeof context === "string" && contexts.includes(context) && isFunction(callback)) {
        e.stopImmediatePropagation();
        callback(() => {
          try {
            return host[context];
          } catch (error) {
            if (false)
              ;
            return;
          }
        });
      }
    };
    host.addEventListener(CONTEXT_REQUEST, listener);
    return () => host.removeEventListener(CONTEXT_REQUEST, listener);
  });
  pushDescriptor(host, "provideContexts", descriptor);
  return descriptor;
};
var makeRequestContext = (host) => (context, fallback) => {
  const slot = createSlot(createCell(fallback));
  let answered = false;
  const dispatch = () => {
    host.dispatchEvent(new ContextRequestEvent(context, (getter) => {
      answered = true;
      slot.replace(deriveCell(getter));
    }));
  };
  dispatch();
  if (!answered) {
    queueMicrotask(() => {
      if (!answered && host.isConnected)
        dispatch();
    });
    setTimeout(() => {
      if (!answered && host.isConnected) {
        dispatch();
        if (false)
          ;
      }
    }, CONTEXT_RETRY_DELAY);
  }
  return slot;
};

// src/helpers/dom.ts
var extractAttributes = (selector) => {
  const attributes = new Set;
  let withoutAttrValues = "";
  let depth = 0;
  for (const ch of selector) {
    if (ch === "[")
      depth++;
    else if (ch === "]") {
      if (depth > 0)
        depth--;
    } else if (depth === 0)
      withoutAttrValues += ch;
  }
  if (withoutAttrValues.includes("."))
    attributes.add("class");
  if (withoutAttrValues.includes("#"))
    attributes.add("id");
  if (selector.includes("[")) {
    const parts = selector.split("[");
    for (let i = 1;i < parts.length; i++) {
      const part = parts[i];
      if (!part || !part.includes("]"))
        continue;
      const attrName = part.split("=")[0].split("]")[0].trim().replace(/[^a-zA-Z0-9_-]/g, "");
      if (attrName)
        attributes.add(attrName);
    }
  }
  return [...attributes];
};
function queryOne(root, selector, required, contextLabel) {
  const target = root.querySelector(selector);
  if (required != null && !target)
    throw new MissingElementError(root, selector, required, contextLabel);
  return target ?? undefined;
}
var bindFirst = (root) => (selector, required) => queryOne(root, selector, required, "item");
function query(root, selector, required) {
  return queryOne(root, selector, required, "component");
}
function queryAll(root, selector, required) {
  const targets = Array.from(root.querySelectorAll(selector));
  if (required != null && !targets.length)
    throw new MissingElementError(root, selector, required);
  return targets;
}
function createElementsMemo(parent, selector) {
  try {
    parent.querySelector(selector);
  } catch (error) {
    throw new InvalidSelectorError(parent, selector, error);
  }
  return createMemo(() => Array.from(parent.querySelectorAll(selector)), {
    value: [],
    equals: (a, b) => a.length === b.length && a.every((el, i) => el === b[i]),
    watched: (invalidate) => {
      const observerConfig = {
        childList: true,
        subtree: true
      };
      const observedAttributes = extractAttributes(selector);
      if (observedAttributes.length) {
        observerConfig.attributes = true;
        observerConfig.attributeFilter = observedAttributes;
      }
      const couldMatch = (node) => node instanceof Element && (node.matches(selector) || node.querySelector(selector));
      const maybeDirty = (mutation) => {
        if (mutation.type === "attributes")
          return true;
        if (mutation.type === "childList")
          return Array.from(mutation.addedNodes).some(couldMatch) || Array.from(mutation.removedNodes).some(couldMatch);
        return false;
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (maybeDirty(mutation)) {
            invalidate();
            return;
          }
        }
      });
      observer.observe(parent, observerConfig);
      return () => observer.disconnect();
    }
  });
}
var makeElementQueries = (host) => {
  const root = host.shadowRoot ?? host;
  const dependencies = new Set;
  let queriedDefinedCustomChild = false;
  function first(selector, required) {
    const target = queryOne(root, selector, required, "component");
    if (target && isNotYetDefinedComponent(target))
      dependencies.add(target.localName);
    else if (target && isCustomElement(target))
      queriedDefinedCustomChild = true;
    return target ?? undefined;
  }
  function all(selector, required) {
    const targets = createElementsMemo(root, selector);
    const current = targets.get();
    if (required != null && !current.length)
      throw new MissingElementError(host, selector, required);
    if (current.length)
      for (const target of current) {
        if (isNotYetDefinedComponent(target))
          dependencies.add(target.localName);
        else if (isCustomElement(target))
          queriedDefinedCustomChild = true;
      }
    return targets;
  }
  const resolveDependencies = (callback) => {
    if (dependencies.size || queriedDefinedCustomChild) {
      queueMicrotask(() => {
        const deps = Array.from(dependencies).filter((dep) => !customElements.get(dep));
        if (!deps.length) {
          callback();
          return;
        }
        Promise.race([
          Promise.all(deps.map((dep) => customElements.whenDefined(dep))),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new DependencyTimeoutError(host, deps.filter((dep) => !customElements.get(dep))));
            }, DEPENDENCY_TIMEOUT);
          })
        ]).then(callback).catch((error) => {
          if (false)
            ;
          callback();
        });
      });
    } else {
      callback();
    }
  };
  return [{ first, all }, resolveDependencies];
};

// src/helpers/reactive.ts
var activateResult = (result) => {
  for (const descriptor of result) {
    if (Array.isArray(descriptor))
      activateResult(descriptor);
    else if (descriptor)
      descriptor();
  }
};
var forEachUnseen = (result, seen, visit) => {
  if (Array.isArray(result)) {
    for (const item of result)
      forEachUnseen(item, seen, visit);
  } else if (typeof result === "function" && !seen.has(result)) {
    visit(result);
  }
};
var keyedScopes = (memo, mount) => {
  const scopes = new Map;
  createScope(() => {
    createEffect(() => {
      const current = memo.get();
      const currentSet = new Set(current);
      for (const [el, dispose] of Array.from(scopes)) {
        if (!currentSet.has(el)) {
          dispose();
          scopes.delete(el);
        }
      }
      for (const el of current) {
        if (scopes.has(el))
          continue;
        const dispose = createScope(() => mount(el), { root: true });
        scopes.set(el, dispose);
      }
    });
    return () => {
      for (const dispose of scopes.values())
        dispose();
      scopes.clear();
    };
  });
};
var toSignal = (host, source) => {
  if (isFunction(source))
    return deriveCell(source);
  if (typeof source === "string") {
    const sig = getSignals(host)[source];
    if (sig)
      return sig;
    return createMemo(() => host[source]);
  }
  if (isSlotDescriptor(source))
    return source;
  return source;
};
var makeWatch = (host) => {
  function watch(source, handlerOrHandlers) {
    const descriptor = () => {
      if (Array.isArray(source)) {
        const signals = source.map((s) => toSignal(host, s));
        if (false) {}
        if (typeof handlerOrHandlers === "function") {
          const handler = handlerOrHandlers;
          return createEffect(() => match(signals, {
            ok: (values) => untrack(() => handler(values))
          }));
        }
        return createEffect(() => match(signals, handlerOrHandlers));
      }
      const signal = toSignal(host, source);
      if (typeof handlerOrHandlers === "function") {
        if (false) {}
        return createEffect(() => match(signal, {
          ok: (value) => untrack(() => handlerOrHandlers(value))
        }));
      }
      if (false) {}
      return createEffect(() => match(signal, handlerOrHandlers));
    };
    pushDescriptor(host, "watch", descriptor);
    return descriptor;
  }
  return watch;
};
var makePass = (host) => {
  const swapSlots = (target, props) => createScope(() => {
    if (!isCustomElement(target))
      throw new InvalidCustomElementError(target, `pass from ${elementName(host)}`);
    if (!isRecord(props))
      throw new InvalidReactivesError(host, target, props);
    const signals = getSignals(target);
    const targetName = elementName(target);
    const failures = new Map;
    const bindings = [];
    for (const [prop, reactive] of Object.entries(props)) {
      if (reactive == null)
        continue;
      if (!(prop in target)) {
        failures.set(prop, `does not exist on ${targetName}`);
        continue;
      }
      const signal = toSignal(host, reactive);
      if (!signal) {
        failures.set(prop, "could not be resolved to a signal");
        continue;
      }
      if (false) {}
      const slot = signals[prop];
      if (!isSlot(slot)) {
        failures.set(prop, `is not Slot-backed on ${targetName} (read-only property, or target is not a Le Truc component)`);
        continue;
      }
      bindings.push({ slot, signal });
    }
    if (failures.size)
      throw new InvalidPassPropertyError(host, target, failures);
    const cleanups = bindings.map(({ slot, signal }) => {
      const original = slot.current();
      slot.replace(signal);
      return () => slot.replace(original);
    });
    if (cleanups.length)
      return () => {
        for (const c of cleanups)
          c();
      };
  });
  const resolvePassedValues = (props) => {
    const resolved = {};
    for (const [prop, reactive] of Object.entries(props)) {
      if (reactive == null)
        continue;
      try {
        const signal = toSignal(host, reactive);
        resolved[prop] = signal && typeof signal === "object" && "get" in signal ? signal.get() : reactive;
      } catch {
        resolved[prop] = reactive;
      }
    }
    return resolved;
  };
  function pass(target, props) {
    const descriptor = () => {
      if (!target)
        return;
      if (isSignal(target)) {
        keyedScopes(target, (el) => {
          const cleanup = swapSlots(el, props);
          if (false) {}
          return cleanup;
        });
      } else {
        swapSlots(target, props);
        if (false) {}
      }
    };
    pushDescriptor(host, "pass", descriptor);
    return descriptor;
  }
  return pass;
};
function each(memo, callback) {
  const descriptor = () => {
    keyedScopes(memo, (element) => {
      const collected = [];
      const result = withCollector(collected, () => callback(element, bindFirst(element)));
      activateResult(collected);
      forEachUnseen(result, new Set(collected), (d) => d());
    });
  };
  pushDescriptor(undefined, "each", descriptor);
  return descriptor;
}
function reconcile(container, template, source, bindItem) {
  const descriptor = () => {
    if (template.content.childElementCount !== 1)
      throw new InvalidTemplateError(container, template.content.childElementCount);
    const itemRoot = template.content.firstElementChild;
    const keyOf = new WeakMap;
    const disposers = new Map;
    const nextKeyed = (after) => {
      let node = after ? after.nextElementSibling : container.firstElementChild;
      while (node && (!keyOf.has(node) || node.hasAttribute("data-unreconciled")))
        node = node.nextElementSibling;
      return node;
    };
    const classify = (keySet) => {
      const current = new Map;
      const adopted = new Set;
      const pinned = new Set;
      const leavers = [];
      for (const child of Array.from(container.children)) {
        if (child.hasAttribute("data-unreconciled")) {
          const key2 = keyOf.get(child);
          if (key2 !== undefined && keySet.has(key2)) {
            current.set(key2, child);
            pinned.add(key2);
          }
          continue;
        }
        const key = keyOf.get(child);
        if (key !== undefined) {
          if (keySet.has(key))
            current.set(key, child);
          else
            leavers.push(child);
          continue;
        }
        const harvested = child.getAttribute("data-key");
        if (harvested !== null && keySet.has(harvested) && !current.has(harvested)) {
          keyOf.set(child, harvested);
          current.set(harvested, child);
          adopted.add(harvested);
          continue;
        }
        if (false)
          ;
        child.remove();
      }
      return { current, adopted, pinned, leavers };
    };
    const leave = (keySet, leavers) => {
      for (const [key, dispose] of disposers) {
        if (keySet.has(key))
          continue;
        dispose();
        disposers.delete(key);
      }
      for (const el of leavers)
        el.remove();
    };
    const enter = (keys, current, adopted, pinned) => {
      let prev = null;
      for (const key of keys) {
        let el = current.get(key);
        let mount = adopted.has(key);
        if (!el) {
          el = itemRoot.cloneNode(true);
          el.setAttribute("data-key", key);
          keyOf.set(el, key);
          mount = true;
        }
        if (mount) {
          disposers.get(key)?.();
          const item = source.byKey(key);
          if (item) {
            const element = el;
            disposers.set(key, createScope(() => {
              const collected = [];
              const cleanup = withCollector(collected, () => bindItem(element, item, key, bindFirst(element)));
              activateResult(collected);
              return cleanup;
            }, {
              root: true
            }));
          }
        }
        if (pinned.has(key))
          continue;
        if (nextKeyed(prev) !== el)
          container.insertBefore(el, prev ? prev.nextElementSibling : container.firstElementChild);
        prev = el;
      }
    };
    createScope(() => {
      createEffect(() => {
        const keys = Array.from(source.keys());
        untrack(() => {
          const keySet = new Set(keys);
          const { current, adopted, pinned, leavers } = classify(keySet);
          leave(keySet, leavers);
          enter(keys, current, adopted, pinned);
        });
      });
      return () => {
        for (const dispose of disposers.values())
          dispose();
        disposers.clear();
      };
    });
  };
  pushDescriptor(undefined, "reconcile", descriptor);
  return descriptor;
}

// src/helpers/events.ts
var PASSIVE_EVENTS = new Set([
  "scroll",
  "resize",
  "mousewheel",
  "touchstart",
  "touchmove",
  "wheel"
]);
var NON_BUBBLING_EVENTS = new Set([
  "focus",
  "blur",
  "scroll",
  "resize",
  "load",
  "unload",
  "error",
  "toggle",
  "mouseenter",
  "mouseleave",
  "pointerenter",
  "pointerleave",
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "ended",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "volumechange",
  "waiting"
]);
var attachListener = (host, target, type, handler, options) => {
  const rawListener = (e) => {
    const result = handler(e, target);
    if (!isRecord(result))
      return;
    batch(() => {
      for (const [key, value] of Object.entries(result)) {
        host[key] = value;
      }
    });
  };
  const listener = options.passive ? throttle(rawListener) : rawListener;
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener);
    listener.cancel?.();
  };
};
var makeOn = (host) => {
  function on(target, type, handler, options = {}) {
    const descriptor = () => {
      if (!target)
        return;
      if (!("passive" in options)) {
        options = { ...options, passive: PASSIVE_EVENTS.has(type) };
      }
      if (isSignal(target)) {
        if (NON_BUBBLING_EVENTS.has(type)) {
          if (false) {}
          return keyedScopes(target, (el) => {
            let removeDebugListener;
            if (false) {}
            const cleanup = attachListener(host, el, type, handler, options);
            if (!removeDebugListener)
              return cleanup;
            return () => {
              cleanup();
              removeDebugListener?.();
            };
          });
        }
        const root = host.shadowRoot ?? host;
        const rawListener = (e) => {
          const path = e.composedPath();
          for (const el of target.get()) {
            if (path.includes(el)) {
              const result = handler(e, el);
              if (!isRecord(result))
                break;
              batch(() => {
                for (const [key, value] of Object.entries(result)) {
                  host[key] = value;
                }
              });
              break;
            }
          }
        };
        const listener = options.passive ? throttle(rawListener) : rawListener;
        createScope(() => {
          let removeDebugListener;
          if (false) {}
          root.addEventListener(type, listener, options);
          return () => {
            root.removeEventListener(type, listener);
            listener.cancel?.();
            removeDebugListener?.();
          };
        });
        return;
      }
      createScope(() => {
        let removeDebugListener;
        if (false) {}
        const cleanup = attachListener(host, target, type, handler, options);
        if (!removeDebugListener)
          return cleanup;
        return () => {
          cleanup();
          removeDebugListener?.();
        };
      });
    };
    pushDescriptor(host, "on", descriptor);
    return descriptor;
  }
  return on;
};

// src/types.ts
var PARSER_BRAND = Symbol("parser");
var METHOD_BRAND = Symbol("method");
var RESERVED_WORDS_LIST = [
  "constructor",
  "prototype",
  "__proto__",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
];
var RESERVED_WORDS = new Set(RESERVED_WORDS_LIST);
var isParser = (value) => typeof value === "function" && (PARSER_BRAND in value);
var isMethodProducer = (value) => typeof value === "function" && (METHOD_BRAND in value);
var isReservedWord = (name) => RESERVED_WORDS.has(name);
var asParser = (fn) => Object.assign(fn, { [PARSER_BRAND]: true });
var defineMethod = (fn) => Object.assign(fn, { [METHOD_BRAND]: true });

// src/component.ts
var elementInternalsRegistry = () => {
  const g = globalThis;
  g._elementInternals ??= new WeakMap;
  return g._elementInternals;
};
function defineComponent(name, factory, extensions) {
  if (!name.includes("-") || !name.match(/^[a-z][a-z0-9-]*$/))
    throw new InvalidComponentNameError(name);
  const exts = extensions ?? [];
  const merged = mergeExtensions(name, exts);

  class Truc extends HTMLElement {
    static formAssociated = false;
    static observedAttributes = merged.observedAttributes;
    #initialized = false;
    #setup = [];
    #cleanup;
    #internalsAccessed = false;
    constructor() {
      super();
      try {
        const internals = this.attachInternals();
        internalsMap.set(this, internals);
        internalsHosts.set(internals, this);
        elementInternalsRegistry().set(this, internals);
      } catch {
        internalsMap.set(this, null);
      }
    }
    connectedCallback() {
      const runSetup = () => {
        this.#cleanup = createScope(() => {
          activateResult(this.#setup);
        }, {
          root: true
        });
      };
      if (this.#initialized) {
        if (isFunction(this.#cleanup))
          this.#cleanup();
        runSetup();
      } else {
        const instance = this;
        const host = this;
        const [elementQueries, resolveDependencies] = makeElementQueries(host);
        const context = {
          expose: this.#initSignals.bind(this),
          host,
          ...elementQueries,
          get internals() {
            const internals2 = internalsMap.get(instance) ?? null;
            if (false) {}
            return internals2;
          },
          watch: makeWatch(host),
          on: makeOn(host),
          pass: makePass(host),
          provideContexts: makeProvideContexts(host),
          requestContext: makeRequestContext(host)
        };
        const collector = [];
        const result = withCollector(collector, () => factory(context));
        this.#setup = collector;
        if (result) {
          const seen = new Set(collector);
          forEachUnseen(result, seen, (d) => this.#setup.push(d));
        }
        const internals = internalsMap.get(this) ?? null;
        for (const ext of exts) {
          const extra = ext.onConnect?.(this, internals);
          if (extra) {
            const seen = new Set(this.#setup);
            forEachUnseen(extra, seen, (d) => this.#setup.push(d));
          }
        }
        this.#initialized = true;
        if (!this.#setup.length)
          return;
        resolveDependencies(runSetup);
      }
    }
    attributeChangedCallback(attrName, oldValue, newValue) {
      for (const ext of exts)
        ext.onAttributeChanged?.(this, attrName, oldValue, newValue);
    }
    disconnectedCallback() {
      if (isFunction(this.#cleanup))
        this.#cleanup();
    }
    #initSignals(instanceProps) {
      const createReactiveProperty = (key, initializer) => {
        if (isParser(initializer)) {
          const result = initializer(this.getAttribute(key));
          if (result != null)
            this.#setAccessor(key, result);
        } else if (isMethodProducer(initializer)) {
          this[key] = initializer;
        } else {
          const value = initializer;
          if (value != null)
            this.#setAccessor(key, value);
        }
      };
      for (const [prop, initializer] of Object.entries(instanceProps)) {
        if (initializer == null)
          continue;
        if (isReservedWord(prop))
          throw new InvalidPropertyNameError(this.localName, prop, "reserved word or Object builtin — cannot be used as a reactive property");
        if (merged.reservedMembers.has(prop)) {
          let reason = "is a member reserved by an extension";
          if (false)
            ;
          throw new InvalidPropertyNameError(this.localName, prop, reason);
        }
        if (prop in this)
          continue;
        let retained = retainedInitializers.get(this);
        if (!retained) {
          retained = {};
          retainedInitializers.set(this, retained);
        }
        retained[prop] = initializer;
        createReactiveProperty(prop, initializer);
      }
    }
    #setAccessor(key, value) {
      const signal = isSignal(value) ? value : isSlotDescriptor(value) ? value : isFunction(value) ? deriveCell(value) : createCell(value);
      const signals = getSignals(this);
      const k = key;
      const prev = signals[k];
      if (isSlot(prev)) {
        prev.replace(signal);
      } else if (isMutableSignal(signal) || isSlotDescriptor(signal)) {
        const slot = createSlot(signal);
        signals[k] = slot;
        Object.defineProperty(this, key, slot);
      } else {
        signals[k] = signal;
        Object.defineProperty(this, key, {
          get: signal.get,
          enumerable: true
        });
      }
    }
  }
  Object.assign(Truc, merged.staticProps);
  for (const ext of exts)
    ext.installOnPrototype?.(Truc.prototype);
  customElements.define(name, Truc);
  return customElements.get(name);
}
// src/extensions/attributes.ts
var observedAttributes = (names) => ({
  name: "observedAttributes",
  observedAttributes: names,
  onAttributeChanged: (instance, name, _oldValue, newValue) => {
    const initializer = retainedInitializers.get(instance)?.[name];
    if (!isParser(initializer))
      return;
    const result = initializer(newValue);
    if (result != null)
      instance[name] = result;
  }
});
// src/extensions/form.ts
var emptyNodeList;
var getEmptyNodeList = () => emptyNodeList ??= typeof document !== "undefined" && typeof document.createDocumentFragment === "function" ? document.createDocumentFragment().childNodes : [];
var EMPTY_VALIDITY_STATE = {
  valueMissing: false,
  typeMismatch: false,
  patternMismatch: false,
  tooLong: false,
  tooShort: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  stepMismatch: false,
  badInput: false,
  customError: false,
  valid: true
};
var snapshotValidity = (validity) => {
  const snapshot = {};
  for (const key of Object.keys(EMPTY_VALIDITY_STATE))
    snapshot[key] = validity[key];
  return snapshot;
};
var VALIDITY_FLAG_KEYS = Object.keys(EMPTY_VALIDITY_STATE).filter((key) => key !== "valid");
var HOST_CONTRACT_DESCRIPTORS = {
  form: {
    get() {
      return internalsMap.get(this)?.form ?? null;
    },
    enumerable: true,
    configurable: true
  },
  name: {
    get() {
      return this.getAttribute("name") ?? "";
    },
    set(v) {
      if (v == null)
        this.removeAttribute("name");
      else
        this.setAttribute("name", v);
    },
    enumerable: true,
    configurable: true
  },
  labels: {
    get() {
      return internalsMap.get(this)?.labels ?? getEmptyNodeList();
    },
    enumerable: true,
    configurable: true
  },
  validity: {
    get() {
      const signal = getSignals(this)["validity"];
      return isSignal(signal) ? signal.get() : internalsMap.get(this)?.validity ?? EMPTY_VALIDITY_STATE;
    },
    enumerable: true,
    configurable: true
  },
  validationMessage: {
    get() {
      const signal = getSignals(this)["validationMessage"];
      return isSignal(signal) ? signal.get() : internalsMap.get(this)?.validationMessage ?? "";
    },
    enumerable: true,
    configurable: true
  },
  willValidate: {
    get() {
      return internalsMap.get(this)?.willValidate ?? false;
    },
    enumerable: true,
    configurable: true
  },
  checkValidity: {
    value() {
      return internalsMap.get(this)?.checkValidity() ?? true;
    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  reportValidity: {
    value() {
      return internalsMap.get(this)?.reportValidity() ?? true;
    },
    enumerable: true,
    configurable: true,
    writable: true
  },
  setCustomValidity: {
    value(ownMessage) {
      const internals = internalsMap.get(this);
      if (internals) {
        const current = snapshotValidity(internals.validity);
        const flags = {
          customError: !!ownMessage
        };
        const merged = {};
        for (const key of VALIDITY_FLAG_KEYS)
          merged[key] = flags[key] ?? current[key];
        const anyTrue = VALIDITY_FLAG_KEYS.some((key) => merged[key]);
        const message = ownMessage || (anyTrue ? internals.validationMessage || FALLBACK_VALIDITY_MESSAGE : undefined);
        internals.setValidity(merged, message || undefined, this.querySelector(FOCUSABLE_FORM_CONTROL_SELECTOR) ?? this);
      }
    },
    enumerable: true,
    configurable: true,
    writable: true
  }
};
var MANAGED_FORM_MEMBERS = new Set([
  ...Object.keys(HOST_CONTRACT_DESCRIPTORS),
  "disabled"
]);
var FOCUSABLE_FORM_CONTROL_SELECTOR = "input, select, textarea, button, [tabindex]";
var FALLBACK_VALIDITY_MESSAGE = "Invalid value";
var makeDefaultPropDescriptor = (prop) => ({
  get() {
    const initializer = retainedInitializers.get(this)?.[prop];
    if (isParser(initializer))
      return initializer(this.getAttribute(prop));
    if (initializer !== undefined)
      return initializer;
    return prop === "checked" ? this.hasAttribute("checked") : this.getAttribute(prop) ?? "";
  },
  set(v) {
    if (prop === "checked") {
      if (v)
        this.setAttribute("checked", "");
      else
        this.removeAttribute("checked");
    } else if (v == null)
      this.removeAttribute(prop);
    else
      this.setAttribute(prop, String(v));
  },
  enumerable: true,
  configurable: true
});
var installManagedFormMembers = (proto, propName, defaultPropName, resetCallback, stateRestoreCallback) => {
  Object.defineProperties(proto, {
    ...HOST_CONTRACT_DESCRIPTORS,
    [defaultPropName]: makeDefaultPropDescriptor(propName),
    formResetCallback: {
      value: resetCallback,
      writable: true,
      configurable: true
    },
    formStateRestoreCallback: {
      value: stateRestoreCallback,
      writable: true,
      configurable: true
    },
    formDisabledCallback: {
      value: formDisabledCallback,
      writable: true,
      configurable: true
    }
  });
};
var createManagedProperties = (instance, internals) => {
  const disabledSlot = createSlot(createCell(instance.hasAttribute("disabled")));
  const messageState = createCell(internals.validationMessage);
  const validityState = createCell(snapshotValidity(internals.validity), {
    equals: DEEP_EQUALITY
  });
  const signals = getSignals(instance);
  signals["disabled"] = disabledSlot;
  Object.defineProperty(instance, "disabled", {
    get: () => disabledSlot.get(),
    set: (v) => {
      disabledSlot.set(v);
      if (v)
        instance.setAttribute("disabled", "");
      else
        instance.removeAttribute("disabled");
    },
    enumerable: true,
    configurable: true
  });
  signals["validationMessage"] = messageState;
  signals["validity"] = validityState;
  const setValidity = internals.setValidity.bind(internals);
  internals.setValidity = (flags, message, anchor) => {
    setValidity(flags, message, anchor);
    messageState.set(internals.validationMessage);
    validityState.set(snapshotValidity(internals.validity));
  };
  return messageState;
};
var makeFormAssociatedExtension = (config) => ({
  name: config.name,
  __kind: config.__kind,
  staticProps: { formAssociated: true },
  reservedMembers: new Set([...MANAGED_FORM_MEMBERS, config.defaultPropName]),
  installOnPrototype: config.installOnPrototype,
  onConnect: (instance, internals) => {
    if (!internals)
      return;
    const { propName } = config;
    const hasSignal = propName in instance && getSignals(instance)[propName];
    if (false)
      ;
    createManagedProperties(instance, internals);
    return [config.makeSyncDescriptor(instance, internals)];
  }
});
var makeResetCallback = (prop, defaultProp) => function() {
  const initializer = retainedInitializers.get(this)?.[prop];
  if (initializer === undefined)
    return;
  if (!isParser(initializer) && (isSignal(initializer) || isFunction(initializer) || isSlotDescriptor(initializer)))
    return;
  queueMicrotask(() => {
    const result = this[defaultProp];
    if (result != null)
      this[prop] = result;
  });
};
var formStateRestoreCallback = function(state) {
  if (typeof state !== "string")
    return;
  const initializer = retainedInitializers.get(this)?.["value"];
  if (isParser(initializer)) {
    const result = initializer(state);
    if (result != null)
      this.value = result;
  } else if (typeof this.value === "number") {
    const n = Number(state);
    if (!Number.isNaN(n))
      this.value = n;
  } else {
    this.value = state;
  }
};
var checkboxFormStateRestoreCallback = function(state) {
  this.checked = typeof state === "string";
};
var formDisabledCallback = function(disabled) {
  const signals = getSignals(this);
  const slot = signals["disabled"];
  if (isSlot(slot))
    slot.set(disabled);
  else
    this.disabled = disabled;
};
var formAssociated = () => makeFormAssociatedExtension({
  __kind: "form-associated",
  name: "formAssociated",
  propName: "value",
  defaultPropName: "defaultValue",
  installOnPrototype: (proto) => installManagedFormMembers(proto, "value", "defaultValue", makeResetCallback("value", "defaultValue"), formStateRestoreCallback),
  makeSyncDescriptor: (instance, internals) => () => createEffect(() => {
    const v = instance.value;
    internals.setFormValue(typeof v === "string" ? v : String(v ?? ""));
  })
});
var formAssociatedCheckbox = () => makeFormAssociatedExtension({
  __kind: "form-associated-checkbox",
  name: "formAssociatedCheckbox",
  propName: "checked",
  defaultPropName: "defaultChecked",
  installOnPrototype: (proto) => installManagedFormMembers(proto, "checked", "defaultChecked", makeResetCallback("checked", "defaultChecked"), checkboxFormStateRestoreCallback),
  makeSyncDescriptor: (instance, internals) => () => createEffect(() => {
    const checked = instance.checked;
    internals.setFormValue(checked ? instance.getAttribute("value") ?? "on" : null);
  })
});
var relayValidity = (internals, control, anchor = control) => {
  if (!internals)
    return;
  control.checkValidity();
  const flags = {};
  for (const key of VALIDITY_FLAG_KEYS)
    flags[key] = control.validity[key];
  const anyTrue = VALIDITY_FLAG_KEYS.some((key) => flags[key]);
  internals.setValidity(flags, control.validationMessage || (anyTrue ? FALLBACK_VALIDITY_MESSAGE : undefined), anchor);
};
// src/parsers/boolean.ts
var asBoolean = (fallback = false) => asParser((value) => value != null ? value.toLowerCase() !== "false" : fallback);
// src/parsers/json.ts
var asJSON = (fallback) => asParser((value) => {
  if ((value ?? fallback) == null)
    throw new TypeError("asJSON: Value and fallback are both null or undefined");
  if (value == null)
    return fallback;
  if (value === "")
    throw new SyntaxError("Empty string is not valid JSON");
  let result;
  try {
    result = JSON.parse(value, (key, parsed) => isReservedWord(key) ? undefined : parsed);
  } catch (error) {
    throw new SyntaxError(`Failed to parse JSON: ${String(error)}`, {
      cause: error
    });
  }
  return result ?? fallback;
});
// src/parsers/number.ts
var parseNumber = (parseFn, value) => {
  if (value == null)
    return;
  const parsed = parseFn(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
var asInteger = (fallback = 0) => asParser((value) => {
  if (value == null)
    return fallback;
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("0x"))
    return parseNumber((v) => parseInt(v, 16), trimmed) ?? fallback;
  const parsed = parseNumber(parseFloat, value);
  return parsed != null ? Math.trunc(parsed) : fallback;
});
var asNumber = (fallback = 0) => asParser((value) => parseNumber(parseFloat, value) ?? fallback);
var asClampedInteger = (min = 0, max = Number.MAX_SAFE_INTEGER) => asParser((value) => {
  if (value == null)
    return min;
  const trimmed = value.trim();
  const raw = trimmed.toLowerCase().startsWith("0x") ? parseNumber((v) => parseInt(v, 16), trimmed) : parseNumber(parseFloat, value);
  const parsed = raw != null ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(parsed, max));
});
// src/parsers/string.ts
var asString = (fallback = "") => asParser((value) => value ?? fallback);
var asEnum = (valid) => asParser((value) => {
  if (value == null)
    return valid[0];
  const lowerValue = value.toLowerCase();
  const matchingValid = valid.find((v) => v.toLowerCase() === lowerValue);
  return matchingValid ?? valid[0];
});
export {
  untrack,
  unown,
  throttle,
  setTextPreservingComments,
  schedule,
  safeSetAttribute,
  relayValidity,
  reconcile,
  queryAll,
  query,
  observedAttributes,
  match,
  isTask,
  isStore,
  isState,
  isSlot,
  isSignalOfType,
  isSignal,
  isSensor,
  isRecord,
  isPending,
  isParser,
  isMutableStore,
  isMutableSignal,
  isMutableList,
  isMutableCell,
  isMethodProducer,
  isMemo,
  isList,
  isFunction,
  isDerivedList,
  isComputed,
  isCollection,
  isCell,
  isAsyncFunction,
  formAssociatedCheckbox,
  formAssociated,
  escapeHTML,
  each,
  deriveStore,
  deriveSignal,
  deriveList,
  deriveCell,
  defineMethod,
  defineComponent,
  dangerouslyBindInnerHTML,
  createTask,
  createStore,
  createState,
  createSlot,
  createSignal,
  createSensor,
  createScope,
  createMutableSignal,
  createMemo,
  createList,
  createElementsMemo,
  createEffect,
  createContext,
  createComputed,
  createCollection,
  createCell,
  bindVisible,
  bindText,
  bindStyle,
  bindState,
  bindProperty,
  bindClass,
  bindAttribute,
  bindAria,
  batch,
  asString,
  asParser,
  asNumber,
  asJSON,
  asInteger,
  asEnum,
  asClampedInteger,
  asBoolean,
  abort,
  UnsetSignalValueError,
  UnresolvableKeyError,
  SKIP_EQUALITY,
  RequiredOwnerError,
  ReadonlySignalError,
  PromiseValueError,
  NullishSignalValueError,
  NoActiveCollectorError,
  MissingElementError,
  InvalidTemplateError,
  InvalidStoreMutationError,
  InvalidSignalValueError,
  InvalidSelectorError,
  InvalidReactivesError,
  InvalidPropertyNameError,
  InvalidPassPropertyError,
  InvalidCustomElementError,
  InvalidComponentNameError,
  InvalidCallbackError,
  ExtensionCollisionError,
  EffectConvergenceError,
  DuplicateKeyError,
  DependencyTimeoutError,
  DEFAULT_EQUALITY,
  DEEP_EQUALITY,
  ContextRequestEvent,
  CircularDependencyError,
  CONTEXT_REQUEST
};

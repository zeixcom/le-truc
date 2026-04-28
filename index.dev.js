// node_modules/@zeix/cause-effect/src/util.ts
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
function isUniformArray(value, guard = (item) => item != null) {
  return Array.isArray(value) && value.every(guard);
}
function valueString(value) {
  return typeof value === "string" ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);
}

// node_modules/@zeix/cause-effect/src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`[${where}] Circular dependency detected`);
    this.name = "CircularDependencyError";
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

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`[${where}] Could not add key "${key}"${value ? ` with value ${JSON.stringify(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
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
// node_modules/@zeix/cause-effect/src/graph.ts
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
var deepEqual = (a, b) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (a == null || typeof a !== "object" || b == null || typeof b !== "object")
    return false;
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b))
    return false;
  if (aIsArray) {
    const aa = a;
    const ba = b;
    if (aa.length !== ba.length)
      return false;
    for (let i = 0;i < aa.length; i++)
      if (!deepEqual(aa[i], ba[i]))
        return false;
    return true;
  }
  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length)
      return false;
    for (const key of aKeys) {
      if (!(key in b))
        return false;
      if (!deepEqual(a[key], b[key]))
        return false;
    }
    return true;
  }
  return false;
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
    node.flags = newFlag;
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
  }
  node.flags = FLAG_CLEAN;
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
function flush() {
  if (flushing)
    return;
  flushing = true;
  try {
    for (let i = 0;i < queuedEffects.length; i++) {
      const effect = queuedEffects[i];
      if (effect.flags & (FLAG_DIRTY | FLAG_CHECK))
        refresh(effect);
    }
    queuedEffects.length = 0;
  } finally {
    flushing = false;
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
// node_modules/@zeix/cause-effect/src/nodes/state.ts
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

// node_modules/@zeix/cause-effect/src/nodes/list.ts
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
  return [
    typeof keyConfig === "string" ? () => `${keyConfig}${keyCounter++}` : contentBased ? (item) => keyConfig(item) || String(keyCounter++) : () => String(keyCounter++),
    contentBased
  ];
}
function diffArrays(prev, next, prevKeys, generateKey, contentBased, itemEquals) {
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
    if (val === undefined)
      continue;
    const key = contentBased ? generateKey(val) : prevKeys[i] ?? generateKey(val);
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
  const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig);
  const itemEquals = options?.itemEquals ?? DEEP_EQUALITY;
  const itemFactory = options?.createItem ?? ((item) => createState(item, { equals: itemEquals }));
  const buildValue = () => keys.map((key) => signals.get(key)?.get()).filter((v) => v !== undefined);
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
    if (Object.keys(changes.change).length) {
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
    if (val === undefined)
      continue;
    let key = keys[i];
    if (!key) {
      key = generateKey(val);
      keys[i] = key;
    }
    validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
    signals.set(key, itemFactory(val));
  }
  node.value = value;
  node.flags = 0;
  const list = {
    [Symbol.toStringTag]: TYPE_LIST,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
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
      if (node.sources) {
        if (node.flags) {
          const relink = node.flags & FLAG_RELINK;
          node.value = untrack(buildValue);
          if (relink) {
            node.flags = FLAG_DIRTY;
            refresh(node);
            if (node.error)
              throw node.error;
          } else {
            node.flags = FLAG_CLEAN;
          }
        }
      } else {
        refresh(node);
        if (node.error)
          throw node.error;
      }
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value;
      const changes = diffArrays(prev, next, keys, generateKey, contentBased, itemEquals);
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
      list.set(fn(list.get()));
    },
    at(index) {
      const key = keys[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    keys() {
      subscribe();
      return keys.values();
    },
    byKey(key) {
      return signals.get(key);
    },
    keyAt(index) {
      return keys[index];
    },
    indexOfKey(key) {
      return keys.indexOf(key);
    },
    add(value2) {
      const key = generateKey(value2);
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_LIST, key, value2);
      if (!keys.includes(key))
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
      signal.set(value2);
      node.flags |= FLAG_DIRTY;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
    },
    sort(compareFn) {
      const entries = keys.map((key) => [key, signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
      const newOrder = entries.map(([key]) => key);
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
      for (let i = 0;i < actualDeleteCount; i++) {
        const index = actualStart + i;
        const key = keys[index];
        if (key) {
          const signal = signals.get(key);
          if (signal)
            remove[key] = signal.get();
        }
      }
      const newOrder = keys.slice(0, actualStart);
      const change = {};
      for (const item of items) {
        const key = generateKey(item);
        if (key in remove) {
          delete remove[key];
          change[key] = item;
        } else if (signals.has(key)) {
          throw new DuplicateKeyError(TYPE_LIST, key, item);
        } else {
          add[key] = item;
        }
        newOrder.push(key);
      }
      newOrder.push(...keys.slice(actualStart + actualDeleteCount));
      const changed = !!(Object.keys(add).length || Object.keys(remove).length || Object.keys(change).length);
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
function isList(value) {
  return isSignalOfType(value, TYPE_LIST);
}

// node_modules/@zeix/cause-effect/src/nodes/memo.ts
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

// node_modules/@zeix/cause-effect/src/nodes/task.ts
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

// node_modules/@zeix/cause-effect/src/nodes/collection.ts
function deriveCollection(source, callback) {
  validateCallback(TYPE_COLLECTION, callback);
  const isAsync = isAsyncFunction(callback);
  const signals = new Map;
  let keys = [];
  const addSignal = (key) => {
    const signal = isAsync ? createTask(async (prev, abort) => {
      const sourceValue = source.byKey(key)?.get();
      if (sourceValue == null)
        return prev;
      return callback(sourceValue, abort);
    }) : createMemo(() => {
      const sourceValue = source.byKey(key)?.get();
      if (sourceValue == null)
        return;
      return callback(sourceValue);
    });
    signals.set(key, signal);
  };
  function syncKeys(nextKeys) {
    if (!keysEqual(keys, nextKeys)) {
      const a = new Set(keys);
      const b = new Set(nextKeys);
      for (const key of keys)
        if (!b.has(key))
          signals.delete(key);
      for (const key of nextKeys)
        if (!a.has(key))
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
  const valuesEqual = (a, b) => {
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++)
      if (a[i] !== b[i])
        return false;
    return true;
  };
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
  function ensureFresh() {
    if (node.sources) {
      if (node.flags) {
        node.value = untrack(buildValue);
        if (node.flags & FLAG_RELINK) {
          node.flags = FLAG_DIRTY;
          refresh(node);
          if (node.error)
            throw node.error;
        } else {
          node.flags = FLAG_CLEAN;
        }
      }
    } else if (node.sinks) {
      refresh(node);
      if (node.error)
        throw node.error;
    } else {
      node.value = untrack(buildValue);
    }
  }
  const initialKeys = Array.from(untrack(() => source.keys()));
  for (const key of initialKeys)
    addSignal(key);
  keys = initialKeys;
  const collection = {
    [Symbol.toStringTag]: TYPE_COLLECTION,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      for (const key of keys) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      if (activeSink)
        link(node, activeSink);
      ensureFresh();
      return keys.length;
    },
    keys() {
      if (activeSink)
        link(node, activeSink);
      ensureFresh();
      return keys.values();
    },
    get() {
      if (activeSink)
        link(node, activeSink);
      ensureFresh();
      return node.value;
    },
    at(index) {
      const key = keys[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    byKey(key) {
      return signals.get(key);
    },
    keyAt(index) {
      return keys[index];
    },
    indexOfKey(key) {
      return keys.indexOf(key);
    },
    deriveCollection(cb) {
      return deriveCollection(collection, cb);
    }
  };
  return collection;
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
        for (const item of add) {
          const key = generateKey(item);
          signals.set(key, itemFactory(item));
          itemToKey.set(item, key);
          if (!keys.includes(key))
            keys.push(key);
          structural = true;
        }
      }
      if (change) {
        for (const item of change) {
          const key = resolveKey(item);
          if (!key)
            continue;
          const signal = signals.get(key);
          if (signal && isState(signal)) {
            itemToKey.delete(signal.get());
            signal.set(item);
            itemToKey.set(item, key);
          }
        }
      }
      if (remove) {
        for (const item of remove) {
          const key = resolveKey(item);
          if (!key)
            continue;
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
  const collection = {
    [Symbol.toStringTag]: TYPE_COLLECTION,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
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
    keys() {
      subscribe();
      return keys.values();
    },
    get() {
      subscribe();
      if (node.sources) {
        if (node.flags) {
          const relink = node.flags & FLAG_RELINK;
          node.value = untrack(buildValue);
          if (relink) {
            node.flags = FLAG_DIRTY;
            refresh(node);
            if (node.error)
              throw node.error;
          } else {
            node.flags = FLAG_CLEAN;
          }
        }
      } else {
        refresh(node);
        if (node.error)
          throw node.error;
      }
      return node.value;
    },
    at(index) {
      const key = keys[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    byKey(key) {
      return signals.get(key);
    },
    keyAt(index) {
      return keys[index];
    },
    indexOfKey(key) {
      return keys.indexOf(key);
    },
    deriveCollection(cb) {
      return deriveCollection(collection, cb);
    }
  };
  return collection;
}
function isCollection(value) {
  return isSignalOfType(value, TYPE_COLLECTION);
}
// node_modules/@zeix/cause-effect/src/nodes/effect.ts
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
// node_modules/@zeix/cause-effect/src/nodes/sensor.ts
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
// node_modules/@zeix/cause-effect/src/nodes/store.ts
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
  const buildValue = () => {
    const record = {};
    signals.forEach((signal, key) => {
      record[key] = signal.get();
    });
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
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const val = changes.change[key];
          validateSignalValue(`${TYPE_STORE} for key "${key}"`, val);
          const signal = signals.get(key);
          if (signal) {
            if (isRecord(val) !== isStore(signal)) {
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
      for (const key of Array.from(signals.keys())) {
        const signal = signals.get(key);
        if (signal)
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
      if (node.sources) {
        if (node.flags) {
          const relink = node.flags & FLAG_RELINK;
          node.value = untrack(buildValue);
          if (relink) {
            node.flags = FLAG_DIRTY;
            refresh(node);
            if (node.error)
              throw node.error;
          } else {
            node.flags = FLAG_CLEAN;
          }
        }
      } else {
        refresh(node);
        if (node.error)
          throw node.error;
      }
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value;
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
      store.set(fn(store.get()));
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
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (typeof prop !== "symbol")
        return target.byKey(prop);
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
      return signal ? {
        enumerable: true,
        configurable: true,
        writable: true,
        value: signal
      } : undefined;
    }
  });
}
function isStore(value) {
  return isSignalOfType(value, TYPE_STORE);
}

// node_modules/@zeix/cause-effect/src/signal.ts
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
function createComputed(callback, options) {
  return isAsyncFunction(callback) ? createTask(callback, options) : createMemo(callback, options);
}
function createSignal(value) {
  if (isSignal(value))
    return value;
  if (value == null)
    throw new InvalidSignalValueError("createSignal", value);
  if (isAsyncFunction(value))
    return createTask(value);
  if (isFunction(value))
    return createMemo(value);
  if (isUniformArray(value))
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
  if (isUniformArray(value))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return createState(value);
}
function isComputed(value) {
  return isMemo(value) || isTask(value);
}
function isSignal(value) {
  return value != null && SIGNAL_TYPES.has(value[Symbol.toStringTag]);
}
function isMutableSignal(value) {
  return isState(value) || isStore(value) || isList(value);
}

// node_modules/@zeix/cause-effect/src/nodes/slot.ts
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
    if (isSlot(delegated))
      return delegated.set(next);
    if ("set" in delegated && typeof delegated.set === "function") {
      validateSignalValue(TYPE_SLOT, next, guard);
      delegated.set(next);
    } else {
      throw new ReadonlySignalError(TYPE_SLOT);
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
// src/context.ts
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
var makeProvideContexts = (host) => (contexts) => () => createScope(() => {
  const listener = (e) => {
    const { context, callback } = e;
    if (typeof context === "string" && contexts.includes(context) && isFunction(callback)) {
      e.stopImmediatePropagation();
      callback(() => host[context]);
    }
  };
  host.addEventListener(CONTEXT_REQUEST, listener);
  return () => host.removeEventListener(CONTEXT_REQUEST, listener);
});
var makeRequestContext = (host) => (context, fallback) => {
  let consumed = () => fallback;
  host.dispatchEvent(new ContextRequestEvent(context, (getter) => {
    consumed = getter;
  }));
  return createMemo(consumed);
};

// src/util.ts
var DEV_MODE = typeof process !== "undefined" && true;
var LOG_WARN = "warn";
var idString = (id) => id ? `#${id}` : "";
var classString = (classList) => classList?.length ? `.${Array.from(classList).join(".")}` : "";
var isCustomElement = (element) => element.localName.includes("-");
var isNotYetDefinedComponent = (element) => isCustomElement(element) && element.matches(":not(:defined)");
var elementName = (el) => el ? `<${el.localName}${idString(el.id)}${classString(el.classList)}>` : "<unknown>";

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
  constructor(host, selector, required) {
    super(`Missing required element <${selector}> in component ${elementName(host)}. ${required}`);
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

// src/internal.ts
var componentSignals = new WeakMap;
var getSignals = (el) => {
  let signals = componentSignals.get(el);
  if (!signals) {
    signals = {};
    componentSignals.set(el, signals);
  }
  return signals;
};

// src/effects.ts
var activateResult = (result) => {
  for (const descriptor of result) {
    if (Array.isArray(descriptor))
      activateResult(descriptor);
    else if (descriptor)
      descriptor();
  }
};
var toSignal = (host, source) => {
  if (isFunction(source))
    return createComputed(source);
  if (typeof source === "string") {
    const sig = getSignals(host)[source];
    if (sig)
      return sig;
    return createMemo(() => host[source]);
  }
  if (source && typeof source === "object" && "get" in source && !(Symbol.toStringTag in source)) {
    return source;
  }
  return source;
};
var makeWatch = (host) => {
  function watch(source, handlerOrHandlers) {
    return () => {
      if (Array.isArray(source)) {
        const signals = source.map((s) => toSignal(host, s));
        const handler = handlerOrHandlers;
        return createEffect(() => match(signals, { ok: (values) => untrack(() => handler(values)) }));
      }
      const signal = toSignal(host, source);
      if (typeof handlerOrHandlers === "function") {
        return createEffect(() => match(signal, {
          ok: (value) => untrack(() => handlerOrHandlers(value))
        }));
      }
      return createEffect(() => match(signal, handlerOrHandlers));
    };
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
    const cleanups = [];
    for (const [prop, reactive] of Object.entries(props)) {
      if (reactive == null)
        continue;
      if (!(prop in target)) {
        if (DEV_MODE)
          console[LOG_WARN](`pass(): property '${prop}' does not exist on ${targetName}`);
        continue;
      }
      const signal = toSignal(host, reactive);
      if (!signal)
        continue;
      const slot = signals[prop];
      if (isSlot(slot)) {
        const original = slot.current();
        slot.replace(signal);
        cleanups.push(() => slot.replace(original));
        continue;
      }
      if (DEV_MODE)
        console[LOG_WARN](`pass(): property '${prop}' on ${targetName} is not Slot-backed — use setProperty() for non-Le Truc elements`);
    }
    if (cleanups.length)
      return () => {
        for (const c of cleanups)
          c();
      };
  });
  function pass(target, props) {
    return () => {
      if (!target)
        return;
      if (isMemo(target)) {
        createEffect(() => {
          for (const el of target.get()) {
            createScope(() => swapSlots(el, props));
          }
        });
      } else {
        swapSlots(target, props);
      }
    };
  }
  return pass;
};
function each(memo, callback) {
  return () => {
    createEffect(() => {
      for (const element of memo.get()) {
        createScope(() => {
          const result = callback(element);
          if (Array.isArray(result))
            activateResult(result);
          else if (typeof result === "function")
            result();
        });
      }
    });
  };
}

// src/scheduler.ts
var objects = new Set;
var tasks = new WeakMap;
var throttledCallbacks = new Set;
var requestId;
var runTasks = () => {
  requestId = undefined;
  const elements = Array.from(objects);
  objects.clear();
  for (const element of elements)
    tasks.get(element)?.();
  const callbacks = Array.from(throttledCallbacks);
  throttledCallbacks.clear();
  for (const cb of callbacks)
    cb();
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

// src/events.ts
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
    return () => {
      if (!target)
        return;
      if (!("passive" in options)) {
        options = { ...options, passive: PASSIVE_EVENTS.has(type) };
      }
      if (isMemo(target)) {
        if (NON_BUBBLING_EVENTS.has(type)) {
          if (DEV_MODE) {
            console[LOG_WARN](`on(): '${type}' does not bubble — prefer each() + on() for per-element listeners in ${elementName(host)}`);
          }
          return createEffect(() => {
            for (const el of target.get()) {
              createScope(() => {
                return attachListener(host, el, type, handler, options);
              });
            }
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
        root.addEventListener(type, listener, options);
        return () => {
          root.removeEventListener(type, listener);
          listener.cancel?.();
        };
      }
      return attachListener(host, target, type, handler, options);
    };
  }
  return on;
};

// src/parsers.ts
var PARSER_BRAND = Symbol("parser");
var METHOD_BRAND = Symbol("method");
var isParser = (value) => isFunction(value) && (PARSER_BRAND in value);
var isMethodProducer = (value) => isFunction(value) && (METHOD_BRAND in value);
var asParser = (fn) => Object.assign(fn, { [PARSER_BRAND]: true });
var defineMethod = (fn) => Object.assign(fn, { [METHOD_BRAND]: true });

// src/ui.ts
var DEPENDENCY_TIMEOUT = 200;
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
function createElementsMemo(parent, selector) {
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
  function first(selector, required) {
    const target = root.querySelector(selector);
    if (required != null && !target)
      throw new MissingElementError(host, selector, required);
    if (target && isNotYetDefinedComponent(target))
      dependencies.add(target.localName);
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
      }
    return targets;
  }
  const resolveDependencies = (callback) => {
    if (dependencies.size) {
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
          if (DEV_MODE)
            console[LOG_WARN](error);
          callback();
        });
      });
    } else {
      callback();
    }
  };
  return [{ first, all }, resolveDependencies];
};

// src/component.ts
function defineComponent(name, factory) {
  if (!name.includes("-") || !name.match(/^[a-z][a-z0-9-]*$/))
    throw new InvalidComponentNameError(name);

  class Truc extends HTMLElement {
    debug;
    #initialized = false;
    #setup = [];
    #cleanup;
    connectedCallback() {
      const [elementQueries, resolveDependencies] = makeElementQueries(this);
      const runSetup = () => {
        this.#cleanup = createScope(() => activateResult(this.#setup), {
          root: true
        });
      };
      if (this.#initialized) {
        runSetup();
      } else {
        const host = this;
        const context = {
          expose: this.#initSignals.bind(this),
          host,
          ...elementQueries,
          watch: makeWatch(host),
          on: makeOn(host),
          pass: makePass(host),
          provideContexts: makeProvideContexts(host),
          requestContext: makeRequestContext(host)
        };
        const result = factory(context);
        if (result)
          this.#setup = result;
        this.#initialized = true;
        resolveDependencies(runSetup);
      }
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
        if (initializer == null || prop in this)
          continue;
        createReactiveProperty(prop, initializer);
      }
    }
    #setAccessor(key, value) {
      const signal = isSignal(value) ? value : isFunction(value) ? createComputed(value) : createState(value);
      const signals = getSignals(this);
      const k = key;
      const prev = signals[k];
      if (isSlot(prev)) {
        prev.replace(signal);
      } else if (isMutableSignal(signal)) {
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
  customElements.define(name, Truc);
  return customElements.get(name);
}
// src/safety.ts
var isSafeURL = (value) => {
  if (/^(javascript|data|vbscript):/i.test(value))
    return false;
  if (/^(mailto|tel):/i.test(value))
    return true;
  if (value.includes("://")) {
    try {
      const url = new URL(value);
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
  Array.from(element.childNodes).filter((node) => node.nodeType !== Node.COMMENT_NODE).forEach((node) => node.remove());
  element.append(document.createTextNode(text));
};

// src/helpers.ts
var SCRIPT_ATTRS = [
  "type",
  "src",
  "async",
  "defer",
  "nomodule",
  "crossorigin",
  "integrity",
  "referrerpolicy",
  "fetchpriority"
];
var bindText = (element, preserveComments = false) => preserveComments ? (value) => setTextPreservingComments(element, String(value)) : (value) => {
  element.textContent = String(value);
};
var bindProperty = (object, key) => (value) => {
  object[key] = value;
};
var bindClass = (element, token) => (value) => {
  element.classList.toggle(token, Boolean(value));
};
var bindVisible = (element) => (value) => {
  element.hidden = !value;
};
var bindAttribute = (element, name, allowUnsafe = false) => ({
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
});
var bindStyle = (element, prop) => ({
  ok: (value) => {
    element.style.setProperty(prop, value);
  },
  nil: () => {
    element.style.removeProperty(prop);
  }
});
var dangerouslyBindInnerHTML = (element, options = {}) => {
  const reset = () => {
    if (element.shadowRoot)
      element.shadowRoot.innerHTML = "<slot></slot>";
    else
      element.innerHTML = "";
  };
  return {
    ok: (html) => {
      if (!html) {
        reset();
        return;
      }
      const { shadowRootMode, allowScripts } = options;
      if (shadowRootMode && !element.shadowRoot)
        element.attachShadow({ mode: shadowRootMode });
      const target = element.shadowRoot || element;
      schedule(element, () => {
        target.innerHTML = html;
        if (allowScripts) {
          target.querySelectorAll("script").forEach((script) => {
            const newScript = document.createElement("script");
            for (const attr of SCRIPT_ATTRS) {
              if (script.hasAttribute(attr))
                newScript.setAttribute(attr, script.getAttribute(attr));
            }
            if (!script.hasAttribute("src"))
              newScript.appendChild(document.createTextNode(script.textContent ?? ""));
            target.appendChild(newScript);
            script.remove();
          });
        }
      });
    },
    nil: reset
  };
};
// src/parsers/boolean.ts
var asBoolean = () => asParser((value) => value != null && value !== "false");
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
    result = JSON.parse(value);
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
  valueString,
  untrack,
  unown,
  throttle,
  setTextPreservingComments,
  schedule,
  safeSetAttribute,
  match,
  isTask,
  isStore,
  isState,
  isSlot,
  isSignalOfType,
  isSignal,
  isSensor,
  isRecord,
  isParser,
  isMutableSignal,
  isMethodProducer,
  isMemo,
  isList,
  isFunction,
  isComputed,
  isCollection,
  isAsyncFunction,
  escapeHTML,
  each,
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
  createComputed,
  createCollection,
  bindVisible,
  bindText,
  bindStyle,
  bindProperty,
  bindClass,
  bindAttribute,
  batch,
  asString,
  asParser,
  asNumber,
  asJSON,
  asInteger,
  asEnum,
  asClampedInteger,
  asBoolean,
  UnsetSignalValueError,
  SKIP_EQUALITY,
  RequiredOwnerError,
  ReadonlySignalError,
  NullishSignalValueError,
  MissingElementError,
  InvalidSignalValueError,
  InvalidReactivesError,
  InvalidPropertyNameError,
  InvalidCustomElementError,
  InvalidComponentNameError,
  InvalidCallbackError,
  DependencyTimeoutError,
  DEFAULT_EQUALITY,
  DEEP_EQUALITY,
  ContextRequestEvent,
  CircularDependencyError,
  CONTEXT_REQUEST
};

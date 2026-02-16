// node_modules/@zeix/cause-effect/src/util.ts
function isFunction(fn) {
  return typeof fn === "function";
}
function isAsyncFunction(fn) {
  return isFunction(fn) && fn.constructor.name === "AsyncFunction";
}
function isSyncFunction(fn) {
  return isFunction(fn) && fn.constructor.name !== "AsyncFunction";
}
function isObjectOfType(value, type) {
  return Object.prototype.toString.call(value) === `[object ${type}]`;
}
function isRecord(value) {
  return isObjectOfType(value, "Object");
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
    if (flags & FLAG_DIRTY)
      return;
    node.flags = FLAG_DIRTY;
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
  promise.then((next) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    if (node.error || !node.equals(next, node.value)) {
      node.value = next;
      node.error = undefined;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
    }
  }, (err) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    const error = err instanceof Error ? err : new Error(String(err));
    if (!node.error || error.name !== node.error.name || error.message !== node.error.message) {
      node.error = error;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
    }
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
      if (effect.flags & FLAG_DIRTY)
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
function createScope(fn) {
  const prevOwner = activeOwner;
  const scope = { cleanup: null };
  activeOwner = scope;
  try {
    const out = fn();
    if (typeof out === "function")
      registerCleanup(scope, out);
    const dispose = () => runCleanup(scope);
    if (prevOwner)
      registerCleanup(prevOwner, dispose);
    return dispose;
  } finally {
    activeOwner = prevOwner;
  }
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
  return isObjectOfType(value, TYPE_STATE);
}

// node_modules/@zeix/cause-effect/src/nodes/list.ts
function isEqual(a, b, visited) {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (a == null || typeof a !== "object" || b == null || typeof b !== "object")
    return false;
  if (!visited)
    visited = new WeakSet;
  if (visited.has(a) || visited.has(b))
    throw new CircularDependencyError("isEqual");
  visited.add(a);
  visited.add(b);
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
        if (!isEqual(aa[i], ba[i], visited))
          return false;
      return true;
    }
    if (isRecord(a) && isRecord(b)) {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length)
        return false;
      for (const key of aKeys) {
        if (!(key in b))
          return false;
        if (!isEqual(a[key], b[key], visited))
          return false;
      }
      return true;
    }
    return false;
  } finally {
    visited.delete(a);
    visited.delete(b);
  }
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
  return [
    typeof keyConfig === "string" ? () => `${keyConfig}${keyCounter++}` : contentBased ? (item) => keyConfig(item) || String(keyCounter++) : () => String(keyCounter++),
    contentBased
  ];
}
function diffArrays(prev, next, prevKeys, generateKey, contentBased) {
  const visited = new WeakSet;
  const add = {};
  const change = {};
  const remove = {};
  const nextKeys = [];
  let changed = false;
  const prevByKey = new Map;
  for (let i = 0;i < prev.length; i++) {
    const key = prevKeys[i];
    if (key && prev[i])
      prevByKey.set(key, prev[i]);
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
    } else if (!isEqual(prevByKey.get(key), val, visited)) {
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
  const buildValue = () => keys.map((key) => signals.get(key)?.get()).filter((v) => v !== undefined);
  const node = {
    fn: buildValue,
    value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: isEqual,
    error: undefined
  };
  const toRecord = (array) => {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const val = array[i];
      if (val === undefined)
        continue;
      let key = keys[i];
      if (!key) {
        key = generateKey(val);
        keys[i] = key;
      }
      record[key] = val;
    }
    return record;
  };
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      const val = changes.add[key];
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
      signals.set(key, createState(val));
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
  const watched = options?.watched;
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched();
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
  const initRecord = toRecord(value);
  for (const key in initRecord) {
    const val = initRecord[key];
    validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
    signals.set(key, createState(val));
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
      const changes = diffArrays(prev, next, keys, generateKey, contentBased);
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
      return signals.get(keys[index]);
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
      signals.set(key, createState(value2));
      node.flags |= FLAG_DIRTY | FLAG_RELINK;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(keyOrIndex) {
      const key = typeof keyOrIndex === "number" ? keys[keyOrIndex] : keyOrIndex;
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
      for (const item of items) {
        const key = generateKey(item);
        if (signals.has(key) && !(key in remove))
          throw new DuplicateKeyError(TYPE_LIST, key, item);
        newOrder.push(key);
        add[key] = item;
      }
      newOrder.push(...keys.slice(actualStart + actualDeleteCount));
      const changed = !!(Object.keys(add).length || Object.keys(remove).length);
      if (changed) {
        applyChanges({
          add,
          change: {},
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
  return isObjectOfType(value, TYPE_LIST);
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
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched(() => {
          node.flags |= FLAG_DIRTY;
          for (let e = node.sinks;e; e = e.nextSink)
            propagate(e.sink);
          if (batchDepth === 0)
            flush();
        });
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
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
  return isObjectOfType(value, TYPE_MEMO);
}

// node_modules/@zeix/cause-effect/src/nodes/task.ts
function createTask(fn, options) {
  validateCallback(TYPE_TASK, fn, isAsyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_TASK, options.value, options?.guard);
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
    stop: undefined
  };
  const watched = options?.watched;
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched(() => {
          node.flags |= FLAG_DIRTY;
          for (let e = node.sinks;e; e = e.nextSink)
            propagate(e.sink);
          if (batchDepth === 0)
            flush();
        });
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
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
      return !!node.controller;
    },
    abort() {
      node.controller?.abort();
      node.controller = undefined;
    }
  };
}
function isTask(value) {
  return isObjectOfType(value, TYPE_TASK);
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
      return signals.get(keys[index]);
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
  const itemFactory = options?.createItem ?? createState;
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
  function subscribe() {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched((changes) => {
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
        });
      link(node, activeSink);
    }
  }
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
      return signals.get(keys[index]);
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
  return isObjectOfType(value, TYPE_COLLECTION);
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
function match(signals, handlers) {
  if (!activeOwner)
    throw new RequiredOwnerError("match");
  const { ok, err = console.error, nil } = handlers;
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
    else
      out = ok(values);
  } catch (e) {
    err([e instanceof Error ? e : new Error(String(e))]);
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
// node_modules/@zeix/cause-effect/src/nodes/store.ts
function diffRecords(prev, next) {
  const prevValid = isRecord(prev) || Array.isArray(prev);
  const nextValid = isRecord(next) || Array.isArray(next);
  if (!prevValid || !nextValid) {
    const changed2 = !Object.is(prev, next);
    return {
      changed: changed2,
      add: changed2 && nextValid ? next : {},
      change: {},
      remove: changed2 && prevValid ? prev : {}
    };
  }
  const visited = new WeakSet;
  const add = {};
  const change = {};
  const remove = {};
  let changed = false;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  for (const key of nextKeys) {
    if (key in prev) {
      if (!isEqual(prev[key], next[key], visited)) {
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
    equals: isEqual,
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
  const watched = options?.watched;
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched();
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
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
  return isObjectOfType(value, TYPE_STORE);
}

// node_modules/@zeix/cause-effect/src/signal.ts
function createComputed(callback, options) {
  return isAsyncFunction(callback) ? createTask(callback, options) : createMemo(callback, options);
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
  const signalsTypes = [
    TYPE_STATE,
    TYPE_MEMO,
    TYPE_TASK,
    TYPE_SENSOR,
    TYPE_SLOT,
    TYPE_LIST,
    TYPE_COLLECTION,
    TYPE_STORE
  ];
  const typeStyle = Object.prototype.toString.call(value).slice(8, -1);
  return signalsTypes.includes(typeStyle);
}
function isMutableSignal(value) {
  return isState(value) || isStore(value) || isList(value);
}

// node_modules/@zeix/cause-effect/src/nodes/slot.ts
function createSlot(initialSignal, options) {
  validateSignalValue(TYPE_SLOT, initialSignal, isSignal);
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
    if (!isMutableSignal(delegated))
      throw new ReadonlySignalError(TYPE_SLOT);
    validateSignalValue(TYPE_SLOT, next, guard);
    delegated.set(next);
  };
  const replace = (next) => {
    validateSignalValue(TYPE_SLOT, next, isSignal);
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
  return isObjectOfType(value, TYPE_SLOT);
}
// src/util.ts
var DEV_MODE = true;
var LOG_DEBUG = "debug";
var LOG_WARN = "warn";
var LOG_ERROR = "error";
var RESERVED_WORDS = new Set([
  "constructor",
  "prototype"
]);
var HTML_ELEMENT_PROPS = new Set([
  "id",
  "class",
  "className",
  "title",
  "role",
  "style",
  "dataset",
  "lang",
  "dir",
  "hidden",
  "children",
  "innerHTML",
  "outerHTML",
  "textContent",
  "innerText"
]);
var idString = (id) => id ? `#${id}` : "";
var classString = (classList) => classList?.length ? `.${Array.from(classList).join(".")}` : "";
var isCustomElement = (element) => element.localName.includes("-");
var isNotYetDefinedComponent = (element) => isCustomElement(element) && element.matches(":not(:defined)");
var elementName = (el) => el ? `<${el.localName}${idString(el.id)}${classString(el.classList)}>` : "<unknown>";
var log = (value, msg, level = LOG_DEBUG) => {
  if (DEV_MODE || [LOG_ERROR, LOG_WARN].includes(level))
    console[level](msg, value);
  return value;
};
var validatePropertyName = (prop) => {
  if (RESERVED_WORDS.has(prop))
    return `Property name "${prop}" is a reserved word`;
  if (HTML_ELEMENT_PROPS.has(prop))
    return `Property name "${prop}" conflicts with inherited HTMLElement property`;
  return null;
};

// src/errors.ts
class CircularMutationError extends Error {
  constructor(host, selector) {
    super(`Circular dependency detected in selection signal for component ${elementName(host)} with selector "${selector}"`);
    this.name = "CircularMutationError";
  }
}

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

class InvalidEffectsError extends TypeError {
  constructor(host, cause) {
    super(`Invalid effects in component ${elementName(host)}. Effects must be a record of effects for UI elements or the component, or a Promise that resolves to effects.`);
    this.name = "InvalidEffectsError";
    if (cause)
      this.cause = cause;
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

// src/effects.ts
var RESET = Symbol("RESET");
var getUpdateDescription = (op, name = "") => {
  const ops = {
    a: "attribute ",
    c: "class ",
    d: "dataset ",
    h: "inner HTML",
    m: "method call ",
    p: "property ",
    s: "style property ",
    t: "text content"
  };
  return ops[op] + name;
};
var runElementEffects = (host, target, effects) => {
  const cleanups = [];
  const run = (fn) => {
    const cleanup = fn(host, target);
    if (cleanup)
      cleanups.push(cleanup);
  };
  if (Array.isArray(effects))
    for (const fn of effects)
      run(fn);
  else
    run(effects);
  return () => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups.length = 0;
  };
};
var runElementsEffects = (host, elements, effects) => {
  const cleanups = new Map;
  const attach = (targets) => {
    for (const target of targets) {
      const cleanup = runElementEffects(host, target, effects);
      if (cleanup)
        cleanups.set(target, cleanup);
    }
  };
  const detach = (targets) => {
    for (const target of targets) {
      cleanups.get(target)?.();
      cleanups.delete(target);
    }
  };
  const dispose = createEffect(() => {
    const next = new Set(elements.get());
    const added = [];
    const removed = [];
    for (const target of next)
      if (!cleanups.has(target))
        added.push(target);
    for (const target of cleanups.keys())
      if (!next.has(target))
        removed.push(target);
    attach(added);
    detach(removed);
  });
  return () => {
    for (const cleanup of cleanups.values())
      cleanup();
    cleanups.clear();
    dispose();
  };
};
var runEffects = (ui, effects) => {
  if (!isRecord(effects))
    throw new InvalidEffectsError(ui.host);
  const cleanups = [];
  const keys = Object.keys(effects);
  for (const key of keys) {
    const k = key;
    if (!effects[k])
      continue;
    const elementEffects = Array.isArray(effects[k]) ? effects[k] : [effects[k]];
    if (isMemo(ui[k])) {
      cleanups.push(runElementsEffects(ui.host, ui[k], elementEffects));
    } else if (ui[k]) {
      const cleanup = runElementEffects(ui.host, ui[k], elementEffects);
      if (cleanup)
        cleanups.push(cleanup);
    }
  }
  return () => {
    for (const cleanup of cleanups)
      cleanup();
    cleanups.length = 0;
  };
};
var resolveReactive = (reactive, host, target, context) => {
  try {
    return typeof reactive === "string" ? host[reactive] : isSignal(reactive) ? reactive.get() : isFunction(reactive) ? reactive(target) : RESET;
  } catch (error) {
    if (context) {
      log(error, `Failed to resolve value of ${valueString(reactive)}${context ? ` for ${context}` : ""} in ${elementName(target)}${host !== target ? ` in ${elementName(host)}` : ""}`, LOG_ERROR);
    }
    return RESET;
  }
};
var updateElement = (reactive, updater) => (host, target) => {
  const { op, name = "", read, update } = updater;
  const operationDesc = getUpdateDescription(op, name);
  const ok = (verb) => () => {
    if (DEV_MODE && host.debug) {
      log(target, `${verb} ${operationDesc} of ${elementName(target)} in ${elementName(host)}`);
    }
    updater.resolve?.(target);
  };
  const err = (verb) => (error) => {
    log(error, `Failed to ${verb} ${operationDesc} of ${elementName(target)} in ${elementName(host)}`, LOG_ERROR);
    updater.reject?.(error);
  };
  const fallback = read(target);
  return createEffect(() => {
    const value = resolveReactive(reactive, host, target, operationDesc);
    const resolvedValue = value === RESET ? fallback : value === null ? updater.delete ? null : fallback : value;
    if (updater.delete && resolvedValue === null) {
      try {
        updater.delete(target);
        ok("delete")();
      } catch (error) {
        err("delete")(error);
      }
    } else if (resolvedValue != null) {
      const current = read(target);
      if (Object.is(resolvedValue, current))
        return;
      try {
        update(target, resolvedValue);
        ok("update")();
      } catch (error) {
        err("update")(error);
      }
    }
  });
};

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

// src/parsers.ts
var isParser = (value) => isFunction(value) && value.length >= 2;
var isReader = (value) => isFunction(value);
var getFallback = (ui, fallback) => isReader(fallback) ? fallback(ui) : fallback;
var read = (reader, fallback) => (ui) => {
  const value = reader(ui);
  return typeof value === "string" && isParser(fallback) ? fallback(ui, value) : value ?? getFallback(ui, fallback);
};

// src/ui.ts
var DEPENDENCY_TIMEOUT = 50;
var extractAttributes = (selector) => {
  const attributes = new Set;
  if (selector.includes("."))
    attributes.add("class");
  if (selector.includes("#"))
    attributes.add("id");
  if (selector.includes("[")) {
    const parts = selector.split("[");
    for (let i = 1;i < parts.length; i++) {
      const part = parts[i];
      if (!part.includes("]"))
        continue;
      const attrName = part.split("=")[0].trim().replace(/[^a-zA-Z0-9_-]/g, "");
      if (attrName)
        attributes.add(attrName);
    }
  }
  return [...attributes];
};
function createElementsMemo(parent, selector) {
  return createMemo(() => Array.from(parent.querySelectorAll(selector)), {
    value: [],
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
      const observer = new MutationObserver(() => invalidate());
      observer.observe(parent, observerConfig);
      return () => observer.disconnect();
    }
  });
}
var getHelpers = (host) => {
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
      const deps = Array.from(dependencies);
      Promise.race([
        Promise.all(deps.map((dep) => customElements.whenDefined(dep))),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DependencyTimeoutError(host, deps.filter((dep) => !customElements.get(dep))));
          }, DEPENDENCY_TIMEOUT);
        })
      ]).then(callback).catch(() => {
        callback();
      });
    } else {
      callback();
    }
  };
  return [{ first, all }, resolveDependencies];
};

// src/component.ts
function defineComponent(name, props = {}, select = () => ({}), setup = () => ({})) {
  if (!name.includes("-") || !name.match(/^[a-z][a-z0-9-]*$/))
    throw new InvalidComponentNameError(name);
  for (const prop of Object.keys(props)) {
    const error = validatePropertyName(prop);
    if (error)
      throw new InvalidPropertyNameError(name, prop, error);
  }

  class Truc extends HTMLElement {
    debug;
    #ui;
    #cleanup;
    static observedAttributes = Object.entries(props)?.filter(([, initializer]) => isParser(initializer)).map(([prop]) => prop) ?? [];
    connectedCallback() {
      const [elementQueries, resolveDependencies] = getHelpers(this);
      const ui = {
        ...select(elementQueries),
        host: this
      };
      this.#ui = ui;
      Object.freeze(this.#ui);
      const isReaderOrMethodProducer = (value) => {
        return isFunction(value);
      };
      const createSignal2 = (key, initializer) => {
        const result = isParser(initializer) ? initializer(ui, this.getAttribute(key)) : isReaderOrMethodProducer(initializer) ? initializer(ui) : initializer;
        if (result != null)
          this.#setAccessor(key, result);
      };
      for (const [prop, initializer] of Object.entries(props)) {
        if (initializer == null || prop in this)
          continue;
        createSignal2(prop, initializer);
      }
      resolveDependencies(() => {
        this.#cleanup = runEffects(ui, setup(ui));
      });
    }
    disconnectedCallback() {
      if (isFunction(this.#cleanup))
        this.#cleanup();
    }
    attributeChangedCallback(name2, oldValue, newValue) {
      if (!this.#ui || newValue === oldValue || isComputed(getSignals(this)[name2]))
        return;
      const parser = props[name2];
      if (!isParser(parser))
        return;
      const parsed = parser(this.#ui, newValue, oldValue);
      if (name2 in this)
        this[name2] = parsed;
      else
        this.#setAccessor(name2, parsed);
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
var provideContexts = (contexts) => (host) => {
  const listener = (e) => {
    const { context, callback } = e;
    if (typeof context === "string" && contexts.includes(context) && isFunction(callback)) {
      e.stopImmediatePropagation();
      callback(() => host[context]);
    }
  };
  host.addEventListener(CONTEXT_REQUEST, listener);
  return () => host.removeEventListener(CONTEXT_REQUEST, listener);
};
var requestContext = (context, fallback) => (ui) => {
  let consumed = () => getFallback(ui, fallback);
  ui.host.dispatchEvent(new ContextRequestEvent(context, (getter) => {
    consumed = getter;
  }));
  return createMemo(consumed);
};
// src/effects/attribute.ts
var isSafeURL = (value) => {
  if (/^(mailto|tel):/i.test(value))
    return true;
  if (value.includes("://")) {
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:", "ftp:"].includes(url.protocol);
    } catch {
      return false;
    }
  }
  return true;
};
var safeSetAttribute = (element, attr, value) => {
  if (/^on/i.test(attr))
    throw new Error(`Unsafe attribute: ${attr}`);
  value = String(value).trim();
  if (!isSafeURL(value))
    throw new Error(`Unsafe URL for ${attr}: ${value}`);
  element.setAttribute(attr, value);
};
var setAttribute = (name, reactive = name) => updateElement(reactive, {
  op: "a",
  name,
  read: (el) => el.getAttribute(name),
  update: (el, value) => {
    safeSetAttribute(el, name, value);
  },
  delete: (el) => {
    el.removeAttribute(name);
  }
});
var toggleAttribute = (name, reactive = name) => updateElement(reactive, {
  op: "a",
  name,
  read: (el) => el.hasAttribute(name),
  update: (el, value) => {
    el.toggleAttribute(name, value);
  }
});
// src/effects/class.ts
var toggleClass = (token, reactive = token) => updateElement(reactive, {
  op: "c",
  name: token,
  read: (el) => el.classList.contains(token),
  update: (el, value) => {
    el.classList.toggle(token, value);
  }
});
// src/scheduler.ts
var PASSIVE_EVENTS = new Set([
  "scroll",
  "resize",
  "mousewheel",
  "touchstart",
  "touchmove",
  "wheel"
]);
var pendingElements = new Set;
var tasks = new WeakMap;
var requestId;
var runTasks = () => {
  requestId = undefined;
  const elements = Array.from(pendingElements);
  pendingElements.clear();
  for (const element of elements)
    tasks.get(element)?.();
};
var requestTick = () => {
  if (requestId)
    cancelAnimationFrame(requestId);
  requestId = requestAnimationFrame(runTasks);
};
var schedule = (element, task) => {
  tasks.set(element, task);
  pendingElements.add(element);
  requestTick();
};

// src/effects/event.ts
var on = (type, handler, options = {}) => (host, target) => {
  if (!("passive" in options))
    options = { ...options, passive: PASSIVE_EVENTS.has(type) };
  const listener = (e) => {
    const task = () => {
      const result = handler(e);
      if (!isRecord(result))
        return;
      batch(() => {
        for (const [key, value] of Object.entries(result)) {
          try {
            host[key] = value;
          } catch (error) {
            log(error, `Reactive property "${key}" on ${elementName(host)} from event ${type} on ${elementName(target)} could not be set, because it is read-only.`, LOG_ERROR);
          }
        }
      });
    };
    if (options.passive)
      schedule(target, task);
    else
      task();
  };
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener);
};
// src/effects/html.ts
var dangerouslySetInnerHTML = (reactive, options = {}) => updateElement(reactive, {
  op: "h",
  read: (el) => (el.shadowRoot || !options.shadowRootMode ? el : null)?.innerHTML ?? "",
  update: (el, html) => {
    const { shadowRootMode, allowScripts } = options;
    if (!html) {
      if (el.shadowRoot)
        el.shadowRoot.innerHTML = "<slot></slot>";
      return "";
    }
    if (shadowRootMode && !el.shadowRoot)
      el.attachShadow({ mode: shadowRootMode });
    const target = el.shadowRoot || el;
    schedule(el, () => {
      target.innerHTML = html;
      if (allowScripts) {
        target.querySelectorAll("script").forEach((script) => {
          const newScript = document.createElement("script");
          newScript.appendChild(document.createTextNode(script.textContent ?? ""));
          const typeAttr = script.getAttribute("type");
          if (typeAttr)
            newScript.setAttribute("type", typeAttr);
          target.appendChild(newScript);
          script.remove();
        });
      }
    });
    return allowScripts ? " with scripts" : "";
  }
});
// src/effects/pass.ts
var pass = (props) => (host, target) => {
  if (!isCustomElement(target))
    throw new InvalidCustomElementError(target, `pass from ${elementName(host)}`);
  const reactives = isFunction(props) ? props(target) : props;
  if (!isRecord(reactives))
    throw new InvalidReactivesError(host, target, reactives);
  const toSignal = (value) => {
    if (isSignal(value))
      return value;
    const fn = typeof value === "string" && value in host ? () => host[value] : isFunction(value) ? value : undefined;
    return fn ? createComputed(fn) : undefined;
  };
  const signals = getSignals(target);
  for (const [prop, reactive] of Object.entries(reactives)) {
    if (reactive == null)
      continue;
    if (!(prop in target))
      continue;
    const applied = isFunction(reactive) && reactive.length === 1 ? reactive(target) : reactive;
    const isArray = Array.isArray(applied) && applied.length === 2;
    const signal = toSignal(isArray ? applied[0] : applied);
    if (!signal)
      continue;
    const slot = signals[prop];
    if (isSlot(slot))
      slot.replace(signal);
  }
};
// src/effects/property.ts
var setProperty = (key, reactive = key) => updateElement(reactive, {
  op: "p",
  name: key,
  read: (el) => (key in el) ? el[key] ?? null : null,
  update: (el, value) => {
    el[key] = value;
  }
});
var show = (reactive) => updateElement(reactive, {
  op: "p",
  name: "hidden",
  read: (el) => !el.hidden,
  update: (el, value) => {
    el.hidden = !value;
  }
});
// src/effects/style.ts
var setStyle = (prop, reactive = prop) => updateElement(reactive, {
  op: "s",
  name: prop,
  read: (el) => el.style.getPropertyValue(prop),
  update: (el, value) => {
    el.style.setProperty(prop, value);
  },
  delete: (el) => {
    el.style.removeProperty(prop);
  }
});
// src/effects/text.ts
var setText = (reactive) => updateElement(reactive, {
  op: "t",
  read: (el) => el.textContent,
  update: (el, value) => {
    Array.from(el.childNodes).filter((node) => node.nodeType !== Node.COMMENT_NODE).forEach((node) => node.remove());
    el.append(document.createTextNode(value));
  }
});
// src/events.ts
var createEventsSensor = (init, key, events) => (ui) => {
  const { host } = ui;
  let value = getFallback(ui, init);
  const targets = isMemo(ui[key]) ? ui[key].get() : [ui[key]];
  const eventMap = new Map;
  const getTarget = (eventTarget) => {
    for (const t of targets)
      if (t.contains(eventTarget))
        return t;
  };
  return createSensor((set) => {
    for (const [type, handler] of Object.entries(events)) {
      const options = { passive: PASSIVE_EVENTS.has(type) };
      const listener = (e) => {
        const eventTarget = e.target;
        if (!eventTarget)
          return;
        const target = getTarget(eventTarget);
        if (!target)
          return;
        e.stopPropagation();
        const task = () => {
          try {
            const next = handler({
              event: e,
              ui,
              target,
              prev: value
            });
            if (next == null || next instanceof Promise)
              return;
            if (!Object.is(next, value)) {
              value = next;
              set(next);
            }
          } catch (error) {
            e.stopImmediatePropagation();
            throw error;
          }
        };
        if (options.passive)
          schedule(host, task);
        else
          task();
      };
      eventMap.set(type, listener);
      host.addEventListener(type, listener, options);
    }
    return () => {
      if (eventMap.size) {
        for (const [type, listener] of eventMap)
          host.removeEventListener(type, listener);
        eventMap.clear();
      }
    };
  }, { value });
};
// src/parsers/boolean.ts
var asBoolean = () => (_, value) => value != null && value !== "false";
// src/parsers/json.ts
var asJSON = (fallback) => (ui, value) => {
  if ((value ?? fallback) == null)
    throw new TypeError("asJSON: Value and fallback are both null or undefined");
  if (value == null)
    return getFallback(ui, fallback);
  if (value === "")
    throw new TypeError("Empty string is not valid JSON");
  let result;
  try {
    result = JSON.parse(value);
  } catch (error) {
    throw new SyntaxError(`Failed to parse JSON: ${String(error)}`, {
      cause: error
    });
  }
  return result ?? getFallback(ui, fallback);
};
// src/parsers/number.ts
var parseNumber = (parseFn, value) => {
  if (value == null)
    return;
  const parsed = parseFn(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
var asInteger = (fallback = 0) => (ui, value) => {
  if (value == null)
    return getFallback(ui, fallback);
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("0x"))
    return parseNumber((v) => parseInt(v, 16), trimmed) ?? getFallback(ui, fallback);
  const parsed = parseNumber(parseFloat, value);
  return parsed != null ? Math.trunc(parsed) : getFallback(ui, fallback);
};
var asNumber = (fallback = 0) => (ui, value) => parseNumber(parseFloat, value) ?? getFallback(ui, fallback);
// src/parsers/string.ts
var asString = (fallback = "") => (ui, value) => value ?? getFallback(ui, fallback);
var asEnum = (valid) => (_, value) => {
  if (value == null)
    return valid[0];
  const lowerValue = value.toLowerCase();
  const matchingValid = valid.find((v) => v.toLowerCase() === lowerValue);
  return matchingValid ? value : valid[0];
};
export {
  valueString,
  updateElement,
  toggleClass,
  toggleAttribute,
  show,
  setText,
  setStyle,
  setProperty,
  setAttribute,
  schedule,
  runElementEffects,
  runEffects,
  requestContext,
  read,
  provideContexts,
  pass,
  on,
  match,
  isTask,
  isStore,
  isState,
  isSignal,
  isRecord,
  isParser,
  isMutableSignal,
  isMemo,
  isList,
  isFunction,
  isEqual,
  isComputed,
  isCollection,
  isAsyncFunction,
  defineComponent,
  dangerouslySetInnerHTML,
  createTask,
  createStore,
  createState,
  createSensor,
  createScope,
  createMutableSignal,
  createMemo,
  createList,
  createEventsSensor,
  createElementsMemo,
  createEffect,
  createComputed,
  createCollection,
  batch,
  asString,
  asNumber,
  asJSON,
  asInteger,
  asEnum,
  asBoolean,
  NullishSignalValueError,
  MissingElementError,
  InvalidSignalValueError,
  InvalidReactivesError,
  InvalidPropertyNameError,
  InvalidEffectsError,
  InvalidCustomElementError,
  InvalidComponentNameError,
  InvalidCallbackError,
  DependencyTimeoutError,
  ContextRequestEvent,
  CircularMutationError,
  CircularDependencyError,
  CONTEXT_REQUEST
};

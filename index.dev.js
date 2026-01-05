// node_modules/@zeix/cause-effect/src/util.ts
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isSymbol = (value) => typeof value === "symbol";
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isSyncFunction = (fn) => isFunction(fn) && fn.constructor.name !== "AsyncFunction";
var isNonNullObject = (value) => value != null && typeof value === "object";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var isRecordOrArray = (value) => isRecord(value) || Array.isArray(value);
var isUniformArray = (value, guard = (item) => item != null) => Array.isArray(value) && value.every(guard);
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var valueString = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);

// node_modules/@zeix/cause-effect/src/system.ts
var activeWatcher;
var unwatchMap = new WeakMap;
var pendingReactions = new Set;
var batchDepth = 0;
var UNSET = Symbol();
var HOOK_ADD = "add";
var HOOK_CHANGE = "change";
var HOOK_CLEANUP = "cleanup";
var HOOK_REMOVE = "remove";
var HOOK_SORT = "sort";
var HOOK_WATCH = "watch";
var createWatcher = (react) => {
  const cleanups = new Set;
  const watcher = react;
  watcher.on = (type, cleanup) => {
    if (type === HOOK_CLEANUP)
      cleanups.add(cleanup);
    else
      throw new InvalidHookError("watcher", type);
  };
  watcher.stop = () => {
    try {
      for (const cleanup of cleanups)
        cleanup();
    } finally {
      cleanups.clear();
    }
  };
  return watcher;
};
var subscribeActiveWatcher = (watchers, watchHookCallbacks) => {
  if (!watchers.size && watchHookCallbacks?.size) {
    const unwatch = triggerHook(watchHookCallbacks);
    if (unwatch) {
      const unwatchCallbacks = unwatchMap.get(watchers) ?? new Set;
      unwatchCallbacks.add(unwatch);
      if (!unwatchMap.has(watchers))
        unwatchMap.set(watchers, unwatchCallbacks);
    }
  }
  if (activeWatcher && !watchers.has(activeWatcher)) {
    const watcher = activeWatcher;
    watcher.on(HOOK_CLEANUP, () => {
      watchers.delete(watcher);
      if (!watchers.size) {
        const unwatchCallbacks = unwatchMap.get(watchers);
        if (unwatchCallbacks) {
          try {
            for (const unwatch of unwatchCallbacks)
              unwatch();
          } finally {
            unwatchCallbacks.clear();
            unwatchMap.delete(watchers);
          }
        }
      }
    });
    watchers.add(watcher);
  }
};
var notifyWatchers = (watchers) => {
  if (!watchers.size)
    return false;
  for (const react of watchers) {
    if (batchDepth)
      pendingReactions.add(react);
    else
      react();
  }
  return true;
};
var flushPendingReactions = () => {
  while (pendingReactions.size) {
    const watchers = Array.from(pendingReactions);
    pendingReactions.clear();
    for (const watcher of watchers)
      watcher();
  }
};
var batchSignalWrites = (callback) => {
  batchDepth++;
  try {
    callback();
  } finally {
    flushPendingReactions();
    batchDepth--;
  }
};
var trackSignalReads = (watcher, run) => {
  const prev = activeWatcher;
  activeWatcher = watcher || undefined;
  try {
    run();
  } finally {
    activeWatcher = prev;
  }
};
var triggerHook = (callbacks, payload) => {
  if (!callbacks)
    return;
  const cleanups = [];
  const errors = [];
  const throwError = (inCleanup) => {
    if (errors.length) {
      if (errors.length === 1)
        throw errors[0];
      throw new AggregateError(errors, `Errors in hook ${inCleanup ? "cleanup" : "callback"}:`);
    }
  };
  for (const callback of callbacks) {
    try {
      const cleanup = callback(payload);
      if (isFunction(cleanup))
        cleanups.push(cleanup);
    } catch (error) {
      errors.push(createError(error));
    }
  }
  throwError();
  if (!cleanups.length)
    return;
  if (cleanups.length === 1)
    return cleanups[0];
  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (error) {
        errors.push(createError(error));
      }
    }
    throwError(true);
  };
};
var isHandledHook = (type, handled) => handled.includes(type);

// node_modules/@zeix/cause-effect/src/diff.ts
var isEqual = (a, b, visited) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (!isNonNullObject(a) || !isNonNullObject(b))
    return false;
  if (!visited)
    visited = new WeakSet;
  if (visited.has(a) || visited.has(b))
    throw new CircularDependencyError("isEqual");
  visited.add(a);
  visited.add(b);
  try {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0;i < a.length; i++) {
        if (!isEqual(a[i], b[i], visited))
          return false;
      }
      return true;
    }
    if (Array.isArray(a) !== Array.isArray(b))
      return false;
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
};
var diff = (oldObj, newObj) => {
  const oldValid = isRecordOrArray(oldObj);
  const newValid = isRecordOrArray(newObj);
  if (!oldValid || !newValid) {
    const changed = !Object.is(oldObj, newObj);
    return {
      changed,
      add: changed && newValid ? newObj : {},
      change: {},
      remove: changed && oldValid ? oldObj : {}
    };
  }
  const visited = new WeakSet;
  const add = {};
  const change = {};
  const remove = {};
  const oldKeys = Object.keys(oldObj);
  const newKeys = Object.keys(newObj);
  const allKeys = new Set([...oldKeys, ...newKeys]);
  for (const key of allKeys) {
    const oldHas = key in oldObj;
    const newHas = key in newObj;
    if (!oldHas && newHas) {
      add[key] = newObj[key];
      continue;
    } else if (oldHas && !newHas) {
      remove[key] = UNSET;
      continue;
    }
    const oldValue = oldObj[key];
    const newValue = newObj[key];
    if (!isEqual(oldValue, newValue, visited))
      change[key] = newValue;
  }
  return {
    add,
    change,
    remove,
    changed: !!(Object.keys(add).length || Object.keys(change).length || Object.keys(remove).length)
  };
};

// node_modules/@zeix/cause-effect/src/classes/computed.ts
var TYPE_COMPUTED = "Computed";

class Memo {
  #watchers = new Set;
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #watcher;
  #watchHookCallbacks;
  constructor(callback, initialValue = UNSET) {
    validateCallback(this.constructor.name, callback, isMemoCallback);
    validateSignalValue(this.constructor.name, initialValue);
    this.#callback = callback;
    this.#value = initialValue;
  }
  #getWatcher() {
    if (!this.#watcher) {
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        if (!notifyWatchers(this.#watchers))
          this.#watcher?.stop();
      });
      this.#watcher.on(HOOK_CLEANUP, () => {
        this.#watcher = undefined;
      });
    }
    return this.#watcher;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks);
    flushPendingReactions();
    if (this.#dirty) {
      const watcher = this.#getWatcher();
      trackSignalReads(watcher, () => {
        if (this.#computing)
          throw new CircularDependencyError("memo");
        let result;
        this.#computing = true;
        try {
          result = this.#callback(this.#value);
        } catch (e) {
          this.#value = UNSET;
          this.#error = createError(e);
          this.#computing = false;
          return;
        }
        if (result == null || UNSET === result) {
          this.#value = UNSET;
          this.#error = undefined;
        } else {
          this.#value = result;
          this.#error = undefined;
          this.#dirty = false;
        }
        this.#computing = false;
      });
    }
    if (this.#error)
      throw this.#error;
    return this.#value;
  }
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#watchHookCallbacks ||= new Set;
      this.#watchHookCallbacks.add(callback);
      return () => {
        this.#watchHookCallbacks?.delete(callback);
      };
    }
    throw new InvalidHookError(this.constructor.name, type);
  }
}

class Task {
  #watchers = new Set;
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #changed = false;
  #watcher;
  #controller;
  #watchHookCallbacks;
  constructor(callback, initialValue = UNSET) {
    validateCallback(this.constructor.name, callback, isTaskCallback);
    validateSignalValue(this.constructor.name, initialValue);
    this.#callback = callback;
    this.#value = initialValue;
  }
  #getWatcher() {
    if (!this.#watcher) {
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        this.#controller?.abort();
        if (!notifyWatchers(this.#watchers))
          this.#watcher?.stop();
      });
      this.#watcher.on(HOOK_CLEANUP, () => {
        this.#controller?.abort();
        this.#controller = undefined;
        this.#watcher = undefined;
      });
    }
    return this.#watcher;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks);
    flushPendingReactions();
    const ok = (v) => {
      if (!isEqual(v, this.#value)) {
        this.#value = v;
        this.#changed = true;
      }
      this.#error = undefined;
      this.#dirty = false;
    };
    const nil = () => {
      this.#changed = UNSET !== this.#value;
      this.#value = UNSET;
      this.#error = undefined;
    };
    const err = (e) => {
      const newError = createError(e);
      this.#changed = !this.#error || newError.name !== this.#error.name || newError.message !== this.#error.message;
      this.#value = UNSET;
      this.#error = newError;
    };
    const settle = (fn) => (arg) => {
      this.#computing = false;
      this.#controller = undefined;
      fn(arg);
      if (this.#changed && !notifyWatchers(this.#watchers))
        this.#watcher?.stop();
    };
    const compute = () => trackSignalReads(this.#getWatcher(), () => {
      if (this.#computing)
        throw new CircularDependencyError("task");
      this.#changed = false;
      if (this.#controller)
        return this.#value;
      this.#controller = new AbortController;
      this.#controller.signal.addEventListener("abort", () => {
        this.#computing = false;
        this.#controller = undefined;
        compute();
      }, {
        once: true
      });
      let result;
      this.#computing = true;
      try {
        result = this.#callback(this.#value, this.#controller.signal);
      } catch (e) {
        if (isAbortError(e))
          nil();
        else
          err(e);
        this.#computing = false;
        return;
      }
      if (result instanceof Promise)
        result.then(settle(ok), settle(err));
      else if (result == null || UNSET === result)
        nil();
      else
        ok(result);
      this.#computing = false;
    });
    if (this.#dirty)
      compute();
    if (this.#error)
      throw this.#error;
    return this.#value;
  }
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#watchHookCallbacks ||= new Set;
      this.#watchHookCallbacks.add(callback);
      return () => {
        this.#watchHookCallbacks?.delete(callback);
      };
    }
    throw new InvalidHookError(this.constructor.name, type);
  }
}
var createComputed = (callback, initialValue = UNSET) => isAsyncFunction(callback) ? new Task(callback, initialValue) : new Memo(callback, initialValue);
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isMemoCallback = (value) => isSyncFunction(value) && value.length < 2;
var isTaskCallback = (value) => isAsyncFunction(value) && value.length < 3;

// node_modules/@zeix/cause-effect/src/classes/composite.ts
class Composite {
  signals = new Map;
  #validate;
  #create;
  #watchers = new Map;
  #hookCallbacks = {};
  #batching = false;
  constructor(values, validate, create) {
    this.#validate = validate;
    this.#create = create;
    this.change({
      add: values,
      change: {},
      remove: {},
      changed: true
    }, true);
  }
  #addWatcher(key) {
    const watcher = createWatcher(() => {
      trackSignalReads(watcher, () => {
        this.signals.get(key)?.get();
        if (!this.#batching)
          triggerHook(this.#hookCallbacks.change, [key]);
      });
    });
    this.#watchers.set(key, watcher);
    watcher();
  }
  add(key, value) {
    if (!this.#validate(key, value))
      return false;
    this.signals.set(key, this.#create(value));
    if (this.#hookCallbacks.change?.size)
      this.#addWatcher(key);
    if (!this.#batching)
      triggerHook(this.#hookCallbacks.add, [key]);
    return true;
  }
  remove(key) {
    const ok = this.signals.delete(key);
    if (!ok)
      return false;
    const watcher = this.#watchers.get(key);
    if (watcher) {
      watcher.stop();
      this.#watchers.delete(key);
    }
    if (!this.#batching)
      triggerHook(this.#hookCallbacks.remove, [key]);
    return true;
  }
  change(changes, initialRun) {
    this.#batching = true;
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.add(key, changes.add[key]);
      const notify = () => triggerHook(this.#hookCallbacks.add, Object.keys(changes.add));
      if (initialRun)
        setTimeout(notify, 0);
      else
        notify();
    }
    if (Object.keys(changes.change).length) {
      batchSignalWrites(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!this.#validate(key, value))
            continue;
          const signal = this.signals.get(key);
          if (guardMutableSignal(`list item "${key}"`, value, signal))
            signal.set(value);
        }
      });
      triggerHook(this.#hookCallbacks.change, Object.keys(changes.change));
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        this.remove(key);
      triggerHook(this.#hookCallbacks.remove, Object.keys(changes.remove));
    }
    this.#batching = false;
    return changes.changed;
  }
  clear() {
    const keys = Array.from(this.signals.keys());
    this.signals.clear();
    this.#watchers.clear();
    triggerHook(this.#hookCallbacks.remove, keys);
    return true;
  }
  on(type, callback) {
    if (!isHandledHook(type, [HOOK_ADD, HOOK_CHANGE, HOOK_REMOVE]))
      throw new InvalidHookError("Composite", type);
    this.#hookCallbacks[type] ||= new Set;
    this.#hookCallbacks[type].add(callback);
    if (type === HOOK_CHANGE && !this.#watchers.size) {
      this.#batching = true;
      for (const key of this.signals.keys())
        this.#addWatcher(key);
      this.#batching = false;
    }
    return () => {
      this.#hookCallbacks[type]?.delete(callback);
      if (type === HOOK_CHANGE && !this.#hookCallbacks.change?.size) {
        if (this.#watchers.size) {
          for (const watcher of this.#watchers.values())
            watcher.stop();
          this.#watchers.clear();
        }
      }
    };
  }
}

// node_modules/@zeix/cause-effect/src/classes/state.ts
var TYPE_STATE = "State";

class State {
  #watchers = new Set;
  #value;
  #watchHookCallbacks;
  constructor(initialValue) {
    validateSignalValue(TYPE_STATE, initialValue);
    this.#value = initialValue;
  }
  get [Symbol.toStringTag]() {
    return TYPE_STATE;
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks);
    return this.#value;
  }
  set(newValue) {
    validateSignalValue(TYPE_STATE, newValue);
    if (isEqual(this.#value, newValue))
      return;
    this.#value = newValue;
    if (this.#watchers.size)
      notifyWatchers(this.#watchers);
    if (UNSET === this.#value)
      this.#watchers.clear();
  }
  update(updater) {
    validateCallback(`${TYPE_STATE} update`, updater);
    this.set(updater(this.#value));
  }
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#watchHookCallbacks ||= new Set;
      this.#watchHookCallbacks.add(callback);
      return () => {
        this.#watchHookCallbacks?.delete(callback);
      };
    }
    throw new InvalidHookError(this.constructor.name, type);
  }
}
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// node_modules/@zeix/cause-effect/src/classes/list.ts
var TYPE_LIST = "List";

class List {
  #composite;
  #watchers = new Set;
  #hookCallbacks = {};
  #order = [];
  #generateKey;
  constructor(initialValue, keyConfig) {
    validateSignalValue(TYPE_LIST, initialValue, Array.isArray);
    let keyCounter = 0;
    this.#generateKey = isString(keyConfig) ? () => `${keyConfig}${keyCounter++}` : isFunction(keyConfig) ? (item) => keyConfig(item) : () => String(keyCounter++);
    this.#composite = new Composite(this.#toRecord(initialValue), (key, value) => {
      validateSignalValue(`${TYPE_LIST} for key "${key}"`, value);
      return true;
    }, (value) => new State(value));
  }
  #toRecord(array) {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const value = array[i];
      if (value === undefined)
        continue;
      let key = this.#order[i];
      if (!key) {
        key = this.#generateKey(value);
        this.#order[i] = key;
      }
      record[key] = value;
    }
    return record;
  }
  get #value() {
    return this.#order.map((key) => this.#composite.signals.get(key)?.get()).filter((v) => v !== undefined);
  }
  get [Symbol.toStringTag]() {
    return TYPE_LIST;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#order) {
      const signal = this.#composite.signals.get(key);
      if (signal)
        yield signal;
    }
  }
  get length() {
    subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH]);
    return this.#order.length;
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH]);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#composite.clear();
      notifyWatchers(this.#watchers);
      this.#watchers.clear();
      return;
    }
    const oldValue = this.#value;
    const changes = diff(this.#toRecord(oldValue), this.#toRecord(newValue));
    const removedKeys = Object.keys(changes.remove);
    const changed = this.#composite.change(changes);
    if (changed) {
      for (const key of removedKeys) {
        const index = this.#order.indexOf(key);
        if (index !== -1)
          this.#order.splice(index, 1);
      }
      this.#order = this.#order.filter(() => true);
      notifyWatchers(this.#watchers);
    }
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  at(index) {
    return this.#composite.signals.get(this.#order[index]);
  }
  keys() {
    return this.#order.values();
  }
  byKey(key) {
    return this.#composite.signals.get(key);
  }
  keyAt(index) {
    return this.#order[index];
  }
  indexOfKey(key) {
    return this.#order.indexOf(key);
  }
  add(value) {
    const key = this.#generateKey(value);
    if (this.#composite.signals.has(key))
      throw new DuplicateKeyError("store", key, value);
    if (!this.#order.includes(key))
      this.#order.push(key);
    const ok = this.#composite.add(key, value);
    if (ok)
      notifyWatchers(this.#watchers);
    return key;
  }
  remove(keyOrIndex) {
    const key = isNumber(keyOrIndex) ? this.#order[keyOrIndex] : keyOrIndex;
    const ok = this.#composite.remove(key);
    if (ok) {
      const index = isNumber(keyOrIndex) ? keyOrIndex : this.#order.indexOf(key);
      if (index >= 0)
        this.#order.splice(index, 1);
      this.#order = this.#order.filter(() => true);
      notifyWatchers(this.#watchers);
    }
  }
  sort(compareFn) {
    const entries = this.#order.map((key) => [key, this.#composite.signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
    const newOrder = entries.map(([key]) => key);
    if (!isEqual(this.#order, newOrder)) {
      this.#order = newOrder;
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.sort, this.#order);
    }
  }
  splice(start, deleteCount, ...items) {
    const length = this.#order.length;
    const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
    const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
    const add = {};
    const remove = {};
    for (let i = 0;i < actualDeleteCount; i++) {
      const index = actualStart + i;
      const key = this.#order[index];
      if (key) {
        const signal = this.#composite.signals.get(key);
        if (signal)
          remove[key] = signal.get();
      }
    }
    const newOrder = this.#order.slice(0, actualStart);
    for (const item of items) {
      const key = this.#generateKey(item);
      newOrder.push(key);
      add[key] = item;
    }
    newOrder.push(...this.#order.slice(actualStart + actualDeleteCount));
    const changed = !!(Object.keys(add).length || Object.keys(remove).length);
    if (changed) {
      this.#composite.change({
        add,
        change: {},
        remove,
        changed
      });
      this.#order = newOrder.filter(() => true);
      notifyWatchers(this.#watchers);
    }
    return Object.values(remove);
  }
  on(type, callback) {
    if (isHandledHook(type, [HOOK_SORT, HOOK_WATCH])) {
      this.#hookCallbacks[type] ||= new Set;
      this.#hookCallbacks[type].add(callback);
      return () => {
        this.#hookCallbacks[type]?.delete(callback);
      };
    } else if (isHandledHook(type, [HOOK_ADD, HOOK_CHANGE, HOOK_REMOVE])) {
      return this.#composite.on(type, callback);
    }
    throw new InvalidHookError(TYPE_LIST, type);
  }
  deriveCollection(callback) {
    return new DerivedCollection(this, callback);
  }
}
var isList = (value) => isObjectOfType(value, TYPE_LIST);

// node_modules/@zeix/cause-effect/src/classes/store.ts
var TYPE_STORE = "Store";

class BaseStore {
  #composite;
  #watchers = new Set;
  #watchHookCallbacks;
  constructor(initialValue) {
    validateSignalValue(TYPE_STORE, initialValue, isRecord);
    this.#composite = new Composite(initialValue, (key, value) => {
      validateSignalValue(`${TYPE_STORE} for key "${key}"`, value);
      return true;
    }, (value) => createMutableSignal(value));
  }
  get #value() {
    const record = {};
    for (const [key, signal] of this.#composite.signals.entries())
      record[key] = signal.get();
    return record;
  }
  get [Symbol.toStringTag]() {
    return TYPE_STORE;
  }
  get [Symbol.isConcatSpreadable]() {
    return false;
  }
  *[Symbol.iterator]() {
    for (const [key, signal] of this.#composite.signals.entries())
      yield [key, signal];
  }
  keys() {
    return this.#composite.signals.keys();
  }
  byKey(key) {
    return this.#composite.signals.get(key);
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#composite.clear();
      notifyWatchers(this.#watchers);
      this.#watchers.clear();
      return;
    }
    const oldValue = this.#value;
    const changed = this.#composite.change(diff(oldValue, newValue));
    if (changed)
      notifyWatchers(this.#watchers);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  add(key, value) {
    if (this.#composite.signals.has(key))
      throw new DuplicateKeyError(TYPE_STORE, key, value);
    const ok = this.#composite.add(key, value);
    if (ok)
      notifyWatchers(this.#watchers);
    return key;
  }
  remove(key) {
    const ok = this.#composite.remove(key);
    if (ok)
      notifyWatchers(this.#watchers);
  }
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#watchHookCallbacks ||= new Set;
      this.#watchHookCallbacks.add(callback);
      return () => {
        this.#watchHookCallbacks?.delete(callback);
      };
    } else if (isHandledHook(type, [HOOK_ADD, HOOK_CHANGE, HOOK_REMOVE])) {
      return this.#composite.on(type, callback);
    }
    throw new InvalidHookError(TYPE_STORE, type);
  }
}
var createStore = (initialValue) => {
  const instance = new BaseStore(initialValue);
  return new Proxy(instance, {
    get(target, prop) {
      if (prop in target) {
        const value = Reflect.get(target, prop);
        return isFunction(value) ? value.bind(target) : value;
      }
      if (!isSymbol(prop))
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
      if (isSymbol(prop))
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
};
var isStore = (value) => isObjectOfType(value, TYPE_STORE);

// node_modules/@zeix/cause-effect/src/signal.ts
var isSignal = (value) => isState(value) || isComputed(value) || isStore(value);
var isMutableSignal = (value) => isState(value) || isStore(value) || isList(value);
function createSignal(value) {
  if (isMemoCallback(value))
    return new Memo(value);
  if (isTaskCallback(value))
    return new Task(value);
  if (isUniformArray(value))
    return new List(value);
  if (isRecord(value))
    return createStore(value);
  return new State(value);
}
function createMutableSignal(value) {
  if (isUniformArray(value))
    return new List(value);
  if (isRecord(value))
    return createStore(value);
  return new State(value);
}

// node_modules/@zeix/cause-effect/src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency detected in ${where}`);
    this.name = "CircularDependencyError";
  }
}

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`Could not add ${where} key "${key}"${value ? ` with value ${valueString(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}

class InvalidCallbackError extends TypeError {
  constructor(where, value) {
    super(`Invalid ${where} callback ${valueString(value)}`);
    this.name = "InvalidCallbackError";
  }
}

class InvalidCollectionSourceError extends TypeError {
  constructor(where, value) {
    super(`Invalid ${where} source ${valueString(value)}`);
    this.name = "InvalidCollectionSourceError";
  }
}

class InvalidHookError extends TypeError {
  constructor(where, type) {
    super(`Invalid hook "${type}" in  ${where}`);
    this.name = "InvalidHookError";
  }
}

class InvalidSignalValueError extends TypeError {
  constructor(where, value) {
    super(`Invalid signal value ${valueString(value)} in ${where}`);
    this.name = "InvalidSignalValueError";
  }
}

class NullishSignalValueError extends TypeError {
  constructor(where) {
    super(`Nullish signal values are not allowed in ${where}`);
    this.name = "NullishSignalValueError";
  }
}

class ReadonlySignalError extends Error {
  constructor(what, value) {
    super(`Could not set ${what} to ${valueString(value)} because signal is read-only`);
    this.name = "ReadonlySignalError";
  }
}
var createError = (reason) => reason instanceof Error ? reason : Error(String(reason));
var validateCallback = (where, value, guard = isFunction) => {
  if (!guard(value))
    throw new InvalidCallbackError(where, value);
};
var validateSignalValue = (where, value, guard = () => !(isSymbol(value) && value !== UNSET) || isFunction(value)) => {
  if (value == null)
    throw new NullishSignalValueError(where);
  if (!guard(value))
    throw new InvalidSignalValueError(where, value);
};
var guardMutableSignal = (what, value, signal) => {
  if (!isMutableSignal(signal))
    throw new ReadonlySignalError(what, value);
  return true;
};

// node_modules/@zeix/cause-effect/src/classes/collection.ts
var TYPE_COLLECTION = "Collection";

class DerivedCollection {
  #watchers = new Set;
  #source;
  #callback;
  #signals = new Map;
  #ownWatchers = new Map;
  #hookCallbacks = {};
  #order = [];
  constructor(source, callback) {
    validateCallback(TYPE_COLLECTION, callback);
    if (isFunction(source))
      source = source();
    if (!isCollectionSource(source))
      throw new InvalidCollectionSourceError(TYPE_COLLECTION, source);
    this.#source = source;
    this.#callback = callback;
    for (let i = 0;i < this.#source.length; i++) {
      const key = this.#source.keyAt(i);
      if (!key)
        continue;
      this.#add(key);
    }
    this.#source.on(HOOK_ADD, (additions) => {
      if (!additions)
        return;
      for (const key of additions) {
        if (!this.#signals.has(key)) {
          this.#add(key);
          const signal = this.#signals.get(key);
          if (signal && isAsyncCollectionCallback(this.#callback))
            signal.get();
        }
      }
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.add, additions);
    });
    this.#source.on(HOOK_REMOVE, (removals) => {
      if (!removals)
        return;
      for (const key of removals) {
        if (!this.#signals.has(key))
          continue;
        this.#signals.delete(key);
        const index = this.#order.indexOf(key);
        if (index >= 0)
          this.#order.splice(index, 1);
        const watcher = this.#ownWatchers.get(key);
        if (watcher) {
          watcher.stop();
          this.#ownWatchers.delete(key);
        }
      }
      this.#order = this.#order.filter(() => true);
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.remove, removals);
    });
    this.#source.on(HOOK_SORT, (newOrder) => {
      if (newOrder)
        this.#order = [...newOrder];
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.sort, newOrder);
    });
  }
  #add(key) {
    const computedCallback = isAsyncCollectionCallback(this.#callback) ? async (_, abort) => {
      const sourceValue = this.#source.byKey(key)?.get();
      if (sourceValue === UNSET)
        return UNSET;
      return this.#callback(sourceValue, abort);
    } : () => {
      const sourceValue = this.#source.byKey(key)?.get();
      if (sourceValue === UNSET)
        return UNSET;
      return this.#callback(sourceValue);
    };
    const signal = createComputed(computedCallback);
    this.#signals.set(key, signal);
    if (!this.#order.includes(key))
      this.#order.push(key);
    if (this.#hookCallbacks.change?.size)
      this.#addWatcher(key);
    return true;
  }
  #addWatcher(key) {
    const watcher = createWatcher(() => {
      trackSignalReads(watcher, () => {
        this.#signals.get(key)?.get();
      });
    });
    this.#ownWatchers.set(key, watcher);
    watcher();
  }
  get [Symbol.toStringTag]() {
    return TYPE_COLLECTION;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#order) {
      const signal = this.#signals.get(key);
      if (signal)
        yield signal;
    }
  }
  keys() {
    return this.#order.values();
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH]);
    return this.#order.map((key) => this.#signals.get(key)?.get()).filter((v) => v != null && v !== UNSET);
  }
  at(index) {
    return this.#signals.get(this.#order[index]);
  }
  byKey(key) {
    return this.#signals.get(key);
  }
  keyAt(index) {
    return this.#order[index];
  }
  indexOfKey(key) {
    return this.#order.indexOf(key);
  }
  on(type, callback) {
    if (isHandledHook(type, [
      HOOK_ADD,
      HOOK_CHANGE,
      HOOK_REMOVE,
      HOOK_SORT,
      HOOK_WATCH
    ])) {
      this.#hookCallbacks[type] ||= new Set;
      this.#hookCallbacks[type].add(callback);
      if (type === HOOK_CHANGE && !this.#ownWatchers.size) {
        for (const key of this.#signals.keys())
          this.#addWatcher(key);
      }
      return () => {
        this.#hookCallbacks[type]?.delete(callback);
        if (type === HOOK_CHANGE && !this.#hookCallbacks.change?.size) {
          if (this.#ownWatchers.size) {
            for (const watcher of this.#ownWatchers.values())
              watcher.stop();
            this.#ownWatchers.clear();
          }
        }
      };
    }
    throw new InvalidHookError(TYPE_COLLECTION, type);
  }
  deriveCollection(callback) {
    return new DerivedCollection(this, callback);
  }
  get length() {
    subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH]);
    return this.#order.length;
  }
}
var isCollection = (value) => isObjectOfType(value, TYPE_COLLECTION);
var isCollectionSource = (value) => isList(value) || isCollection(value);
var isAsyncCollectionCallback = (callback) => isAsyncFunction(callback);
// node_modules/@zeix/cause-effect/src/classes/ref.ts
var TYPE_REF = "Ref";

class Ref {
  #watchers = new Set;
  #value;
  #watchHookCallbacks;
  constructor(value, guard) {
    validateSignalValue(TYPE_REF, value, guard);
    this.#value = value;
  }
  get [Symbol.toStringTag]() {
    return TYPE_REF;
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#watchHookCallbacks);
    return this.#value;
  }
  notify() {
    notifyWatchers(this.#watchers);
  }
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#watchHookCallbacks ||= new Set;
      this.#watchHookCallbacks.add(callback);
      return () => {
        this.#watchHookCallbacks?.delete(callback);
      };
    }
    throw new InvalidHookError(TYPE_REF, type);
  }
}
// node_modules/@zeix/cause-effect/src/effect.ts
var createEffect = (callback) => {
  if (!isFunction(callback) || callback.length > 1)
    throw new InvalidCallbackError("effect", callback);
  const isAsync = isAsyncFunction(callback);
  let running = false;
  let controller;
  const watcher = createWatcher(() => trackSignalReads(watcher, () => {
    if (running)
      throw new CircularDependencyError("effect");
    running = true;
    controller?.abort();
    controller = undefined;
    let cleanup;
    try {
      if (isAsync) {
        controller = new AbortController;
        const currentController = controller;
        callback(controller.signal).then((cleanup2) => {
          if (isFunction(cleanup2) && controller === currentController)
            watcher.on(HOOK_CLEANUP, cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Error in async effect callback:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          watcher.on(HOOK_CLEANUP, cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Error in effect callback:", error);
    }
    running = false;
  }));
  watcher();
  return () => {
    controller?.abort();
    try {
      watcher.stop();
    } catch (error) {
      console.error("Error in effect cleanup:", error);
    }
  };
};
// node_modules/@zeix/cause-effect/src/match.ts
function match(result, handlers) {
  try {
    if (result.pending)
      handlers.nil?.();
    else if (result.errors)
      handlers.err?.(result.errors);
    else if (result.ok)
      handlers.ok(result.values);
  } catch (e) {
    const error = createError(e);
    if (handlers.err && (!result.errors || !result.errors.includes(error)))
      handlers.err(result.errors ? [...result.errors, error] : [error]);
    else
      throw error;
  }
}
// node_modules/@zeix/cause-effect/src/resolve.ts
function resolve(signals) {
  const errors = [];
  let pending = false;
  const values = {};
  for (const [key, signal] of Object.entries(signals)) {
    try {
      const value = signal.get();
      if (value === UNSET)
        pending = true;
      else
        values[key] = value;
    } catch (e) {
      errors.push(createError(e));
    }
  }
  if (pending)
    return { ok: false, pending: true };
  if (errors.length > 0)
    return { ok: false, errors };
  return { ok: true, values };
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
var isElement = (node) => node.nodeType === Node.ELEMENT_NODE;
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

class InvalidUIKeyError extends TypeError {
  constructor(host, key, where) {
    super(`Invalid UI key "${key}" in ${where} of component ${elementName(host)}`);
    this.name = "InvalidUIKeyError";
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
var runCollectionEffects = (host, collection, effects) => {
  const cleanups = new Map;
  const attach = (keys) => {
    if (!keys)
      return;
    for (const key of keys) {
      const target = collection.byKey(key)?.get();
      if (!target)
        continue;
      const cleanup = runElementEffects(host, target, effects);
      if (cleanup)
        cleanups.set(target, cleanup);
    }
  };
  const detach = (keys) => {
    if (!keys)
      return;
    for (const key of keys) {
      const target = collection.byKey(key)?.get();
      if (!target)
        continue;
      cleanups.get(target)?.();
      cleanups.delete(target);
    }
  };
  collection.on(HOOK_ADD, attach);
  collection.on(HOOK_REMOVE, detach);
  attach(Array.from(collection.keys()));
  return () => {
    for (const cleanup of cleanups.values())
      cleanup();
    cleanups.clear();
  };
};
var runEffects = (ui, effects) => {
  if (!isRecord(effects))
    throw new InvalidEffectsError(ui.host);
  const cleanups = [];
  const keys = Object.keys(effects);
  for (const key of keys) {
    if (!effects[key])
      continue;
    const elementEffects = Array.isArray(effects[key]) ? effects[key] : [effects[key]];
    const targets = ui[key];
    if (isCollection(targets)) {
      cleanups.push(runCollectionEffects(ui.host, targets, elementEffects));
    } else if (targets) {
      const cleanup = runElementEffects(ui.host, targets, elementEffects);
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
    return isString(reactive) ? host[reactive] : isSignal(reactive) ? reactive.get() : isFunction(reactive) ? reactive(target) : RESET;
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
    const resolvedValue = value === RESET ? fallback : value === UNSET ? updater.delete ? null : fallback : value;
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

// src/parsers.ts
var isParser = (value) => isFunction(value) && value.length >= 2;
var isReader = (value) => isFunction(value);
var getFallback = (ui, fallback) => isReader(fallback) ? fallback(ui) : fallback;
var read = (reader, fallback) => (ui) => {
  const value = reader(ui);
  return isString(value) && isParser(fallback) ? fallback(ui, value) : value ?? getFallback(ui, fallback);
};

// src/signals/collection.ts
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

class ElementCollection {
  #watchers = new Set;
  #signals = new Map;
  #hookCallbacks = {};
  #parent;
  #selector;
  #observer;
  #order = [];
  #generateKey;
  constructor(parent, selector, keyConfig) {
    this.#parent = parent;
    this.#selector = selector;
    let keyCounter = 0;
    this.#generateKey = isString(keyConfig) ? () => `${keyConfig}${keyCounter++}` : isFunction(keyConfig) ? (element) => keyConfig(element) : () => String(keyCounter++);
  }
  #keyFor(element) {
    for (const [key, signal] of this.#signals) {
      if (signal.get() === element)
        return key;
    }
    return;
  }
  #observe() {
    Array.from(this.#parent.querySelectorAll(this.#selector)).forEach((element) => {
      const key = this.#generateKey(element);
      this.#signals.set(key, new Ref(element));
    });
    const findMatches = (nodes) => {
      const elements = Array.from(nodes).filter(isElement);
      const found = [];
      for (const element of elements) {
        if (element.matches(this.#selector))
          found.push(element);
        found.push(...Array.from(element.querySelectorAll(this.#selector)));
      }
      return found;
    };
    this.#observer = new MutationObserver((mutations) => {
      const addedElements = [];
      const removedElements = [];
      const addedKeys = [];
      const changedKeys = new Set;
      const removedKeys = [];
      let changed = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const target = mutation.target;
          if (isElement(target)) {
            const key = this.#keyFor(target);
            if (key)
              changedKeys.add(key);
          }
          if (mutation.addedNodes.length)
            addedElements.push(...findMatches(mutation.addedNodes));
          if (mutation.removedNodes.length)
            removedElements.push(...findMatches(mutation.removedNodes));
        } else if (mutation.type === "attributes") {
          const target = mutation.target;
          if (isElement(target)) {
            const key = this.#keyFor(target);
            const isMatching = target.matches(this.#selector);
            if (key && !isMatching) {
              this.#signals.delete(key);
              removedElements.push(target);
              removedKeys.push(key);
            } else if (key && isMatching) {
              changedKeys.add(key);
            } else if (!key && isMatching) {
              const newKey = this.#generateKey(target);
              this.#signals.set(newKey, new Ref(target));
              addedElements.push(target);
              addedKeys.push(newKey);
            }
          }
        }
      }
      batchSignalWrites(() => {
        if (addedKeys.length || removedKeys.length) {
          changed = true;
          if (addedKeys.length)
            triggerHook(this.#hookCallbacks[HOOK_ADD], addedKeys);
          if (removedKeys.length)
            triggerHook(this.#hookCallbacks[HOOK_REMOVE], removedKeys);
        }
        if (this.#hookCallbacks[HOOK_CHANGE]?.size) {
          triggerHook(this.#hookCallbacks[HOOK_CHANGE], Array.from(changedKeys));
          for (const key of changedKeys) {
            if (key)
              this.#signals.get(key)?.notify();
          }
        }
        const newOrder = Array.from(this.#parent.querySelectorAll(this.#selector)).map((element) => this.#keyFor(element)).filter((key) => key !== undefined);
        if (!isEqual(this.#order, newOrder)) {
          this.#order = newOrder;
          changed = true;
          triggerHook(this.#hookCallbacks[HOOK_SORT], newOrder);
        }
        if (changed)
          notifyWatchers(this.#watchers);
      });
    });
    const observerConfig = this.#hookCallbacks[HOOK_CHANGE]?.size ? {
      attributes: true,
      childList: true,
      subtree: true
    } : {
      childList: true,
      subtree: true
    };
    if (!this.#hookCallbacks[HOOK_CHANGE]?.size) {
      const observedAttributes = extractAttributes(this.#selector);
      if (observedAttributes.length) {
        observerConfig.attributes = true;
        observerConfig.attributeFilter = observedAttributes;
      }
    }
    this.#observer.observe(this.#parent, observerConfig);
  }
  get [Symbol.toStringTag]() {
    return TYPE_COLLECTION;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#order) {
      const element = this.#signals.get(key);
      if (element)
        yield element;
    }
  }
  keys() {
    return this.#order.values();
  }
  get() {
    subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH]);
    if (!this.#observer)
      this.#observe();
    return this.#order.map((key) => this.#signals.get(key)?.get()).filter((element) => element !== undefined);
  }
  at(index) {
    return this.#signals.get(this.#order[index]);
  }
  byKey(key) {
    return this.#signals.get(key);
  }
  keyAt(index) {
    return this.#order[index];
  }
  indexOfKey(key) {
    return this.#order.indexOf(key);
  }
  on(type, callback) {
    if (isHandledHook(type, [
      HOOK_ADD,
      HOOK_CHANGE,
      HOOK_REMOVE,
      HOOK_SORT,
      HOOK_WATCH
    ])) {
      this.#hookCallbacks[type] ||= new Set;
      this.#hookCallbacks[type].add(callback);
      if (!this.#observer)
        this.#observe();
      return () => {
        this.#hookCallbacks[type]?.delete(callback);
      };
    }
    throw new InvalidHookError(TYPE_COLLECTION, type);
  }
  deriveCollection(callback) {
    return new DerivedCollection(this, callback);
  }
  get length() {
    subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH]);
    if (!this.#observer)
      this.#observe();
    return this.#signals.size;
  }
}
function createElementCollection(parent, selector, keyConfig) {
  return new ElementCollection(parent, selector, keyConfig);
}

// src/ui.ts
var DEPENDENCY_TIMEOUT = 50;
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
    const collection = createElementCollection(root, selector);
    const targets = collection.get();
    if (required != null && !targets.length)
      throw new MissingElementError(host, selector, required);
    if (targets.length)
      targets.forEach((target) => {
        if (isNotYetDefinedComponent(target))
          dependencies.add(target.localName);
      });
    return collection;
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
    #signals = {};
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
      if (!this.#ui || newValue === oldValue || isComputed(this.#signals[name2]))
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
      const signal = isSignal(value) ? value : isMemoCallback(value) ? new Memo(value) : isTaskCallback(value) ? new Task(value) : new State(value);
      const prev = this.#signals[key];
      const mutable = isMutableSignal(signal);
      this.#signals[key] = signal;
      Object.defineProperty(this, key, {
        get: signal.get,
        set: mutable ? signal.set : undefined,
        enumerable: true,
        configurable: mutable
      });
      if (prev && isState(prev) || isStore(prev))
        prev.set(UNSET);
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
    if (isString(context) && contexts.includes(context) && isFunction(callback)) {
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
  return new Memo(consumed);
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
      batchSignalWrites(() => {
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
  const resetProperties = {};
  const getGetter = (value) => {
    if (isSignal(value))
      return value.get;
    const fn = isString(value) && value in host ? () => host[value] : isMemoCallback(value) ? value : undefined;
    return fn ? new Memo(fn).get : undefined;
  };
  for (const [prop, reactive] of Object.entries(reactives)) {
    if (reactive == null)
      continue;
    const descriptor = Object.getOwnPropertyDescriptor(target, prop);
    if (!(prop in target) || !descriptor?.configurable)
      continue;
    const applied = isFunction(reactive) && reactive.length === 1 ? reactive(target) : reactive;
    const isArray = Array.isArray(applied) && applied.length === 2;
    const getter = getGetter(isArray ? applied[0] : applied);
    const setter = isArray && isFunction(applied[1]) ? applied[1] : undefined;
    if (!getter)
      continue;
    resetProperties[prop] = descriptor;
    Object.defineProperty(target, prop, {
      configurable: true,
      enumerable: true,
      get: getter,
      set: setter
    });
    descriptor.set?.call(target, UNSET);
  }
  return () => {
    Object.defineProperties(target, resetProperties);
  };
};
// src/effects/property.ts
var setProperty = (key, reactive = key) => updateElement(reactive, {
  op: "p",
  name: key,
  read: (el) => (key in el) ? el[key] : UNSET,
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
// src/signals/sensor.ts
function getTarget(targets, eventTarget) {
  const elements = isCollection(targets) ? targets.get() : [targets];
  for (const t of elements)
    if (t.contains(eventTarget))
      return t;
}

class Sensor {
  #watchers = new Set;
  #value;
  #host;
  #events = new Map;
  #cleanup;
  constructor(ui, key, events, initialValue) {
    if (!ui[key])
      throw new InvalidUIKeyError(ui.host, key, "sensor");
    this.#host = ui.host;
    this.#value = initialValue;
    const targets = ui[key];
    for (const [type, handler] of Object.entries(events)) {
      this.#events.set(type, this.#getEventListener(type, handler, ui, targets));
    }
  }
  #getEventListener(type, handler, ui, targets) {
    const isPassive = PASSIVE_EVENTS.has(type);
    return (e) => {
      const eventTarget = e.target;
      if (!eventTarget)
        return;
      const target = getTarget(targets, eventTarget);
      if (!target)
        return;
      e.stopPropagation();
      const task = () => {
        try {
          const next = handler({
            event: e,
            ui,
            target,
            prev: this.#value
          });
          if (next == null || next instanceof Promise)
            return;
          if (!Object.is(next, this.#value)) {
            this.#value = next;
            if (this.#watchers.size)
              notifyWatchers(this.#watchers);
            else if (this.#cleanup)
              this.#cleanup();
          }
        } catch (error) {
          e.stopImmediatePropagation();
          throw error;
        }
      };
      if (isPassive)
        schedule(this.#host, task);
      else
        task();
    };
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    if (this.#watchers.size && !this.#cleanup) {
      for (const [type, listener] of this.#events) {
        const options = { passive: PASSIVE_EVENTS.has(type) };
        this.#host.addEventListener(type, listener, options);
      }
      this.#cleanup = () => {
        for (const [type, listener] of this.#events)
          this.#host.removeEventListener(type, listener);
        this.#cleanup = undefined;
      };
    }
    return this.#value;
  }
}
var createSensor = (init, key, events) => (ui) => {
  const value = getFallback(ui, init);
  return new Sensor(ui, key, events, value);
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
  resolve,
  requestContext,
  read,
  provideContexts,
  pass,
  on,
  match,
  isSymbol,
  isString,
  isStore,
  isState,
  isSignal,
  isRecordOrArray,
  isRecord,
  isParser,
  isNumber,
  isMutableSignal,
  isFunction,
  isEqual,
  isComputed,
  isAsyncFunction,
  isAbortError,
  diff,
  defineComponent,
  dangerouslySetInnerHTML,
  createStore,
  createSignal,
  createSensor,
  createError,
  createEffect,
  createComputed,
  batchSignalWrites,
  asString,
  asNumber,
  asJSON,
  asInteger,
  asEnum,
  asBoolean,
  UNSET,
  Task,
  State,
  Ref,
  ReadonlySignalError,
  NullishSignalValueError,
  MissingElementError,
  Memo,
  List,
  InvalidSignalValueError,
  InvalidReactivesError,
  InvalidPropertyNameError,
  InvalidEffectsError,
  InvalidCustomElementError,
  InvalidComponentNameError,
  InvalidCollectionSourceError,
  InvalidCallbackError,
  DuplicateKeyError,
  DerivedCollection,
  DependencyTimeoutError,
  ContextRequestEvent,
  CircularMutationError,
  CircularDependencyError,
  CONTEXT_REQUEST
};

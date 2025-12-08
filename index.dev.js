// node_modules/@zeix/cause-effect/src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency detected in ${where}`);
    this.name = "CircularDependencyError";
  }
}

class InvalidCallbackError extends TypeError {
  constructor(where, value) {
    super(`Invalid ${where} callback ${value}`);
    this.name = "InvalidCallbackError";
  }
}

class InvalidSignalValueError extends TypeError {
  constructor(where, value) {
    super(`Invalid signal value ${value} in ${where}`);
    this.name = "InvalidSignalValueError";
  }
}

class NullishSignalValueError extends TypeError {
  constructor(where) {
    super(`Nullish signal values are not allowed in ${where}`);
    this.name = "NullishSignalValueError";
  }
}

class StoreKeyExistsError extends Error {
  constructor(key, value) {
    super(`Could not add store key "${key}" with value ${value} because it already exists`);
    this.name = "StoreKeyExistsError";
  }
}

class StoreKeyRangeError extends RangeError {
  constructor(index) {
    super(`Could not remove store index ${String(index)} because it is out of range`);
    this.name = "StoreKeyRangeError";
  }
}

class StoreKeyReadonlyError extends Error {
  constructor(key, value) {
    super(`Could not set store key "${key}" to ${value} because it is readonly`);
    this.name = "StoreKeyReadonlyError";
  }
}

// node_modules/@zeix/cause-effect/src/util.ts
var UNSET = Symbol();
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isSymbol = (value) => typeof value === "symbol";
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var isRecordOrArray = (value) => isRecord(value) || Array.isArray(value);
var validArrayIndexes = (keys) => {
  if (!keys.length)
    return null;
  const indexes = keys.map((k) => isString(k) ? parseInt(k, 10) : isNumber(k) ? k : NaN);
  return indexes.every((index) => Number.isFinite(index) && index >= 0) ? indexes.sort((a, b) => a - b) : null;
};
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var toError = (reason) => reason instanceof Error ? reason : Error(String(reason));
var recordToArray = (record) => {
  const indexes = validArrayIndexes(Object.keys(record));
  if (indexes === null)
    return record;
  const array = [];
  for (const index of indexes)
    array.push(record[String(index)]);
  return array;
};
var valueString = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);

// node_modules/@zeix/cause-effect/src/diff.ts
var isEqual = (a, b, visited) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (typeof a !== "object" || a === null || b === null)
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
    const changed2 = !Object.is(oldObj, newObj);
    return {
      changed: changed2,
      add: changed2 && newValid ? newObj : {},
      change: {},
      remove: changed2 && oldValid ? oldObj : {}
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
  const changed = Object.keys(add).length > 0 || Object.keys(change).length > 0 || Object.keys(remove).length > 0;
  return {
    changed,
    add,
    change,
    remove
  };
};

// node_modules/@zeix/cause-effect/src/system.ts
var activeWatcher;
var pendingWatchers = new Set;
var batchDepth = 0;
var createWatcher = (watch) => {
  const cleanups = new Set;
  const w = watch;
  w.unwatch = (cleanup) => {
    cleanups.add(cleanup);
  };
  w.cleanup = () => {
    for (const cleanup of cleanups)
      cleanup();
    cleanups.clear();
  };
  return w;
};
var subscribe = (watchers) => {
  if (activeWatcher && !watchers.has(activeWatcher)) {
    const watcher = activeWatcher;
    watcher.unwatch(() => {
      watchers.delete(watcher);
    });
    watchers.add(watcher);
  }
};
var notify = (watchers) => {
  for (const watcher of watchers) {
    if (batchDepth)
      pendingWatchers.add(watcher);
    else
      watcher();
  }
};
var flush = () => {
  while (pendingWatchers.size) {
    const watchers = Array.from(pendingWatchers);
    pendingWatchers.clear();
    for (const watcher of watchers)
      watcher();
  }
};
var batch = (fn) => {
  batchDepth++;
  try {
    fn();
  } finally {
    flush();
    batchDepth--;
  }
};
var observe = (run, watcher) => {
  const prev = activeWatcher;
  activeWatcher = watcher;
  try {
    run();
  } finally {
    activeWatcher = prev;
  }
};

// node_modules/@zeix/cause-effect/src/computed.ts
var TYPE_COMPUTED = "Computed";
var createComputed = (callback, initialValue = UNSET) => {
  if (!isComputedCallback(callback))
    throw new InvalidCallbackError("computed", valueString(callback));
  if (initialValue == null)
    throw new NullishSignalValueError("computed");
  const watchers = new Set;
  let value = initialValue;
  let error;
  let controller;
  let dirty = true;
  let changed = false;
  let computing = false;
  const ok = (v) => {
    if (!isEqual(v, value)) {
      value = v;
      changed = true;
    }
    error = undefined;
    dirty = false;
  };
  const nil = () => {
    changed = UNSET !== value;
    value = UNSET;
    error = undefined;
  };
  const err = (e) => {
    const newError = toError(e);
    changed = !error || newError.name !== error.name || newError.message !== error.message;
    value = UNSET;
    error = newError;
  };
  const settle = (fn) => (arg) => {
    computing = false;
    controller = undefined;
    fn(arg);
    if (changed)
      notify(watchers);
  };
  const watcher = createWatcher(() => {
    dirty = true;
    controller?.abort();
    if (watchers.size)
      notify(watchers);
    else
      watcher.cleanup();
  });
  watcher.unwatch(() => {
    controller?.abort();
  });
  const compute = () => observe(() => {
    if (computing)
      throw new CircularDependencyError("computed");
    changed = false;
    if (isAsyncFunction(callback)) {
      if (controller)
        return value;
      controller = new AbortController;
      controller.signal.addEventListener("abort", () => {
        computing = false;
        controller = undefined;
        compute();
      }, {
        once: true
      });
    }
    let result;
    computing = true;
    try {
      result = controller ? callback(value, controller.signal) : callback(value);
    } catch (e) {
      if (isAbortError(e))
        nil();
      else
        err(e);
      computing = false;
      return;
    }
    if (result instanceof Promise)
      result.then(settle(ok), settle(err));
    else if (result == null || UNSET === result)
      nil();
    else
      ok(result);
    computing = false;
  }, watcher);
  const computed = {};
  Object.defineProperties(computed, {
    [Symbol.toStringTag]: {
      value: TYPE_COMPUTED
    },
    get: {
      value: () => {
        subscribe(watchers);
        flush();
        if (dirty)
          compute();
        if (error)
          throw error;
        return value;
      }
    }
  });
  return computed;
};
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isComputedCallback = (value) => isFunction(value) && value.length < 3;
// node_modules/@zeix/cause-effect/src/effect.ts
var createEffect = (callback) => {
  if (!isFunction(callback) || callback.length > 1)
    throw new InvalidCallbackError("effect", valueString(callback));
  const isAsync = isAsyncFunction(callback);
  let running = false;
  let controller;
  const watcher = createWatcher(() => observe(() => {
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
            watcher.unwatch(cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Async effect error:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          watcher.unwatch(cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Effect callback error:", error);
    }
    running = false;
  }, watcher));
  watcher();
  return () => {
    controller?.abort();
    watcher.cleanup();
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
  } catch (error) {
    if (handlers.err && (!result.errors || !result.errors.includes(toError(error))))
      handlers.err(result.errors ? [...result.errors, toError(error)] : [toError(error)]);
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
      errors.push(toError(e));
    }
  }
  if (pending)
    return { ok: false, pending: true };
  if (errors.length > 0)
    return { ok: false, errors };
  return { ok: true, values };
}
// node_modules/@zeix/cause-effect/src/state.ts
var TYPE_STATE = "State";
var createState = (initialValue) => {
  if (initialValue == null)
    throw new NullishSignalValueError("state");
  const watchers = new Set;
  let value = initialValue;
  const setValue = (newValue) => {
    if (newValue == null)
      throw new NullishSignalValueError("state");
    if (isEqual(value, newValue))
      return;
    value = newValue;
    notify(watchers);
    if (UNSET === value)
      watchers.clear();
  };
  const state = {};
  Object.defineProperties(state, {
    [Symbol.toStringTag]: {
      value: TYPE_STATE
    },
    get: {
      value: () => {
        subscribe(watchers);
        return value;
      }
    },
    set: {
      value: (newValue) => {
        setValue(newValue);
      }
    },
    update: {
      value: (updater) => {
        if (!isFunction(updater))
          throw new InvalidCallbackError("state update", valueString(updater));
        setValue(updater(value));
      }
    }
  });
  return state;
};
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// node_modules/@zeix/cause-effect/src/store.ts
var TYPE_STORE = "Store";
var createStore = (initialValue) => {
  if (initialValue == null)
    throw new NullishSignalValueError("store");
  const watchers = new Set;
  const listeners = {
    add: new Set,
    change: new Set,
    remove: new Set,
    sort: new Set
  };
  const signals = new Map;
  const signalWatchers = new Map;
  const isArrayLike = Array.isArray(initialValue);
  const current = () => {
    const record = {};
    for (const [key, signal] of signals)
      record[key] = signal.get();
    return record;
  };
  const emit = (key, changes) => {
    Object.freeze(changes);
    for (const listener of listeners[key])
      listener(changes);
  };
  const getSortedIndexes = () => Array.from(signals.keys()).map((k) => Number(k)).filter((n) => Number.isInteger(n)).sort((a, b) => a - b);
  const isValidValue = (key, value) => {
    if (value == null)
      throw new NullishSignalValueError(`store for key "${key}"`);
    if (value === UNSET)
      return true;
    if (isSymbol(value) || isFunction(value) || isComputed(value))
      throw new InvalidSignalValueError(`store for key "${key}"`, valueString(value));
    return true;
  };
  const addProperty = (key, value, single = false) => {
    if (!isValidValue(key, value))
      return false;
    const signal = isState(value) || isStore(value) ? value : isRecord(value) || Array.isArray(value) ? createStore(value) : createState(value);
    signals.set(key, signal);
    const watcher = createWatcher(() => observe(() => {
      emit("change", { [key]: signal.get() });
    }, watcher));
    watcher();
    signalWatchers.set(key, watcher);
    if (single) {
      notify(watchers);
      emit("add", { [key]: value });
    }
    return true;
  };
  const removeProperty = (key, single = false) => {
    const ok = signals.delete(key);
    if (ok) {
      const watcher = signalWatchers.get(key);
      if (watcher)
        watcher.cleanup();
      signalWatchers.delete(key);
    }
    if (single) {
      notify(watchers);
      emit("remove", { [key]: UNSET });
    }
    return ok;
  };
  const reconcile = (oldValue, newValue, initialRun) => {
    const changes = diff(oldValue, newValue);
    batch(() => {
      if (Object.keys(changes.add).length) {
        for (const key in changes.add)
          addProperty(key, changes.add[key] ?? UNSET);
        if (initialRun) {
          setTimeout(() => {
            emit("add", changes.add);
          }, 0);
        } else {
          emit("add", changes.add);
        }
      }
      if (Object.keys(changes.change).length) {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!isValidValue(key, value))
            continue;
          const signal = signals.get(key);
          if (isMutableSignal(signal))
            signal.set(value);
          else
            throw new StoreKeyReadonlyError(key, valueString(value));
        }
        emit("change", changes.change);
      }
      if (Object.keys(changes.remove).length) {
        for (const key in changes.remove)
          removeProperty(key);
        emit("remove", changes.remove);
      }
    });
    return changes.changed;
  };
  reconcile({}, initialValue, true);
  const store = {};
  Object.defineProperties(store, {
    [Symbol.toStringTag]: {
      value: TYPE_STORE
    },
    [Symbol.isConcatSpreadable]: {
      value: isArrayLike
    },
    [Symbol.iterator]: {
      value: isArrayLike ? function* () {
        const indexes = getSortedIndexes();
        for (const index of indexes) {
          const signal = signals.get(String(index));
          if (signal)
            yield signal;
        }
      } : function* () {
        for (const [key, signal] of signals)
          yield [key, signal];
      }
    },
    add: {
      value: isArrayLike ? (v) => {
        addProperty(String(signals.size), v, true);
      } : (k, v) => {
        if (!signals.has(k))
          addProperty(k, v, true);
        else
          throw new StoreKeyExistsError(k, valueString(v));
      }
    },
    get: {
      value: () => {
        subscribe(watchers);
        return recordToArray(current());
      }
    },
    remove: {
      value: isArrayLike ? (index) => {
        const currentArray = recordToArray(current());
        const currentLength = signals.size;
        if (!Array.isArray(currentArray) || index <= -currentLength || index >= currentLength)
          throw new StoreKeyRangeError(index);
        const newArray = [...currentArray];
        newArray.splice(index, 1);
        if (reconcile(currentArray, newArray))
          notify(watchers);
      } : (k) => {
        if (signals.has(k))
          removeProperty(k, true);
      }
    },
    set: {
      value: (v) => {
        if (reconcile(current(), v)) {
          notify(watchers);
          if (UNSET === v)
            watchers.clear();
        }
      }
    },
    update: {
      value: (fn) => {
        const oldValue = current();
        const newValue = fn(recordToArray(oldValue));
        if (reconcile(oldValue, newValue)) {
          notify(watchers);
          if (UNSET === newValue)
            watchers.clear();
        }
      }
    },
    sort: {
      value: (compareFn) => {
        const entries = Array.from(signals.entries()).map(([key, signal]) => [key, signal.get()]).sort(compareFn ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
        const newOrder = entries.map(([key]) => String(key));
        const newSignals = new Map;
        entries.forEach(([key], newIndex) => {
          const oldKey = String(key);
          const newKey = isArrayLike ? String(newIndex) : String(key);
          const signal = signals.get(oldKey);
          if (signal)
            newSignals.set(newKey, signal);
        });
        signals.clear();
        newSignals.forEach((signal, key) => signals.set(key, signal));
        notify(watchers);
        emit("sort", newOrder);
      }
    },
    on: {
      value: (type, listener) => {
        listeners[type].add(listener);
        return () => listeners[type].delete(listener);
      }
    },
    length: {
      get() {
        subscribe(watchers);
        return signals.size;
      }
    }
  });
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (isSymbol(prop))
        return;
      return signals.get(prop);
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return signals.has(String(prop));
    },
    ownKeys(target) {
      const staticKeys = Reflect.ownKeys(target);
      const signalKeys = isArrayLike ? getSortedIndexes().map((key) => String(key)) : Array.from(signals.keys());
      return [...new Set([...signalKeys, ...staticKeys])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
      const signal = signals.get(String(prop));
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
var isMutableSignal = (value) => isState(value) || isStore(value);
function toSignal(value) {
  if (isSignal(value))
    return value;
  if (isComputedCallback(value))
    return createComputed(value);
  if (Array.isArray(value) || isRecord(value))
    return createStore(value);
  return createState(value);
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
var hasMethod = (obj, methodName) => isString(methodName) && (methodName in obj) && isFunction(obj[methodName]);
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

// src/signals/collection.ts
var TYPE_COLLECTION = "Collection";
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
var createCollection = (parent, selector) => {
  const watchers = new Set;
  const listeners = {
    add: new Set,
    remove: new Set
  };
  let elements = [];
  let observer;
  const filterMatches = (elements2) => Array.from(elements2).filter(isElement).filter((element) => element.matches(selector));
  const notifyListeners = (listeners2, elements2) => {
    Object.freeze(elements2);
    for (const listener of listeners2)
      listener(elements2);
  };
  const observe2 = () => {
    elements = Array.from(parent.querySelectorAll(selector));
    observer = new MutationObserver((mutations) => {
      const added = [];
      const removed = [];
      for (const mutation of mutations) {
        added.push(...filterMatches(mutation.addedNodes));
        removed.push(...filterMatches(mutation.removedNodes));
        for (const node of mutation.addedNodes) {
          if (isElement(node))
            added.push(...Array.from(node.querySelectorAll(selector)));
        }
      }
      if (added.length) {
        notifyListeners(listeners.add, added);
        elements = Array.from(parent.querySelectorAll(selector));
      }
      if (removed.length) {
        notifyListeners(listeners.remove, removed);
        for (const element of removed) {
          const index = elements.indexOf(element);
          if (index !== -1)
            elements.splice(index, 1);
        }
      }
      if (added.length || removed.length)
        notify(watchers);
    });
    const observerConfig = {
      childList: true,
      subtree: true
    };
    const observedAttributes = extractAttributes(selector);
    if (observedAttributes.length) {
      observerConfig.attributes = true;
      observerConfig.attributeFilter = observedAttributes;
    }
    observer.observe(parent, observerConfig);
  };
  const collection = {};
  Object.defineProperties(collection, {
    [Symbol.toStringTag]: {
      value: TYPE_COLLECTION
    },
    [Symbol.isConcatSpreadable]: {
      value: true
    },
    [Symbol.iterator]: {
      value: function* () {
        for (const element of elements)
          yield element;
      }
    },
    get: {
      value: () => {
        subscribe(watchers);
        if (!observer)
          observe2();
        return elements;
      }
    },
    on: {
      value: (type, listener) => {
        const listenerSet = listeners[type];
        if (!listenerSet)
          throw new TypeError(`Invalid change notification type: ${type}`);
        listenerSet.add(listener);
        if (!observer)
          observe2();
        return () => listenerSet.delete(listener);
      }
    },
    length: {
      get: () => {
        subscribe(watchers);
        if (!observer)
          observe2();
        return elements.length;
      }
    }
  });
  return new Proxy(collection, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (isSymbol(prop))
        return;
      const index = Number(prop);
      if (Number.isInteger(index))
        return elements[index];
      return;
    },
    has(target, prop) {
      if (prop in target)
        return true;
      if (Number.isInteger(Number(prop)))
        return !!elements[Number(prop)];
      return isString(prop) && hasMethod(elements, prop);
    },
    ownKeys(target) {
      const staticKeys = Reflect.ownKeys(target);
      const indexes = Object.keys(elements).map((key) => String(key));
      return [...new Set([...indexes, ...staticKeys])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
      const element = elements[Number(prop)];
      return element ? {
        enumerable: true,
        configurable: true,
        writable: true,
        value: element
      } : undefined;
    }
  });
};
var isCollection = (value) => Object.prototype.toString.call(value) === `[object Collection]`;

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
  try {
    if (effects instanceof Promise)
      throw effects;
    const cleanups = [];
    for (const fn of effects) {
      const cleanup = fn(host, target);
      if (cleanup)
        cleanups.push(cleanup);
    }
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      cleanups.length = 0;
    };
  } catch (error) {
    if (error instanceof Promise)
      error.then(() => runElementEffects(host, target, effects));
    else
      throw new InvalidEffectsError(host, error instanceof Error ? error : new Error(String(error)));
  }
};
var runCollectionEffects = (host, collection, effects) => {
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
      const cleanup = cleanups.get(target);
      if (cleanup)
        cleanup();
      cleanups.delete(target);
    }
  };
  collection.on("add", attach);
  collection.on("remove", detach);
  attach(collection.get());
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
    const k = key;
    if (!effects[k])
      continue;
    const elementEffects = Array.isArray(effects[k]) ? effects[k] : [effects[k]];
    if (isCollection(ui[k])) {
      cleanups.push(runCollectionEffects(ui.host, ui[k], elementEffects));
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
var insertOrRemoveElement = (reactive, inserter) => (host, target) => {
  const ok = (verb) => () => {
    if (DEV_MODE && host.debug) {
      log(target, `${verb} element in ${elementName(target)} in ${elementName(host)}`);
    }
    if (isFunction(inserter?.resolve)) {
      inserter.resolve(target);
    } else {
      const signal = isSignal(reactive) ? reactive : undefined;
      if (isState(signal))
        signal.set(0);
    }
  };
  const err = (verb) => (error) => {
    log(error, `Failed to ${verb} element in ${elementName(target)} in ${elementName(host)}`, LOG_ERROR);
    inserter?.reject?.(error);
  };
  return createEffect(() => {
    const diff2 = resolveReactive(reactive, host, target, "insertion or deletion");
    const resolvedDiff = diff2 === RESET ? 0 : diff2;
    if (resolvedDiff > 0) {
      if (!inserter)
        throw new TypeError(`No inserter provided`);
      try {
        for (let i = 0;i < resolvedDiff; i++) {
          const element = inserter.create(target);
          if (!element)
            continue;
          target.insertAdjacentElement(inserter.position ?? "beforeend", element);
        }
        ok("insert")();
      } catch (error) {
        err("insert")(error);
      }
    } else if (resolvedDiff < 0) {
      try {
        if (inserter && (inserter.position === "afterbegin" || inserter.position === "beforeend")) {
          for (let i = 0;i > resolvedDiff; i--) {
            if (inserter.position === "afterbegin")
              target.firstElementChild?.remove();
            else
              target.lastElementChild?.remove();
          }
        } else {
          target.remove();
        }
        ok("remove")();
      } catch (error) {
        err("remove")(error);
      }
    }
  });
};

// src/parsers.ts
var isParser = (value) => isFunction(value) && value.length >= 2;
var getFallback = (ui, fallback) => isFunction(fallback) ? fallback(ui) : fallback;
var read = (reader, fallback) => (ui) => {
  const value = reader(ui);
  return isString(value) && isParser(fallback) ? fallback(ui, value) : value ?? getFallback(ui, fallback);
};

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
    const collection = createCollection(root, selector);
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
      const createSignal = (key, initializer) => {
        const result = isFunction(initializer) ? isParser(initializer) ? initializer(ui, this.getAttribute(key)) : initializer(ui) : initializer;
        if (result != null)
          this.#setAccessor(key, result);
      };
      for (const [prop, initializer] of Object.entries(props)) {
        if (initializer == null || prop in this)
          continue;
        createSignal(prop, initializer);
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
      const signal = isSignal(value) ? value : isComputedCallback(value) ? createComputed(value) : createState(value);
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
      const result = handler({
        host,
        target,
        event: e
      });
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
      schedule(host, task);
    else
      task();
  };
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener);
};
var emit = (type, reactive) => (host, target) => createEffect(() => {
  const value = resolveReactive(reactive, host, target, `custom event "${type}" detail`);
  if (value === RESET || value === UNSET)
    return;
  target.dispatchEvent(new CustomEvent(type, {
    detail: value,
    bubbles: true
  }));
});
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
    const fn = isString(value) && value in host ? () => host[value] : isComputedCallback(value) ? value : undefined;
    return fn ? createComputed(fn).get : undefined;
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
var asJSON = (fallback) => (host, value) => {
  if ((value ?? fallback) == null)
    throw new TypeError("asJSON: Value and fallback are both null or undefined");
  if (value == null)
    return getFallback(host, fallback);
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
  return result ?? getFallback(host, fallback);
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
var createSensor = (init, key, events) => (ui) => {
  const watchers = new Set;
  let value = getFallback(ui, init);
  const targets = isCollection(ui[key]) ? ui[key].get() : [ui[key]];
  const eventMap = new Map;
  let cleanup;
  const listen = () => {
    for (const [type, handler] of Object.entries(events)) {
      const options = { passive: PASSIVE_EVENTS.has(type) };
      const listener = (e) => {
        const target = e.target;
        if (!target || !targets.includes(target))
          return;
        e.stopPropagation();
        const task = () => {
          try {
            const newValue = handler({
              event: e,
              ui,
              target,
              value
            });
            if (newValue == null || newValue instanceof Promise)
              return;
            if (!Object.is(newValue, value)) {
              value = newValue;
              if (watchers.size)
                notify(watchers);
              else if (cleanup)
                cleanup();
            }
          } catch (error) {
            e.stopImmediatePropagation();
            throw error;
          }
        };
        if (options.passive)
          schedule(ui.host, task);
        else
          task();
      };
      eventMap.set(type, listener);
      ui.host.addEventListener(type, listener, options);
    }
    cleanup = () => {
      if (eventMap.size) {
        for (const [type, listener] of eventMap)
          ui.host.removeEventListener(type, listener);
        eventMap.clear();
      }
      cleanup = undefined;
    };
  };
  const sensor = {};
  Object.defineProperties(sensor, {
    [Symbol.toStringTag]: {
      value: TYPE_COMPUTED
    },
    get: {
      value: () => {
        subscribe(watchers);
        if (watchers.size && !eventMap.size)
          listen();
        return value;
      }
    }
  });
  return sensor;
};
export {
  valueString,
  updateElement,
  toggleClass,
  toggleAttribute,
  toSignal,
  toError,
  show,
  setText,
  setStyle,
  setProperty,
  setAttribute,
  schedule,
  runElementEffects,
  runEffects,
  resolve,
  read,
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
  isCollection,
  isAsyncFunction,
  isAbortError,
  insertOrRemoveElement,
  emit,
  diff,
  defineComponent,
  dangerouslySetInnerHTML,
  createStore,
  createState,
  createSensor,
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
  UNSET,
  StoreKeyReadonlyError,
  StoreKeyRangeError,
  StoreKeyExistsError,
  NullishSignalValueError,
  InvalidSignalValueError,
  InvalidCallbackError,
  CircularDependencyError
};

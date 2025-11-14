// node_modules/@zeix/cause-effect/src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency detected in ${where}`);
    this.name = "CircularDependencyError";
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
var isDefinedObject = (value) => !!value && typeof value === "object";
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
  for (const index of indexes) {
    array.push(record[String(index)]);
  }
  return array;
};
var valueString = (value) => isString(value) ? `"${value}"` : isDefinedObject(value) ? JSON.stringify(value) : String(value);

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

// node_modules/@zeix/cause-effect/src/scheduler.ts
var active;
var pending = new Set;
var batchDepth = 0;
var updateMap = new Map;
var requestId;
var updateDOM = () => {
  requestId = undefined;
  const updates = Array.from(updateMap.values());
  updateMap.clear();
  for (const update of updates) {
    update();
  }
};
var requestTick = () => {
  if (requestId)
    cancelAnimationFrame(requestId);
  requestId = requestAnimationFrame(updateDOM);
};
queueMicrotask(updateDOM);
var watch = (notice) => {
  const cleanups = new Set;
  const w = notice;
  w.off = (on) => {
    cleanups.add(on);
  };
  w.cleanup = () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.clear();
  };
  return w;
};
var subscribe = (watchers) => {
  if (active && !watchers.has(active)) {
    const watcher = active;
    watchers.add(watcher);
    active.off(() => {
      watchers.delete(watcher);
    });
  }
};
var notify = (watchers) => {
  for (const watcher of watchers) {
    if (batchDepth)
      pending.add(watcher);
    else
      watcher();
  }
};
var flush = () => {
  while (pending.size) {
    const watchers = Array.from(pending);
    pending.clear();
    for (const watcher of watchers) {
      watcher();
    }
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
  const prev = active;
  active = watcher;
  try {
    run();
  } finally {
    active = prev;
  }
};
var enqueue = (fn, dedupe) => new Promise((resolve, reject) => {
  updateMap.set(dedupe || Symbol(), () => {
    try {
      resolve(fn());
    } catch (error) {
      reject(error);
    }
  });
  requestTick();
});

// node_modules/@zeix/cause-effect/src/computed.ts
var TYPE_COMPUTED = "Computed";
var computed = (fn) => {
  const watchers = new Set;
  let value = UNSET;
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
  const settle = (settleFn) => (arg) => {
    computing = false;
    controller = undefined;
    settleFn(arg);
    if (changed)
      notify(watchers);
  };
  const mark = watch(() => {
    dirty = true;
    controller?.abort();
    if (watchers.size)
      notify(watchers);
    else
      mark.cleanup();
  });
  mark.off(() => {
    controller?.abort();
  });
  const compute = () => observe(() => {
    if (computing)
      throw new CircularDependencyError("computed");
    changed = false;
    if (isAsyncFunction(fn)) {
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
      result = controller ? fn(controller.signal) : fn();
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
  }, mark);
  const c = {
    [Symbol.toStringTag]: TYPE_COMPUTED,
    get: () => {
      subscribe(watchers);
      flush();
      if (dirty)
        compute();
      if (error)
        throw error;
      return value;
    }
  };
  return c;
};
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isComputedCallback = (value) => isFunction(value) && value.length < 2;
// node_modules/@zeix/cause-effect/src/effect.ts
var effect = (callback) => {
  const isAsync = isAsyncFunction(callback);
  let running = false;
  let controller;
  const run = watch(() => observe(() => {
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
            run.off(cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Async effect error:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          run.off(cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Effect callback error:", error);
    }
    running = false;
  }, run));
  run();
  return () => {
    controller?.abort();
    run.cleanup();
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
  let pending2 = false;
  const values = {};
  for (const [key, signal] of Object.entries(signals)) {
    try {
      const value = signal.get();
      if (value === UNSET)
        pending2 = true;
      else
        values[key] = value;
    } catch (e) {
      errors.push(toError(e));
    }
  }
  if (pending2)
    return { ok: false, pending: true };
  if (errors.length > 0)
    return { ok: false, errors };
  return { ok: true, values };
}
// node_modules/@zeix/cause-effect/src/state.ts
var TYPE_STATE = "State";
var state = (initialValue) => {
  const watchers = new Set;
  let value = initialValue;
  const s = {
    [Symbol.toStringTag]: TYPE_STATE,
    get: () => {
      subscribe(watchers);
      return value;
    },
    set: (v) => {
      if (v == null)
        throw new NullishSignalValueError("state");
      if (isEqual(value, v))
        return;
      value = v;
      notify(watchers);
      if (UNSET === value)
        watchers.clear();
    },
    update: (fn) => {
      s.set(fn(value));
    }
  };
  return s;
};
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// node_modules/@zeix/cause-effect/src/store.ts
var TYPE_STORE = "Store";
var STORE_EVENT_ADD = "store-add";
var STORE_EVENT_CHANGE = "store-change";
var STORE_EVENT_REMOVE = "store-remove";
var STORE_EVENT_SORT = "store-sort";
var store = (initialValue) => {
  const watchers = new Set;
  const eventTarget = new EventTarget;
  const signals = new Map;
  const cleanups = new Map;
  const isArrayLike = Array.isArray(initialValue);
  const size = state(0);
  const current = () => {
    const record = {};
    for (const [key, signal] of signals) {
      record[key] = signal.get();
    }
    return record;
  };
  const emit = (type, detail) => eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
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
    const signal = isState(value) || isStore(value) ? value : isRecord(value) ? store(value) : Array.isArray(value) ? store(value) : state(value);
    signals.set(key, signal);
    const cleanup = effect(() => {
      const currentValue = signal.get();
      if (currentValue != null)
        emit(STORE_EVENT_CHANGE, {
          [key]: currentValue
        });
    });
    cleanups.set(key, cleanup);
    if (single) {
      size.set(signals.size);
      notify(watchers);
      emit(STORE_EVENT_ADD, {
        [key]: value
      });
    }
    return true;
  };
  const removeProperty = (key, single = false) => {
    const ok = signals.delete(key);
    if (ok) {
      const cleanup = cleanups.get(key);
      if (cleanup)
        cleanup();
      cleanups.delete(key);
    }
    if (single) {
      size.set(signals.size);
      notify(watchers);
      emit(STORE_EVENT_REMOVE, {
        [key]: UNSET
      });
    }
    return ok;
  };
  const reconcile = (oldValue, newValue, initialRun) => {
    const changes = diff(oldValue, newValue);
    batch(() => {
      if (Object.keys(changes.add).length) {
        for (const key in changes.add) {
          const value = changes.add[key] ?? UNSET;
          addProperty(key, value);
        }
        if (initialRun) {
          setTimeout(() => {
            emit(STORE_EVENT_ADD, changes.add);
          }, 0);
        } else {
          emit(STORE_EVENT_ADD, changes.add);
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
        emit(STORE_EVENT_CHANGE, changes.change);
      }
      if (Object.keys(changes.remove).length) {
        for (const key in changes.remove)
          removeProperty(key);
        emit(STORE_EVENT_REMOVE, changes.remove);
      }
      size.set(signals.size);
    });
    return changes.changed;
  };
  reconcile({}, initialValue, true);
  const s = {
    add: isArrayLike ? (v) => {
      const nextIndex = signals.size;
      const key = String(nextIndex);
      addProperty(key, v, true);
    } : (k, v) => {
      if (!signals.has(k))
        addProperty(k, v, true);
      else
        throw new StoreKeyExistsError(k, valueString(v));
    },
    get: () => {
      subscribe(watchers);
      return recordToArray(current());
    },
    remove: isArrayLike ? (index) => {
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
    },
    set: (v) => {
      if (reconcile(current(), v)) {
        notify(watchers);
        if (UNSET === v)
          watchers.clear();
      }
    },
    update: (fn) => {
      const oldValue = current();
      const newValue = fn(recordToArray(oldValue));
      if (reconcile(oldValue, newValue)) {
        notify(watchers);
        if (UNSET === newValue)
          watchers.clear();
      }
    },
    sort: (compareFn) => {
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
      emit(STORE_EVENT_SORT, newOrder);
    },
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    size
  };
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === Symbol.toStringTag)
        return TYPE_STORE;
      if (prop === Symbol.isConcatSpreadable)
        return isArrayLike;
      if (prop === Symbol.iterator)
        return isArrayLike ? function* () {
          const indexes = getSortedIndexes();
          for (const index of indexes) {
            const signal = signals.get(String(index));
            if (signal)
              yield signal;
          }
        } : function* () {
          for (const [key, signal] of signals)
            yield [key, signal];
        };
      if (isSymbol(prop))
        return;
      if (prop in s)
        return s[prop];
      if (prop === "length" && isArrayLike) {
        subscribe(watchers);
        return size.get();
      }
      return signals.get(prop);
    },
    has(_target, prop) {
      const stringProp = String(prop);
      return stringProp && signals.has(stringProp) || Object.keys(s).includes(stringProp) || prop === Symbol.toStringTag || prop === Symbol.iterator || prop === Symbol.isConcatSpreadable || prop === "length" && isArrayLike;
    },
    ownKeys() {
      return isArrayLike ? getSortedIndexes().map((key) => String(key)).concat(["length"]) : Array.from(signals.keys()).map((key) => String(key));
    },
    getOwnPropertyDescriptor(_target, prop) {
      const nonEnumerable = (value) => ({
        enumerable: false,
        configurable: true,
        writable: false,
        value
      });
      if (prop === "length" && isArrayLike)
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: size.get()
        };
      if (prop === Symbol.isConcatSpreadable)
        return nonEnumerable(isArrayLike);
      if (prop === Symbol.toStringTag)
        return nonEnumerable(TYPE_STORE);
      if (isSymbol(prop))
        return;
      if (Object.keys(s).includes(prop))
        return nonEnumerable(s[prop]);
      const signal = signals.get(prop);
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
    return computed(value);
  if (Array.isArray(value) || isRecord(value))
    return store(value);
  return state(value);
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
var elementName = (el) => el ? `<${el.localName}${idString(el.id)}${classString(el.classList)}>` : "<unknown>";
var valueString2 = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);
var typeString = (value) => {
  if (value === null)
    return "null";
  if (typeof value !== "object")
    return typeof value;
  if (Array.isArray(value))
    return "Array";
  if (Symbol.toStringTag in Object(value)) {
    return value[Symbol.toStringTag];
  }
  return value.constructor?.name || "Object";
};
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
    super(`Invalid effects in component ${elementName(host)}. Effects must be an array of effects, a single effect function, or a Promise that resolves to effects.`);
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

// src/effects.ts
var runEffects = (effects, host, target = host) => {
  try {
    if (effects instanceof Promise)
      throw effects;
    if (!Array.isArray(effects))
      return effects(host, target);
    const cleanups = effects.filter(isFunction).map((effect2) => effect2(host, target));
    return () => {
      cleanups.filter(isFunction).forEach((cleanup) => cleanup());
      cleanups.length = 0;
    };
  } catch (error) {
    if (error instanceof Promise) {
      error.then(() => runEffects(effects, host, target));
    } else {
      throw new InvalidEffectsError(host, error instanceof Error ? error : new Error(String(error)));
    }
  }
};

// src/parsers.ts
var isParser = (value) => isFunction(value) && value.length >= 2;

// src/ui.ts
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
var observeSubtree = (parent, selector, callback) => {
  const observer = new MutationObserver(callback);
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
  return observer;
};
var getHelpers = (host) => {
  const root = host.shadowRoot ?? host;
  const dependencies = new Set;
  function useElement(selector, required) {
    const target = root.querySelector(selector);
    if (required != null && !target)
      throw new MissingElementError(host, selector, required);
    if (target && isCustomElement(target) && target.matches(":not(:defined)"))
      dependencies.add(target.localName);
    return target;
  }
  function useElements(selector, required) {
    const targets = root.querySelectorAll(selector);
    if (required != null && !targets.length)
      throw new MissingElementError(host, selector, required);
    if (targets.length)
      targets.forEach((target) => {
        if (isCustomElement(target) && target.matches(":not(:defined)"))
          dependencies.add(target.localName);
      });
    return Array.from(targets);
  }
  const first = (selector, effects, required) => {
    const target = required != null ? useElement(selector, required) : useElement(selector);
    return () => {
      if (target)
        return runEffects(effects, host, target);
    };
  };
  const all = (selector, effects, required) => {
    const targets = required != null ? useElements(selector, required) : useElements(selector);
    return () => {
      const cleanups = new Map;
      const attach = (target) => {
        const cleanup = runEffects(effects, host, target);
        if (cleanup && !cleanups.has(target))
          cleanups.set(target, cleanup);
      };
      const detach = (target) => {
        const cleanup = cleanups.get(target);
        if (cleanup)
          cleanup();
        cleanups.delete(target);
      };
      const applyToMatching = (fn) => (node) => {
        if (isElement(node)) {
          if (node.matches(selector))
            fn(node);
          node.querySelectorAll(selector).forEach(fn);
        }
      };
      const observer = observeSubtree(root, selector, (mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(applyToMatching(attach));
          mutation.removedNodes.forEach(applyToMatching(detach));
        }
      });
      if (targets.length)
        targets.forEach(attach);
      return () => {
        observer.disconnect();
        cleanups.forEach((cleanup) => cleanup());
        cleanups.clear();
      };
    };
  };
  return [
    { useElement, useElements, first, all },
    () => Array.from(dependencies)
  ];
};

// src/component.ts
var DEPENDENCY_TIMEOUT = 50;
function component(config) {
  const {
    name,
    select = () => ({}),
    props = {},
    setup = () => []
  } = config;
  if (!name.includes("-") || !name.match(/^[a-z][a-z0-9-]*$/))
    throw new InvalidComponentNameError(name);
  for (const prop of Object.keys(props)) {
    const error = validatePropertyName(prop);
    if (error)
      throw new InvalidPropertyNameError(name, prop, error);
  }

  class CustomElement extends HTMLElement {
    debug;
    #ui = {};
    #signals = {};
    #cleanup;
    static observedAttributes = Object.entries(props)?.filter(([, initializer]) => isParser(initializer)).map(([prop]) => prop) ?? [];
    connectedCallback() {
      if (DEV_MODE) {
        this.debug = this.hasAttribute("debug");
        if (this.debug)
          log(this, "Connected");
      }
      const [helpers, getDependencies] = getHelpers(this);
      this.#ui = {
        ...select(helpers),
        component: this
      };
      const createSignal = (key, initializer) => {
        const result = isFunction(initializer) ? initializer(this) : initializer;
        if (result != null)
          this.#setAccessor(key, result);
      };
      for (const [prop, initializer] of Object.entries(props)) {
        if (initializer == null || prop in this)
          continue;
        createSignal(prop, initializer);
      }
      const effects = setup(this.#ui, helpers);
      const deps = getDependencies();
      const runSetup = () => {
        const cleanup = runEffects(effects, this);
        if (cleanup)
          this.#cleanup = cleanup;
      };
      if (deps.length) {
        Promise.race([
          Promise.all(deps.map((dep) => customElements.whenDefined(dep))),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new DependencyTimeoutError(this, deps.filter((dep) => !customElements.get(dep))));
            }, DEPENDENCY_TIMEOUT);
          })
        ]).then(runSetup).catch((error) => {
          if (DEV_MODE)
            log(error, `Error during setup of <${name}>. Trying to run effects anyway.`, LOG_WARN);
          runSetup();
        });
      } else {
        runSetup();
      }
    }
    disconnectedCallback() {
      if (isFunction(this.#cleanup))
        this.#cleanup();
      if (DEV_MODE && this.debug)
        log(this, "Disconnected");
    }
    attributeChangedCallback(name2, oldValue, newValue) {
      if (newValue === oldValue || isComputed(this.#signals[name2]))
        return;
      const parser = props[name2];
      if (!isParser(parser))
        return;
      const parsed = parser(this.#ui, newValue, oldValue);
      if (DEV_MODE && this.debug)
        log(newValue, `Attribute "${String(name2)}" of ${elementName(this)} changed from ${valueString2(oldValue)} to ${valueString2(newValue)}, parsed as <${typeString(parsed)}> ${valueString2(parsed)}`);
      if (name2 in this)
        this[name2] = parsed;
      else
        this.#setAccessor(name2, parsed);
    }
    #setAccessor(key, value) {
      const signal = isSignal(value) ? value : isComputedCallback(value) ? computed(value) : state(value);
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
      if (DEV_MODE && this.debug)
        log(signal, `Set ${typeString(signal)} "${String(key)}" in ${elementName(this)}`);
    }
  }
  customElements.define(name, CustomElement);
  return customElements.get(name);
}
export {
  toSignal,
  toError,
  store,
  state,
  resolve,
  match,
  isSymbol,
  isString,
  isStore,
  isState,
  isSignal,
  isRecordOrArray,
  isRecord,
  isNumber,
  isMutableSignal,
  isFunction,
  isEqual,
  isComputed,
  isAsyncFunction,
  isAbortError,
  enqueue,
  effect,
  diff,
  computed,
  component,
  batch,
  UNSET,
  StoreKeyReadonlyError,
  StoreKeyRangeError,
  StoreKeyExistsError,
  NullishSignalValueError,
  InvalidSignalValueError,
  CircularDependencyError
};

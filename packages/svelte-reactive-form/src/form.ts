import { writable, get, readable } from "svelte/store";
import type { Readable } from "svelte/store";

import { resolveRule } from "./rule";
import toPromise from "./to_promise";
import type {
  Config,
  FieldState,
  FieldOption,
  ValidationRule,
  SuccessCallback,
  FormState,
  ValidationResult,
  ResetFormOption,
  FormControl,
  Form,
  Fields,
  Field,
  NodeElement,
  RegisterOption,
  ErrorCallback,
  FieldStateStore,
} from "./types";

const defaultFormState = {
  dirty: false,
  submitting: false,
  touched: false,
  pending: false,
  valid: false,
};

const defaultFieldState = {
  defaultValue: "",
  value: "",
  pending: false,
  dirty: false,
  touched: false,
  valid: false,
  errors: [],
};

const fields = ["INPUT", "SELECT", "TEXTAREA"];

// TODO: test case for _normalizeObject
const _normalizeObject = (
  data: Record<string, any>,
  name: string,
  value: any
) => {
  const escape = name.match(/^\[(.*)\]$/);
  const queue: [[Record<string, any>, Array<string>]] = [
    [data, escape ? [escape[1]] : name.split(".")],
  ];
  while (queue.length > 0) {
    const first = <[Record<string, any>, string[]]>queue.shift();
    const paths = first[1];
    const name = <string>paths.shift();
    const result = name.match(/^([a-z\_\.]+)((\[\d+\])+)/i);

    if (result && result.length > 2) {
      const name = result[1];
      // if it's not array, assign it and make it as array
      if (!Array.isArray(first[0][name])) {
        first[0][name] = [];
      }
      let cur = first[0][name];
      const indexs = result[2].replace(/^\[+|\]+$/g, "").split("][");
      while (indexs.length > 0) {
        const index = parseInt(<string>indexs.shift(), 10);
        // if nested index is last position && parent is last position
        if (indexs.length === 0) {
          if (paths.length === 0) {
            cur[index] = value;
          } else {
            if (!cur[index]) {
              cur[index] = {};
            }
          }
        } else if (!cur[index]) {
          // set to empty array if it's undefined
          cur[index] = [];
        }
        cur = cur[index];
      }

      if (paths.length > 0) {
        queue.push([cur, paths]);
      }

      continue;
    }

    if (paths.length === 0) {
      first[0][name] = value;
    } else {
      if (!first[0][name]) {
        first[0][name] = {};
      }
      queue.push([first[0][name], paths]);
    }
  }

  return data;
};

const _strToValidator = (rule: string): ValidationRule => {
  const params = rule.split(/:/g);
  const name = <string>params.shift();
  if (!resolveRule(name))
    console.error(
      `[svelte-reactive-form] invalid validation function "${name}"`
    );
  return {
    name,
    validate: toPromise<boolean | string>(resolveRule(name)),
    params: params[0] ? params[0].split(",") : [],
  };
};

export const useForm = (config: Config = { validateOnChange: true }): Form => {
  // cache for form fields
  const cache: Map<string, [FieldStateStore, ValidationRule[]]> = new Map();

  // global state for form
  const form$ = writable<FormState>(Object.assign({}, defaultFormState));
  const anyNonDirty = new Map();
  const anyPending = new Map();
  const anyNonTouched = new Map();
  const anyInvalid = new Map();

  // errors should be private variable
  const errors$ = writable<Record<string, any>>({});

  const _updateForm = () => {
    form$.update((v) =>
      Object.assign(v, {
        valid: anyInvalid.size === 0,
        dirty: anyNonDirty.size === 0,
        touched: anyNonTouched.size === 0,
        pending: anyPending.size > 0,
      })
    );
  };

  const _useLocalStore = (path: string, state: object) => {
    const { subscribe, set, update } = writable<FieldState>(
      Object.assign({}, defaultFieldState, state)
    );

    let unsubscribe: null | Function;
    return {
      set,
      update,
      destroy() {
        cache.delete(path); // clean our cache
        anyInvalid.delete(path);
        anyNonDirty.delete(path);
        anyNonTouched.delete(path);
        anyPending.delete(path);
        _updateForm();
        unsubscribe && unsubscribe();
      },
      subscribe(
        run: (value: FieldState) => void,
        invalidate?: (value?: FieldState) => void
      ) {
        unsubscribe = subscribe(run, invalidate);
        return () => {
          // prevent memory leak
          unsubscribe && unsubscribe();
          unsubscribe = null;
        };
      },
    };
  };

  const _setStore = (path: string, state: object = {}) => {
    const store$ = _useLocalStore(path, state);
    cache.set(path, [store$, []]);
  };

  const register = <T>(
    path: string,
    option: RegisterOption<T> = {}
  ): Readable<FieldState> => {
    const value = option.defaultValue || "";
    const store$ = _useLocalStore(path, {
      defaultValue: value,
      value,
    });

    if (path === "") console.error("[svelte-reactive-form] missing field name");

    let ruleExprs: ValidationRule[] = [];
    const { rules = [] } = option;
    const typeOfRule = typeof rules;
    if (typeOfRule === "string") {
      ruleExprs = ((rules as string).match(/[^\|]+/g) || []).map((v: string) =>
        _strToValidator(v)
      );
    } else if (Array.isArray(rules)) {
      ruleExprs = rules.reduce((acc: ValidationRule[], rule: any) => {
        const typeOfVal = typeof rule;
        if (!rule) return acc; // skip null, undefined etc
        if (typeOfVal === "string") {
          rule = <string>rule.trim();
          rule && acc.push(_strToValidator(rule));
        } else if (typeOfVal === "function") {
          rule = rule as Function;
          if (rule.name === "")
            console.error(
              "[svelte-reactive-form] validation rule function name is empty"
            );
          acc.push({
            name: rule.name,
            validate: toPromise<boolean | string>(<Function>rule),
            params: [],
          });
        }
        return acc;
      }, []);
    } else if (typeOfRule !== null && typeOfRule === "object") {
      ruleExprs = Object.entries(<object>rules).reduce(
        (acc: ValidationRule[], cur: [string, any]) => {
          const [name, params] = cur;
          acc.push({
            name,
            validate: toPromise<boolean | string>(resolveRule(name)),
            params: Array.isArray(params) ? params : [params],
          });
          return acc;
        },
        []
      );
    } else {
      console.error(
        `[svelte-reactive-form] invalid data type for validation rule ${typeOfRule}`
      );
    }

    cache.set(path, [store$, ruleExprs]);

    if (option.validateOnMount) {
      _validate(path, value);
    }

    if (config.validateOnChange) {
      // on every state change, it will update the form
      store$.subscribe((state) => {
        if (state.valid) anyInvalid.delete(path);
        else if (!state.valid) anyInvalid.set(path, true);
        if (state.dirty) anyNonDirty.delete(path);
        else if (!state.dirty) anyNonDirty.set(path, true);
        if (!state.pending) anyPending.delete(path);
        else if (state.pending) anyPending.set(path, true);
        if (state.touched) anyNonTouched.delete(path);
        else if (!state.touched) anyNonTouched.set(path, true);
        _updateForm();
      });
    }

    return {
      subscribe: store$.subscribe,
    };
  };

  const unregister = (path: string) => {
    if (cache.has(path)) {
      // clear subscriptions and cache
      (<[FieldStateStore, ValidationRule[]]>cache.get(path))[0].destroy();
    }
  };

  const setValue = <T>(path: string, value: T): void => {
    if (cache.has(path)) {
      const [store$, validators] = <Field>cache.get(path);
      if (config.validateOnChange && validators.length > 0) {
        _validate(path, value);
      } else {
        store$.update((v) => Object.assign(v, { dirty: true, value }));
      }
    } else {
      _setStore(path);
    }
  };

  const setError = (path: string, errors: string[]): void => {
    if (cache.has(path)) {
      const [store$] = <Field>cache.get(path);
      store$.update((v: FieldState) => Object.assign(v, { errors }));
    } else {
      _setStore(path, { errors });
    }
  };

  const setTouched = (path: string, touched: boolean): void => {
    if (cache.has(path)) {
      const [store$] = <Field>cache.get(path);
      store$.update((v) => Object.assign(v, { touched }));
    }
  };

  const getValue = <T>(path: string): T | null => {
    if (cache.has(path)) {
      const [store$] = <Field>cache.get(path);
      const state = get<FieldState>(store$);
      return <T>state.value;
    }
    return null;
  };

  const _useField = (node: Element, option: FieldOption = {}) => {
    option = Object.assign({ rules: [], defaultValue: "" }, option);
    const selector = fields.join(",");
    while (!fields.includes(node.nodeName)) {
      const el = <NodeElement>node.querySelector(selector);
      node = el;
      if (el) break;
    }
    const name = (<NodeElement>node).name || node.id;
    if (name === "") console.error("[svelte-reactive-form] empty field name");

    const { defaultValue, rules } = option;
    const state$ = register(name, { defaultValue, rules });
    const onChange = (e: Event) => {
      setValue(name, (<HTMLInputElement>e.currentTarget).value);
    };
    const onBlur = (_: Event) => {
      setTouched(name, true);
    };

    if (defaultValue) {
      node.setAttribute("value", defaultValue);
    }
    const listeners: Array<[string, (e: Event) => void]> = [];
    const _attachEvent = (
      event: string,
      cb: (e: Event) => void,
      opts?: object
    ) => {
      node.addEventListener(event, cb, opts);
      listeners.push([event, cb]);
    };

    const _detachEvents = () => {
      for (let i = 0, len = listeners.length; i < len; i++) {
        const [event, cb] = listeners[i];
        node.removeEventListener(event, cb);
      }
    };

    _attachEvent("blur", onBlur, { once: true });
    if (config.validateOnChange) {
      _attachEvent("input", onChange);
      _attachEvent("change", onChange);
    }

    let unsubscribe: null | Function;
    if (option.handleChange) {
      unsubscribe = state$.subscribe((v: FieldState) => {
        (<(state: FieldState, node: Element) => void>option.handleChange)(
          v,
          <Element>node
        );
      });
    }

    return {
      destroy() {
        _detachEvents();
        unregister(name);
        unsubscribe && unsubscribe();
      },
    };
  };

  const reset = (values?: Fields, option?: ResetFormOption) => {
    const defaultOption = {
      dirtyFields: false,
      errors: false,
    };
    option = Object.assign(defaultOption, option || {});
    if (option.errors) {
      errors$.set({}); // reset errors
    }
    const fields = Array.from(cache.values());
    for (let i = 0, len = fields.length; i < len; i++) {
      const [store$] = fields[i];
      store$.update((v) => {
        const { defaultValue } = v;
        return Object.assign({}, defaultFieldState, {
          defaultValue,
          value: defaultValue,
        });
      });
    }
  };

  const useField = (node: Element, option: FieldOption = {}) => {
    let field = _useField(node, option);

    return {
      update(newOption: FieldOption = {}) {
        field.destroy(); // reset
        field = _useField(node, newOption);
      },
      destroy() {
        field.destroy();
      },
    };
  };

  const onSubmit = (
    successCallback: SuccessCallback,
    errorCallback?: ErrorCallback
  ) => async (e: Event) => {
    form$.update((v) => Object.assign(v, { submitting: true }));
    e.preventDefault();
    e.stopPropagation();
    errors$.set({}); // reset errors
    let data = {},
      valid = true;
    const { elements = [] } = <HTMLFormElement>e.currentTarget;
    for (let i = 0, len = elements.length; i < len; i++) {
      const el = <HTMLInputElement>elements[i];
      const name = el.name || el.id;
      let value = el.value || "";
      if (!name) continue;
      if (config.resolver) {
        data = _normalizeObject(data, name, value);
        continue;
      }
      // TODO: shouldn't only loop elements, should check cache keys which not exists in elements as well
      if (cache.has(name)) {
        const store = cache.get(name);
        // TODO: check checkbox and radio
        const { nodeName, type } = el;
        switch (type) {
          case "checkbox":
            value = el.checked ? value : "";
            break;
        }

        const result = await _validate(name, value);
        valid = valid && result.valid; // update valid
        data = _normalizeObject(data, name, value);
      }
    }

    if (config.resolver) {
      try {
        await config.resolver.validate(data);
      } catch (e) {
        valid = false;
        errors$.set(<Record<string, any>>e);
      }
    }

    if (valid) {
      await toPromise<void>(successCallback)(data, e);
    } else {
      errorCallback && errorCallback(get(errors$), e);
    }

    // submitting should end only after execute user callback
    form$.update((v) => Object.assign(v, { valid, submitting: false }));
  };

  const _validate = (path: string, value: any): Promise<FieldState> => {
    const promises: Promise<ValidationResult>[] = [];
    // if (cache.has(path)) {
    const [store$, validators] = <Field>cache.get(path);
    let state = get(store$);

    if (validators.length === 0) {
      state = Object.assign(state, { errors: [], valid: true });
      store$.set(state);
      return Promise.resolve(state);
    }
    form$.update((v) => Object.assign(v, { pending: true, valid: false }));
    store$.update((v: FieldState) =>
      Object.assign(v, { errors: [], dirty: true, pending: true, value })
    );

    for (let i = 0, len = validators.length; i < len; i++) {
      const { validate, params } = validators[i];
      promises.push(validate(value, params));
    }

    return Promise.all(promises).then((result: ValidationResult[]) => {
      const errors = <string[]>(
        result.filter((v: ValidationResult) => v !== true)
      );
      const valid = errors.length === 0;
      store$.update((v: FieldState) =>
        Object.assign(v, { pending: false, errors, valid })
      );
      // setError(path, errors);

      return Promise.resolve(<FieldState>get(store$));
    });
    // }
  };

  const validate = (paths: string | string[] = Array.from(cache.keys())) => {
    if (!Array.isArray(paths)) paths = [paths];
    const promises: Promise<FieldState>[] = [];

    let data = {};
    for (let i = 0, len = paths.length; i < len; i++) {
      if (!cache.has(paths[i])) continue;
      const [store$] = <Field>cache.get(paths[i]);
      const state = get(store$);
      promises.push(_validate(paths[i], state.value));
      _normalizeObject(data, paths[i], state.value);
    }

    return Promise.all(promises).then((result: FieldState[]) => {
      return {
        valid: result.every((state) => state.valid),
        data,
      };
    });
  };

  const getValues = () => {
    let data = {};
    for (const [name, [store$]] of cache.entries()) {
      const state = get(store$);
      _normalizeObject(data, name, state.value);
    }
    return data;
  };

  return {
    control: readable<FormControl>(
      {
        register,
        unregister,
        setValue,
        getValue,
        setError,
        setTouched,
        getValues,
        reset,
      },
      () => {}
    ),
    subscribe(
      run: (value: FormState) => void,
      invalidate?: (value?: FormState) => void
    ) {
      const unsubscribe = form$.subscribe(run, invalidate);
      return () => {
        // prevent memory leak
        unsubscribe();
        cache.clear(); // clean our cache
      };
    },
    errors: {
      subscribe: errors$.subscribe,
    },
    field: useField,
    register,
    unregister,
    setValue,
    getValue,
    setError,
    setTouched,
    getValues,
    onSubmit,
    reset,
    validate,
  };
};

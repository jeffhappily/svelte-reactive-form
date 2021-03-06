import type { FormControl } from "svelte-reactive-form/src/types";

export const required = (v: any): boolean | string => {
  if (v === undefined) return "This field is required.";
  if (v === 0) return "This field is required.";
  if (v === null) return "This field is required.";
  if (v === "") return "This field is required.";
  if (Array.isArray(v) && v.length === 0) return "This field is required.";
  return true;
};

// TODO:
// export const requiredIf = (v: any, []: any[]): boolean | string => {
//   if (v === undefined) return "This field is required.";
//   if (v === 0) return "This field is required.";
//   if (v === null) return "This field is required.";
//   if (v === "") return "This field is required.";
//   if (Array.isArray(v) && v.length === 0) return "This field is required.";
//   return true;
// };

export const alphaNum = (v: string): boolean | string => {
  return /^[a-z0-9]+$/i.test(v) ? true : "The field is not alphanumeric.";
};

export const between = (v: any, [min, max]: string[]): boolean | string => {
  return v > min && v < max
    ? true
    : `The field is not between ${min} and ${max}.`;
};

export const url = (v: string): boolean | string => {
  return /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/.test(
    v
  )
    ? true
    : "This field is not url.";
};

export const unique = <T>(v: T[]): boolean | string => {
  const map = new Map();
  for (let i = 0; v.length; i++) {
    if (map.has(v)) return "This field is not unique.";
    map.set(v, true);
  }
  return true;
};

export const same = (
  v: any,
  [field]: string[],
  ctx: FormControl
): boolean | string => {
  return v !== ctx.getValue(field)
    ? `The field must have the same vaue as ${field} `
    : true;
};

export const email = (v: string): boolean | string =>
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
    v
  ) || "This field must be a valid email.";

export const contains = <T>(v: T, list: T[]): boolean | string => {
  return list.includes(v)
    ? true
    : `This field doesn't have valid value (such as ${list.join(", ")})`;
};

export const minLength = (val: any, [min]: [number]): boolean | string => {
  if (Array.isArray(val) && val.length < min) {
    return `Array must contains ${min} items.`;
  }
  const typeOfVal = typeof val;
  switch (typeOfVal) {
    case "string":
      return (
        val.length >= Number(min) ||
        `This field must be at least ${min} characters.`
      );
    case "number":
  }
  return "invalid data type for minLength";
};

export const max = (v: any, [len]: [string]): boolean | string => {
  const l = parseFloat(len);
  const value = isNaN(v) ? v.length : parseFloat(v);
  return value < l || `This field must be less than ${length} characters.`;
};

export const min = (v: any, [len]: [string]): boolean | string => {
  const l = parseFloat(len);
  const value = isNaN(v) ? v.length : parseFloat(v);
  return value >= l || `This field must be at least ${l} characters.`;
};

export const integer = (v: string): boolean | string => {
  return /^\d+$/.test(v) ? true : "The field is not an integer";
};

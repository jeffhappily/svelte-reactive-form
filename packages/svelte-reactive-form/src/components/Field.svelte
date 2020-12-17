<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import type { Readable } from "svelte/store";

  import type { FormControl, RuleExpression } from "../types";

  export let name = "";
  export let defaultValue: any = "";
  export let control: Readable<FormControl>;
  export let rules: RuleExpression = "";
  export let type: "hidden" | "text" = "hidden";

  const form = get<FormControl>(control);
  if (!form) console.error("[svelte-reactive-form] Missing form control");
  const { register, unregister, setValue, setTouched } = form;

  // reactive state
  const state$ = register(name, {
    defaultValue,
    rules,
  });

  let value = defaultValue;
  const onChange = (e: any) => {
    if (e.target) {
      const target = e.target as HTMLInputElement;
      value = target.value;
    } else if (e.currentTarget) {
      const target = e.currentTarget as HTMLInputElement;
      value = target.value;
    } else if (e instanceof CustomEvent) {
      value = e.detail;
    } else {
      value = e;
    }
    setValue(name, value);
  };

  const onBlur = () => {
    setTouched(name, true);
  };

  onDestroy(() => {
    unregister(name);
  });
</script>

<div>
  <input {name} {type} on:input {value} />
  <slot
    pending={$state$.pending}
    valid={$state$.valid}
    errors={$state$.errors}
    dirty={$state$.dirty}
    touched={$state$.touched}
    {value}
    {onChange}
    {onBlur} />
</div>
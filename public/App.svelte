<script lang="ts">
  import { useForm, defineRule } from "../packages/svelte-reactive-form/src";
  import {
    required,
    minLength,
    alphaNum,
    integer,
    email,
    contains,
  } from "../packages/rules/src";
  import Component from "./Component.svelte";
  import DefaultValuesForm from "./DefaultValuesForm.svelte";
  import ConditionalForm from "./ConditionalForm.svelte";
  import FormC from "./FormC.svelte";
  import FormD from "./FormD.svelte";
  import DynamicForm from "./DynamicForm.svelte";
  import DynamicValidator from "./DynamicValidator.svelte";
  import Form from "./Form.svelte";
  import UserInformation from "./UserInformation.svelte";
  import FormB from "./FormB.svelte";

  defineRule("required", required);
  defineRule("alphaNum", alphaNum);
  defineRule("contains", contains);
  defineRule("email", email);
  defineRule("integer", integer);
  defineRule("minLength", minLength);
  defineRule("phoneNo", (val: any) => {
    return /[0-9]+/.test(val) || "invalid phone number format";
  });

  let step = 0;

  const form$ = useForm({ validateOnChange: true });
  const { register, setValue, validate, control, onSubmit } = form$;

  let editable = false;
  register("empty_option_field");
  const state$ = register("custom_field", {
    defaultValue: "Custom",
    rules: ["required", "minLength:10"],
  });

  const asyncValidation = () => {
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 1500);
    });
  };

  let ruleOption = 1;
  let customValue = "default";
  const setCustomValue = () => {
    setValue("custom_field", customValue);
  };

  const formB$ = useForm({ validateOnChange: true });
  const customField$ = formB$.register("custom_field", {
    defaultValue: "Custom",
    rules: ["required", "minLength:10"],
  });

  const toggleRule = () => {
    validate();
    // rules = [asyncValidation, "minLength:20"];
  };

  let rules = [required, asyncValidation, "minLength:6"];

  const onInput = (e: Event) => {
    console.log(formB$.getValue("custom_field"));
    formB$.setValue("custom_field", (<HTMLInputElement>e.target).value);
  };

  const array$ = register("array", {
    defaultValue: [1, 2, 3, 4, 5],
    rules: ["required"],
  });
  const onEnterInput = (e: Event) => {
    const v = (<HTMLInputElement>e.target).value;
    form$.setValue("array", v.split(",").filter(Boolean));
    console.log($array$.value);
  };

  const onValidate = () => {
    form$.validate(["array", "name"]).then(console.log);
  };

  let selectedForm = 0;
  const forms = [
    {
      name: "Default Value Form",
      component: DefaultValuesForm,
    },
    {
      name: "Form A",
      component: FormC,
    },
    {
      name: "Form B",
      component: FormB,
    },
    {
      name: "Form D",
      component: FormD,
    },
    {
      name: "Conditional Form",
      component: ConditionalForm,
    },
    {
      name: "Dynamic Form",
      component: DynamicForm,
    },
    {
      name: "Dynamic Validator",
      component: DynamicValidator,
    },
  ];
</script>

<div>
  {#each forms as item, i}
    <button type="button" on:click={() => (selectedForm = i)}
      >{item.name}</button
    >
  {/each}
</div>
<svelte:component this={forms[selectedForm].component} />

<style>
  :global(.errors) {
    color: red;
  }
</style>

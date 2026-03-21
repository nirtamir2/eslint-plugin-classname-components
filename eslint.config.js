import nirtamir2 from "@nirtamir2/eslint-config";

// import { tsImport } from "tsx/esm/api";
// const local = await tsImport("./src/index.ts", import.meta.url).then(
//   (r) => r.default,
// );

export default nirtamir2(
  {
    type: "lib",
  },
  [
    {
      ignores: ["vendor"],
    },
    {
      rules: {
        "sonarjs/cognitive-complexity": "off",
        "sonarjs/no-empty-test-file": "off",
      },
    },
    {
      // TODO: ignore those rules on markdown files only
      ignores: ["src/rules/sort-destructure-keys-by-type.md"],
      // rules: {
      //   "sonarjs/no-unused-vars": "off",
      //   "sonarjs/no-dead-store": "off",
      // },
    },
  ],
).removeRules(["unicorn/no-empty-file"]);
// replace local config
// .onResolved((configs) => {
//   configs.forEach((config) => {
//     if (config?.plugins?.antfu) config.plugins.antfu = local;
//   });
// });

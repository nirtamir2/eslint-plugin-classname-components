import nirtamir2 from "@nirtamir2/eslint-config";

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
      ignores: ["src/rules/*.md"],
    },
    {
      files: ["**/*"],
    },
  ],
).removeRules(["unicorn/no-empty-file"]);

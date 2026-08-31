import nirtamir2 from "@nirtamir2/eslint-config";

export default nirtamir2(
  {
    type: "lib",
  },
  [
    {
      ignores: ["vendor", "examples/**"],
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
      files: ["package.json"],
      rules: {
        "e18e/ban-dependencies": "off",
      },
    },
  ],
).removeRules(["unicorn/no-empty-file"]);

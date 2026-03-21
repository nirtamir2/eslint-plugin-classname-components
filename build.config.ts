import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index", "src/config", "src/types"],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
  externals: ["@typescript-eslint/utils", "typescript"],
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import * as typescriptEslintParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import { plugin } from "../plugin";

const DEMO_PLUGIN_NAME = "classname-components-demo";
type DemoRuleConfig = Record<
  | `${typeof DEMO_PLUGIN_NAME}/no-classname-prop-in-styled-components`
  | `${typeof DEMO_PLUGIN_NAME}/no-classname-prop-merge-in-styled-components`
  | `${typeof DEMO_PLUGIN_NAME}/prefer-plain-props-parameter`
  | `${typeof DEMO_PLUGIN_NAME}/prefer-static-classname-in-styled-components`,
  "off" | "error"
>;

const ALL_RULES: DemoRuleConfig = {
  [`${DEMO_PLUGIN_NAME}/no-classname-prop-in-styled-components`]: "error",
  [`${DEMO_PLUGIN_NAME}/no-classname-prop-merge-in-styled-components`]: "error",
  [`${DEMO_PLUGIN_NAME}/prefer-plain-props-parameter`]: "error",
  [`${DEMO_PLUGIN_NAME}/prefer-static-classname-in-styled-components`]: "error",
};

const MERGE_ONLY_RULES: DemoRuleConfig = {
  [`${DEMO_PLUGIN_NAME}/no-classname-prop-in-styled-components`]: "off",
  [`${DEMO_PLUGIN_NAME}/no-classname-prop-merge-in-styled-components`]: "error",
  [`${DEMO_PLUGIN_NAME}/prefer-plain-props-parameter`]: "off",
  [`${DEMO_PLUGIN_NAME}/prefer-static-classname-in-styled-components`]: "off",
};

const PREFER_STATIC_ONLY_RULES: DemoRuleConfig = {
  [`${DEMO_PLUGIN_NAME}/no-classname-prop-in-styled-components`]: "off",
  [`${DEMO_PLUGIN_NAME}/no-classname-prop-merge-in-styled-components`]: "off",
  [`${DEMO_PLUGIN_NAME}/prefer-plain-props-parameter`]: "off",
  [`${DEMO_PLUGIN_NAME}/prefer-static-classname-in-styled-components`]: "error",
};

export const SHADCN_ALERT_DEMO_PATH = path.resolve(
  process.cwd(),
  "examples/shadcn-alert.demo.tsx",
);

export const SHADCN_ALERT_FIXED_PATH = path.resolve(
  process.cwd(),
  "examples/shadcn-alert.fixed.tsx",
);

export interface DemoMessage {
  column: number;
  line: number;
  message: string;
  ruleId: string | null;
}

export interface DemoLintResult {
  fixedCode: string;
  messages: Array<DemoMessage>;
}

export interface ShadcnAlertDemoRun {
  expectedFixedCode: string;
  fullAutofix: DemoLintResult;
  mergeOnlyAutofix: DemoLintResult;
  original: DemoLintResult;
  preferStaticAfterMerge: DemoLintResult;
  source: string;
}

async function lintSource({
  fix,
  rules,
  source,
}: {
  fix: boolean;
  rules: DemoRuleConfig;
  source: string;
}): Promise<DemoLintResult> {
  const eslint = new ESLint({
    cwd: process.cwd(),
    fix,
    ignore: false,
    overrideConfig: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parser: typescriptEslintParser,
          parserOptions: {
            ecmaFeatures: {
              jsx: true,
            },
            projectService: {
              allowDefaultProject: ["examples/*.tsx"],
            },
          },
        },
        plugins: {
          [DEMO_PLUGIN_NAME]: plugin,
        },
        rules,
      },
    ],
    overrideConfigFile: true,
  });

  const [result] = await eslint.lintText(source, {
    filePath: SHADCN_ALERT_DEMO_PATH,
  });

  if (result == null) {
    throw new Error("Expected a lint result for the shadcn Alert demo.");
  }

  return {
    fixedCode: result.output ?? source,
    messages: result.messages.map((message) => {
      return {
        column: message.column,
        line: message.line,
        message: message.message,
        ruleId: message.ruleId,
      };
    }),
  };
}

export function countMessagesByRule(
  messages: Array<DemoMessage>,
): Record<string, number> {
  return messages.reduce<Record<string, number>>((counts, message) => {
    const key = message.ruleId ?? "<unknown>";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export async function runShadcnAlertDemo(): Promise<ShadcnAlertDemoRun> {
  const [source, expectedFixedCode] = await Promise.all([
    readFile(SHADCN_ALERT_DEMO_PATH, "utf8"),
    readFile(SHADCN_ALERT_FIXED_PATH, "utf8"),
  ]);

  const original = await lintSource({
    fix: false,
    rules: ALL_RULES,
    source,
  });
  const mergeOnlyAutofix = await lintSource({
    fix: true,
    rules: MERGE_ONLY_RULES,
    source,
  });
  const preferStaticAfterMerge = await lintSource({
    fix: false,
    rules: PREFER_STATIC_ONLY_RULES,
    source: mergeOnlyAutofix.fixedCode,
  });
  const fullAutofix = await lintSource({
    fix: true,
    rules: ALL_RULES,
    source,
  });

  return {
    expectedFixedCode,
    fullAutofix,
    mergeOnlyAutofix,
    original,
    preferStaticAfterMerge,
    source,
  };
}

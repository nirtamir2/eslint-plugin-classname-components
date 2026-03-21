import tsParser from "@typescript-eslint/parser";
import type {
  InvalidTestCase,
  RuleTesterInitOptions,
  TestCasesOptions,
  TestExecutionResult,
  ValidTestCase,
} from "eslint-vitest-rule-tester";
import { runClassic as _runClassic } from "eslint-vitest-rule-tester";

function removeConfigLookupWarnings(result: {
  messages: Array<{ message: string }>;
}): void {
  result.messages = result.messages.filter((message) => {
    return !message.message.startsWith("No matching configuration found for ");
  });
}

function withFilteredOnResult<
  T extends InvalidTestCase | ValidTestCase,
>(cases: Array<T> | undefined): Array<T> | undefined {
  return cases?.map((testcase) => {
    if (typeof testcase === "string") {
      return {
        code: testcase,
        onResult: removeConfigLookupWarnings,
      } as unknown as T;
    }

    const testcaseObject = testcase as Exclude<T, string> & {
      onResult?: (result: TestExecutionResult) => Promise<void> | void;
    };
    const originalOnResult = testcaseObject.onResult;
    return {
      ...testcaseObject,
      onResult: async (result: TestExecutionResult) => {
        removeConfigLookupWarnings(result);
        await originalOnResult?.(result);
      },
    } as unknown as T;
  });
}

export function run(options: TestCasesOptions & RuleTesterInitOptions): void {
  const { invalid, name, rule, valid, ...rest } = options;

  if (name == null || rule == null) {
    throw new Error("Tests must provide both `name` and `rule`.");
  }

  const cases: TestCasesOptions = {};
  const normalizedInvalid = withFilteredOnResult(invalid);
  const normalizedValid = withFilteredOnResult(valid);

  if (normalizedInvalid != null) {
    cases.invalid = normalizedInvalid;
  }
  if (normalizedValid != null) {
    cases.valid = normalizedValid;
  }

  _runClassic(
    name,
    rule,
    cases,
    {
      languageOptions: {
        parser: tsParser,
      },
      ...rest,
    },
  );
}

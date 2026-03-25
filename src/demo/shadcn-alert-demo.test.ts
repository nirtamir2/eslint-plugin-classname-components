import { describe, expect, it } from "vitest";
import { countMessagesByRule, runShadcnAlertDemo } from "./shadcn-alert-demo";

describe("shadcn Alert demo", () => {
  it("shows the rules and autofixes on a realistic fixture", async () => {
    const demo = await runShadcnAlertDemo();

    expect(countMessagesByRule(demo.original.messages)).toEqual({
      "classname-components-demo/no-classname-prop-in-styled-components": 3,
      "classname-components-demo/no-classname-prop-merge-in-styled-components": 3,
      "classname-components-demo/prefer-static-classname-in-styled-components": 1,
    });

    expect(countMessagesByRule(demo.preferStaticAfterMerge.messages)).toEqual({
      "classname-components-demo/prefer-static-classname-in-styled-components": 1,
    });

    expect(demo.fullAutofix.fixedCode).toBe(demo.expectedFixedCode);
    expect(countMessagesByRule(demo.fullAutofix.messages)).toEqual({});
  });
});

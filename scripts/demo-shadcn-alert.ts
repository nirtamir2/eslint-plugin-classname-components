import {
  SHADCN_ALERT_DEMO_PATH,
  SHADCN_ALERT_FIXED_PATH,
  countMessagesByRule,
  runShadcnAlertDemo,
} from "../src/demo/shadcn-alert-demo";

function printRuleCounts(title: string, counts: Record<string, number>) {
  console.log(title);

  for (const [ruleId, count] of Object.entries(counts)) {
    console.log(`  ${count} x ${ruleId}`);
  }

  if (Object.keys(counts).length === 0) {
    console.log("  no messages");
  }
}

const demo = await runShadcnAlertDemo();

console.log("Shadcn Alert rule demo");
console.log(`Fixture: ${SHADCN_ALERT_DEMO_PATH}`);
console.log(`Expected fixed snapshot: ${SHADCN_ALERT_FIXED_PATH}`);
console.log("");

printRuleCounts(
  "Original fixture with all rules:",
  countMessagesByRule(demo.original.messages),
);
console.log("");

printRuleCounts(
  "After applying only no-classname-prop-merge autofix, prefer-static sees:",
  countMessagesByRule(demo.preferStaticAfterMerge.messages),
);
console.log("");

printRuleCounts(
  "Remaining messages after full autofix:",
  countMessagesByRule(demo.fullAutofix.messages),
);
console.log("");

console.log(
  demo.fullAutofix.fixedCode === demo.expectedFixedCode
    ? "Full autofix matches the checked-in fixed snapshot."
    : "Full autofix does not match the checked-in fixed snapshot.",
);
console.log("");
console.log("Autofixed output:");
console.log("");
console.log(demo.fullAutofix.fixedCode);

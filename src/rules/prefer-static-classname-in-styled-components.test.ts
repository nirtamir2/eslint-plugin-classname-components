import typescriptEslintParser from "@typescript-eslint/parser";
import { any as tsx } from "code-tag";
import { run } from "./_test";
import preferStaticClassnameInStyledComponents, {
  RULE_NAME,
} from "./prefer-static-classname-in-styled-components";

const setup = tsx`
  declare namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      button: {
        className?: string;
        disabled?: boolean;
        type?: "button" | "submit";
      };
      div: {
        className?: string;
      };
      span: {
        className?: string;
      };
    }
  }

  declare function clsx(...values: Array<unknown>): string;
  declare function cn(...values: Array<unknown>): string;
  declare function cva(
    base: string,
    config?: unknown,
  ): (options?: unknown) => string;
`;

const solidSetup = tsx`
  declare namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      button: {
        class?: string;
        disabled?: boolean;
        type?: "button" | "submit";
      };
      div: {
        class?: string;
      };
      span: {
        class?: string;
      };
    }
  }

  declare function clsx(...values: Array<unknown>): string;
  declare function cn(...values: Array<unknown>): string;
  declare function cva(
    base: string,
    config?: unknown,
  ): (options?: unknown) => string;
`;

run({
  name: RULE_NAME,
  rule: preferStaticClassnameInStyledComponents,
  languageOptions: {
    parser: typescriptEslintParser,
    parserOptions: {
      projectService: {
        allowDefaultProject: ["file.ts", "file.tsx"],
      },
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  valid: [
    tsx`
      ${setup};
      function Button() {
        return <button className="rounded px-4" />;
      }
    `,
    tsx`
      ${setup};
      function Button(props: { disabled?: boolean }) {
        return (
          <button className={clsx("rounded", props.disabled && "opacity-50")} />
        );
      }
    `,
    tsx`
      ${setup};
      const buttonVariants = cva("rounded");

      function Button(props: { variant?: "primary" | "secondary" }) {
        return (
          <button className={buttonVariants({ variant: props.variant })} />
        );
      }
    `,
    tsx`
      ${setup};
      function Button(props: JSX.IntrinsicElements["button"]) {
        return <button className={props.className} />;
      }
    `,
    tsx`
      ${setup};
      function Button(props: { sizeClass: string }) {
        return <button className={\`size-\${props.sizeClass}\`} />;
      }
    `,
    tsx`
      ${solidSetup};
      function Button() {
        return <button class="rounded px-4" />;
      }
    `,
    tsx`
      ${solidSetup};
      function Button(props: { disabled?: boolean }) {
        return (
          <button class={clsx("rounded", props.disabled && "opacity-50")} />
        );
      }
    `,
  ],
  invalid: [
    {
      name: "string literal wrapper becomes jsx string literal",
      code: tsx`
        ${setup};
        function Button() {
          return <button className={"rounded px-4"} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "template literal without expressions becomes jsx string literal",
      code: tsx`
        ${setup};
        function Button() {
          return <button className={\`rounded px-4\`} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "static const identifier becomes jsx string literal",
      code: tsx`
        ${setup};
        function Button() {
          const buttonClassName = "rounded px-4";
          return <button className={buttonClassName} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          const buttonClassName = "rounded px-4";
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "nested static const identifier becomes jsx string literal",
      code: tsx`
        ${setup};
        function Button() {
          const baseClassName = "rounded px-4";
          const buttonClassName = baseClassName;
          return <button className={buttonClassName} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          const baseClassName = "rounded px-4";
          const buttonClassName = baseClassName;
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "template literal with static const expression becomes jsx string literal",
      code: tsx`
        ${setup};
        function Button() {
          const baseClassName = "rounded";
          return <button className={\`\${baseClassName} px-4\`} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          const baseClassName = "rounded";
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "clsx single static argument becomes jsx string literal",
      code: tsx`
        ${setup};
        function Button() {
          return <button className={clsx("rounded")} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          return <button className="rounded" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "clsx static arguments collapse into one string literal",
      code: tsx`
        ${setup};
        function Button() {
          return <button className={clsx("rounded", "px-4")} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "cn static arguments collapse into one string literal",
      code: tsx`
        ${setup};
        function Button() {
          return <button className={cn("rounded", "px-4")} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button() {
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    // prettier-ignore
    {
      name: "clsx empty-string ternary becomes logical and",
      code: tsx`
        ${setup};
        function Button(props: { disabled?: boolean }) {
          return (
            <button
              className={clsx("rounded", props.disabled ? "opacity-50" : "")}
            />
          );
        }
      `,
      output: tsx`
        ${setup};
        function Button(props: { disabled?: boolean }) {
          return (
            <button
              className={clsx("rounded", (props.disabled) && "opacity-50")}
            />
          );
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    // prettier-ignore
    {
      name: "whitespace-delimited template literal becomes clsx call",
      code: tsx`
        ${setup};
        function Button(props: { disabled?: boolean }) {
          return (
            <button
              className={\`rounded px-4 \${props.disabled ? "opacity-50" : ""}\`}
            />
          );
        }
      `,
      output: tsx`
        ${setup};
        function Button(props: { disabled?: boolean }) {
          return (
            <button
              className={clsx("rounded px-4", (props.disabled) && "opacity-50")}
            />
          );
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    // prettier-ignore
    {
      name: "template literal variable becomes clsx call",
      code: tsx`
        ${setup};
        function Button(props: { toneClassName: string }) {
          const buttonClassName = \`rounded px-4 \${props.toneClassName}\`;
          return <button className={buttonClassName} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button(props: { toneClassName: string }) {
          const buttonClassName = \`rounded px-4 \${props.toneClassName}\`;
          return <button className={clsx("rounded px-4", props.toneClassName)} />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "clsx static arguments on class collapse into a class string literal",
      code: tsx`
        ${solidSetup};
        function Button() {
          return <button class={clsx("rounded", "px-4")} />;
        }
      `,
      output: tsx`
        ${solidSetup};
        function Button() {
          return <button class="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
    {
      name: "string literal wrapper on class becomes jsx string literal",
      code: tsx`
        ${solidSetup};
        function Button() {
          return <button class={"rounded px-4"} />;
        }
      `,
      output: tsx`
        ${solidSetup};
        function Button() {
          return <button class="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "preferStatic" }],
    },
  ],
});

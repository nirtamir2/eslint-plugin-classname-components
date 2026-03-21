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
  ],
});

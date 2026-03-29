import typescriptEslintParser from "@typescript-eslint/parser";
import { any as tsx } from "code-tag";
import { run } from "./_test";
import noClassnamePropMergeInStyledComponents, {
  RULE_NAME,
} from "./no-classname-prop-merge-in-styled-components";

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
  rule: noClassnamePropMergeInStyledComponents,
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
      name: "clsx merge drops destructured className prop",
      code: tsx`
        ${setup};
        function Button({ className }: { className?: string }) {
          return <button className={clsx("rounded", className)} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button({ className }: { className?: string }) {
          return <button className="rounded" />;
        }
      `,
      errors: [{ messageId: "forbid" }],
    },
    {
      name: "cn merge drops className prop and keeps static classes",
      code: tsx`
        ${setup};
        function Button({ className }: { className?: string }) {
          return <button className={cn("rounded", "px-4", className)} />;
        }
      `,
      output: tsx`
        ${setup};
        function Button({ className }: { className?: string }) {
          return <button className="rounded px-4" />;
        }
      `,
      errors: [{ messageId: "forbid" }],
    },
    {
      name: "button variants call remains after removing className merge",
      code: tsx`
        ${setup};
        const buttonVariants = cva("rounded");

        function Button({
          className,
          variant,
        }: {
          className?: string;
          variant?: "primary" | "secondary";
        }) {
          return (
            <button className={clsx(buttonVariants({ variant }), className)} />
          );
        }
      `,
      output: tsx`
        ${setup};
        const buttonVariants = cva("rounded");

        function Button({
          className,
          variant,
        }: {
          className?: string;
          variant?: "primary" | "secondary";
        }) {
          return <button className={buttonVariants({ variant })} />;
        }
      `,
      errors: [{ messageId: "forbid" }],
    },
    {
      name: "direct props.className passthrough reports without fix inside internally styled component",
      code: tsx`
        ${setup};
        function Button(props: JSX.IntrinsicElements["button"]) {
          return (
            <div>
              <button className="rounded" />
              <span className={props.className} />
            </div>
          );
        }
      `,
      errors: [{ messageId: "forbid" }],
    },
  ],
});

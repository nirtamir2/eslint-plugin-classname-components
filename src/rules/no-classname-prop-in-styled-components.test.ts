import typescriptEslintParser from "@typescript-eslint/parser";
import { any as tsx } from "code-tag";
import { run } from "./_test";
import noClassnamePropInStyledComponents, { RULE_NAME } from "./no-classname-prop-in-styled-components";

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
  declare function cva(
    base: string,
    config?: unknown,
  ): (options?: unknown) => string;
  declare function forwardRef<T, P>(
    render: (props: P, ref: T) => JSX.Element,
  ): (props: P) => JSX.Element;
  declare function memo<T>(component: T): T;
`;

run({
  name: RULE_NAME,
  rule: noClassnamePropInStyledComponents,
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
      ${setup}
      type Props = JSX.IntrinsicElements["button"];

      function Button(props: Props) {
        return <button className={props.className} />;
      }
    `,
    tsx`
      ${setup}
      type Props = JSX.IntrinsicElements["button"];

      function Button(props: Props) {
        return <button {...props} />;
      }
    `,
    tsx`
      ${setup}
      type NativeButtonProps = JSX.IntrinsicElements["button"];
      type Props = Omit<NativeButtonProps, "className"> & {
        variant?: "primary" | "secondary";
      };

      const buttonVariants = cva("rounded", {
        variants: {
          variant: {
            primary: "bg-black text-white",
            secondary: "bg-white text-black",
          },
        },
      });

      function Button(props: Props) {
        return <button className={buttonVariants({ variant: props.variant })} />;
      }
    `,
    tsx`
      ${setup}
      type Props = Omit<JSX.IntrinsicElements["button"], "className">;

      const Button = memo(
        forwardRef<unknown, Props>((props, ref) => {
          return <button className={clsx("rounded", props.disabled && "opacity-50")} />;
        }),
      );
    `,
  ],
  invalid: [
    {
      name: "string literal internal styles with inherited className props",
      code: tsx`
        ${setup}
        type Props = JSX.IntrinsicElements["button"];

        function Button(props: Props) {
          return <button className="rounded px-4" />;
        }
      `,
      errors: [
        {
          messageId: "forbid",
          suggestions: [{ messageId: "suggestOmit" }] as never,
        },
      ],
    },
    {
      name: "clsx merge still counts as internal styling",
      code: tsx`
        ${setup}
        function Button(
          { className }: { className?: string; disabled?: boolean },
        ) {
          return <button className={clsx("rounded", className)} />;
        }
      `,
      errors: [
        {
          messageId: "forbid",
          suggestions: [{ messageId: "suggestOmit" }] as never,
        },
      ],
    },
    {
      name: "cva styles on a memoized component still forbid className",
      code: tsx`
        ${setup}
        type Props = JSX.IntrinsicElements["button"];
        const buttonVariants = cva("rounded");

        const Button = memo((props: Props) => {
          return <button className={buttonVariants()} />;
        });
      `,
      errors: [
        {
          messageId: "forbid",
          suggestions: [{ messageId: "suggestOmit" }] as never,
        },
      ],
    },
  ],
});

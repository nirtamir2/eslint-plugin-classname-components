import typescriptEslintParser from "@typescript-eslint/parser";
import { any as tsx } from "code-tag";
import { run } from "./_test";
import noClassnamePropOnStyledComponents, { RULE_NAME } from "./no-classname-prop-on-styled-components";

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
`;

run({
  name: RULE_NAME,
  rule: noClassnamePropOnStyledComponents,
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
      type Props = {
        variant?: "primary";
      };

      function Button(props: Props) {
        return <button className="rounded px-4" />;
      }

      <Button />;
    `,
    tsx`
      ${setup}
      type Props = JSX.IntrinsicElements["button"];

      function Button(props: Props) {
        return <button className={props.className} />;
      }

      <Button className="mt-4" />;
    `,
    tsx`
      ${setup}
      <button className="mt-4" />;
    `,
    tsx`
      ${setup}
      type Props = Omit<JSX.IntrinsicElements["button"], "className">;

      const Button = forwardRef<unknown, Props>((props, ref) => {
        return <button className={clsx("rounded", props.disabled && "opacity-50")} />;
      });

      <Button />;
    `,
  ],
  invalid: [
    {
      name: "styled component rejects className at call site",
      code: tsx`
        ${setup}
        type Props = {
          variant?: "primary";
        };

        function Button(props: Props) {
          return <button className="rounded px-4" />;
        }

        <Button className="mt-4" />;
      `,
      errors: [
        {
          messageId: "forbid",
          suggestions: [{ messageId: "removeClassName" }] as never,
        },
      ],
    },
    {
      name: "cva styled component rejects className at call site",
      code: tsx`
        ${setup}
        const buttonVariants = cva("rounded");
        type Props = {
          variant?: "primary";
        };

        function Button(props: Props) {
          return <button className={buttonVariants({ variant: props.variant })} />;
        }

        <Button className="mt-4" />;
      `,
      errors: [
        {
          messageId: "forbid",
          suggestions: [{ messageId: "removeClassName" }] as never,
        },
      ],
    },
    {
      name: "forwardRef styled component rejects className at call site",
      code: tsx`
        ${setup}
        type Props = {
          disabled?: boolean;
        };

        const Button = forwardRef<unknown, Props>((props, ref) => {
          return <button className={clsx("rounded", props.disabled && "opacity-50")} />;
        });

        <Button className="mt-4" />;
      `,
      errors: [
        {
          messageId: "forbid",
          suggestions: [{ messageId: "removeClassName" }] as never,
        },
      ],
    },
  ],
});

import typescriptEslintParser from "@typescript-eslint/parser";
import { any as tsx } from "code-tag";
import { run } from "./_test";
import preferPlainPropsParameter, {
  RULE_NAME,
} from "./prefer-plain-props-parameter";

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
    }
  }

  declare function forwardRef<T, P>(
    render: (props: P, ref: T) => JSX.Element,
  ): (props: P) => JSX.Element;
  declare function memo<T>(component: T): T;
`;

run({
  name: RULE_NAME,
  rule: preferPlainPropsParameter,
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
      type Props = JSX.IntrinsicElements["button"];

      function Button(props: Props) {
        return <button {...props} />;
      }
    `,
    tsx`
      ${setup};
      type Props = JSX.IntrinsicElements["button"];

      function Button({ className, ...props }: Props) {
        return <button {...props} className={className} />;
      }
    `,
    tsx`
      ${setup};
      type Props = JSX.IntrinsicElements["button"];

      const Button = memo(
        forwardRef<unknown, Props>((props, ref) => {
          return <button {...props} />;
        }),
      );
    `,
  ],
  invalid: [
    {
      name: "function declaration rest-only props parameter becomes plain props",
      code: tsx`
        ${setup};
        type Props = JSX.IntrinsicElements["button"];

        function Button({ ...props }: Props) {
          return <button {...props} />;
        }
      `,
      output: tsx`
        ${setup};
        type Props = JSX.IntrinsicElements["button"];

        function Button(props: Props) {
          return <button {...props} />;
        }
      `,
      errors: [{ messageId: "preferPlainProps" }],
    },
    {
      name: "arrow component rest-only props parameter becomes plain props",
      code: tsx`
        ${setup};
        type Props = JSX.IntrinsicElements["button"];

        const Button = ({ ...props }: Props) => {
          return <button {...props} />;
        };
      `,
      output: tsx`
        ${setup};
        type Props = JSX.IntrinsicElements["button"];

        const Button = (props: Props) => {
          return <button {...props} />;
        };
      `,
      errors: [{ messageId: "preferPlainProps" }],
    },
    {
      name: "defaulted rest-only props parameter becomes plain props",
      code: tsx`
        ${setup};
        type Props = JSX.IntrinsicElements["button"];
        const fallbackProps = { type: "button" as const };

        function Button({ ...props }: Props = fallbackProps) {
          return <button {...props} />;
        }
      `,
      output: tsx`
        ${setup};
        type Props = JSX.IntrinsicElements["button"];
        const fallbackProps = { type: "button" as const };

        function Button(props: Props = fallbackProps) {
          return <button {...props} />;
        }
      `,
      errors: [{ messageId: "preferPlainProps" }],
    },
  ],
});

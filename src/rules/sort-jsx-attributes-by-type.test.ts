import typescriptEslintParser from "@typescript-eslint/parser";
import { isCI } from "ci-info";
import { any as tsx } from "code-tag";
import { run } from "./_test";
import rule, { RULE_NAME } from "./sort-jsx-attributes-by-type";

run({
  name: RULE_NAME,
  rule,
  languageOptions: {
    parser: typescriptEslintParser,
    parserOptions: {
      projectService: true,
      project: "./tsconfig.json",
      tsconfigRootDir: `${import.meta.dirname}/fixtures-jsx`,
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  valid: [
    tsx`
      function A(props: { a: string; b: string }) {}

      <A a="1" b="2" />;
    `,
    {
      skip: isCI,
      name: "includeJSXLowercaseTags option true with react ordered correctly",
      code: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        <div key="key" className="border" />;
      `,
      options: { includeJSXLowercaseTags: true },
    },
    {
      name: "option `componentNameRegex` with excluded unordered component",
      options: {
        componentNameRegex: "^(?!ExcludeComponent$|ExcludeComponent2$)[A-Z].*$",
      },
      code: tsx`
        type Props = {
          name: string;
          email: string;
        };

        export function ExcludeComponent(props: Props) {
          return <div />;
        }

        <ExcludeComponent email="email" name="name" />;
        <ExcludeComponent name="name" email="email" />;
      `,
    },
    {
      name: "includeJSXLowercaseTags option false with react unchecked",
      skip: isCI,
      code: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        <div className="border" key="key" />;
        <div key="key" className="border" />;
      `,
      options: { includeJSXLowercaseTags: false },
    },
  ],
  invalid: [
    {
      name: "includeJSXLowercaseTags true option with react with unordered",
      options: { includeJSXLowercaseTags: true },
      skip: isCI,
      code: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        <div className="border" key="key" />;
      `,
      output: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        <div key="key" className="border" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "inline type",
      code: tsx`
        function A(props: { a: string; b: string }) {}

        <A b="2" a="1" />;
      `,
      output: tsx`
        function A(props: { a: string; b: string }) {}

        <A a="1" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with type variable",
      code: tsx`
        type Props = { a: string; b: string };
        function A(props: Props) {}

        <A b="2" a="1" />;
      `,
      output: tsx`
        type Props = { a: string; b: string };
        function A(props: Props) {}

        <A a="1" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with interface",
      code: tsx`
        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        <A b="2" a="1" />;
      `,
      output: tsx`
        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        <A a="1" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with optional props",
      code: tsx`
        interface Props {
          a?: string;
          b?: string;
        }
        function A(props: Props) {}

        <A b="2" a="1" />;
      `,
      output: tsx`
        interface Props {
          a?: string;
          b?: string;
        }
        function A(props: Props) {}

        <A a="1" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with unknown props",
      code: tsx`
        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        <A b="2" unknown="s" a="1" />;
      `,
      output: tsx`
        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        <A a="1" unknown="s" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with JSXMemberExpression",
      code: tsx`
        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        const B = { A };

        <B.A b="2" a="1" />;
      `,
      output: tsx`
        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        const B = { A };

        <B.A a="1" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with JSXNamespacedName",
      code: tsx`
        declare namespace JSX {
          interface IntrinsicElements {
            "A:B": { a: string; b: string };
          }
        }

        <A:B b="2" a="1" />;
      `,
      output: tsx`
        declare namespace JSX {
          interface IntrinsicElements {
            "A:B": { a: string; b: string };
          }
        }

        <A:B a="1" b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with react basic",
      skip: isCI,
      code: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        <button className="a" type="button" />;
      `,
      output: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        <button type="button" className="a" />;
      `,

      errors: [{ messageId: "sort" }],
    },
    {
      name: "with react",
      skip: isCI,
      code: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        <A b="2" a="1" />;
      `,
      output: tsx`
        /// <reference types="react" />
        /// <reference types="react-dom" />

        interface Props {
          a: string;
          b: string;
        }
        function A(props: Props) {}

        <A a="1" b="2" />;
      `,

      errors: [{ messageId: "sort" }],
    },
    {
      name: "with spread",
      code: tsx`
        interface Props {
          a: string;
          b: string;
          c: string;
        }
        function A(props: Props) {}

        <A b="2" a="1" {...{ c: "" }} />;
      `,
      output: tsx`
        interface Props {
          a: string;
          b: string;
          c: string;
        }
        function A(props: Props) {}

        <A a="1" b="2" {...{ c: "" }} />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "with spread in the middle",
      code: tsx`
        interface Props {
          a: string;
          b: string;
          c: string;
        }
        function A(props: Props) {}

        <A b="2" {...{ c: "" }} a="1" />;
      `,
      output: tsx`
        interface Props {
          a: string;
          b: string;
          c: string;
        }
        function A(props: Props) {}

        <A a="1" {...{ c: "" }} b="2" />;
      `,
      errors: [{ messageId: "sort" }],
    },
    {
      name: "option `componentNameRegex` not excluded unordered component",
      options: {
        componentNameRegex: "^[A-Z].*$",
      },
      code: tsx`
        type Props = {
          name: string;
          email: string;
        };

        export function Example(props: Props) {
          const { email, name } = props;
        }

        <Example email="email" name="name" />;
      `,
      output: tsx`
        type Props = {
          name: string;
          email: string;
        };

        export function Example(props: Props) {
          const { email, name } = props;
        }

        <Example name="name" email="email" />;
      `,
      errors: [{ messageId: "sort" }],
    },
  ],
});

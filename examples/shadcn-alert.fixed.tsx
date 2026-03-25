// Self-contained demo fixture based on the current shadcn Alert component.
declare namespace JSX {
  interface Element {}

  interface IntrinsicElements {
    div: {
      "data-slot"?: string;
      children?: unknown;
      className?: string;
      role?: string;
    };
  }
}

declare namespace React {
  type ComponentProps<T extends keyof JSX.IntrinsicElements> =
    JSX.IntrinsicElements[T];
}

declare function cva(
  base: string,
  config?: unknown,
): (options?: unknown) => string;
declare function cn(...values: Array<unknown>): string;
type VariantProps<T> = T extends (...args: Array<any>) => any
  ? { variant?: "default" | "destructive" }
  : never;

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({ variant, ...props }: Omit<React.ComponentProps<"div"> & VariantProps<typeof alertVariants>, "className">) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={alertVariants({ variant })}
      {...props}
    />
  );
}

function AlertTitle({ ...props }: Omit<React.ComponentProps<"div">, "className">) {
  return (
    <div
      data-slot="alert-title"
      className="col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight"
      {...props}
    />
  );
}

function AlertDescription({ ...props }: Omit<React.ComponentProps<"div">, "className">) {
  return (
    <div
      data-slot="alert-description"
      className="col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&amp;_p]:leading-relaxed"
      {...props}
    />
  );
}

function AlertStaticExample() {
  return <div className="rounded-lg border" />;
}

export { Alert, AlertTitle, AlertDescription, AlertStaticExample };

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Aether button. Every variant is expressed through design-system
 * tokens; components must never override colours inline.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_0_0_oklch(1_0_0/25%)_inset]",
        hero: "bg-primary text-primary-foreground shadow-glow hover:brightness-110 active:translate-y-px",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:bg-surface-raised hover:border-primary/40",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-raised",
        subtle: "bg-surface-raised text-foreground border border-border hover:border-border-strong",
        ghost: "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        brass: "bg-brass text-brass-foreground hover:brightness-110",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        danger:
          "border border-destructive/45 bg-destructive/12 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 has-[>svg]:px-3.5",
        xs: "h-7 rounded-sm px-2 text-xs has-[>svg]:px-1.5",
        sm: "h-9 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

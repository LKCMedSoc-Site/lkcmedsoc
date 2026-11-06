import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui button, recoloured to the brand.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg border font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-p700 text-white border-p700 hover:bg-p900',
        outline: 'bg-white text-p700 border-p700 hover:bg-p100',
        danger: 'bg-white text-bad border-bad hover:bg-red-50',
        onDark: 'bg-white text-p900 border-white hover:bg-p100',
      },
      size: { default: 'px-4 py-2.5', sm: 'px-3 py-1.5 text-sm', lg: 'px-6 py-3 text-lg' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
export { buttonVariants };

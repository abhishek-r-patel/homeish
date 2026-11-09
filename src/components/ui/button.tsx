// Shared button primitive using the documented semantic design tokens.
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-brand bg-brand text-on-brand hover:bg-brand-hover',
  secondary:
    'border border-rule-strong bg-surface text-ink hover:bg-surface-sunken',
  destructive: 'border border-danger bg-danger text-surface hover:bg-danger/90',
};

export function Button({
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`min-h-12 rounded-md px-space-4 text-body-strong outline-none transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}

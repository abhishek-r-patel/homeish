// Shared button primitive with tokenized variants and stable loading layout.
'use client';

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'destructive' | 'success';
type ButtonSize = 'default' | 'guard';

type ButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> & {
  className?: string;
  leadingIcon?: ReactNode;
  loading?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export type ButtonProps =
  | (ButtonBaseProps & {
      'aria-label': string;
      children?: never;
      iconOnly: true;
      leadingIcon: ReactNode;
    })
  | (ButtonBaseProps & {
      'aria-label'?: string;
      children: ReactNode;
      iconOnly?: false;
    });

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-brand bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover',
  secondary:
    'border border-rule-strong bg-surface text-ink hover:bg-surface-sunken active:bg-surface-sunken',
  tertiary:
    'border border-transparent bg-transparent text-brand hover:underline focus-visible:underline active:underline',
  destructive:
    'border border-danger bg-danger text-surface hover:opacity-90 active:opacity-80',
  success:
    'border border-success bg-success text-surface hover:opacity-90 active:opacity-80',
};

export function Button(props: ButtonProps) {
  const {
    'aria-label': ariaLabel,
    buttonRef,
    children,
    className = '',
    disabled = false,
    iconOnly = false,
    leadingIcon,
    loading = false,
    size = 'default',
    type = 'button',
    variant = 'primary',
    ...buttonProps
  } = props;
  const unavailable = disabled || loading;

  return (
    <button
      {...buttonProps}
      aria-busy={loading || undefined}
      aria-disabled={unavailable || undefined}
      aria-label={ariaLabel}
      className={`inline-flex min-h-12 w-full min-w-30 items-center justify-center gap-space-2 rounded-md px-space-4 text-body-strong outline-none transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 medium:w-auto ${size === 'guard' ? 'min-h-14' : ''} ${iconOnly ? 'h-12 min-w-12 px-0' : ''} ${variantClasses[variant]} ${className}`}
      disabled={unavailable}
      ref={buttonRef}
      type={type}
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center"
      >
        {loading ? (
          <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
        ) : (
          leadingIcon
        )}
      </span>
      {iconOnly ? null : <span>{children}</span>}
    </button>
  );
}

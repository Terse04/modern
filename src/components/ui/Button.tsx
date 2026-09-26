import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'secondary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cream/40 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-accent-cream text-bg hover:bg-accent-creamHover font-semibold shadow-sm rounded-full',
      secondary:
        'bg-surface-elevated text-text-primary hover:bg-surface-hover border border-border rounded-full hover:border-border-focus',
      ghost:
        'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-subtle rounded-full',
      icon:
        'bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border rounded-full aspect-square p-2.5',
      danger:
        'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 rounded-full',
    };

    const sizes = {
      sm: 'text-xs px-3.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-3 gap-2.5',
      icon: 'p-2.5',
    };

    const appliedSize = variant === 'icon' ? sizes.icon : sizes[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${appliedSize} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

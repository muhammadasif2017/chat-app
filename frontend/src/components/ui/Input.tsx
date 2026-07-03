import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  loading?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, loading, id, className, ...props },
  ref,
) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block font-meta text-[11px] font-medium text-muted uppercase tracking-widest mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full border-b border-rule bg-transparent py-1.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-cobalt transition-colors disabled:text-muted disabled:cursor-not-allowed',
            loading && 'pr-5',
            className,
          )}
          {...props}
        />
        {loading && (
          <svg
            className="animate-spin absolute right-0 bottom-2 h-3.5 w-3.5 text-muted"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-ember">{error}</p>}
    </div>
  );
});

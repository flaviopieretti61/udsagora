import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface BaseProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;
type SelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement>;
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const InputField = forwardRef<HTMLInputElement, InputProps>(function InputField(
  { label, error, hint, required, className, ...rest },
  ref,
) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={rest.id ?? rest.name}>
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={rest.id ?? rest.name}
        className={clsx('input', error && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, hint, required, className, children, ...rest },
  ref,
) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={rest.id ?? rest.name}>
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}
      <select
        ref={ref}
        id={rest.id ?? rest.name}
        className={clsx('input', error && 'border-red-500')}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField(
  { label, error, hint, required, className, ...rest },
  ref,
) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={rest.id ?? rest.name}>
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={rest.id ?? rest.name}
        className={clsx('input min-h-[80px]', error && 'border-red-500')}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

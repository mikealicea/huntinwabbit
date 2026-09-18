'use client';
import { useState } from 'react';

export function PasswordField({
  name,
  label,
  autoComplete,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`input w-full pr-20 ${error ? 'input-error' : ''}`}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm absolute right-1 top-0 min-h-10"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

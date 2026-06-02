import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong while fetching data.", onRetry }: ErrorStateProps) {
  return (
    <div className="surface-card p-8 flex flex-col items-center justify-center text-center animate-fade-up">
      <div className="size-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-4">
        <AlertCircle className="size-6" />
      </div>
      <h3 className="text-lg font-bold mb-2 text-foreground">Error Loading Data</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-[var(--border)] transition font-medium text-sm"
          style={{ borderColor: 'var(--border)' }}
        >
          <RefreshCcw className="size-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

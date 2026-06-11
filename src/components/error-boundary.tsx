"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 mb-2">Something went wrong</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

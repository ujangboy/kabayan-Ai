import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card-base text-center max-w-sm w-full p-8">
            <p className="text-danger text-lg font-semibold mb-2">Something went wrong</p>
            <p className="text-sm text-text-secondary mb-4">{this.state.error?.message || 'Unknown error'}</p>
            <button onClick={() => window.location.reload()} className="btn-primary text-sm">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Component } from 'react';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card-base text-center max-w-sm w-full p-8">
            <p className="text-danger text-lg font-semibold mb-2">{t('errorBoundary.title')}</p>
            <p className="text-sm text-text-secondary mb-4">{this.state.error?.message || t('errorBoundary.message')}</p>
            <div className="flex justify-center gap-2">
              <button onClick={this.reset} className="btn-ghost text-sm">{t('errorBoundary.retry')}</button>
              <button onClick={() => window.location.reload()} className="btn-primary text-sm">{t('errorBoundary.reload')}</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
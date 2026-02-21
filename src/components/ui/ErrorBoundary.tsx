import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-ludiko-pink/10 to-white">
          <span className="text-6xl mb-4">😵</span>
          <h1 className="text-2xl font-bold mb-2">Oops!</h1>
          <p className="text-gray-500 mb-6">Something went wrong.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.href = import.meta.env.BASE_URL || '/';
            }}
            className="bg-ludiko-blue px-6 py-3 rounded-xl font-bold text-ludiko-text shadow-md hover:shadow-lg transition-all"
          >
            Go Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

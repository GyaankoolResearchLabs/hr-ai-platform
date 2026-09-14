import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { reportClientError } from "../../services/clientErrorReportService";

/*
|--------------------------------------------------------------------------
| ERROR BOUNDARY
|--------------------------------------------------------------------------
|
| Top-level React error boundary (wrapped around <App /> in main.jsx).
| Catches a render-time crash anywhere in the tree, reports it to the
| same platform_error_logs table the server captures into (via
| services/clientErrorReportService.js — a fire-and-forget beacon, never
| blocking or throwing itself), and shows a plain, generic fallback —
| never the raw error/stack — to the end user.
|--------------------------------------------------------------------------
*/
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportClientError({
      error,
      componentStack: info?.componentStack || null,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
          <p className="text-sm font-medium text-ink-800">
            Something went wrong. Please refresh the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

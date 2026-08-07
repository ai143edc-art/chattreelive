import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: (err as Error)?.message || 'Something went wrong.' };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', err, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
        textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#0b141a',
      }}>
        <div style={{ fontSize: 40 }}>💬</div>
        <h2 style={{ margin: 0 }}>Oops — something broke</h2>
        <p style={{ margin: 0, opacity: 0.7, maxWidth: 420 }}>
          The app hit an unexpected error. Your saved chats are safe. Try reloading.
        </p>
        <button
          onClick={() => location.reload()}
          style={{
            padding: '10px 20px', borderRadius: 999, border: 'none',
            background: '#128c7e', color: '#fff', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

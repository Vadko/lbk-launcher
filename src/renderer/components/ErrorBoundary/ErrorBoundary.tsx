import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] React error caught:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Send error to main process for logging
    if (window.api?.logError) {
      window.api.logError(`[Renderer Error] ${error.message}`, error.stack || '');
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleClearCacheOnly = (): void => {
    if (window.api?.clearCacheOnly) {
      window.api.clearCacheOnly().then(() => {
        // App will restart automatically
      });
    } else {
      window.location.reload();
    }
  };

  handleClearAllData = (): void => {
    if (window.api?.clearAllData) {
      window.api.clearAllData().then(() => {
        // App will restart automatically
      });
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#0a0e14',
            color: '#e0e0e0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                maxWidth: '800px',
                width: '100%',
                backgroundColor: '#141922',
                borderRadius: '12px',
                padding: '32px',
                border: '1px solid #1e2530',
              }}
            >
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  color: '#ff6b6b',
                }}
              >
                Помилка застосунку
              </h1>

              <p style={{ fontSize: '16px', marginBottom: '24px', lineHeight: '1.5' }}>
                На жаль, сталася помилка. Спробуйте один з варіантів нижче:
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '32px',
                }}
              >
                <button
                  onClick={this.handleReload}
                  style={{
                    padding: '14px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: '#4a9eff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#3d8de6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#4a9eff';
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    1. Перезавантажити
                  </div>
                  <div style={{ fontSize: '12px', opacity: '0.9' }}>
                    Швидке виправлення (зберігає всі дані)
                  </div>
                </button>

                <button
                  onClick={this.handleClearCacheOnly}
                  style={{
                    padding: '14px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: '#ffa834',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e89525';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffa834';
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    2. Очистити кеш
                  </div>
                  <div style={{ fontSize: '12px', opacity: '0.9' }}>
                    Видалить тимчасові файли (зберігає налаштування)
                  </div>
                </button>

                <button
                  onClick={this.handleClearAllData}
                  style={{
                    padding: '14px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e85555';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ff6b6b';
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    3. Очистити всі дані ⚠️
                  </div>
                  <div style={{ fontSize: '12px', opacity: '0.9' }}>
                    Видалить налаштування, підписки та всі дані
                  </div>
                </button>
              </div>

              <details
                style={{
                  backgroundColor: '#0f1419',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #1e2530',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: '500',
                    marginBottom: '12px',
                    userSelect: 'none',
                  }}
                >
                  Технічна інформація
                </summary>

                <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <strong style={{ color: '#ff6b6b' }}>Помилка:</strong>
                    <pre
                      style={{
                        marginTop: '8px',
                        padding: '12px',
                        backgroundColor: '#000',
                        borderRadius: '4px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {this.state.error?.toString()}
                    </pre>
                  </div>

                  {this.state.error?.stack && (
                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ color: '#ffd93d' }}>Stack trace:</strong>
                      <pre
                        style={{
                          marginTop: '8px',
                          padding: '12px',
                          backgroundColor: '#000',
                          borderRadius: '4px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '11px',
                        }}
                      >
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}

                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong style={{ color: '#6bcf7f' }}>Component stack:</strong>
                      <pre
                        style={{
                          marginTop: '8px',
                          padding: '12px',
                          backgroundColor: '#000',
                          borderRadius: '4px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '11px',
                        }}
                      >
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

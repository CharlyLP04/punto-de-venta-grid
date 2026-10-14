import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SessionProvider from './security/Session';
import './redesign.css';
import './management.css';
import './console.css';
import './switch.css';
import './accessibility.css';
import './refinements.css';
import './workspace-redesign.css';
import './character-theme.css';
import {InputModeProvider} from './ui/InputMode';
import {ThemeProvider} from './ui/Theme';

class RootErrorBoundary extends Component<{children:ReactNode}, {hasError:boolean;error:string}> {
  constructor(props:{children:ReactNode}) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || String(error) };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RootErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="startup" role="alert" style={{padding: '30px', textAlign: 'center'}}>
          <h1>Ocurrió un problema en la pantalla</h1>
          <p style={{color: '#c0392b', margin: '15px 0'}}>{this.state.error}</p>
          <button className="primary" style={{padding: '10px 20px', borderRadius: '10px', cursor: 'pointer'}} onClick={() => window.location.reload()}>
            Recargar punto de venta
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <ThemeProvider>
        <InputModeProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </InputModeProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);



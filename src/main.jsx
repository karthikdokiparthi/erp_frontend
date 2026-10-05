import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if (window.location.hostname === 'localhost') {
  const next = new URL(window.location.href);
  next.hostname = '127.0.0.1';
  window.location.replace(next.toString());
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

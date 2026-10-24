import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Register Service Worker for offline shell and practice mode
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

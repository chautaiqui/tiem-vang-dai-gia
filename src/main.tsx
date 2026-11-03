import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useGame } from './stores/gameStore';
import './index.css';

// Expose the store in dev builds for debugging / automated play-testing.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

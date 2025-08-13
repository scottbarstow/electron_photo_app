import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Add global styles including the spinner animation
const globalStyles = `
  * {
    box-sizing: border-box;
  }
  
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f5f5f5;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  button:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  button:active:not(:disabled) {
    transform: translateY(0);
  }
  
  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
`;

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);

// Get the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Make sure there is an element with id="root" in your HTML.');
}

// Create React root and render the app
const root = createRoot(rootElement);
root.render(<App />);

console.log('React app initialized successfully');
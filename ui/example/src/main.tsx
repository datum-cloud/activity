import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../src/styles.css'; // Import component library styles
import '../../src/autocomplete-styles.css'; // Import autocomplete styles
import '../../src/simple-query-builder-styles.css'; // Import simple query builder styles
import '../../src/datetime-range-picker-styles.css'; // Import datetime range picker styles
import './index.css';
import './app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

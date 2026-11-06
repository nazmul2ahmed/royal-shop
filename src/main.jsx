import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import './index.css';
import App from './App.jsx';
import { businessConfig } from './config/business.config.js';
import { ThemeProvider } from './context/ThemeContext.jsx';

const { primaryColor, secondaryColor, backgroundColor } = businessConfig.branding;

document.documentElement.style.setProperty('--royal-green', primaryColor);
document.documentElement.style.setProperty('--golden-yellow', secondaryColor);
document.documentElement.style.setProperty('--soft-cream', backgroundColor);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AdminAuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
        </AdminAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
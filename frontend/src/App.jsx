import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import TopNavbar from './components/TopNavbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import AiReceiptImport from './pages/AiReceiptImport';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Warehouses from './pages/Warehouses';
import Receipts from './pages/Receipts';
import Deliveries from './pages/Deliveries';
import Transfers from './pages/Transfers';
import Adjustments from './pages/Adjustments';
import Ledger from './pages/Ledger';
import ReorderRules from './pages/ReorderRules';
import InventoryIntelligence from './pages/InventoryIntelligence';
import FutureControl from './pages/FutureControl';
import CopilotDrawer from './components/CopilotDrawer';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F7F3',
        color: '#202020',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#F4D21F',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(244, 210, 31, 0.3)'
          }}>
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '2px',
              background: '#202020',
              transform: 'rotate(45deg)'
            }} />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#202020', marginBottom: '0.25rem' }}>
            Loading StockSense...
          </div>
          <div style={{ fontSize: '0.82rem', color: '#777777' }}>
            Synchronizing inventory operations & intelligence
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authMode === 'register') {
      return <Register onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthMode('register')} />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'future-control':
        return <FutureControl />;
      case 'ml-intelligence':
        return <InventoryIntelligence />;
      case 'ai-receipt':
        return <AiReceiptImport />;
      case 'products':
        return <Products />;
      case 'categories':
        return <Categories />;
      case 'suppliers':
        return <Suppliers />;
      case 'warehouses':
        return <Warehouses />;
      case 'receipts':
        return <Receipts />;
      case 'deliveries':
        return <Deliveries />;
      case 'transfers':
        return <Transfers />;
      case 'adjustments':
        return <Adjustments />;
      case 'ledger':
        return <Ledger />;
      case 'reorder':
        return <ReorderRules />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      {/* Editorial Horizontal Top Navbar */}
      <TopNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* Main Page Area */}
      <main className="main-content">
        {renderActiveTab()}
      </main>

      {/* Clean Agentic Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        setIsOpen={setIsCopilotOpen}
      />
    </div>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;

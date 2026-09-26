import React from 'react';
import { 
  LayoutDashboard, Package, Tag, Users, Warehouse, ArrowDownLeft, 
  ArrowUpRight, ArrowLeftRight, SlidersHorizontal, History, ShieldAlert, LogOut, Boxes, Sparkles, Brain
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ml-intelligence', label: 'ML Intelligence', icon: Brain },
    { id: 'ai-receipt', label: 'AI Receipt Import', icon: Sparkles },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'warehouses', label: 'Warehouses & Locations', icon: Warehouse },
    { id: 'receipts', label: 'Receipts (Incoming)', icon: ArrowDownLeft },
    { id: 'deliveries', label: 'Deliveries (Outgoing)', icon: ArrowUpRight },
    { id: 'transfers', label: 'Internal Transfers', icon: ArrowLeftRight },
    { id: 'adjustments', label: 'Inventory Adjustments', icon: SlidersHorizontal },
    { id: 'ledger', label: 'Stock Movement Ledger', icon: History },
    { id: 'reorder', label: 'Reordering Rules', icon: ShieldAlert },
  ];

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {/* App Brand Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--glass-glow)'
        }}>
          <Boxes size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>StockSense</h2>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Core IMS v1.0</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', padding: '0.5rem 0.75rem', marginBottom: '0.25rem' }}>
          Inventory Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.7rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: isActive ? '#60a5fa' : '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                marginBottom: '0.25rem',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={18} color={isActive ? '#3b82f6' : '#94a3b8'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div style={{
        padding: '1rem 1.25rem',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div 
          onClick={() => setActiveTab('profile')}
          title="View Profile"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', cursor: 'pointer', flex: 1 }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#f8fafc'
          }}>
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.username || 'User'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 500 }}>
              {user?.role || 'Staff'}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          title="Sign Out"
          style={{
            background: 'none',
            border: 'none',
            color: '#ef4444',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

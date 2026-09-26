import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, Package, Warehouse, History, SlidersHorizontal, Tag, ShieldAlert,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Sparkles, Users,
  BarChart2, Brain, Compass, Bot, ChevronDown, Bell, User, LogOut, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TopNavbar = ({ activeTab, setActiveTab, onOpenCopilot }) => {
  const { user, logout } = useAuth();
  
  // Dropdown states: 'inventory' | 'operations' | 'intelligence' | 'user' | null
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dropdown items definitions matching user specification
  const inventoryItems = [
    { id: 'products', label: 'Products', icon: Package },
    { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
    { id: 'ledger', label: 'Stock', icon: History },
    { id: 'adjustments', label: 'Adjustments', icon: SlidersHorizontal },
    { isDivider: true },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'reorder', label: 'Reorder Rules', icon: ShieldAlert }
  ];

  const operationsItems = [
    { id: 'receipts', label: 'Receipts', icon: ArrowDownLeft },
    { id: 'deliveries', label: 'Deliveries', icon: ArrowUpRight },
    { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
    { id: 'ai-receipt', label: 'AI Import', icon: Sparkles },
    { isDivider: true },
    { id: 'suppliers', label: 'Suppliers', icon: Users }
  ];

  const intelligenceItems = [
    { 
      id: 'dashboard-analytics', 
      label: 'Analytics', 
      icon: BarChart2, 
      isAction: true, 
      action: () => { 
        setActiveTab('dashboard'); 
        setTimeout(() => { 
          const el = document.getElementById('analytics-section'); 
          if (el) el.scrollIntoView({ behavior: 'smooth' }); 
        }, 120); 
      } 
    },
    { id: 'ml-intelligence', label: 'ML Intelligence', icon: Brain },
    { id: 'future-control', label: 'Future Control', icon: Compass },
    { 
      id: 'ai-copilot-item', 
      label: 'AI Copilot', 
      icon: Bot, 
      isAction: true, 
      action: () => { 
        if (onOpenCopilot) onOpenCopilot(); 
      } 
    }
  ];

  // Group active checks
  const isDashboardActive = activeTab === 'dashboard';
  const isInventoryActive = ['products', 'warehouses', 'ledger', 'adjustments', 'categories', 'reorder'].includes(activeTab);
  const isOperationsActive = ['receipts', 'deliveries', 'transfers', 'ai-receipt', 'suppliers'].includes(activeTab);
  const isIntelligenceActive = ['ml-intelligence', 'future-control'].includes(activeTab);

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  };

  return (
    <header 
      ref={navRef}
      style={{
        height: '66px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E7E7E2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        fontFamily: 'var(--font-ui)'
      }}
    >
      {/* LEFT: StockSense Logo */}
      <div 
        onClick={() => handleSelectTab('dashboard')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#F4D21F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            width: '13px',
            height: '13px',
            borderRadius: '2.5px',
            backgroundColor: '#202020',
            transform: 'rotate(45deg)'
          }} />
        </div>
        <span style={{
          fontSize: '1.22rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#202020'
        }}>
          StockSense
        </span>
      </div>

      {/* MAIN NAV: Minimal Calm Desktop Nav (4 items only) */}
      <nav 
        className="desktop-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}
      >
        {/* 1. Dashboard (Direct Navigation) */}
        <button
          onClick={() => handleSelectTab('dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.45rem 1.15rem',
            borderRadius: '9999px',
            border: 'none',
            backgroundColor: isDashboardActive ? '#202020' : 'transparent',
            color: isDashboardActive ? '#FFFFFF' : '#202020',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (!isDashboardActive) e.currentTarget.style.backgroundColor = '#F7F7F3';
          }}
          onMouseLeave={(e) => {
            if (!isDashboardActive) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>Dashboard</span>
        </button>

        {/* 2. Inventory Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggleDropdown('inventory')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 1rem',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: isInventoryActive ? '#202020' : (openDropdown === 'inventory' ? '#F7F7F3' : 'transparent'),
              color: isInventoryActive ? '#FFFFFF' : '#202020',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isInventoryActive && openDropdown !== 'inventory') e.currentTarget.style.backgroundColor = '#F7F7F3';
            }}
            onMouseLeave={(e) => {
              if (!isInventoryActive && openDropdown !== 'inventory') e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>Inventory</span>
            <ChevronDown 
              size={13} 
              strokeWidth={2}
              color={isInventoryActive ? '#FFFFFF' : '#777777'} 
              style={{
                transform: openDropdown === 'inventory' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease'
              }}
            />
          </button>

          {openDropdown === 'inventory' && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E7E2',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              padding: '0.4rem',
              minWidth: '190px',
              zIndex: 1100
            }}>
              {inventoryItems.map((item, idx) => {
                if (item.isDivider) {
                  return <div key={`div-${idx}`} style={{ height: '1px', backgroundColor: '#E7E7E2', margin: '0.35rem 0.4rem' }} />;
                }
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#F7F7F3' : 'transparent',
                      color: isSelected ? '#202020' : '#444444',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F7F7F3';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon size={15} strokeWidth={1.8} color={isSelected ? '#202020' : '#777777'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Operations Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggleDropdown('operations')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 1rem',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: isOperationsActive ? '#202020' : (openDropdown === 'operations' ? '#F7F7F3' : 'transparent'),
              color: isOperationsActive ? '#FFFFFF' : '#202020',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isOperationsActive && openDropdown !== 'operations') e.currentTarget.style.backgroundColor = '#F7F7F3';
            }}
            onMouseLeave={(e) => {
              if (!isOperationsActive && openDropdown !== 'operations') e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>Operations</span>
            <ChevronDown 
              size={13} 
              strokeWidth={2}
              color={isOperationsActive ? '#FFFFFF' : '#777777'} 
              style={{
                transform: openDropdown === 'operations' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease'
              }}
            />
          </button>

          {openDropdown === 'operations' && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E7E2',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              padding: '0.4rem',
              minWidth: '190px',
              zIndex: 1100
            }}>
              {operationsItems.map((item, idx) => {
                if (item.isDivider) {
                  return <div key={`div-${idx}`} style={{ height: '1px', backgroundColor: '#E7E7E2', margin: '0.35rem 0.4rem' }} />;
                }
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#F7F7F3' : 'transparent',
                      color: isSelected ? '#202020' : '#444444',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F7F7F3';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon size={15} strokeWidth={1.8} color={isSelected ? '#202020' : '#777777'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Intelligence Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggleDropdown('intelligence')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 1rem',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: isIntelligenceActive ? '#202020' : (openDropdown === 'intelligence' ? '#F7F7F3' : 'transparent'),
              color: isIntelligenceActive ? '#FFFFFF' : '#202020',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isIntelligenceActive && openDropdown !== 'intelligence') e.currentTarget.style.backgroundColor = '#F7F7F3';
            }}
            onMouseLeave={(e) => {
              if (!isIntelligenceActive && openDropdown !== 'intelligence') e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>Intelligence</span>
            <ChevronDown 
              size={13} 
              strokeWidth={2}
              color={isIntelligenceActive ? '#FFFFFF' : '#777777'} 
              style={{
                transform: openDropdown === 'intelligence' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease'
              }}
            />
          </button>

          {openDropdown === 'intelligence' && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E7E2',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              padding: '0.4rem',
              minWidth: '190px',
              zIndex: 1100
            }}>
              {intelligenceItems.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.isAction) {
                        item.action();
                        setOpenDropdown(null);
                      } else {
                        handleSelectTab(item.id);
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#F7F7F3' : 'transparent',
                      color: isSelected ? '#202020' : '#444444',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F7F7F3';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon size={15} strokeWidth={1.8} color={isSelected ? '#202020' : '#777777'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* RIGHT: Notification Bell & Profile Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Notification Bell Icon */}
        <button
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid #E7E7E2',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#444444',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 0.12s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F7F7F3'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          title="Notifications"
        >
          <Bell size={16} strokeWidth={1.8} />
          <span style={{
            position: 'absolute',
            top: '8px',
            right: '9px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#F4D21F'
          }} />
        </button>

        {/* Profile / Avatar */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => toggleDropdown('user')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#202020',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            title="User Profile"
          >
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </button>

          {openDropdown === 'user' && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E7E2',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              padding: '0.5rem',
              minWidth: '190px',
              zIndex: 1100
            }}>
              <div style={{ padding: '0.4rem 0.6rem 0.5rem', borderBottom: '1px solid #E7E7E2', marginBottom: '0.35rem' }}>
                <div style={{ fontWeight: 600, color: '#202020', fontSize: '13px' }}>
                  {user?.username || 'User'}
                </div>
                <div style={{ fontSize: '11px', color: '#777777', marginTop: '1px' }}>
                  {user?.role || 'Administrator'}
                </div>
              </div>

              <button
                onClick={() => handleSelectTab('profile')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.5rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#202020',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F7F7F3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <User size={15} strokeWidth={1.8} color="#777777" />
                <span>My Profile</span>
              </button>

              <button
                onClick={logout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.5rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#D9534F',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginTop: '0.2rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDECEC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut size={15} strokeWidth={1.8} color="#D9534F" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-menu-trigger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid #E7E7E2',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer'
          }}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Responsive Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '66px',
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E7E7E2',
          padding: '1.25rem',
          boxShadow: '0 20px 25px rgba(0,0,0,0.1)',
          maxHeight: 'calc(100vh - 66px)',
          overflowY: 'auto',
          zIndex: 999
        }}>
          <button
            onClick={() => handleSelectTab('dashboard')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isDashboardActive ? '#202020' : '#F7F7F3',
              color: isDashboardActive ? '#FFFFFF' : '#202020',
              fontWeight: 600,
              fontSize: '13px',
              marginBottom: '1rem'
            }}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              Inventory
            </div>
            {inventoryItems.filter(i => !i.isDivider).map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.55rem 0.5rem',
                  border: 'none',
                  background: 'transparent',
                  color: activeTab === item.id ? '#202020' : '#666666',
                  fontWeight: activeTab === item.id ? 600 : 500,
                  fontSize: '13px',
                  textAlign: 'left'
                }}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              Operations
            </div>
            {operationsItems.filter(i => !i.isDivider).map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.55rem 0.5rem',
                  border: 'none',
                  background: 'transparent',
                  color: activeTab === item.id ? '#202020' : '#666666',
                  fontWeight: activeTab === item.id ? 600 : 500,
                  fontSize: '13px',
                  textAlign: 'left'
                }}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              Intelligence
            </div>
            {intelligenceItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isAction) {
                    item.action();
                    setMobileMenuOpen(false);
                  } else {
                    handleSelectTab(item.id);
                  }
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.55rem 0.5rem',
                  border: 'none',
                  background: 'transparent',
                  color: activeTab === item.id ? '#202020' : '#666666',
                  fontWeight: activeTab === item.id ? 600 : 500,
                  fontSize: '13px',
                  textAlign: 'left'
                }}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default TopNavbar;

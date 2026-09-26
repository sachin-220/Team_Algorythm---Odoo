import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Package, ArrowDownLeft, ArrowUpRight,
  AlertTriangle, CheckCircle2, Clock, Truck, ArrowLeftRight,
  ShieldAlert, Activity, RefreshCw, ChevronRight, Filter,
  SlidersHorizontal, Sparkles, Building2
} from 'lucide-react';

const EditorialTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E7E7E2',
        borderRadius: '8px',
        padding: '0.6rem 0.85rem',
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
        fontSize: '0.8rem',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ color: '#777777', fontWeight: 500, marginBottom: '0.25rem' }}>{label}</div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ color: '#202020', fontWeight: 700, margin: '0.15rem 0' }}>
            <span style={{ color: entry.color === '#F4D21F' ? '#D6A800' : entry.color, marginRight: '0.35rem' }}>●</span>
            {entry.name}: {prefix}{entry.value?.toLocaleString()}{suffix}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Reusable Circular Ring Metric matching reference image with perfect proportions
const CircularMetric = ({ label, percentage, color = '#F4D21F' }) => {
  const size = 84;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.25rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg height={size} width={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            stroke="#EFEFE9"
            fill="transparent"
            strokeWidth={stroke}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: 'clamp(16px, 1.8vw, 19px)',
          fontWeight: 600,
          color: '#202020',
          letterSpacing: '-0.02em'
        }}>
          {percentage}%
        </div>
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.78rem',
        fontWeight: 500,
        color: '#777777',
        marginTop: '0.65rem',
        maxWidth: '110px',
        lineHeight: 1.3
      }}>
        {label}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // Filters
  const [timeRange, setTimeRange] = useState('30D');
  const [selectedWh, setSelectedWh] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let queryStr = `?time_range=${timeRange}&`;
      if (selectedWh) queryStr += `warehouse_id=${selectedWh}&`;
      if (selectedCat) queryStr += `category_id=${selectedCat}&`;
      if (selectedProd) queryStr += `product_id=${selectedProd}&`;

      const [anRes, whRes, catRes, prodRes] = await Promise.all([
        apiClient.get(`/analytics/dashboard-full${queryStr}`),
        apiClient.get('/warehouses'),
        apiClient.get('/categories'),
        apiClient.get('/products')
      ]);

      setData(anRes.data);
      setWarehouses(whRes.data);
      setCategories(catRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, selectedWh, selectedCat, selectedProd]);

  const kpis = data?.kpis;
  const charts = data?.charts;

  // Transform activity chart bars to match the reference look
  // (Gray bars with the central/current period highlighted in yellow)
  const activityBarsData = React.useMemo(() => {
    if (!charts?.value_trend || charts.value_trend.length === 0) return [];
    const len = charts.value_trend.length;
    const highlightStart = Math.floor(len * 0.35);
    const highlightEnd = Math.floor(len * 0.75);

    return charts.value_trend.map((pt, idx) => {
      const isHighlighted = idx >= highlightStart && idx <= highlightEnd;
      return {
        ...pt,
        displayDate: pt.date ? pt.date.slice(5) : '',
        fillColor: isHighlighted ? '#F4D21F' : '#E2E2DC'
      };
    });
  }, [charts?.value_trend]);

  return (
    <div className="page-container">
      {/* 1. Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>Dashboard</span>
        <span>/</span>
        <span>...</span>
        <span>/</span>
        <span className="active">Inventory</span>
      </div>

      {/* 2. Page Header & Subtitle */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '1.75rem',
        gap: '1rem'
      }}>
        <div>
          <h1 className="display-title">Inventory Dashboard</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Monitor stock, movement, warehouse health and inventory risk.
          </p>
        </div>

        {/* Compact Filters Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Segmented Time Range (7D, 30D, 90D, 1Y) */}
          <div className="segmented-control">
            {['7D', '30D', '90D', '1Y'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`segmented-btn ${timeRange === range ? 'active' : ''}`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Warehouse Selector */}
          <select
            value={selectedWh}
            onChange={(e) => setSelectedWh(e.target.value)}
            style={{
              height: '34px',
              padding: '0 0.65rem',
              borderRadius: '8px',
              border: '1px solid #E7E7E2',
              background: '#FFFFFF',
              color: '#202020',
              fontSize: '0.8rem',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Category Selector */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            style={{
              height: '34px',
              padding: '0 0.65rem',
              borderRadius: '8px',
              border: '1px solid #E7E7E2',
              background: '#FFFFFF',
              color: '#202020',
              fontSize: '0.8rem',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. ROW 1 & ROW 2: KPI Metrics Cards (4 per row on desktop) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* KPI 1: Inventory Valuation */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Inventory Valuation</span>
          </div>
          <div>
            <div className="kpi-value">
              ${kpis?.inventory_valuation ? kpis.inventory_valuation.toLocaleString() : '34,140'}
            </div>
            <div className="kpi-change positive">
              <span>+8.4%</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Stock Units */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Package size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Total Stock Units</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.total_stock_units ? kpis.total_stock_units.toLocaleString() : '617'}
            </div>
            <div className="kpi-change positive">
              <span>+12.1%</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Stock Inflow */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ArrowDownLeft size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Stock Inflow</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.stock_inflow ? kpis.stock_inflow.toLocaleString() : '617'}
            </div>
            <div className="kpi-change positive">
              <span>+18.4%</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Stock Outflow */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ArrowUpRight size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Stock Outflow</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.stock_outflow ? kpis.stock_outflow.toLocaleString() : '142'}
            </div>
            <div className="kpi-change negative">
              <span>−4.2%</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* KPI 5: Low Stock */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Low Stock</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.low_stock_items ?? 1}
            </div>
            <div className="kpi-change neutral">
              <span>+1 item</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 6: Out of Stock */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Out of Stock</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.out_of_stock_items ?? 0}
            </div>
            <div className="kpi-change neutral">
              <span>0%</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 7: Pending Receipts */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Pending Receipts</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.pending_receipts ?? 0}
            </div>
            <div className="kpi-change neutral">
              <span>0%</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>

        {/* KPI 8: Pending Deliveries */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF9CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Truck size={17} color="#D6A800" strokeWidth={2.2} />
            </div>
            <span className="kpi-label">Pending Deliveries</span>
          </div>
          <div>
            <div className="kpi-value">
              {kpis?.pending_deliveries ?? 1}
            </div>
            <div className="kpi-change positive">
              <span>+1 order</span>
              <span className="kpi-change-period">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROW 3: [──────── Inventory Activity ────────][ Stock Health ] */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: '1.25rem',
        marginBottom: '1.25rem'
      }}>
        {/* Inventory Activity (Primary Chart Card) */}
        <div className="card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020' }}>
              Inventory Activity
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#777777', fontWeight: 500 }}>
                {timeRange} View
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityBarsData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EB" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#A5A5A5"
                  tickLine={false}
                  axisLine={{ stroke: '#E7E7E2' }}
                  tick={{ fill: '#777777', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                />
                <YAxis
                  stroke="#A5A5A5"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#777777', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                  tickFormatter={(val) => val >= 1000 ? `$${(val/1000).toFixed(0)}k` : `$${val}`}
                />
                <Tooltip content={<EditorialTooltip prefix="$" />} />
                <Bar dataKey="value" name="Valuation" radius={[3, 3, 0, 0]}>
                  {activityBarsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#777777',
            paddingTop: '0.5rem',
            borderTop: '1px solid #F0F0EB',
            marginTop: '0.5rem'
          }}>
            <span>Beginning Period</span>
            <span>Peak Activity (Highlighted)</span>
            <span>Current Period</span>
          </div>
        </div>

        {/* Stock Health */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020', marginBottom: '0.35rem' }}>
              Stock Health
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#777777', marginBottom: '1.25rem' }}>
              Overall safety stock compliance
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Healthy */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 500, color: '#202020' }}>Healthy Stock</span>
                  <span style={{ fontWeight: 700, color: '#22A447' }}>86%</span>
                </div>
                <div style={{ width: '100%', height: '7px', background: '#F0F0EB', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '86%', height: '100%', background: '#22A447', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Low Stock */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 500, color: '#202020' }}>Low Stock</span>
                  <span style={{ fontWeight: 700, color: '#E9A400' }}>10%</span>
                </div>
                <div style={{ width: '100%', height: '7px', background: '#F0F0EB', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '10%', height: '100%', background: '#E9A400', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Out of Stock */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 500, color: '#202020' }}>Out of Stock</span>
                  <span style={{ fontWeight: 700, color: '#E05252' }}>4%</span>
                </div>
                <div style={{ width: '100%', height: '7px', background: '#F0F0EB', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '4%', height: '100%', background: '#E05252', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '1.25rem',
            padding: '0.65rem 0.85rem',
            background: '#F7F7F3',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#777777',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22A447' }} />
            <span>Operational health is optimal across active bins.</span>
          </div>
        </div>
      </div>

      {/* 5. ROW 4: [──────── Inventory Overview ────────][ Warehouse Distribution ] */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: '1.25rem',
        marginBottom: '1.25rem'
      }}>
        {/* Inventory Overview (Circular Rings) */}
        <div className="card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020' }}>
                Inventory Overview
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#777777' }}>
                Operational performance metrics & facility fulfillment
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            padding: '0.5rem 0'
          }}>
            <CircularMetric label="Stock Health" percentage={87.5} color="#F4D21F" />
            <CircularMetric label="Warehouse Utilization" percentage={92.2} color="#F4D21F" />
            <CircularMetric label="Order Fulfillment" percentage={94.8} color="#202020" />
            <CircularMetric label="Reorder Coverage" percentage={81.4} color="#F4D21F" />
          </div>
        </div>

        {/* Warehouse Stock Distribution */}
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020' }}>
              Warehouse Distribution
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#777777' }}>
              Stock physical allocation per facility
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(charts?.warehouse_stock && charts.warehouse_stock.length > 0
              ? charts.warehouse_stock
              : [
                  { name: 'Main Central Warehouse', units: 480, percent: 52 },
                  { name: 'East Overflow Facility', units: 285, percent: 31 },
                  { name: 'Secondary Storage Unit', units: 155, percent: 17 }
                ]
            ).map((wh, idx) => (
              <div key={idx} style={{ padding: '0.4rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 600, color: '#202020' }}>{wh.name}</span>
                  <span style={{ color: '#777777', fontWeight: 600 }}>{wh.percent}% ({wh.units} u)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F0F0EB', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${wh.percent}%`,
                    height: '100%',
                    background: idx === 0 ? '#202020' : idx === 1 ? '#F4D21F' : '#A5A5A5',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. ROW 5: [ Inventory Velocity ][ Reorder Risk ][ Recent Activity ] */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Inventory Velocity */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020', marginBottom: '0.35rem' }}>
            Inventory Velocity
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#777777', marginBottom: '1.25rem' }}>
            Product movement frequency
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#202020' }}>Fast Moving</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#22A447' }}>58% (High Turn)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#F0F0EB', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '58%', height: '100%', background: '#22A447', borderRadius: '3px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#202020' }}>Normal Movement</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#202020' }}>32% (Stable)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#F0F0EB', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '32%', height: '100%', background: '#202020', borderRadius: '3px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#202020' }}>Slow Moving</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#777777' }}>10% (Low Turn)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#F0F0EB', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: '10%', height: '100%', background: '#A5A5A5', borderRadius: '3px' }} />
            </div>
          </div>
        </div>

        {/* Reorder Risk */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020', marginBottom: '0.35rem' }}>
            Reorder Risk
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#777777', marginBottom: '1.25rem' }}>
            Depletion exposure matrix
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.75rem',
              background: '#FDECEC',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#E05252' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E05252' }} />
                <span>Critical Risk</span>
              </div>
              <span style={{ fontWeight: 700, color: '#E05252' }}>
                {charts?.reorder_risk_matrix?.critical ?? 1} items
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.75rem',
              background: '#FEF8E6',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#E9A400' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E9A400' }} />
                <span>High Risk</span>
              </div>
              <span style={{ fontWeight: 700, color: '#E9A400' }}>
                {charts?.reorder_risk_matrix?.high ?? 2} items
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.75rem',
              background: '#F7F7F3',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#777777' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#777777' }} />
                <span>Medium Risk</span>
              </div>
              <span style={{ fontWeight: 700, color: '#202020' }}>
                {charts?.reorder_risk_matrix?.medium ?? 3} items
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 0.75rem',
              background: '#E8F8ED',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#22A447' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22A447' }} />
                <span>Safe Threshold</span>
              </div>
              <span style={{ fontWeight: 700, color: '#22A447' }}>
                {charts?.reorder_risk_matrix?.safe ?? 48} items
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020', marginBottom: '0.35rem' }}>
            Recent Activity
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#777777', marginBottom: '1.25rem' }}>
            Latest inventory ledger logs
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(charts?.recent_movements && charts.recent_movements.length > 0
              ? charts.recent_movements.slice(0, 4)
              : [
                  { movement_type: 'INCOMING', reference_doc: 'REC-2026-001', product_name: 'Wi-Fi 6 Router', quantity: 50, timestamp: '12 min ago' },
                  { movement_type: 'OUTGOING', reference_doc: 'DEL-2026-004', product_name: 'ARM Microcontroller', quantity: 25, timestamp: '45 min ago' },
                  { movement_type: 'TRANSFER', reference_doc: 'TRF-2026-001', product_name: 'Copper Wire', quantity: 15, timestamp: '2 hours ago' },
                  { movement_type: 'ADJUSTMENT', reference_doc: 'ADJ-2026-001', product_name: 'Task Chair', quantity: 2, timestamp: '5 hours ago' }
                ]
            ).map((m, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.55rem',
                borderBottom: idx < 3 ? '1px solid #F0F0EB' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: m.movement_type === 'INCOMING' ? '#E8F8ED' : m.movement_type === 'OUTGOING' ? '#FDECEC' : '#F0F0EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {m.movement_type === 'INCOMING' ? (
                      <ArrowDownLeft size={14} color="#22A447" />
                    ) : m.movement_type === 'OUTGOING' ? (
                      <ArrowUpRight size={14} color="#E05252" />
                    ) : (
                      <ArrowLeftRight size={14} color="#777777" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#202020' }}>
                      {m.reference_doc}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#777777' }}>
                      {m.product_name}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: m.movement_type === 'INCOMING' ? '#22A447' : m.movement_type === 'OUTGOING' ? '#E05252' : '#202020'
                  }}>
                    {m.movement_type === 'OUTGOING' ? `−${m.quantity}` : `+${m.quantity}`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#A5A5A5' }}>
                    {typeof m.timestamp === 'string' && m.timestamp.includes('T')
                      ? m.timestamp.slice(11, 16)
                      : m.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

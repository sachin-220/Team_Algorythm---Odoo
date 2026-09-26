import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { History, Filter, Search, Calendar, User } from 'lucide-react';

const Ledger = () => {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filters
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [refSearch, setRefSearch] = useState('');

  const fetchMovements = async () => {
    try {
      let queryStr = '?';
      if (selectedProduct) queryStr += `product_id=${selectedProduct}&`;
      if (selectedWarehouse) queryStr += `warehouse_id=${selectedWarehouse}&`;
      if (selectedType) queryStr += `movement_type=${selectedType}&`;
      if (refSearch) queryStr += `reference_doc=${encodeURIComponent(refSearch)}&`;

      const [mRes, pRes, wRes] = await Promise.all([
        apiClient.get(`/movements${queryStr}`),
        apiClient.get('/products'),
        apiClient.get('/warehouses')
      ]);

      setMovements(mRes.data);
      setProducts(pRes.data);
      setWarehouses(wRes.data);
    } catch (err) {
      console.error('Error fetching movements:', err);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [selectedProduct, selectedWarehouse, selectedType, refSearch]);

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span className="active">Move History</span>
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="display-title">Stock Move History</h1>
        <p className="display-subtitle" style={{ marginBottom: 0 }}>
          Immutable audit ledger of every inventory transaction, transfer, and adjustment.
        </p>
      </div>

      {/* Multi-attribute Filter Bar */}
      <div className="filter-bar" style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <div className="filter-group">
          <Filter size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Filters:</span>
        </div>

        <div className="filter-group">
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={refSearch}
              onChange={(e) => setRefSearch(e.target.value)}
              placeholder="Ref Document..."
              className="form-control"
              style={{ paddingLeft: '2.2rem', height: '36px', fontSize: '0.82rem' }}
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="form-control"
            style={{ width: '160px', height: '36px', fontSize: '0.82rem' }}
          >
            <option value="">All Types</option>
            <option value="INCOMING">Incoming (+)</option>
            <option value="OUTGOING">Outgoing (-)</option>
            <option value="TRANSFER">Transfer (↔)</option>
            <option value="ADJUSTMENT">Adjustment (±)</option>
          </select>

          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="form-control"
            style={{ width: '180px', height: '36px', fontSize: '0.82rem' }}
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="form-control"
            style={{ width: '180px', height: '36px', fontSize: '0.82rem' }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Product SKU / Name</th>
              <th>Quantity</th>
              <th>Source Location</th>
              <th>Destination Location</th>
              <th>Reference Doc</th>
              <th>User</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>#{m.id}</td>
                <td><StatusBadge status={m.movement_type} type="movement" /></td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>{m.product_sku}</div>
                </td>
                <td style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{m.quantity}</td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {m.src_warehouse_name ? `${m.src_warehouse_name} → ${m.src_location_name}` : '—'}
                </td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {m.dest_warehouse_name ? `${m.dest_warehouse_name} → ${m.dest_location_name}` : '—'}
                </td>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {m.reference_doc}
                  </span>
                </td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.user_name || 'System'}</td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {new Date(m.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Ledger;

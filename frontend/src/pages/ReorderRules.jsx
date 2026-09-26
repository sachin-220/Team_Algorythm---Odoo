import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { ShieldAlert, Plus, Trash2 } from 'lucide-react';

const ReorderRules = () => {
  const { showSuccess, showError } = useToast();
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    warehouse_id: '',
    min_stock: 10,
    max_stock: 200,
    reorder_quantity: 50,
    lead_time_days: 5,
    safety_stock: 15
  });

  const fetchRules = async () => {
    try {
      const [rRes, pRes, wRes] = await Promise.all([
        apiClient.get('/reorder-rules'),
        apiClient.get('/products'),
        apiClient.get('/warehouses')
      ]);
      setRules(rRes.data);
      setProducts(pRes.data);
      setWarehouses(wRes.data);
    } catch (err) {
      showError('Failed to fetch reorder rules');
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_id || !formData.warehouse_id) {
      showError('Please select Product and Warehouse');
      return;
    }

    try {
      await apiClient.post('/reorder-rules', {
        product_id: parseInt(formData.product_id),
        warehouse_id: parseInt(formData.warehouse_id),
        min_stock: parseFloat(formData.min_stock),
        max_stock: parseFloat(formData.max_stock),
        reorder_quantity: parseFloat(formData.reorder_quantity),
        lead_time_days: parseInt(formData.lead_time_days),
        safety_stock: parseFloat(formData.safety_stock)
      });
      showSuccess('Reorder rule created');
      setIsOpen(false);
      fetchRules();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create reorder rule');
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Delete reorder rule?')) return;
    try {
      await apiClient.delete(`/reorder-rules/${ruleId}`);
      showSuccess('Reorder rule deleted');
      fetchRules();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete reorder rule');
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Automation</span>
        <span>/</span>
        <span className="active">Reorder Rules</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Reordering Rules</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Automated replenishment thresholds, min-max limits, and safety buffers.
          </p>
        </div>
        <button onClick={() => setIsOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Reorder Rule</span>
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Product SKU / Name</th>
              <th>Warehouse Facility</th>
              <th>Current Stock</th>
              <th>Min Safety Stock</th>
              <th>Max Cap Stock</th>
              <th>Reorder Quantity</th>
              <th>Lead Time</th>
              <th>Status Trigger</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>{r.product_sku}</div>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.warehouse_name}</td>
                <td style={{ fontWeight: 600, fontSize: '0.95rem', color: r.current_stock <= r.min_stock ? 'var(--accent-warning)' : 'var(--accent-positive)' }}>
                  {r.current_stock}
                </td>
                <td style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>{r.min_stock}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.max_stock}</td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.reorder_quantity}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.lead_time_days} days</td>
                <td>
                  <StatusBadge status={r.status} type="stock" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleDelete(r.id)} className="btn btn-sm" style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)', padding: '0 8px' }}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE RULE MODAL */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Configure Reorder Rule">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Product *</label>
            <select required value={formData.product_id} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} className="form-control">
              <option value="">Select Product</option>
              {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Warehouse Facility *</label>
            <select required value={formData.warehouse_id} onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })} className="form-control">
              <option value="">Select Warehouse</option>
              {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Min Stock Threshold</label>
              <input type="number" min="0" required value={formData.min_stock} onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })} className="form-control" />
            </div>

            <div className="form-group">
              <label className="form-label">Max Stock Threshold</label>
              <input type="number" min="1" required value={formData.max_stock} onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })} className="form-control" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Reorder Quantity</label>
              <input type="number" min="1" required value={formData.reorder_quantity} onChange={(e) => setFormData({ ...formData, reorder_quantity: e.target.value })} className="form-control" />
            </div>

            <div className="form-group">
              <label className="form-label">Lead Time (Days)</label>
              <input type="number" min="1" required value={formData.lead_time_days} onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })} className="form-control" />
            </div>

            <div className="form-group">
              <label className="form-label">Safety Stock</label>
              <input type="number" min="0" required value={formData.safety_stock} onChange={(e) => setFormData({ ...formData, safety_stock: e.target.value })} className="form-control" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Reorder Rule</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ReorderRules;

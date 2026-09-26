import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { SlidersHorizontal, Plus, CheckCircle2, Eye } from 'lucide-react';

const Adjustments = () => {
  const { showSuccess, showError } = useToast();
  const [adjustments, setAdjustments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);

  // Form State
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('Counting Difference');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', physical_qty: 0 }]);

  const [availableLocations, setAvailableLocations] = useState([]);

  const fetchAdjustments = async () => {
    try {
      const [aRes, wRes, pRes] = await Promise.all([
        apiClient.get('/adjustments'),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);
      setAdjustments(aRes.data);
      setWarehouses(wRes.data);
      setProducts(pRes.data);
    } catch (err) {
      showError('Failed to fetch inventory adjustments');
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const handleWarehouseChange = (whId) => {
    setWarehouseId(whId);
    setLocationId('');
    const target = warehouses.find((w) => w.id === parseInt(whId));
    setAvailableLocations(target ? target.locations || [] : []);
  };

  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', physical_qty: 0 }]);
  };

  const handleItemChange = (idx, field, val) => {
    const next = [...items];
    next[idx][field] = val;
    setItems(next);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId || !locationId) {
      showError('Please select Target Warehouse and Location');
      return;
    }

    try {
      await apiClient.post('/adjustments', {
        warehouse_id: parseInt(warehouseId),
        location_id: parseInt(locationId),
        reason,
        notes,
        items: items.map((i) => ({
          product_id: parseInt(i.product_id),
          physical_qty: parseFloat(i.physical_qty)
        }))
      });
      showSuccess('Inventory Adjustment created');
      setIsCreateOpen(false);
      resetForm();
      fetchAdjustments();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create adjustment');
    }
  };

  const handleConfirm = async (adjId) => {
    try {
      await apiClient.post(`/adjustments/${adjId}/confirm`);
      showSuccess('Adjustment Confirmed! Physical stock updated & ledger entry recorded.');
      if (isViewOpen) setIsViewOpen(false);
      fetchAdjustments();
    } catch (err) {
      showError(err.response?.data?.detail || 'Confirmation failed');
    }
  };

  const resetForm = () => {
    setWarehouseId('');
    setLocationId('');
    setReason('Counting Difference');
    setNotes('');
    setItems([{ product_id: '', physical_qty: 0 }]);
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Operations</span>
        <span>/</span>
        <span className="active">Adjustments</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Inventory Adjustments</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Physical cycle counts, scrap reconciliations, and quantity corrections.
          </p>
        </div>
        <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>New Stock Adjustment</span>
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Reference No</th>
              <th>Warehouse & Location</th>
              <th>Adjustment Reason</th>
              <th>Status</th>
              <th>Created Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.id}>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {a.reference_no}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.warehouse_name} → {a.location_name}</td>
                <td><span className="badge badge-waiting">{a.reason}</span></td>
                <td><StatusBadge status={a.status} type="document" /></td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => { setSelectedAdjustment(a); setIsViewOpen(true); }} className="btn btn-secondary btn-sm" style={{ marginRight: '0.4rem', padding: '0 8px' }}>
                    <Eye size={13} /> View
                  </button>
                  {a.status !== 'Done' && a.status !== 'Canceled' && (
                    <button onClick={() => handleConfirm(a.id)} className="btn btn-accent btn-sm" style={{ padding: '0 8px' }}>
                      <CheckCircle2 size={13} /> Confirm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE ADJUSTMENT MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Inventory Adjustment" maxWidth="750px">
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Warehouse *</label>
              <select required value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)} className="form-control">
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Location / Rack *</label>
              <select required value={locationId} onChange={(e) => setLocationId(e.target.value)} className="form-control">
                <option value="">Select Location</option>
                {availableLocations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Adjustment Reason *</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="form-control">
                <option value="Damaged">Damaged</option>
                <option value="Lost">Lost</option>
                <option value="Found">Found</option>
                <option value="Counting Difference">Counting Difference</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: '1.25rem 0 0.5rem' }}>Physical Counted Items</h4>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <select required value={item.product_id} onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)} className="form-control">
                <option value="">Select Product</option>
                {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
              </select>
              <input type="number" min="0" step="any" required value={item.physical_qty} onChange={(e) => handleItemChange(idx, 'physical_qty', e.target.value)} placeholder="Physical Count Qty" className="form-control" />
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Adjustment Draft</button>
          </div>
        </form>
      </Modal>

      {/* VIEW ADJUSTMENT MODAL */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Adjustment Document — ${selectedAdjustment?.reference_no}`} maxWidth="750px">
        {selectedAdjustment && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Target Location:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedAdjustment.warehouse_name} → {selectedAdjustment.location_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Reason:</span>
                <div style={{ marginTop: '2px' }}><span className="badge badge-waiting">{selectedAdjustment.reason}</span></div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Status:</span>
                <div style={{ marginTop: '2px' }}><StatusBadge status={selectedAdjustment.status} type="document" /></div>
              </div>
            </div>

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Theoretical Qty</th>
                    <th>Physical Count</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAdjustment.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.product_sku}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.theoretical_qty}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.physical_qty}</td>
                      <td style={{ fontWeight: 600, color: item.difference_qty >= 0 ? 'var(--accent-positive)' : 'var(--accent-danger)' }}>
                        {item.difference_qty > 0 ? `+${item.difference_qty}` : item.difference_qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedAdjustment.status !== 'Done' && selectedAdjustment.status !== 'Canceled' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => handleConfirm(selectedAdjustment.id)} className="btn btn-accent">
                  <CheckCircle2 size={16} /> Confirm & Apply Physical Stock
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Adjustments;

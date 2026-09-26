import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { ArrowDownLeft, Plus, CheckCircle2, Eye, Trash, RefreshCcw } from 'lucide-react';

const Receipts = () => {
  const { showSuccess, showError } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', demand_qty: 1, unit_price: 0 }]);
  const [availableLocations, setAvailableLocations] = useState([]);

  const fetchReceipts = async () => {
    try {
      const [rRes, sRes, wRes, pRes] = await Promise.all([
        apiClient.get('/receipts'),
        apiClient.get('/suppliers'),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);
      setReceipts(rRes.data);
      setSuppliers(sRes.data);
      setWarehouses(wRes.data);
      setProducts(pRes.data);
    } catch (err) {
      showError('Failed to fetch receipts');
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleWarehouseChange = (whId) => {
    setWarehouseId(whId);
    setLocationId('');
    const target = warehouses.find((w) => w.id === parseInt(whId));
    setAvailableLocations(target ? target.locations || [] : []);
  };

  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', demand_qty: 1, unit_price: 0 }]);
  };

  const handleRemoveItemRow = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const next = [...items];
    next[idx][field] = val;
    setItems(next);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || !warehouseId || !locationId) {
      showError('Please select Supplier, Warehouse, and Target Location');
      return;
    }
    const formattedItems = items.map((i) => ({
      product_id: parseInt(i.product_id),
      demand_qty: parseFloat(i.demand_qty),
      received_qty: parseFloat(i.demand_qty),
      unit_price: parseFloat(i.unit_price || 0)
    }));

    try {
      await apiClient.post('/receipts', {
        supplier_id: parseInt(supplierId),
        warehouse_id: parseInt(warehouseId),
        location_id: parseInt(locationId),
        notes,
        items: formattedItems
      });
      showSuccess('Receipt Draft created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchReceipts();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create receipt');
    }
  };

  const handleValidate = async (receiptId) => {
    try {
      await apiClient.post(`/receipts/${receiptId}/validate`);
      showSuccess('Receipt Validated! Target stock increased & movement logged.');
      if (isViewOpen) setIsViewOpen(false);
      fetchReceipts();
    } catch (err) {
      showError(err.response?.data?.detail || 'Validation failed');
    }
  };

  const handleStatusChange = async (receiptId, newStatus) => {
    try {
      await apiClient.put(`/receipts/${receiptId}/status?new_status=${newStatus}`);
      showSuccess(`Status changed to ${newStatus}`);
      fetchReceipts();
      if (selectedReceipt) {
        const updated = receipts.find((r) => r.id === receiptId);
        if (updated) setSelectedReceipt({ ...updated, status: newStatus });
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setSupplierId('');
    setWarehouseId('');
    setLocationId('');
    setNotes('');
    setItems([{ product_id: '', demand_qty: 1, unit_price: 0 }]);
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Operations</span>
        <span>/</span>
        <span className="active">Receipts</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Receipts</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Inbound purchase orders, supplier shipments, and incoming stock validation.
          </p>
        </div>
        <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>New Incoming Receipt</span>
        </button>
      </div>

      {/* Receipts Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Reference No</th>
              <th>Supplier</th>
              <th>Destination Location</th>
              <th>Items Count</th>
              <th>Status</th>
              <th>Created Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {r.reference_no}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.supplier_name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.warehouse_name} → {r.location_name}</td>
                <td><span className="badge badge-draft">{r.items.length} Lines</span></td>
                <td><StatusBadge status={r.status} type="document" /></td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => { setSelectedReceipt(r); setIsViewOpen(true); }} className="btn btn-secondary btn-sm" style={{ marginRight: '0.4rem', padding: '0 8px' }}>
                    <Eye size={13} /> View
                  </button>
                  {r.status !== 'Done' && r.status !== 'Canceled' && (
                    <button onClick={() => handleValidate(r.id)} className="btn btn-accent btn-sm" style={{ padding: '0 8px' }}>
                      <CheckCircle2 size={13} /> Validate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE RECEIPT MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Incoming Receipt" maxWidth="750px">
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Select Supplier *</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="form-control">
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Warehouse *</label>
              <select required value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)} className="form-control">
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Location / Rack *</label>
              <select required value={locationId} onChange={(e) => setLocationId(e.target.value)} className="form-control">
                <option value="">Select Location</option>
                {availableLocations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: '1.25rem 0 0.5rem' }}>Products & Quantities</h4>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <select
                required
                value={item.product_id}
                onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                className="form-control"
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={item.demand_qty}
                onChange={(e) => handleItemChange(idx, 'demand_qty', e.target.value)}
                placeholder="Quantity"
                className="form-control"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={item.unit_price}
                onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                placeholder="Unit Price"
                className="form-control"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => handleRemoveItemRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}>
                  <Trash size={16} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddItemRow} className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
            + Add Product Line
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Draft Receipt</button>
          </div>
        </form>
      </Modal>

      {/* VIEW RECEIPT WORKFLOW MODAL */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Receipt Document — ${selectedReceipt?.reference_no}`} maxWidth="750px">
        {selectedReceipt && (
          <div>
            {/* Visual Step Workflow Bar */}
            <div className="workflow-steps">
              {['Draft', 'Waiting', 'Ready', 'Done'].map((st, i) => {
                const stepOrder = { Draft: 1, Waiting: 2, Ready: 3, Done: 4 };
                const currentOrder = stepOrder[selectedReceipt.status] || 1;
                const thisOrder = stepOrder[st];
                const isActive = selectedReceipt.status === st;
                const isCompleted = currentOrder > thisOrder || selectedReceipt.status === 'Done';
                return (
                  <div key={st} className={`workflow-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                    <div className="step-icon">{isCompleted ? '✓' : i + 1}</div>
                    <div className="step-label">{st}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Supplier:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedReceipt.supplier_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Destination Location:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedReceipt.warehouse_name} → {selectedReceipt.location_name}</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Receipt Line Items</h4>
            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Demand Qty</th>
                    <th>Received Qty</th>
                    <th>Unit Price</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.product_sku}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.demand_qty}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-positive)' }}>{item.received_qty}</td>
                      <td>${item.unit_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Workflow Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedReceipt.status === 'Draft' && (
                  <button onClick={() => handleStatusChange(selectedReceipt.id, 'Waiting')} className="btn btn-secondary btn-sm">Mark Waiting</button>
                )}
                {selectedReceipt.status === 'Waiting' && (
                  <button onClick={() => handleStatusChange(selectedReceipt.id, 'Ready')} className="btn btn-secondary btn-sm">Mark Ready</button>
                )}
                {selectedReceipt.status !== 'Done' && selectedReceipt.status !== 'Canceled' && (
                  <button onClick={() => handleStatusChange(selectedReceipt.id, 'Canceled')} className="btn btn-sm" style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)' }}>Cancel Document</button>
                )}
              </div>

              {selectedReceipt.status !== 'Done' && selectedReceipt.status !== 'Canceled' && (
                <button onClick={() => handleValidate(selectedReceipt.id)} className="btn btn-accent">
                  <CheckCircle2 size={16} /> Validate & Increase Stock
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Receipts;

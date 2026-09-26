import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { ArrowUpRight, Plus, CheckCircle2, Eye, Trash, AlertTriangle } from 'lucide-react';

const Deliveries = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', demand_qty: 1, unit_price: 0 }]);
  const [availableLocations, setAvailableLocations] = useState([]);

  const fetchDeliveries = async () => {
    try {
      const [dRes, wRes, pRes] = await Promise.all([
        apiClient.get('/deliveries'),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);
      setDeliveries(dRes.data);
      setWarehouses(wRes.data);
      setProducts(pRes.data);
    } catch (err) {
      showError('Failed to fetch delivery orders');
    }
  };

  useEffect(() => {
    fetchDeliveries();
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
    if (!customerName || !warehouseId || !locationId) {
      showError('Please fill Customer Name, Source Warehouse, and Location');
      return;
    }
    const formattedItems = items.map((i) => ({
      product_id: parseInt(i.product_id),
      demand_qty: parseFloat(i.demand_qty),
      delivered_qty: parseFloat(i.demand_qty),
      unit_price: parseFloat(i.unit_price || 0)
    }));

    try {
      await apiClient.post('/deliveries', {
        customer_name: customerName,
        warehouse_id: parseInt(warehouseId),
        location_id: parseInt(locationId),
        notes,
        items: formattedItems
      });
      showSuccess('Delivery Order Draft created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchDeliveries();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create delivery order');
    }
  };

  const handleValidate = async (deliveryId) => {
    try {
      await apiClient.post(`/deliveries/${deliveryId}/validate`);
      showSuccess('Delivery Validated! Stock decreased & movement logged.');
      if (isViewOpen) setIsViewOpen(false);
      fetchDeliveries();
    } catch (err) {
      showError(err.response?.data?.detail || 'Validation failed. Check available stock.');
    }
  };

  const handleStatusChange = async (deliveryId, newStatus) => {
    try {
      await apiClient.put(`/deliveries/${deliveryId}/status?new_status=${newStatus}`);
      showSuccess(`Status changed to ${newStatus}`);
      fetchDeliveries();
      if (selectedDelivery) {
        setSelectedDelivery({ ...selectedDelivery, status: newStatus });
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setCustomerName('');
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
        <span className="active">Deliveries</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Delivery Orders</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Outbound customer dispatches, pick-pack fulfillment, and stock releases.
          </p>
        </div>
        <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>New Delivery Order</span>
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Reference No</th>
              <th>Customer</th>
              <th>Source Location</th>
              <th>Items Count</th>
              <th>Status</th>
              <th>Created Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {d.reference_no}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.customer_name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{d.warehouse_name} → {d.location_name}</td>
                <td><span className="badge badge-draft">{d.items.length} Lines</span></td>
                <td><StatusBadge status={d.status} type="document" /></td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => { setSelectedDelivery(d); setIsViewOpen(true); }} className="btn btn-secondary btn-sm" style={{ marginRight: '0.4rem', padding: '0 8px' }}>
                    <Eye size={13} /> View
                  </button>
                  {d.status !== 'Done' && d.status !== 'Canceled' && (
                    <button onClick={() => handleValidate(d.id)} className="btn btn-accent btn-sm" style={{ padding: '0 8px' }}>
                      <CheckCircle2 size={13} /> Validate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE DELIVERY MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Outgoing Delivery Order" maxWidth="750px">
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Acme Corp" className="form-control" />
            </div>

            <div className="form-group">
              <label className="form-label">Source Warehouse *</label>
              <select required value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)} className="form-control">
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Source Location / Rack *</label>
              <select required value={locationId} onChange={(e) => setLocationId(e.target.value)} className="form-control">
                <option value="">Select Location</option>
                {availableLocations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: '0.9rem', color: '#38bdf8', margin: '1rem 0 0.5rem' }}>Outbound Product Lines</h4>
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
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Avail: {p.current_stock}</option>
                ))}
              </select>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={item.demand_qty}
                onChange={(e) => handleItemChange(idx, 'demand_qty', e.target.value)}
                placeholder="Demand Qty"
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
                <button type="button" onClick={() => handleRemoveItemRow(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
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
            <button type="submit" className="btn btn-primary">Save Draft Delivery</button>
          </div>
        </form>
      </Modal>

      {/* VIEW DELIVERY MODAL */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Delivery Order — ${selectedDelivery?.reference_no}`} maxWidth="750px">
        {selectedDelivery && (
          <div>
            <div className="workflow-steps">
              {['Draft', 'Waiting', 'Ready', 'Done'].map((st, i) => {
                const stepOrder = { Draft: 1, Waiting: 2, Ready: 3, Done: 4 };
                const currentOrder = stepOrder[selectedDelivery.status] || 1;
                const thisOrder = stepOrder[st];
                const isActive = selectedDelivery.status === st;
                const isCompleted = currentOrder > thisOrder || selectedDelivery.status === 'Done';
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
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Customer:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedDelivery.customer_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Source Stock Location:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedDelivery.warehouse_name} → {selectedDelivery.location_name}</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Outbound Items & Stock Check</h4>
            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Demand Qty</th>
                    <th>Available Stock</th>
                    <th>Stock Guard</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDelivery.items.map((item) => {
                    const hasEnoughStock = (item.available_stock || 0) >= item.demand_qty;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.product_sku}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.demand_qty}</td>
                        <td style={{ fontWeight: 600, color: hasEnoughStock ? 'var(--accent-positive)' : 'var(--accent-danger)' }}>
                          {item.available_stock || 0}
                        </td>
                        <td>
                          {hasEnoughStock ? (
                            <span className="badge badge-done">Stock OK</span>
                          ) : (
                            <span className="badge badge-out" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={12} /> Insufficient Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedDelivery.status === 'Draft' && (
                  <button onClick={() => handleStatusChange(selectedDelivery.id, 'Waiting')} className="btn btn-secondary btn-sm">Mark Pick & Pack</button>
                )}
                {selectedDelivery.status === 'Waiting' && (
                  <button onClick={() => handleStatusChange(selectedDelivery.id, 'Ready')} className="btn btn-secondary btn-sm">Mark Ready for Dispatch</button>
                )}
                {selectedDelivery.status !== 'Done' && selectedDelivery.status !== 'Canceled' && (
                  <button onClick={() => handleStatusChange(selectedDelivery.id, 'Canceled')} className="btn btn-sm" style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)' }}>Cancel Delivery</button>
                )}
              </div>

              {selectedDelivery.status !== 'Done' && selectedDelivery.status !== 'Canceled' && (
                <button onClick={() => handleValidate(selectedDelivery.id)} className="btn btn-accent">
                  <CheckCircle2 size={16} /> Validate & Decrease Stock
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Deliveries;

import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { ArrowLeftRight, Plus, CheckCircle2, Eye, Trash } from 'lucide-react';

const Transfers = () => {
  const { showSuccess, showError } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);

  // Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // Form State
  const [srcWhId, setSrcWhId] = useState('');
  const [srcLocId, setSrcLocId] = useState('');
  const [destWhId, setDestWhId] = useState('');
  const [destLocId, setDestLocId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', demand_qty: 1 }]);

  const [srcLocations, setSrcLocations] = useState([]);
  const [destLocations, setDestLocations] = useState([]);

  const fetchTransfers = async () => {
    try {
      const [tRes, wRes, pRes] = await Promise.all([
        apiClient.get('/transfers'),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);
      setTransfers(tRes.data);
      setWarehouses(wRes.data);
      setProducts(pRes.data);
    } catch (err) {
      showError('Failed to fetch transfers');
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleSrcWhChange = (whId) => {
    setSrcWhId(whId);
    setSrcLocId('');
    const target = warehouses.find((w) => w.id === parseInt(whId));
    setSrcLocations(target ? target.locations || [] : []);
  };

  const handleDestWhChange = (whId) => {
    setDestWhId(whId);
    setDestLocId('');
    const target = warehouses.find((w) => w.id === parseInt(whId));
    setDestLocations(target ? target.locations || [] : []);
  };

  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', demand_qty: 1 }]);
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
    if (!srcWhId || !srcLocId || !destWhId || !destLocId) {
      showError('Please select Source and Destination Warehouses and Locations');
      return;
    }
    if (srcWhId === destWhId && srcLocId === destLocId) {
      showError('Source location and Destination location cannot be identical');
      return;
    }

    try {
      await apiClient.post('/transfers', {
        src_warehouse_id: parseInt(srcWhId),
        src_location_id: parseInt(srcLocId),
        dest_warehouse_id: parseInt(destWhId),
        dest_location_id: parseInt(destLocId),
        notes,
        items: items.map((i) => ({
          product_id: parseInt(i.product_id),
          demand_qty: parseFloat(i.demand_qty)
        }))
      });
      showSuccess('Internal Transfer Draft created');
      setIsCreateOpen(false);
      resetForm();
      fetchTransfers();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create transfer');
    }
  };

  const handleConfirmTransfer = async (transferId) => {
    try {
      await apiClient.post(`/transfers/${transferId}/confirm`);
      showSuccess('Transfer Confirmed! Stock relocated & company balance preserved.');
      if (isViewOpen) setIsViewOpen(false);
      fetchTransfers();
    } catch (err) {
      showError(err.response?.data?.detail || 'Transfer confirmation failed');
    }
  };

  const resetForm = () => {
    setSrcWhId('');
    setSrcLocId('');
    setDestWhId('');
    setDestLocId('');
    setNotes('');
    setItems([{ product_id: '', demand_qty: 1 }]);
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Operations</span>
        <span>/</span>
        <span className="active">Transfers</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Internal Transfers</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Relocate inventory between warehouses, bays, and storage zones.
          </p>
        </div>
        <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>New Internal Transfer</span>
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Reference No</th>
              <th>Source Location</th>
              <th>Destination Location</th>
              <th>Items Count</th>
              <th>Status</th>
              <th>Created Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id}>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {t.reference_no}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.src_warehouse_name} → {t.src_location_name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{t.dest_warehouse_name} → {t.dest_location_name}</td>
                <td><span className="badge badge-draft">{t.items.length} Lines</span></td>
                <td><StatusBadge status={t.status} type="document" /></td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => { setSelectedTransfer(t); setIsViewOpen(true); }} className="btn btn-secondary btn-sm" style={{ marginRight: '0.4rem', padding: '0 8px' }}>
                    <Eye size={13} /> View
                  </button>
                  {t.status !== 'Done' && t.status !== 'Canceled' && (
                    <button onClick={() => handleConfirmTransfer(t.id)} className="btn btn-accent btn-sm" style={{ padding: '0 8px' }}>
                      <CheckCircle2 size={13} /> Confirm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE TRANSFER MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Internal Stock Transfer" maxWidth="750px">
        <form onSubmit={handleCreateSubmit}>
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Source (Origin)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <select required value={srcWhId} onChange={(e) => handleSrcWhChange(e.target.value)} className="form-control">
                <option value="">Source Warehouse</option>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
              <select required value={srcLocId} onChange={(e) => setSrcLocId(e.target.value)} className="form-control">
                <option value="">Source Location</option>
                {srcLocations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>
          </div>

          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Destination (Target)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <select required value={destWhId} onChange={(e) => handleDestWhChange(e.target.value)} className="form-control">
                <option value="">Destination Warehouse</option>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
              <select required value={destLocId} onChange={(e) => setDestLocId(e.target.value)} className="form-control">
                <option value="">Destination Location</option>
                {destLocations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: '1.25rem 0 0.5rem' }}>Transfer Items</h4>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 40px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <select required value={item.product_id} onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)} className="form-control">
                <option value="">Select Product</option>
                {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
              </select>
              <input type="number" min="0.1" step="any" required value={item.demand_qty} onChange={(e) => handleItemChange(idx, 'demand_qty', e.target.value)} placeholder="Quantity" className="form-control" />
              {items.length > 1 && (
                <button type="button" onClick={() => handleRemoveItemRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}>
                  <Trash size={16} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleAddItemRow} className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>+ Add Product Line</button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Draft Transfer</button>
          </div>
        </form>
      </Modal>

      {/* VIEW TRANSFER MODAL */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Transfer Record — ${selectedTransfer?.reference_no}`} maxWidth="700px">
        {selectedTransfer && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Origin Location:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedTransfer.src_warehouse_name} → {selectedTransfer.src_location_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Destination Location:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedTransfer.dest_warehouse_name} → {selectedTransfer.dest_location_name}</div>
              </div>
            </div>

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Required Qty</th>
                    <th>Source Stock Avail</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransfer.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.product_sku}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.demand_qty}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.available_src_stock || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedTransfer.status !== 'Done' && selectedTransfer.status !== 'Canceled' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => handleConfirmTransfer(selectedTransfer.id)} className="btn btn-accent">
                  <CheckCircle2 size={16} /> Confirm & Relocate Stock
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transfers;

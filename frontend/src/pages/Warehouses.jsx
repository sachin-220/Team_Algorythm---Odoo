import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { Warehouse as WhIcon, Plus, Edit3, Trash2, MapPin, Grid } from 'lucide-react';

const Warehouses = () => {
  const { showSuccess, showError } = useToast();
  const [warehouses, setWarehouses] = useState([]);

  // Warehouse Modal
  const [isWhOpen, setIsWhOpen] = useState(false);
  const [editWhId, setEditWhId] = useState(null);
  const [whFormData, setWhFormData] = useState({ name: '', code: '', address: '' });

  // Location Modal
  const [isLocOpen, setIsLocOpen] = useState(false);
  const [targetWhId, setTargetWhId] = useState(null);
  const [locFormData, setLocFormData] = useState({ name: '', code: '', type: 'Rack' });

  const fetchWarehouses = async () => {
    try {
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data);
    } catch (err) {
      showError('Failed to fetch warehouses');
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleWhSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editWhId) {
        await apiClient.put(`/warehouses/${editWhId}`, whFormData);
        showSuccess('Warehouse updated');
      } else {
        await apiClient.post('/warehouses', whFormData);
        showSuccess('Warehouse created');
      }
      setIsWhOpen(false);
      fetchWarehouses();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save warehouse');
    }
  };

  const handleLocSubmit = async (e) => {
    e.preventDefault();
    if (!targetWhId) return;
    try {
      await apiClient.post(`/warehouses/${targetWhId}/locations`, locFormData);
      showSuccess('Location added to warehouse');
      setIsLocOpen(false);
      fetchWarehouses();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to add location');
    }
  };

  const handleDeleteWh = async (id) => {
    if (!window.confirm('Delete warehouse and all associated locations?')) return;
    try {
      await apiClient.delete(`/warehouses/${id}`);
      showSuccess('Warehouse deleted');
      fetchWarehouses();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete warehouse');
    }
  };

  const handleDeleteLoc = async (locId) => {
    if (!window.confirm('Delete location?')) return;
    try {
      await apiClient.delete(`/warehouses/locations/${locId}`);
      showSuccess('Location deleted');
      fetchWarehouses();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete location');
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Settings</span>
        <span>/</span>
        <span className="active">Warehouses</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Warehouses & Locations</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Manage storage facilities, aisles, bins, and physical capacity.
          </p>
        </div>
        <button onClick={() => { setEditWhId(null); setWhFormData({ name: '', code: '', address: '' }); setIsWhOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Warehouse</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {warehouses.map((w) => (
          <div key={w.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                  {w.code}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.4rem', marginBottom: '0.2rem' }}>{w.name}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <MapPin size={13} /> {w.address || 'No physical address specified'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => { setEditWhId(w.id); setWhFormData({ name: w.name, code: w.code, address: w.address || '' }); setIsWhOpen(true); }} className="btn btn-secondary btn-sm" style={{ padding: '0 8px' }}><Edit3 size={14} /></button>
                <button onClick={() => handleDeleteWh(w.id)} className="btn btn-sm" style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)', padding: '0 8px' }}><Trash2 size={14} /></button>
              </div>
            </div>

            {/* Locations List */}
            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Locations & Racks ({w.locations?.length || 0})
                </span>
                <button
                  onClick={() => { setTargetWhId(w.id); setLocFormData({ name: '', code: `${w.code}-`, type: 'Rack' }); setIsLocOpen(true); }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0 8px', height: '28px' }}
                >
                  <Plus size={12} /> Add Rack
                </button>
              </div>

              {w.locations && w.locations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {w.locations.map((loc) => (
                    <div
                      key={loc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.85rem',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Grid size={14} color="var(--text-secondary)" />
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loc.name}</span>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>({loc.code})</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-draft" style={{ fontSize: '0.7rem' }}>{loc.type}</span>
                        <button onClick={() => handleDeleteLoc(loc.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: '0.2rem' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem' }}>No locations created</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* WAREHOUSE MODAL */}
      <Modal isOpen={isWhOpen} onClose={() => setIsWhOpen(false)} title={editWhId ? 'Edit Warehouse' : 'Create Warehouse'}>
        <form onSubmit={handleWhSubmit}>
          <div className="form-group">
            <label className="form-label">Warehouse Code *</label>
            <input type="text" required value={whFormData.code} onChange={(e) => setWhFormData({ ...whFormData, code: e.target.value })} placeholder="e.g. WH-MAIN" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Warehouse Name *</label>
            <input type="text" required value={whFormData.name} onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })} placeholder="e.g. Main Central Warehouse" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea rows="2" value={whFormData.address} onChange={(e) => setWhFormData({ ...whFormData, address: e.target.value })} className="form-control" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsWhOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{editWhId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* LOCATION MODAL */}
      <Modal isOpen={isLocOpen} onClose={() => setIsLocOpen(false)} title="Add Location / Rack">
        <form onSubmit={handleLocSubmit}>
          <div className="form-group">
            <label className="form-label">Location Code *</label>
            <input type="text" required value={locFormData.code} onChange={(e) => setLocFormData({ ...locFormData, code: e.target.value })} placeholder="e.g. WH-MAIN-A1" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Location Name *</label>
            <input type="text" required value={locFormData.name} onChange={(e) => setLocFormData({ ...locFormData, name: e.target.value })} placeholder="e.g. Rack A1 - Shelf 2" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select value={locFormData.type} onChange={(e) => setLocFormData({ ...locFormData, type: e.target.value })} className="form-control">
              <option value="Rack">Rack</option>
              <option value="Shelf">Shelf</option>
              <option value="Bin">Bin</option>
              <option value="Receiving">Receiving Dock</option>
              <option value="Dispatch">Dispatch Dock</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsLocOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Add Location</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Warehouses;

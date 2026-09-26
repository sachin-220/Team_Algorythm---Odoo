import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { Users, Plus, Search, Edit3, Trash2, Mail, Phone } from 'lucide-react';

const Suppliers = () => {
  const { showSuccess, showError } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', email: '', phone: '', address: '', contact_person: '' });

  const fetchSuppliers = async () => {
    try {
      const res = await apiClient.get(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setSuppliers(res.data);
    } catch (err) {
      showError('Failed to fetch suppliers');
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await apiClient.put(`/suppliers/${editId}`, formData);
        showSuccess('Supplier updated');
      } else {
        await apiClient.post('/suppliers', formData);
        showSuccess('Supplier created');
      }
      setIsOpen(false);
      fetchSuppliers();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save supplier');
    }
  };

  const handleEdit = (s) => {
    setEditId(s.id);
    setFormData({ name: s.name, code: s.code, email: s.email || '', phone: s.phone || '', address: s.address || '', contact_person: s.contact_person || '' });
    setIsOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete supplier?')) return;
    try {
      await apiClient.delete(`/suppliers/${id}`);
      showSuccess('Supplier deleted');
      fetchSuppliers();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete supplier');
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Procurement</span>
        <span>/</span>
        <span className="active">Suppliers</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Suppliers</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Vendor directory, procurement contacts, and supplier performance.
          </p>
        </div>
        <button onClick={() => { setEditId(null); setFormData({ name: '', code: '', email: '', phone: '', address: '', contact_person: '' }); setIsOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Supplier</span>
        </button>
      </div>

      <div className="filter-bar" style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier or contact..." className="form-control" style={{ paddingLeft: '2.4rem', height: '36px', fontSize: '0.82rem' }} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Supplier Name</th>
              <th>Contact Person</th>
              <th>Contact Info</th>
              <th>Address</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {s.code}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{s.contact_person || '—'}</td>
                <td style={{ fontSize: '0.82rem' }}>
                  {s.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}><Mail size={12} /> {s.email}</div>}
                  {s.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}><Phone size={12} /> {s.phone}</div>}
                </td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{s.address || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleEdit(s)} className="btn btn-secondary btn-sm" style={{ marginRight: '0.4rem', padding: '0 8px' }}><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(s.id)} className="btn btn-sm" style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)', padding: '0 8px' }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editId ? 'Edit Supplier' : 'Create Supplier'}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Supplier Code *</label>
              <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. SUP-TECH" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier Name *</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. TechDistro Corp" className="form-control" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="form-control" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Contact Person</label>
            <input type="text" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea rows="2" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="form-control" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Suppliers;

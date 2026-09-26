import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { Tag, Plus, Search, Edit3, Trash2 } from 'lucide-react';

const Categories = () => {
  const { showSuccess, showError } = useToast();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/categories${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setCategories(res.data);
    } catch (err) {
      showError('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await apiClient.put(`/categories/${editId}`, formData);
        showSuccess('Category updated');
      } else {
        await apiClient.post('/categories', formData);
        showSuccess('Category created');
      }
      setIsOpen(false);
      fetchCategories();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save category');
    }
  };

  const handleEdit = (c) => {
    setEditId(c.id);
    setFormData({ name: c.name, code: c.code, description: c.description || '' });
    setIsOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete category?')) return;
    try {
      await apiClient.delete(`/categories/${id}`);
      showSuccess('Category deleted');
      fetchCategories();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete category');
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Inventory</span>
        <span>/</span>
        <span className="active">Categories</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Product Categories</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Organize products into hierarchical classification groups.
          </p>
        </div>
        <button onClick={() => { setEditId(null); setFormData({ name: '', code: '', description: '' }); setIsOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Category</span>
        </button>
      </div>

      <div className="filter-bar" style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <div className="filter-group">
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category name or code..."
              className="form-control"
              style={{ paddingLeft: '2.4rem', height: '36px', fontSize: '0.82rem' }}
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Category Name</th>
              <th>Description</th>
              <th>Assigned Products</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                    {c.code}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.description || '—'}</td>
                <td><span className="badge badge-draft">{c.product_count} Products</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleEdit(c)} className="btn btn-secondary btn-sm" style={{ marginRight: '0.4rem', padding: '0 8px' }}><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(c.id)} className="btn btn-sm" style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)', padding: '0 8px' }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editId ? 'Edit Category' : 'Create Category'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Category Code *</label>
            <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. ELEC" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Category Name *</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Electronics" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="form-control" />
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

export default Categories;

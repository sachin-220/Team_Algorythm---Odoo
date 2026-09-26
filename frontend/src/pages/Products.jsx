import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { Package, Plus, Search, Edit3, Trash2, Layers, Warehouse, AlertCircle } from 'lucide-react';

const Products = ({ globalSearch }) => {
  const { showSuccess, showError } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isQuantsOpen, setIsQuantsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    uom: 'Units',
    min_stock: 10,
    max_stock: 500,
    reorder_qty: 50,
    safety_stock: 15,
    initial_stock: 0,
    initial_warehouse_id: '',
    initial_location_id: ''
  });

  const [availableLocations, setAvailableLocations] = useState([]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let queryStr = '?';
      const term = search || globalSearch;
      if (term) queryStr += `search=${encodeURIComponent(term)}&`;
      if (selectedCat) queryStr += `category_id=${selectedCat}&`;
      if (selectedStatus) queryStr += `stock_status=${selectedStatus}&`;

      const [pRes, cRes, wRes] = await Promise.all([
        apiClient.get(`/products${queryStr}`),
        apiClient.get('/categories'),
        apiClient.get('/warehouses')
      ]);

      setProducts(pRes.data);
      setCategories(cRes.data);
      setWarehouses(wRes.data);
    } catch (err) {
      showError('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, globalSearch, selectedCat, selectedStatus]);

  const handleWarehouseChange = (whId) => {
    setFormData((prev) => ({ ...prev, initial_warehouse_id: whId, initial_location_id: '' }));
    const target = warehouses.find((w) => w.id === parseInt(whId));
    setAvailableLocations(target ? target.locations || [] : []);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/products', {
        ...formData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        initial_warehouse_id: formData.initial_warehouse_id ? parseInt(formData.initial_warehouse_id) : null,
        initial_location_id: formData.initial_location_id ? parseInt(formData.initial_location_id) : null,
        initial_stock: parseFloat(formData.initial_stock || 0)
      });
      showSuccess('Product created successfully!');
      setIsCreateOpen(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create product');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await apiClient.put(`/products/${selectedProduct.id}`, {
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        uom: formData.uom,
        min_stock: parseFloat(formData.min_stock),
        max_stock: parseFloat(formData.max_stock),
        reorder_qty: parseFloat(formData.reorder_qty),
        safety_stock: parseFloat(formData.safety_stock)
      });
      showSuccess('Product updated successfully!');
      setIsEditOpen(false);
      fetchProducts();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update product');
    }
  };

  const handleDelete = async (prodId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiClient.delete(`/products/${prodId}`);
      showSuccess('Product deleted');
      fetchProducts();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete product');
    }
  };

  const openEditModal = (p) => {
    setSelectedProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      description: p.description || '',
      category_id: p.category_id || '',
      uom: p.uom,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      reorder_qty: p.reorder_qty,
      safety_stock: p.safety_stock,
      initial_stock: 0,
      initial_warehouse_id: '',
      initial_location_id: ''
    });
    setIsEditOpen(true);
  };

  const openQuantsModal = (p) => {
    setSelectedProduct(p);
    setIsQuantsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      description: '',
      category_id: '',
      uom: 'Units',
      min_stock: 10,
      max_stock: 500,
      reorder_qty: 50,
      safety_stock: 15,
      initial_stock: 0,
      initial_warehouse_id: '',
      initial_location_id: ''
    });
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span className="active">Products</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="display-title">Products</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Master product catalog, inventory threshold rules, and location breakdowns.
          </p>
        </div>
        <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <div className="filter-group">
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU or Name..."
              className="form-control"
              style={{ paddingLeft: '2.4rem', height: '36px', fontSize: '0.82rem' }}
            />
          </div>

          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="form-control"
            style={{ width: '180px', height: '36px', fontSize: '0.82rem' }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="form-control"
            style={{ width: '180px', height: '36px', fontSize: '0.82rem' }}
          >
            <option value="">All Stock Statuses</option>
            <option value="NORMAL">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Reorder Rules</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-primary)', background: '#f0f0ea', padding: '3px 7px', borderRadius: '4px', fontSize: '0.78rem' }}>
                      {p.sku}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.description || 'No description'}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.category_name || '—'}</td>
                  <td>
                    <button
                      onClick={() => openQuantsModal(p)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', padding: 0 }}
                    >
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                        {p.current_stock} <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{p.uom}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                        <Warehouse size={12} /> {p.quants?.length || 0} locations
                      </div>
                    </button>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Min: {p.min_stock} | Max: {p.max_stock} | Reorder: {p.reorder_qty}
                  </td>
                  <td>
                    <StatusBadge status={p.reorder_status} type="stock" />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => openEditModal(p)}
                      title="Edit Product"
                      className="btn btn-secondary btn-sm"
                      style={{ marginRight: '0.4rem', padding: '0 8px' }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Delete Product"
                      className="btn btn-sm"
                      style={{ background: 'var(--accent-danger-light)', color: 'var(--accent-danger)', border: '1px solid rgba(217,83,79,0.2)', padding: '0 8px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No products found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE PRODUCT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Master Product"
        maxWidth="700px"
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SKU / Product Code *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. PROD-999"
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Wi-Fi Router"
                className="form-control"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="form-control"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Unit of Measure (UOM)</label>
              <input
                type="text"
                required
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                placeholder="Units, Meters, Kg..."
                className="form-control"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-control"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Min Stock Level</label>
              <input
                type="number"
                min="0"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Stock Level</label>
              <input
                type="number"
                min="1"
                value={formData.max_stock}
                onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reorder Quantity</label>
              <input
                type="number"
                min="1"
                value={formData.reorder_qty}
                onChange={(e) => setFormData({ ...formData, reorder_qty: e.target.value })}
                className="form-control"
              />
            </div>
          </div>

          {/* Initial Stock Setup Section */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Warehouse size={16} /> Optional Initial Stock Setup
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Initial Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formData.initial_stock}
                  onChange={(e) => setFormData({ ...formData, initial_stock: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Warehouse</label>
                <select
                  value={formData.initial_warehouse_id}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Location / Rack</label>
                <select
                  value={formData.initial_location_id}
                  onChange={(e) => setFormData({ ...formData, initial_location_id: e.target.value })}
                  className="form-control"
                >
                  <option value="">Select Location</option>
                  {availableLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Product</button>
          </div>
        </form>
      </Modal>

      {/* EDIT PRODUCT MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Product — ${selectedProduct?.sku}`}
        maxWidth="650px"
      >
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-control"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="form-control"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Unit of Measure (UOM)</label>
              <input
                type="text"
                required
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                className="form-control"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Min Stock</label>
              <input
                type="number"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Stock</label>
              <input
                type="number"
                value={formData.max_stock}
                onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reorder Qty</label>
              <input
                type="number"
                value={formData.reorder_qty}
                onChange={(e) => setFormData({ ...formData, reorder_qty: e.target.value })}
                className="form-control"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsEditOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Update Product</button>
          </div>
        </form>
      </Modal>

      {/* QUANTS BREAKDOWN MODAL */}
      <Modal
        isOpen={isQuantsOpen}
        onClose={() => setIsQuantsOpen(false)}
        title={`Location Stock Breakdown — ${selectedProduct?.name}`}
        maxWidth="600px"
      >
        {selectedProduct?.quants && selectedProduct.quants.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Location / Rack</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct.quants.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>{q.warehouse_name}</td>
                    <td>{q.location_name}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {q.quantity} {selectedProduct.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            No stock currently recorded in any warehouse location.
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;

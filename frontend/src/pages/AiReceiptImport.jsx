import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { 
  Sparkles, UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  Trash, Edit3, ArrowRight, ShieldCheck, RefreshCw, FileCheck, Info
} from 'lucide-react';

const AiReceiptImport = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractResult, setExtractResult] = useState(null);

  // Database Resources for Review Dropdowns
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);

  // Review Form Controls
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [autoValidate, setAutoValidate] = useState(true);
  const [reviewItems, setReviewItems] = useState([]);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [sRes, wRes, pRes] = await Promise.all([
          apiClient.get('/suppliers'),
          apiClient.get('/warehouses'),
          apiClient.get('/products')
        ]);
        setSuppliers(sRes.data);
        setWarehouses(wRes.data);
        setProducts(pRes.data);
      } catch (err) {
        console.error('Error fetching resources:', err);
      }
    };
    fetchResources();
  }, []);

  const handleWarehouseChange = (whId) => {
    setWarehouseId(whId);
    setLocationId('');
    const target = warehouses.find((w) => w.id === parseInt(whId));
    setAvailableLocations(target ? target.locations || [] : []);
  };

  const handleFileUpload = async (uploadFile) => {
    if (!uploadFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await apiClient.post('/ai-receipts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      setExtractResult(data);
      setSupplierId(data.matched_supplier_id ? data.matched_supplier_id.toString() : (suppliers[0]?.id.toString() || ''));
      setInvoiceNumber(data.invoice_number || `INV-${Date.now().toString().slice(-6)}`);
      
      if (warehouses.length > 0) {
        const firstWh = warehouses[0];
        setWarehouseId(firstWh.id.toString());
        setAvailableLocations(firstWh.locations || []);
        if (firstWh.locations && firstWh.locations.length > 0) {
          setLocationId(firstWh.locations[0].id.toString());
        }
      }

      setReviewItems(data.items.map((i) => ({
        extracted_name: i.extracted_name,
        extracted_sku: i.extracted_sku,
        product_id: i.matched_product_id || (products[0]?.id || ''),
        demand_qty: i.extracted_qty || 1,
        unit_price: i.unit_price || 0,
        match_method: i.match_method,
        confidence_score: i.confidence_score,
        is_low_confidence: i.is_low_confidence
      })));

      showSuccess(`Invoice #${data.invoice_number || ''} parsed with Gemini AI!`);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to process invoice with Gemini AI');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleUpload = async () => {
    setLoading(true);
    try {
      const sampleText = `INVOICE #INV-2026-9042
Supplier: Apex Electronics Ltd
Date: 2026-09-26
Items:
1. Enterprise Wi-Fi 6 Router | Qty: 20 | Price: 45.00
2. Digital Caliper Tool 150mm | Qty: 15 | Price: 18.50
Total: $1,177.50`;
      
      const blob = new Blob([sampleText], { type: 'text/plain' });
      const sampleFile = new File([blob], 'demo_invoice.txt', { type: 'text/plain' });
      await handleFileUpload(sampleFile);
    } catch (err) {
      showError('Failed to generate demo sample invoice');
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...reviewItems];
    updated[index][field] = value;
    if (field === 'product_id') {
      updated[index].match_method = 'Manual Override';
      updated[index].confidence_score = 100;
      updated[index].is_low_confidence = false;
    }
    setReviewItems(updated);
  };

  const handleDeleteItem = (index) => {
    setReviewItems(reviewItems.filter((_, idx) => idx !== index));
  };

  const handleAddItem = () => {
    setReviewItems([...reviewItems, {
      extracted_name: 'Manual Added Item',
      extracted_sku: '',
      product_id: products.length > 0 ? products[0].id : '',
      demand_qty: 1,
      unit_price: 0,
      match_method: 'Manual Select',
      confidence_score: 100,
      is_low_confidence: false
    }]);
  };

  const handleApproveAndCreate = async () => {
    if (!supplierId || !warehouseId || !locationId || !invoiceNumber) {
      showError('Please select Supplier, Target Warehouse, Location, and Invoice Number');
      return;
    }
    if (reviewItems.length === 0) {
      showError('Receipt must contain at least one line item');
      return;
    }

    const payload = {
      supplier_id: parseInt(supplierId),
      warehouse_id: parseInt(warehouseId),
      location_id: parseInt(locationId),
      invoice_number: invoiceNumber,
      notes: "Extracted via Gemini AI Document Parser with RapidFuzz Matching",
      auto_validate: autoValidate,
      items: reviewItems.map((i) => ({
        product_id: parseInt(i.product_id),
        demand_qty: parseFloat(i.demand_qty),
        unit_price: parseFloat(i.unit_price || 0)
      }))
    };

    setLoading(true);
    try {
      const res = await apiClient.post('/ai-receipts/approve', payload);
      showSuccess(`Receipt #${res.data.reference_no} approved & ${autoValidate ? 'Stock Validated!' : 'Draft Created!'}`);
      setExtractResult(null);
      setFile(null);
    } catch (err) {
      showError(err.response?.data?.detail || 'Receipt approval failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>Dashboard</span>
        <span>/</span>
        <span>...</span>
        <span>/</span>
        <span className="active">AI Receipt Import</span>
      </div>

      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="display-title">AI Document-to-Receipt Processing</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Upload PDF or image invoices to extract line items using Gemini Vision AI & RapidFuzz product matching
          </p>
        </div>

        <button onClick={handleSampleUpload} disabled={loading} className="btn btn-secondary">
          <FileText size={15} color="#D6A800" />
          <span>Load Demo Sample Invoice</span>
        </button>
      </div>

      {/* STEP 1: UPLOAD AREA */}
      {!extractResult && (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem', borderStyle: 'dashed', borderWidth: '1.5px', borderColor: '#E7E7E2' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: '#FFF9CC',
            color: '#D6A800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <UploadCloud size={28} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202020', marginBottom: '0.4rem' }}>
            Upload Invoice or Delivery Challan
          </h3>
          <p style={{ color: '#777777', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            Drag and drop your PDF, PNG, JPG, or WEBP document here or select a file to parse using Gemini AI.
          </p>

          <input
            type="file"
            id="ai-file-input"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <label htmlFor="ai-file-input" className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <FileCheck size={16} />
              <span>Select Document File</span>
            </label>
            <button onClick={handleSampleUpload} className="btn btn-secondary">
              Try Demo Sample Document
            </button>
          </div>

          {loading && (
            <div style={{ marginTop: '1.75rem', color: '#777777', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <RefreshCw size={16} className="spin" color="#D6A800" />
              <span>Running Gemini Vision AI & RapidFuzz Matching Engine...</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: HUMAN REVIEW & APPROVAL SCREEN */}
      {extractResult && (
        <div>
          {/* Top Document Extraction Summary Panel */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E7E7E2', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#202020' }}>
                <Sparkles size={18} color="#D6A800" />
                <span>Extracted Document Summary & Matching Results</span>
              </h3>
              <button onClick={() => setExtractResult(null)} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                Upload Different File
              </button>
            </div>

            {extractResult.is_duplicate_invoice && (
              <div style={{
                background: '#FDECEC',
                border: '1px solid #E05252',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                color: '#E05252',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={16} />
                <span>DUPLICATE WARNING: Invoice #{extractResult.invoice_number} already exists in the system.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="form-label">Extracted Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="form-control"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.72rem', color: '#22A447', marginTop: '0.25rem', fontWeight: 500 }}>
                  Supplier Confidence: {extractResult.supplier_match_confidence}%
                </div>
              </div>

              <div>
                <label className="form-label">Invoice Reference # *</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="form-control"
                />
              </div>

              <div>
                <label className="form-label">Destination Warehouse *</label>
                <select
                  value={warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Target Location Rack *</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select Location</option>
                  {availableLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#202020' }}>
                  Review & Correct Extracted Products ({reviewItems.length} Lines)
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#777777', margin: 0 }}>
                  Verify quantities and confirm matched catalog products before final validation
                </p>
              </div>
              <button onClick={handleAddItem} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                + Add Line Item
              </button>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Extracted Document Text</th>
                    <th>Matched Catalog Product</th>
                    <th>Match Method</th>
                    <th>Confidence</th>
                    <th style={{ width: '100px' }}>Quantity</th>
                    <th style={{ width: '110px' }}>Unit Price ($)</th>
                    <th style={{ width: '60px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((item, idx) => (
                    <tr key={idx} style={{ background: item.is_low_confidence ? '#FEF8E6' : 'transparent' }}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#202020' }}>{item.extracted_name}</div>
                        {item.extracted_sku && (
                          <div style={{ fontSize: '0.7rem', color: '#A5A5A5' }}>Doc SKU: {item.extracted_sku}</div>
                        )}
                      </td>
                      <td>
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                          className="form-control"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                        >
                          <option value="">-- Choose Product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: '#777777' }}>
                          {item.match_method || 'Direct'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: item.confidence_score >= 80 ? '#E8F8ED' : '#FEF8E6',
                          color: item.confidence_score >= 80 ? '#22A447' : '#E9A400'
                        }}>
                          {item.confidence_score}%
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.demand_qty}
                          onChange={(e) => handleItemChange(idx, 'demand_qty', e.target.value)}
                          className="form-control"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="form-control"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#E05252', cursor: 'pointer', padding: '4px' }}
                          title="Remove Line"
                        >
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Approval Controls */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid #E7E7E2',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#202020', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoValidate}
                  onChange={(e) => setAutoValidate(e.target.checked)}
                  style={{ accentColor: '#202020' }}
                />
                <span>Auto-validate receipt directly into Stock Engine (updates physical stock immediately)</span>
              </label>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setExtractResult(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleApproveAndCreate}
                  disabled={loading}
                  className="btn btn-primary"
                  id="approve-receipt-btn"
                >
                  <CheckCircle2 size={16} color="#F4D21F" />
                  <span>{loading ? 'Processing...' : 'Approve & Create Receipt'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiReceiptImport;

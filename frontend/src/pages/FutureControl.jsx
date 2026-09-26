import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import {
  Compass, Play, Pause, RotateCcw, Plus, Trash2, ArrowRight,
  TrendingUp, AlertTriangle, ShieldCheck, CheckCircle2, Clock,
  Truck, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Layers,
  Calendar, Zap, BarChart2, ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const FutureControl = () => {
  // Mode: LIVE, SIMULATE, REPLAY
  const [mode, setMode] = useState('SIMULATE'); // 'LIVE' | 'SIMULATE' | 'REPLAY'

  // Selected Timeline Horizon (in days: 0 = Today, 3, 7, 14, 21, 30)
  const [selectedDay, setSelectedDay] = useState(14);

  // Active Branching Scenario ('baseline', 'spike', 'delay', 'proactive')
  const [activeScenario, setActiveScenario] = useState('baseline');

  // Simulation Events List
  const [simEvents, setSimEvents] = useState([
    { id: 1, day: 7, type: 'RECEIPT', label: 'Vendor PO Replenishment', qtyDelta: +250, valueDelta: +11250 },
    { id: 2, day: 14, type: 'DEMAND_SPIKE', label: 'Surge Customer Order Wave', qtyDelta: -80, valueDelta: -3600 }
  ]);

  // Modal for Adding Simulation Event
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventDay, setNewEventDay] = useState(7);
  const [newEventType, setNewEventType] = useState('RECEIPT');
  const [newEventQty, setNewEventQty] = useState(100);
  const [newEventLabel, setNewEventLabel] = useState('Scheduled Batch Arrival');

  // Data from backend
  const [analyticsData, setAnalyticsData] = useState(null);
  const [mlSummary, setMlSummary] = useState(null);
  const [mlForecasts, setMlForecasts] = useState([]);
  const [stockouts, setStockouts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Replay State
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const replayTimerRef = useRef(null);

  // Load Real Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [anRes, sumRes, fcRes, stRes, whRes] = await Promise.all([
          apiClient.get('/analytics/dashboard-full?time_range=30D'),
          apiClient.get('/ml/summary'),
          apiClient.get('/ml/demand-forecast'),
          apiClient.get('/ml/stockouts'),
          apiClient.get('/warehouses')
        ]);
        setAnalyticsData(anRes.data);
        setMlSummary(sumRes.data);
        setMlForecasts(fcRes.data || []);
        setStockouts(stRes.data || []);
        setWarehouses(whRes.data || []);
      } catch (err) {
        console.error('Error fetching future control data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Replay Controller
  useEffect(() => {
    if (replayPlaying) {
      replayTimerRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          const maxLen = 6;
          if (prev >= maxLen - 1) {
            setReplayPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1500);
    } else {
      clearInterval(replayTimerRef.current);
    }
    return () => clearInterval(replayTimerRef.current);
  }, [replayPlaying]);

  // Derived baseline values from real data
  const baseStock = analyticsData?.kpis?.total_stock_units || 617;
  const baseValuation = analyticsData?.kpis?.inventory_valuation || 34140;
  const avgDailyBurn = stockouts.length > 0 
    ? stockouts.reduce((acc, s) => acc + (s.daily_burn_rate || 2), 0)
    : 24.5;
  const baseCoverageDays = avgDailyBurn > 0 ? Math.round(baseStock / avgDailyBurn) : 25;

  // Calculate Scenario Modifiers
  const scenarioModifiers = {
    baseline: { demandMul: 1.0, leadDelay: 0, label: 'Normal Baseline' },
    spike: { demandMul: 1.35, leadDelay: 0, label: 'Demand Surge (+35%)' },
    delay: { demandMul: 1.0, leadDelay: 5, label: 'Supplier Delay (+5d)' },
    proactive: { demandMul: 1.0, leadDelay: 0, label: 'Proactive Buffer' }
  };

  const currModifier = scenarioModifiers[activeScenario] || scenarioModifiers.baseline;

  // Dynamic simulation values at selectedDay
  const eventsUpToDay = simEvents.filter(e => e.day <= selectedDay);
  const netEventsQty = eventsUpToDay.reduce((acc, e) => acc + e.qtyDelta, 0);
  const netEventsValue = eventsUpToDay.reduce((acc, e) => acc + e.valueDelta, 0);

  const effectiveDailyDemand = avgDailyBurn * currModifier.demandMul;
  const projectedDepletion = effectiveDailyDemand * selectedDay;

  // Final Simulated State at Horizon
  const simStock = Math.max(0, Math.round(baseStock - projectedDepletion + netEventsQty));
  const simCoverage = effectiveDailyDemand > 0 ? Math.round(simStock / effectiveDailyDemand) : 0;
  const simValue = Math.max(0, Math.round(baseValuation - (projectedDepletion * 50) + netEventsValue));
  
  const simRisk = simCoverage <= 5 ? 'Critical' : simCoverage <= 12 ? 'High' : simCoverage <= 20 ? 'Medium' : 'Safe';
  const baseRisk = baseCoverageDays <= 7 ? 'Critical' : baseCoverageDays <= 14 ? 'High' : 'Medium';

  // Add event handler
  const handleAddEvent = () => {
    const qty = parseFloat(newEventQty) || 0;
    const delta = newEventType === 'DELIVERY' ? -qty : qty;
    const value = delta * 45; // average price unit
    const newEv = {
      id: Date.now(),
      day: parseInt(newEventDay),
      type: newEventType,
      label: newEventLabel || `${newEventType} Event`,
      qtyDelta: delta,
      valueDelta: value
    };
    setSimEvents([...simEvents, newEv]);
    setShowAddModal(false);
    setNewEventLabel('');
  };

  const handleDeleteEvent = (id) => {
    setSimEvents(simEvents.filter(e => e.id !== id));
  };

  // Timeline curve data points
  const timelineChartData = [0, 3, 7, 14, 21, 30].map(day => {
    const dayEvs = simEvents.filter(e => e.day <= day);
    const dayEvQty = dayEvs.reduce((a, b) => a + b.qtyDelta, 0);
    const dayDepletion = effectiveDailyDemand * day;
    const simulated = Math.max(0, Math.round(baseStock - dayDepletion + dayEvQty));
    const baseline = Math.max(0, Math.round(baseStock - (avgDailyBurn * day)));
    return {
      dayLabel: day === 0 ? 'Today' : `Day ${day}`,
      dayNum: day,
      baseline,
      simulated
    };
  });

  // Replay Real Movements Feed
  const replayItems = (analyticsData?.charts?.recent_movements || [
    { movement_type: 'INCOMING', reference_doc: 'REC-2026-001', product_name: 'Wi-Fi 6 Router', quantity: 50, timestamp: '09:15 AM' },
    { movement_type: 'OUTGOING', reference_doc: 'DEL-2026-004', product_name: 'ARM Microcontroller', quantity: 30, timestamp: '10:30 AM' },
    { movement_type: 'TRANSFER', reference_doc: 'TRF-2026-001', product_name: 'Copper Wire', quantity: 20, timestamp: '11:45 AM' },
    { movement_type: 'ADJUSTMENT', reference_doc: 'ADJ-2026-001', product_name: 'Task Chair', quantity: -2, timestamp: '01:10 PM' },
    { movement_type: 'INCOMING', reference_doc: 'INV-2026-AI-7580', product_name: 'Digital Caliper', quantity: 15, timestamp: '02:30 PM' },
    { movement_type: 'OUTGOING', reference_doc: 'SO-2026-092', product_name: 'Wi-Fi 6 Router', quantity: 10, timestamp: '04:00 PM' }
  ]).slice(0, 6);

  return (
    <div className="page-container">
      {/* 1. Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>Dashboard</span>
        <span>/</span>
        <span>...</span>
        <span>/</span>
        <span className="active">Future Control</span>
      </div>

      {/* 2. Page Header & Mode Selector */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '1.75rem',
        gap: '1rem'
      }}>
        <div>
          <h1 className="display-title">Inventory Future Control</h1>
          <p className="display-subtitle" style={{ marginBottom: 0 }}>
            Simulate inventory decisions before they happen.
          </p>
        </div>

        {/* Mode Selector: LIVE | SIMULATE | REPLAY */}
        <div className="segmented-control" style={{ height: '38px', padding: '4px' }}>
          {['LIVE', 'SIMULATE', 'REPLAY'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`segmented-btn ${mode === m ? 'active' : ''}`}
              style={{ padding: '0 14px', height: '30px', fontWeight: 600, fontSize: '0.78rem' }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 3. SIMULATION HORIZON TIMELINE (when in SIMULATE or LIVE mode) */}
      {mode !== 'REPLAY' && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass size={18} color="#202020" />
              <span className="section-title">Projection Horizon Timeline</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#777777', fontWeight: 500 }}>
              Selected Forecast: <strong style={{ color: '#202020' }}>{selectedDay === 0 ? 'Today (Live)' : `Day +${selectedDay}`}</strong>
            </span>
          </div>

          {/* Interactive Timeline Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            {[
              { day: 0, label: 'TODAY' },
              { day: 3, label: 'DAY 3' },
              { day: 7, label: 'DAY 7' },
              { day: 14, label: 'DAY 14' },
              { day: 21, label: 'DAY 21' },
              { day: 30, label: 'DAY 30' }
            ].map((node) => {
              const isSelected = selectedDay === node.day;
              const hasEvents = simEvents.some(e => e.day === node.day);
              return (
                <button
                  key={node.day}
                  onClick={() => setSelectedDay(node.day)}
                  style={{
                    padding: '0.75rem 0.5rem',
                    borderRadius: '12px',
                    border: `1.5px solid ${isSelected ? '#202020' : '#E7E7E2'}`,
                    background: isSelected ? '#202020' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#202020',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: isSelected ? '#A3A3A3' : '#777777', fontWeight: 500 }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '2px' }}>
                    +{node.day}d
                  </div>
                  {hasEvents && (
                    <span style={{
                      position: 'absolute',
                      top: '6px',
                      right: '8px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#F4D21F'
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Compact Timeline Horizon Projection Chart */}
          <div style={{ width: '100%', height: 160, marginTop: '0.75rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineChartData}>
                <defs>
                  <linearGradient id="simAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F4D21F" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#F4D21F" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EB" />
                <XAxis dataKey="dayLabel" stroke="#A3A3A3" tick={{ fill: '#777777', fontSize: 11, fontFamily: 'Inter, sans-serif' }} />
                <YAxis stroke="#A3A3A3" tick={{ fill: '#777777', fontSize: 11, fontFamily: 'Inter, sans-serif' }} />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div style={{ background: '#FFFFFF', border: '1px solid #E7E7E2', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: '#777777' }}>{label}</div>
                        <div style={{ color: '#202020', fontWeight: 700 }}>Simulated: {payload[0]?.value} units</div>
                        <div style={{ color: '#777777' }}>Baseline: {payload[1]?.value} units</div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Area type="monotone" dataKey="simulated" name="Simulated Path" stroke="#D6A800" strokeWidth={2.5} fill="url(#simAreaGrad)" />
                <Line type="monotone" dataKey="baseline" name="Status Quo" stroke="#CFCFC8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. CURRENT VS SIMULATED STATE COMPARISON CARDS */}
      {mode === 'SIMULATE' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          {/* Status Quo (Current) */}
          <div className="card" style={{ borderLeft: '4px solid #777777' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#777777', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CURRENT (Status Quo)
              </span>
              <span className={`badge badge-${baseRisk === 'Safe' ? 'positive' : 'warning'}`}>
                {baseRisk} Risk
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Available Stock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#202020' }}>{baseStock} units</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Stock Coverage</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#202020' }}>{baseCoverageDays} days</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Daily Burn Rate</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#202020' }}>{avgDailyBurn.toFixed(1)} u/d</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Inventory Value</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#202020' }}>${baseValuation.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Simulated Decision State */}
          <div className="card" style={{ borderLeft: '4px solid #F4D21F', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D6A800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SIMULATED (Day +{selectedDay})
              </span>
              <span className={`badge badge-${simRisk === 'Safe' ? 'positive' : simRisk === 'Critical' ? 'danger' : 'warning'}`}>
                {simRisk} Risk
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Projected Stock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#202020' }}>{simStock} units</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Projected Coverage</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#202020' }}>{simCoverage} days</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Simulated Burn</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#202020' }}>{effectiveDailyDemand.toFixed(1)} u/d</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Projected Valuation</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#202020' }}>${simValue.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Decision Impact Delta Card */}
          <div className="card" style={{ borderLeft: '4px solid #20A447' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#20A447', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.75rem' }}>
              DECISION IMPACT DELTA
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Net Stock Delta</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: simStock >= baseStock ? '#20A447' : '#D9534F' }}>
                  {simStock >= baseStock ? `+${simStock - baseStock}` : simStock - baseStock} units
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Coverage Delta</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: simCoverage >= baseCoverageDays ? '#20A447' : '#D9534F' }}>
                  {simCoverage >= baseCoverageDays ? `+${simCoverage - baseCoverageDays}` : simCoverage - baseCoverageDays} days
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Valuation Shift</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#202020' }}>
                  {simValue >= baseValuation ? `+$${(simValue - baseValuation).toLocaleString()}` : `-$${(baseValuation - simValue).toLocaleString()}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#777777' }}>Stockout Exposure</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: simRisk === 'Critical' ? '#D9534F' : '#20A447' }}>
                  {simRisk === 'Safe' ? '−62% Risk' : '+40% Risk'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SCENARIO BRANCHING CARDS */}
      {mode === 'SIMULATE' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="section-title">Scenario Branching</span>
            <span style={{ fontSize: '0.78rem', color: '#777777' }}>Test stress conditions on baseline inventory</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem'
          }}>
            {[
              { id: 'baseline', title: 'Scenario A: Normal Baseline', desc: 'Historical demand velocity with regular replenishment schedule.', risk: 'Medium', cov: `${baseCoverageDays}d` },
              { id: 'spike', title: 'Scenario B: Demand Spike (+35%)', desc: 'Sudden wholesale customer orders accelerating burn rate.', risk: 'High', cov: `${Math.round(baseCoverageDays * 0.74)}d` },
              { id: 'delay', title: 'Scenario C: Supplier Delay (+5d)', desc: 'Port congestion / supply chain delay postponing arrivals.', risk: 'Critical', cov: `${Math.max(0, baseCoverageDays - 5)}d` },
              { id: 'proactive', title: 'Scenario D: Proactive Buffer', desc: 'Pre-emptive safety purchase order (+250 units) on Day 7.', risk: 'Safe', cov: `${baseCoverageDays + 14}d` }
            ].map((sc) => {
              const isActive = activeScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => setActiveScenario(sc.id)}
                  className="card"
                  style={{
                    padding: '1.1rem 1.25rem',
                    cursor: 'pointer',
                    borderColor: isActive ? '#202020' : '#E7E7E2',
                    boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.06)' : 'var(--shadow-subtle)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#202020' }}>
                      {sc.title}
                    </span>
                    <span className={`badge badge-${sc.risk === 'Safe' ? 'positive' : sc.risk === 'Critical' ? 'danger' : 'warning'}`}>
                      {sc.risk}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#777777', lineHeight: '1.4', marginBottom: '0.65rem' }}>
                    {sc.desc}
                  </p>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#202020', borderTop: '1px solid #F0F0EB', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Estimated Coverage:</span>
                    <span>{sc.cov}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. WHAT-IF EVENTS BUILDER & ACTIVE EVENTS */}
      {mode === 'SIMULATE' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span className="section-title">What-If Event Injections</span>
              <p style={{ fontSize: '0.78rem', color: '#777777', margin: 0 }}>
                Inject hypothetical receipts, deliveries, transfers, or demand spikes
              </p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Add What-If Event</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {simEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  background: '#F7F7F3',
                  border: '1px solid #E7E7E2',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: ev.qtyDelta > 0 ? '#E8F8ED' : '#FDECEC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: ev.qtyDelta > 0 ? '#20A447' : '#D9534F'
                }}>
                  {ev.qtyDelta > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#202020' }}>
                    Day +{ev.day}: {ev.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#777777' }}>
                    Impact: <strong style={{ color: ev.qtyDelta > 0 ? '#20A447' : '#D9534F' }}>
                      {ev.qtyDelta > 0 ? `+${ev.qtyDelta}` : ev.qtyDelta} units
                    </strong>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteEvent(ev.id)}
                  style={{ background: 'none', border: 'none', color: '#A3A3A3', cursor: 'pointer', padding: '2px' }}
                  title="Remove Event"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. FUTURE RISK MAP: WAREHOUSE NETWORK NODES */}
      {mode === 'SIMULATE' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <span className="section-title">Warehouse Network Risk Map</span>
            <p style={{ fontSize: '0.78rem', color: '#777777', margin: 0 }}>
              Physical distribution & projected stockout points under selected simulation
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {(warehouses.length > 0 ? warehouses : [
              { id: 1, name: 'Main Central Warehouse', code: 'WH-MAIN' },
              { id: 2, name: 'East Overflow Facility', code: 'WH-EAST' },
              { id: 3, name: 'Secondary Storage Unit', code: 'WH-SEC' }
            ]).map((wh, idx) => {
              const status = idx === 0 ? 'Safe' : idx === 1 ? 'At Risk' : 'Depleting';
              const color = idx === 0 ? '#20A447' : idx === 1 ? '#E5A400' : '#D9534F';
              const allocatedUnits = idx === 0 ? Math.round(simStock * 0.6) : idx === 1 ? Math.round(simStock * 0.28) : Math.round(simStock * 0.12);

              return (
                <div
                  key={wh.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E7E7E2',
                    borderRadius: '12px',
                    padding: '1rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#202020' }}>{wh.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#A3A3A3' }}>{wh.code}</div>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: color,
                      background: `${color}15`,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: `1px solid ${color}30`
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                      {status}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #F0F0EB', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#777777' }}>Simulated Stock:</span>
                    <strong style={{ color: '#202020' }}>{allocatedUnits} units</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. DECISION REPLAY MODE */}
      {mode === 'REPLAY' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <span className="section-title">Decision Replay Timeline</span>
              <p style={{ fontSize: '0.78rem', color: '#777777', margin: 0 }}>
                Chronological animated playback of historical operational actions
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setReplayPlaying(!replayPlaying)}
                className="btn btn-primary btn-sm"
              >
                {replayPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{replayPlaying ? 'Pause Replay' : 'Play Replay'}</span>
              </button>
              <button
                onClick={() => { setReplayPlaying(false); setReplayIndex(0); }}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Running Inventory State Counter */}
          <div style={{
            background: '#F7F7F3',
            border: '1px solid #E7E7E2',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#777777', textTransform: 'uppercase' }}>Replay Timestamp</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#202020' }}>
                {replayItems[replayIndex]?.timestamp || '09:00 AM'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#777777', textTransform: 'uppercase' }}>Active Transaction</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#202020' }}>
                {replayItems[replayIndex]?.reference_doc} — {replayItems[replayIndex]?.product_name}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#777777', textTransform: 'uppercase' }}>Running Stock Delta</div>
              <div style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: replayItems[replayIndex]?.quantity >= 0 ? '#20A447' : '#D9534F'
              }}>
                {replayItems[replayIndex]?.quantity >= 0 ? `+${replayItems[replayIndex]?.quantity}` : replayItems[replayIndex]?.quantity} units
              </div>
            </div>
          </div>

          {/* Chronological Step Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {replayItems.map((item, idx) => {
              const isPast = idx < replayIndex;
              const isCurrent = idx === replayIndex;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: `1px solid ${isCurrent ? '#202020' : '#E7E7E2'}`,
                    background: isCurrent ? '#FFFFFF' : isPast ? '#F7F7F3' : '#FFFFFF',
                    boxShadow: isCurrent ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    opacity: idx > replayIndex ? 0.45 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#A3A3A3', width: '65px', fontWeight: 500 }}>
                      {item.timestamp}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: item.movement_type === 'INCOMING' ? '#E8F8ED' : item.movement_type === 'OUTGOING' ? '#FDECEC' : '#F0F0EB',
                      color: item.movement_type === 'INCOMING' ? '#20A447' : item.movement_type === 'OUTGOING' ? '#D9534F' : '#202020'
                    }}>
                      {item.movement_type}
                    </span>
                    <span style={{ fontWeight: 600, color: '#202020', fontSize: '0.82rem' }}>
                      {item.reference_doc}
                    </span>
                    <span style={{ color: '#777777', fontSize: '0.78rem' }}>
                      {item.product_name}
                    </span>
                  </div>

                  <div style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: item.movement_type === 'INCOMING' ? '#20A447' : item.movement_type === 'OUTGOING' ? '#D9534F' : '#202020'
                  }}>
                    {item.movement_type === 'OUTGOING' ? `−${Math.abs(item.quantity)}` : `+${item.quantity}`} u
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. REALITY VS SIMULATION COMPARISON TABLE */}
      <div className="card">
        <div style={{ borderBottom: '1px solid #E7E7E2', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <span className="section-title">Reality vs. Simulation Decision Audit</span>
          <p style={{ fontSize: '0.78rem', color: '#777777', margin: 0 }}>
            Side-by-side verification of operational parameters at target projection
          </p>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Inventory Metric</th>
                <th>Reality (Live Baseline)</th>
                <th>Simulation (Day +{selectedDay})</th>
                <th>Variance Shift</th>
                <th>Operational Decision Outcome</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Total Physical Stock</td>
                <td>{baseStock} units</td>
                <td style={{ fontWeight: 600, color: '#202020' }}>{simStock} units</td>
                <td style={{ fontWeight: 700, color: simStock >= baseStock ? '#20A447' : '#D9534F' }}>
                  {simStock >= baseStock ? `+${simStock - baseStock}` : simStock - baseStock} units
                </td>
                <td style={{ color: '#777777' }}>Reflects sales burn plus planned deliveries</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Daily Demand Rate</td>
                <td>{avgDailyBurn.toFixed(1)} u/d</td>
                <td style={{ fontWeight: 600, color: '#202020' }}>{effectiveDailyDemand.toFixed(1)} u/d</td>
                <td style={{ color: '#777777' }}>
                  {currModifier.demandMul !== 1 ? `${currModifier.demandMul * 100}% of Base` : 'Standard'}
                </td>
                <td style={{ color: '#777777' }}>Adjusted for scenario market stress</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Estimated Coverage</td>
                <td>{baseCoverageDays} days</td>
                <td style={{ fontWeight: 600, color: '#202020' }}>{simCoverage} days</td>
                <td style={{ fontWeight: 700, color: simCoverage >= baseCoverageDays ? '#20A447' : '#D9534F' }}>
                  {simCoverage >= baseCoverageDays ? `+${simCoverage - baseCoverageDays}` : simCoverage - baseCoverageDays} days
                </td>
                <td style={{ color: '#777777' }}>Stockout horizon safety duration</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Stockout Risk Exposure</td>
                <td>
                  <span className={`badge badge-${baseRisk === 'Safe' ? 'positive' : 'warning'}`}>{baseRisk}</span>
                </td>
                <td>
                  <span className={`badge badge-${simRisk === 'Safe' ? 'positive' : simRisk === 'Critical' ? 'danger' : 'warning'}`}>{simRisk}</span>
                </td>
                <td style={{ fontWeight: 600, color: simRisk === 'Safe' ? '#20A447' : '#D9534F' }}>
                  {simRisk === 'Safe' ? 'Risk Mitigated' : 'Attention Needed'}
                </td>
                <td style={{ color: '#777777' }}>Critical reorder threshold alert</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Valuation Reserve</td>
                <td>${baseValuation.toLocaleString()}</td>
                <td style={{ fontWeight: 600, color: '#202020' }}>${simValue.toLocaleString()}</td>
                <td style={{ fontWeight: 700, color: '#202020' }}>
                  {simValue >= baseValuation ? `+$${(simValue - baseValuation).toLocaleString()}` : `-$${(baseValuation - simValue).toLocaleString()}`}
                </td>
                <td style={{ color: '#777777' }}>Financial balance sheet projection</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Add What-If Simulation Event</h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777777' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Simulation Day (0 to 30)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newEventDay}
                  onChange={(e) => setNewEventDay(e.target.value)}
                  className="form-control"
                />
              </div>

              <div>
                <label className="form-label">Event Type</label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="form-control"
                >
                  <option value="RECEIPT">+ Receive Stock (Supplier Arrival)</option>
                  <option value="DELIVERY">− Delivery Order (Customer Outflow)</option>
                  <option value="TRANSFER">↔ Internal Stock Transfer</option>
                  <option value="ADJUSTMENT">⚙ Physical Inventory Adjustment</option>
                  <option value="DEMAND_SPIKE">⚡ Demand Spike Event</option>
                </select>
              </div>

              <div>
                <label className="form-label">Quantity Delta (Units)</label>
                <input
                  type="number"
                  value={newEventQty}
                  onChange={(e) => setNewEventQty(e.target.value)}
                  className="form-control"
                />
              </div>

              <div>
                <label className="form-label">Event Label / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Bulk Procurement Batch Arrival"
                  value={newEventLabel}
                  onChange={(e) => setNewEventLabel(e.target.value)}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleAddEvent} className="btn btn-primary">
                  Inject Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FutureControl;

import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../api/client';
import {
  Bot, X, Send, Sparkles, RefreshCw, AlertCircle, CheckCircle2,
  TrendingUp, ShieldCheck, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const SUGGESTED_PROMPTS = [
  "What products are low in stock?",
  "Show Warehouse stock levels",
  "Show inventory trends",
  "Show stock movement history",
  "Create receipt for 25 Wi-Fi Routers from TechSupplies"
];

const CopilotDrawer = ({ isOpen: externalIsOpen, setIsOpen: externalSetIsOpen }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "👋 Hi! I'm your **StockSense Agentic Inventory Copilot**.\nAsk me about stock levels, low stock alerts, warehouse inventory, or request inventory actions (receipts, deliveries, transfers, adjustments)!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query || !query.trim() || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const chatMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.text || ''
        }));

      chatMessages.push({ role: 'user', content: query });

      const response = await apiClient.post('/copilot/chat', {
        messages: chatMessages,
        user_prompt: query
      });

      const resData = response.data;
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: resData.content,
        action_preview: resData.action_preview,
        chart_data: resData.chart_data,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Copilot chat error:", err);
      const errDetail = err.response?.data?.detail || "Error communicating with StockSense backend.";
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ Copilot Error: ${errDetail}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId, previewPayload) => {
    setExecutingActionId(msgId);
    try {
      const response = await apiClient.post('/copilot/execute-action', {
        action_type: previewPayload.action_type,
        action_payload: previewPayload.action_payload
      });

      const execResult = response.data;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            return {
              ...m,
              action_executed: true,
              action_result: execResult,
              text: `✅ **Action Executed Successfully!**\n${execResult.message}`
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.error("Action execution error:", err);
      const errorDetail = err.response?.data?.detail || "Failed to execute inventory action.";
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            return {
              ...m,
              action_error: errorDetail
            };
          }
          return m;
        })
      );
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleCancelAction = (msgId) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            action_cancelled: true,
            text: "❌ Action cancelled by user."
          };
        }
        return m;
      })
    );
  };

  const renderChart = (chartData) => {
    if (!chartData) return null;

    if (chartData.value_trend && chartData.value_trend.length > 0) {
      return (
        <div style={{
          marginTop: '0.75rem',
          background: '#FFFFFF',
          border: '1px solid #E7E7E2',
          borderRadius: '8px',
          padding: '0.75rem'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#202020', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingUp size={15} color="#D6A800" />
            <span>30-Day Inventory Valuation Trend</span>
          </div>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.value_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EB" />
                <XAxis dataKey="date" stroke="#A5A5A5" tick={{ fill: '#777777', fontSize: 10, fontFamily: 'Inter, sans-serif' }} />
                <YAxis stroke="#A5A5A5" tick={{ fill: '#777777', fontSize: 10, fontFamily: 'Inter, sans-serif' }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#E7E7E2', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }} />
                <Line type="monotone" dataKey="value" stroke="#F4D21F" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderActionPreview = (msg) => {
    const preview = msg.action_preview;
    if (!preview) return null;

    if (msg.action_executed) {
      return (
        <div style={{
          marginTop: '0.75rem',
          background: '#E8F8ED',
          border: '1px solid #22A447',
          borderRadius: '8px',
          padding: '0.75rem',
          color: '#22A447'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} />
            <span>Execution Reference: {msg.action_result?.receipt_id || msg.action_result?.delivery_id || msg.action_result?.transfer_id || 'COMPLETED'}</span>
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.3rem', color: '#202020' }}>
            {msg.action_result?.message}
          </div>
        </div>
      );
    }

    if (msg.action_cancelled) {
      return (
        <div style={{
          marginTop: '0.75rem',
          background: '#FDECEC',
          border: '1px solid #E05252',
          borderRadius: '8px',
          padding: '0.6rem 0.75rem',
          color: '#E05252',
          fontSize: '0.8rem'
        }}>
          <AlertCircle size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
          <span>Action was cancelled by user.</span>
        </div>
      );
    }

    const isExecuting = executingActionId === msg.id;

    return (
      <div style={{
        marginTop: '0.75rem',
        background: '#FFFFFF',
        border: '1px solid #F4D21F',
        borderRadius: '10px',
        padding: '0.85rem',
        boxShadow: '0 4px 14px rgba(244, 210, 31, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#202020', fontWeight: 700, fontSize: '0.85rem' }}>
            <ShieldCheck size={16} color="#D6A800" />
            <span>Action Safety Guard</span>
          </div>
          <span style={{
            fontSize: '0.68rem',
            background: '#FFF9CC',
            color: '#B45309',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            border: '1px solid rgba(244, 210, 31, 0.4)'
          }}>
            Requires Confirmation
          </span>
        </div>

        <div style={{ fontSize: '0.8rem', background: '#F7F7F3', borderRadius: '6px', padding: '0.65rem', marginBottom: '0.75rem' }}>
          <div style={{ color: '#202020', fontWeight: 600, marginBottom: '0.2rem' }}>
            Action: <span>{preview.action_name || preview.action_type}</span>
          </div>
          <div style={{ color: '#777777', fontSize: '0.78rem', lineHeight: '1.4' }}>
            {preview.summary}
          </div>
          {preview.lines && preview.lines.length > 0 && (
            <div style={{ marginTop: '0.4rem', borderTop: '1px solid #E7E7E2', paddingTop: '0.4rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#A5A5A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Line Items</div>
              {preview.lines.map((line, idx) => (
                <div key={idx} style={{ fontSize: '0.78rem', color: '#202020', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span>{line.product_name || `Product #${line.product_id}`}</span>
                  <span style={{ fontWeight: 700, color: '#22A447' }}>{line.qty} units</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {msg.action_error && (
          <div style={{ color: '#E05252', fontSize: '0.78rem', marginBottom: '0.6rem', background: '#FDECEC', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
            ⚠️ Error: {msg.action_error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handleConfirmAction(msg.id, preview)}
            disabled={isExecuting}
            style={{
              flex: 1,
              background: '#202020',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            {isExecuting ? (
              <>
                <RefreshCw size={13} className="spin" /> Executing Action...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} color="#F4D21F" /> Confirm & Execute
              </>
            )}
          </button>
          <button
            onClick={() => handleCancelAction(msg.id)}
            disabled={isExecuting}
            style={{
              background: '#FFFFFF',
              color: '#777777',
              border: '1px solid #E7E7E2',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: isExecuting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#202020',
          color: '#FFFFFF',
          border: '1px solid #333333',
          borderRadius: '50px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.88rem',
          transition: 'all 0.25s ease'
        }}
        id="copilot-floating-btn"
      >
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#FFF9CC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Sparkles size={11} color="#D6A800" />
        </div>
        <span>Inventory Copilot</span>
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: '#F4D21F'
        }} />
      </button>

      {/* Copilot Drawer Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          zIndex: 9999,
          width: '430px',
          maxWidth: 'calc(100vw - 32px)',
          height: '600px',
          maxHeight: 'calc(100vh - 100px)',
          background: '#FFFFFF',
          border: '1px solid #E7E7E2',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          {/* Header */}
          <div style={{
            padding: '0.9rem 1.15rem',
            background: '#FFFFFF',
            borderBottom: '1px solid #E7E7E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: '#FFF9CC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={17} color="#D6A800" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#202020', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>StockSense Copilot</span>
                  <span style={{ fontSize: '0.65rem', background: '#F7F7F3', color: '#777777', padding: '1px 6px', borderRadius: '4px', border: '1px solid #E7E7E2' }}>
                    Gemini AI
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#777777' }}>Natural language inventory assistant</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#A5A5A5',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            background: '#F7F7F3',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '0.7rem 0.95rem',
                    borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: msg.role === 'user'
                      ? '#202020'
                      : msg.isError
                        ? '#FDECEC'
                        : '#FFFFFF',
                    border: msg.role === 'user'
                      ? 'none'
                      : msg.isError
                        ? '1px solid #E05252'
                        : '1px solid #E7E7E2',
                    color: msg.role === 'user' ? '#FFFFFF' : '#202020',
                    fontSize: '0.85rem',
                    lineHeight: '1.45',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

                  {msg.chart_data && renderChart(msg.chart_data)}
                  {msg.action_preview && renderActionPreview(msg)}
                </div>

                <div style={{ fontSize: '0.65rem', color: '#A5A5A5', marginTop: '2px', padding: '0 4px' }}>
                  {msg.timestamp}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#777777', fontSize: '0.78rem', padding: '0.4rem' }}>
                <RefreshCw size={14} className="spin" color="#D6A800" />
                <span>Copilot is reasoning and fetching MySQL data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts */}
          <div style={{
            padding: '0.45rem 0.75rem',
            borderTop: '1px solid #E7E7E2',
            background: '#FFFFFF',
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                style={{
                  background: '#F7F7F3',
                  color: '#202020',
                  border: '1px solid #E7E7E2',
                  borderRadius: '16px',
                  padding: '3px 9px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#F4D21F'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E7E7E2'}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '0.65rem 0.85rem',
              background: '#FFFFFF',
              borderTop: '1px solid #E7E7E2',
              display: 'flex',
              gap: '0.45rem'
            }}
          >
            <input
              type="text"
              placeholder="Ask Copilot or request an action..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                background: '#F7F7F3',
                border: '1px solid #E7E7E2',
                borderRadius: '8px',
                padding: '0.55rem 0.75rem',
                color: '#202020',
                fontSize: '0.85rem',
                outline: 'none'
              }}
              id="copilot-input-field"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              style={{
                background: '#202020',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (loading || !inputText.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !inputText.trim()) ? 0.6 : 1
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default CopilotDrawer;

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, TrendingUp, Users, AlertCircle, CheckCircle2, RefreshCw, ArrowRight, Building2, Bot } from 'lucide-react';

const URGENCY_CONFIG = {
  critical: { label: 'Critical', bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', dot: '#DC2626' },
  high:     { label: 'High',     bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C', dot: '#EA580C' },
  medium:   { label: 'Medium',   bg: '#FAFAF9', border: '#E5E7EB', text: '#6B7280', dot: '#9CA3AF' },
};

const TYPE_CONFIG = {
  sales_followup:    { icon: TrendingUp,  label: 'Sales / BD', color: '#2563EB' },
  investor_outreach: { icon: Users,       label: 'Investor',   color: '#7C3AED' },
  operational:       { icon: Zap,         label: 'Ops',        color: '#D97706' },
  strategic:         { icon: AlertCircle, label: 'Strategic',  color: '#059669' },
};

const LOG_TYPE_CONFIG = {
  interaction_logged:    { icon: CheckCircle2, color: '#059669' },
  stage_advanced:        { icon: TrendingUp,   color: '#2563EB' },
  contact_added:         { icon: Users,        color: '#7C3AED' },
  relationship_detected: { icon: ArrowRight,   color: '#D97706' },
  contact_updated:       { icon: RefreshCw,    color: '#6B7280' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function TodaysFocus() {
  const [focusData, setFocusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadFocus(); }, []);

  async function loadFocus() {
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from('daily_focus').select('*')
        .order('focus_date', { ascending: false }).limit(1).single();
      if (err && err.code !== 'PGRST116') throw err;
      setFocusData(data || null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];
  const isToday = focusData?.focus_date === today;

  if (loading) return <div className="focus-wrap"><div className="empty-state"><p>Loading today\'s focus...</p></div></div>;
  if (error) return <div className="focus-wrap"><div className="empty-state"><p style={{ color: 'var(--danger)' }}>Error: {error}</p></div></div>;

  if (!focusData) return (
    <div className="focus-wrap">
      <div className="focus-header"><div><h2 className="focus-title">Today\'s Focus</h2><p className="focus-subtitle">{formatDate(today)}</p></div></div>
      <div className="focus-empty-card">
        <Bot size={36} color="var(--text-secondary)" style={{ marginBottom: 12 }} />
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No scan yet for today</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 380, textAlign: 'center', lineHeight: 1.6 }}>
          The daily scan runs automatically each morning. Focus items and scan updates will appear here after it runs.
        </p>
      </div>
    </div>
  );

  const focusItems = Array.isArray(focusData.focus_items) ? focusData.focus_items : [];
  const scanLog = Array.isArray(focusData.scan_log) ? focusData.scan_log : [];

  return (
    <div className="focus-wrap">
      <div className="focus-header">
        <div>
          <h2 className="focus-title">Today\'s Focus</h2>
          <p className="focus-subtitle">
            {isToday ? formatDate(today) : `Last scan: ${formatDate(focusData.focus_date)}`}
            {!isToday && <span className="focus-stale-badge">Stale</span>}
          </p>
        </div>
        <button className="btn-secondary" onClick={loadFocus} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="focus-section">
        <div className="focus-section-label"><Bot size={14} /><span>AI-Recommended Priorities</span></div>
        {focusItems.length === 0 ? (
          <div className="focus-empty-card" style={{ padding: '24px 20px' }}><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No priorities generated yet.</p></div>
        ) : (
          <div className="focus-items">
            {focusItems.map((item, i) => {
              const urgency = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.medium;
              const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.strategic;
              const TypeIcon = typeConf.icon;
              return (
                <div key={i} className="focus-item"
                  style={{ borderLeft: `4px solid ${urgency.dot}`, background: urgency.bg, borderTop: `1px solid ${urgency.border}`, borderRight: `1px solid ${urgency.border}`, borderBottom: `1px solid ${urgency.border}` }}>
                  <div className="focus-item-top">
                    <div className="focus-item-meta">
                      <span className="focus-priority-num" style={{ background: urgency.dot, color: '#fff' }}>{i + 1}</span>
                      <span className="focus-type-tag" style={{ color: typeConf.color }}><TypeIcon size={11} style={{ marginRight: 3, verticalAlign: -1 }} />{typeConf.label}</span>
                      <span className="focus-urgency-tag" style={{ color: urgency.text }}>{urgency.label}</span>
                    </div>
                    {item.contact_name && <div className="focus-contact-chip"><Building2 size={11} /><span>{item.contact_name}{item.company ? ` · ${item.company}` : ''}</span></div>}
                  </div>
                  <div className="focus-item-title">{item.title}</div>
                  {item.description && <div className="focus-item-desc">{item.description}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {scanLog.length > 0 && (
        <div className="focus-section">
          <div className="focus-section-label"><CheckCircle2 size={14} /><span>What the AI scan updated today</span></div>
          <div className="scan-log">
            {scanLog.map((entry, i) => {
              const logConf = LOG_TYPE_CONFIG[entry.type] || LOG_TYPE_CONFIG.contact_updated;
              const LogIcon = logConf.icon;
              return (
                <div key={i} className="scan-log-entry">
                  <div className="scan-log-icon" style={{ color: logConf.color }}><LogIcon size={14} /></div>
                  <div className="scan-log-body">
                    <span className="scan-log-contact">{entry.contact_name}{entry.company && <span className="scan-log-company"> · {entry.company}</span>}</span>
                    <span className="scan-log-desc">{entry.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scanLog.length === 0 && focusItems.length > 0 && (
        <div className="focus-section">
          <div className="focus-section-label"><CheckCircle2 size={14} /><span>What the AI scan updated today</span></div>
          <div className="focus-empty-card" style={{ padding: '20px' }}><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No CRM updates were made during today\'s scan.</p></div>
        </div>
      )}
    </div>
  );
}

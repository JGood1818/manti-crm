import { useState, useEffect, useCallback } from 'react';
import { Search, LayoutGrid, List, Plus, X, ChevronUp, ChevronDown, Users, TrendingUp, Clock, Globe, Linkedin, ExternalLink, GitBranch, LogOut } from 'lucide-react';
import { fetchContacts, fetchStages, updateContact, createContact, deleteContact } from './lib/api';
import { getDaysSinceColor, CATEGORY_COLORS, CATEGORIES } from './lib/constants';
import { isEmailAllowed, signOut, getSession, onAuthStateChange } from './lib/auth';
import RelationshipGraph from './components/RelationshipGraph';
import LoginPage from './components/LoginPage';
import AccessDenied from './components/AccessDenied';
import './index.css';

const SECTIONS = [
  { id: 'sales_bd', label: 'Sales & BD', pipelineType: 'sales_bd' },
  { id: 'investor', label: 'Investor', pipelineType: 'investor' },
  { id: 'all', label: 'All Contacts', pipelineType: null },
  { id: 'graph', label: 'Relationship Graph', pipelineType: null, isGraph: true },
];

function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'unauthenticated' | 'denied' | 'authenticated'
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    // Check existing session on mount
    getSession().then(session => {
      if (session?.user) {
        const email = session.user.email;
        setUserEmail(email);
        if (isEmailAllowed(email)) {
          setAuthState('authenticated');
        } else {
          setAuthState('denied');
        }
      } else {
        setAuthState('unauthenticated');
      }
    }).catch(() => setAuthState('unauthenticated'));

    // Listen for auth changes (login/logout)
    const subscription = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const email = session.user.email;
        setUserEmail(email);
        if (isEmailAllowed(email)) {
          setAuthState('authenticated');
        } else {
          setAuthState('denied');
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthState('unauthenticated');
        setUserEmail(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (authState === 'loading') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">Manti<span>CRM</span></div>
          <p className="login-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginPage />;
  }

  if (authState === 'denied') {
    return <AccessDenied email={userEmail} />;
  }

  return <AuthenticatedApp userEmail={userEmail} />;
}

function AuthenticatedApp({ userEmail }) {
  const [section, setSection] = useState('sales_bd');
  const [view, setView] = useState('table');
  const [contacts, setContacts] = useState([]);
  const [stages, setStages] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedContact, setSelectedContact] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentSection = SECTIONS.find(s => s.id === section);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { search: search || undefined };
      if (currentSection.pipelineType) {
        filters.pipelineType = currentSection.pipelineType;
        const stagesData = await fetchStages(currentSection.pipelineType);
        setStages(stagesData);
      } else {
        setStages([]);
        if (categoryFilter) filters.category = categoryFilter;
      }
      if (stageFilter) filters.stageId = stageFilter;
      const data = await fetchContacts(filters);
      setContacts(data);
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  }, [section, search, stageFilter, categoryFilter, currentSection?.pipelineType]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setStageFilter(''); setCategoryFilter(''); setSearch(''); }, [section]);

  const sorted = [...contacts].sort((a, b) => {
    let aVal = a[sortBy], bVal = b[sortBy];
    if (sortBy === 'days_since_contact') { aVal = aVal ?? 9999; bVal = bVal ?? 9999; }
    if (sortBy === 'pipeline_stages') {
      aVal = a.pipeline_stages?.sort_order ?? 99;
      bVal = b.pipeline_stages?.sort_order ?? 99;
    }
    if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (col) => {
    if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleSave = async (id, updates) => {
    try {
      await updateContact(id, updates);
      await loadData();
      setSelectedContact(null);
    } catch (err) { console.error('Save error:', err); }
  };

  const handleCreate = async (contact) => {
    try {
      await createContact(contact);
      await loadData();
      setShowAddModal(false);
    } catch (err) { console.error('Create error:', err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await deleteContact(id);
      await loadData();
      setSelectedContact(null);
    } catch (err) { console.error('Delete error:', err); }
  };

  const totalContacts = contacts.length;
  const avgDays = contacts.filter(c => c.days_since_contact != null).reduce((sum, c, _, arr) =>
    sum + c.days_since_contact / arr.length, 0);

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">Manti<span>CRM</span></div>
          <nav className="nav-tabs">
            {SECTIONS.map(s => (
              <button key={s.id} className={`nav-tab ${section === s.id ? 'active' : ''}`}
                onClick={() => setSection(s.id)}>{s.label}</button>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <span className="user-email">{userEmail}</span>
          <button className="btn-secondary" onClick={signOut} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {currentSection.isGraph ? (
        <RelationshipGraph onSelectContact={(node) => {
          // Find the full contact data to open detail panel
          const fullContact = contacts.find(c => c.id === node.id);
          if (fullContact) setSelectedContact(fullContact);
        }} />
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat">
              <Users size={16} color="var(--accent)" />
              <span className="stat-value">{totalContacts}</span>
              <span className="stat-label">contacts</span>
            </div>
            {currentSection.pipelineType && (
              <div className="stat">
                <TrendingUp size={16} color="var(--accent)" />
                <span className="stat-value">
                  {contacts.filter(c => c.pipeline_stages?.stage_number >= 4).length}
                </span>
                <span className="stat-label">in advanced stages</span>
              </div>
            )}
            <div className="stat">
              <Clock size={16} color={avgDays > 30 ? 'var(--danger)' : 'var(--accent)'} />
              <span className="stat-value">{Math.round(avgDays) || '—'}</span>
              <span className="stat-label">avg days since contact</span>
            </div>
          </div>

          <div className="toolbar">
            <div className="toolbar-left">
              <div className="search-box">
                <Search size={16} />
                <input placeholder="Search contacts..." value={search}
                  onChange={e => setSearch(e.target.value)} />
                {search && <button style={{ background: 'none', border: 'none', padding: 0 }}
                  onClick={() => setSearch('')}><X size={14} /></button>}
              </div>
              {currentSection.pipelineType && stages.length > 0 && (
                <select className="filter-select" value={stageFilter}
                  onChange={e => setStageFilter(e.target.value)}>
                  <option value="">All Stages</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.stage_number}. {s.stage_name}</option>
                  ))}
                </select>
              )}
              {!currentSection.pipelineType && !currentSection.isGraph && (
                <select className="filter-select" value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div className="toolbar-right">
              {currentSection.pipelineType && (
                <div className="view-toggle">
                  <button className={`view-btn ${view === 'table' ? 'active' : ''}`}
                    onClick={() => setView('table')}>
                    <List size={14} /> Table
                  </button>
                  <button className={`view-btn ${view === 'kanban' ? 'active' : ''}`}
                    onClick={() => setView('kanban')}>
                    <LayoutGrid size={14} /> Board
                  </button>
                </div>
              )}
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={14} /> Add Contact
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state"><p>Loading...</p></div>
          ) : contacts.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>No contacts found. Try adjusting your filters.</p>
            </div>
          ) : view === 'table' || !currentSection.pipelineType ? (
            <TableView contacts={sorted} stages={stages} section={currentSection}
              onSelect={setSelectedContact} sortBy={sortBy} SortIcon={SortIcon} onSort={handleSort} />
          ) : (
            <KanbanView contacts={sorted} stages={stages} onSelect={setSelectedContact} />
          )}
        </>
      )}

      {selectedContact && (
        <DetailPanel contact={selectedContact} stages={stages} section={currentSection}
          onClose={() => setSelectedContact(null)} onSave={handleSave} onDelete={handleDelete} />
      )}

      {showAddModal && (
        <AddContactModal section={currentSection} stages={stages}
          onClose={() => setShowAddModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

function TableView({ contacts, stages, section, onSelect, sortBy, SortIcon, onSort }) {
  const isPipeline = !!section.pipelineType;
  return (
    <div className="table-container" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th onClick={() => onSort('full_name')} className={sortBy === 'full_name' ? 'sorted' : ''}>
              Name <SortIcon col="full_name" />
            </th>
            <th onClick={() => onSort('company')} className={sortBy === 'company' ? 'sorted' : ''}>
              Company <SortIcon col="company" />
            </th>
            {isPipeline ? (
              <th onClick={() => onSort('pipeline_stages')} className={sortBy === 'pipeline_stages' ? 'sorted' : ''}>
                Stage <SortIcon col="pipeline_stages" />
              </th>
            ) : (
              <th onClick={() => onSort('category')} className={sortBy === 'category' ? 'sorted' : ''}>
                Category <SortIcon col="category" />
              </th>
            )}
            <th onClick={() => onSort('last_interaction_date')} className={sortBy === 'last_interaction_date' ? 'sorted' : ''}>
              Last Contact <SortIcon col="last_interaction_date" />
            </th>
            <th onClick={() => onSort('days_since_contact')} className={sortBy === 'days_since_contact' ? 'sorted' : ''}>
              Days Since <SortIcon col="days_since_contact" />
            </th>
            <th onClick={() => onSort('last_interaction_type')} className={sortBy === 'last_interaction_type' ? 'sorted' : ''}>
              Type <SortIcon col="last_interaction_type" />
            </th>
            <th>Next Step</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map(c => {
            const stage = c.pipeline_stages;
            const daysColor = getDaysSinceColor(c.days_since_contact);
            const catColor = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other;
            return (
              <tr key={c.id} onClick={() => onSelect(c)}>
                <td>
                  <div className="contact-name">{c.full_name}</div>
                  {c.role_title && <div className="contact-company">{c.role_title}</div>}
                </td>
                <td>{c.company || '—'}</td>
                {isPipeline && stage ? (
                  <td>
                    <span className="stage-badge" style={{ background: stage.color_hex, color: stage.stage_number >= 6 ? '#fff' : '#1F2937' }}>
                      <span className="stage-num">{stage.stage_number}</span>
                      {stage.stage_name}
                    </span>
                  </td>
                ) : !isPipeline ? (
                  <td>
                    <span className="category-badge" style={{ background: catColor.bg, color: catColor.text }}>
                      {c.category}
                    </span>
                  </td>
                ) : <td>—</td>}
                <td>{c.last_interaction_date || '—'}</td>
                <td>
                  {c.days_since_contact != null ? (
                    <span className="days-badge" style={{ background: daysColor.bg, color: daysColor.text }}>
                      {c.days_since_contact}d
                    </span>
                  ) : '—'}
                </td>
                <td>{c.last_interaction_type || '—'}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.next_step || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ contacts, stages, onSelect }) {
  const grouped = {};
  stages.forEach(s => { grouped[s.id] = []; });
  contacts.forEach(c => {
    if (c.stage_id && grouped[c.stage_id]) grouped[c.stage_id].push(c);
  });

  return (
    <div className="kanban-container">
      {stages.map(stage => (
        <div key={stage.id} className="kanban-column">
          <div className="kanban-header" style={{ borderColor: stage.color_hex }}>
            <div className="kanban-header-left">
              <span className="stage-num" style={{ background: stage.color_hex,
                color: stage.stage_number >= 6 ? '#fff' : '#1F2937' }}>{stage.stage_number}</span>
              <span className="kanban-stage-name">{stage.stage_name}</span>
            </div>
            <span className="kanban-count">{grouped[stage.id]?.length || 0}</span>
          </div>
          <div className="kanban-cards">
            {(grouped[stage.id] || []).map(c => {
              const daysColor = getDaysSinceColor(c.days_since_contact);
              return (
                <div key={c.id} className="kanban-card" onClick={() => onSelect(c)}>
                  <div className="kanban-card-name">{c.full_name}</div>
                  {c.company && <div className="kanban-card-company">{c.company}</div>}
                  <div className="kanban-card-meta">
                    <span className="kanban-card-date">{c.last_interaction_date || 'No date'}</span>
                    {c.days_since_contact != null && (
                      <span className="days-badge" style={{ background: daysColor.bg, color: daysColor.text, fontSize: 11 }}>
                        {c.days_since_contact}d
                      </span>
                    )}
                  </div>
                  {c.next_step && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {c.next_step}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ contact, stages, section, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...contact });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel">
        <div className="panel-header">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{contact.full_name}</h2>
            {contact.company && <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{contact.company}</p>}
          </div>
          <button className="panel-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="panel-body">
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Full Name</div>
              <input className="field-input" value={form.full_name || ''} onChange={e => set('full_name', e.target.value)} />
            </div>
            <div className="field-group">
              <div className="field-label">Company</div>
              <input className="field-input" value={form.company || ''} onChange={e => set('company', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Role / Title</div>
              <input className="field-input" value={form.role_title || ''} onChange={e => set('role_title', e.target.value)} />
            </div>
            <div className="field-group">
              <div className="field-label">Email</div>
              <input className="field-input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Phone</div>
              <input className="field-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            </div>
            {section.pipelineType && stages.length > 0 && (
              <div className="field-group">
                <div className="field-label">Pipeline Stage</div>
                <select className="field-input" value={form.stage_id || ''}
                  onChange={e => set('stage_id', e.target.value || null)}>
                  <option value="">— Select —</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.stage_number}. {s.stage_name}</option>)}
                </select>
              </div>
            )}
          </div>
          {!section.pipelineType && (
            <div className="field-group">
              <div className="field-label">Category</div>
              <select className="field-input" value={form.category || ''}
                onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="field-row">
            <div className="field-group">
              <div className="field-label"><Globe size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Website</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="field-input" value={form.website || ''} onChange={e => set('website', e.target.value)}
                  placeholder="https://company.com" style={{ flex: 1 }} />
                {form.website && (
                  <a href={form.website.startsWith('http') ? form.website : `https://${form.website}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', flexShrink: 0 }}>
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
            <div className="field-group">
              <div className="field-label"><Linkedin size={13} style={{ marginRight: 4, verticalAlign: -2 }} />LinkedIn</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="field-input" value={form.linkedin || ''} onChange={e => set('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/..." style={{ flex: 1 }} />
                {form.linkedin && (
                  <a href={form.linkedin.startsWith('http') ? form.linkedin : `https://${form.linkedin}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: '#0A66C2', flexShrink: 0 }}>
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="field-group">
            <div className="field-label">Next Step / Follow-up</div>
            <input className="field-input" value={form.next_step || ''} onChange={e => set('next_step', e.target.value)}
              placeholder="e.g., Schedule follow-up demo..." />
          </div>
          <div className="field-group">
            <div className="field-label">Your Notes</div>
            <textarea className="field-input" value={form.user_notes || ''} onChange={e => set('user_notes', e.target.value)}
              placeholder="Your personal notes..." />
          </div>
          {form.ai_notes && (
            <div className="field-group">
              <div className="field-label">AI-Detected Activity</div>
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {form.ai_notes}
              </div>
            </div>
          )}
          <div className="field-row" style={{ marginTop: 16 }}>
            <div className="field-group">
              <div className="field-label">Last Interaction</div>
              <div className="field-value">{contact.last_interaction_date || '—'}</div>
            </div>
            <div className="field-group">
              <div className="field-label">Days Since Contact</div>
              <div className="field-value">
                {contact.days_since_contact != null ? (
                  <span className="days-badge" style={{
                    ...(() => { const c = getDaysSinceColor(contact.days_since_contact); return { background: c.bg, color: c.text }; })()
                  }}>{contact.days_since_contact} days</span>
                ) : '—'}
              </div>
            </div>
          </div>
        </div>
        <div className="panel-footer">
          <button className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => onDelete(contact.id)}>Delete</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(contact.id, {
            full_name: form.full_name,
            company: form.company,
            role_title: form.role_title,
            email: form.email,
            phone: form.phone,
            website: form.website,
            linkedin: form.linkedin,
            stage_id: form.stage_id,
            category: form.category,
            next_step: form.next_step,
            user_notes: form.user_notes,
          })}>Save Changes</button>
        </div>
      </div>
    </>
  );
}

function AddContactModal({ section, stages, onClose, onCreate }) {
  const [form, setForm] = useState({
    full_name: '', company: '', role_title: '', email: '', phone: '',
    website: '', linkedin: '',
    pipeline_type: section.pipelineType || null,
    stage_id: null, category: section.pipelineType ? (section.pipelineType === 'investor' ? 'Investor' : 'Sales/BD') : 'Other',
    next_step: '', user_notes: '', source: 'manual',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Contact</h2>
          <button className="panel-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Full Name *</div>
              <input className="field-input" value={form.full_name} onChange={e => set('full_name', e.target.value)} autoFocus />
            </div>
            <div className="field-group">
              <div className="field-label">Company</div>
              <input className="field-input" value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Role / Title</div>
              <input className="field-input" value={form.role_title} onChange={e => set('role_title', e.target.value)} />
            </div>
            <div className="field-group">
              <div className="field-label">Email</div>
              <input className="field-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Website</div>
              <input className="field-input" value={form.website} onChange={e => set('website', e.target.value)}
                placeholder="https://company.com" />
            </div>
            <div className="field-group">
              <div className="field-label">LinkedIn</div>
              <input className="field-input" value={form.linkedin} onChange={e => set('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/..." />
            </div>
          </div>
          {section.pipelineType && stages.length > 0 && (
            <div className="field-group">
              <div className="field-label">Pipeline Stage</div>
              <select className="field-input" value={form.stage_id || ''} onChange={e => set('stage_id', e.target.value || null)}>
                <option value="">— Select —</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.stage_number}. {s.stage_name}</option>)}
              </select>
            </div>
          )}
          {!section.pipelineType && (
            <div className="field-group">
              <div className="field-label">Category</div>
              <select className="field-input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="field-group">
            <div className="field-label">Next Step / Follow-up</div>
            <input className="field-input" value={form.next_step} onChange={e => set('next_step', e.target.value)} />
          </div>
          <div className="field-group">
            <div className="field-label">Notes</div>
            <textarea className="field-input" value={form.user_notes} onChange={e => set('user_notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!form.full_name.trim()} onClick={() => onCreate(form)}>
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

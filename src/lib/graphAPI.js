import { supabase } from './supabase';

// Fetch all contacts with graph-relevant fields
export async function fetchGraphContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, full_name, company, role_title, email, category, pipeline_type, is_high_profile, connection_count, linkedin, website')
    .order('connection_count', { ascending: false });
  if (error) throw error;
  return data;
}

// Fetch all relationships
export async function fetchRelationships() {
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .order('strength', { ascending: false });
  if (error) throw error;
  return data;
}

// Fetch full graph data (contacts + relationships combined)
export async function fetchGraphData() {
  const [contacts, relationships] = await Promise.all([
    fetchGraphContacts(),
    fetchRelationships(),
  ]);

  // Build a set of contact IDs that appear in relationships
  const connectedIds = new Set();
  relationships.forEach(r => {
    connectedIds.add(r.contact_a_id);
    connectedIds.add(r.contact_b_id);
  });

  // Map contacts to graph nodes
  const nodes = contacts
    .filter(c => connectedIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.full_name,
      company: c.company,
      role: c.role_title,
      email: c.email,
      category: c.category,
      pipelineType: c.pipeline_type,
      isHighProfile: c.is_high_profile,
      connectionCount: c.connection_count || 0,
      linkedin: c.linkedin,
      website: c.website,
    }));

  // Map relationships to graph edges
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = relationships
    .filter(r => nodeIds.has(r.contact_a_id) && nodeIds.has(r.contact_b_id))
    .map(r => ({
      source: r.contact_a_id,
      target: r.contact_b_id,
      type: r.relationship_type,
      strength: r.strength,
      evidence: r.evidence || [],
      lastDetected: r.last_detected_at,
    }));

  return { nodes, edges };
}

// Fetch enrichment data for a contact
export async function fetchEnrichmentData(contactId) {
  const { data, error } = await supabase
    .from('enrichment_data')
    .select('*')
    .eq('contact_id', contactId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

// Get neighbors of a specific contact
export async function fetchContactNeighbors(contactId) {
  const { data: rels, error } = await supabase
    .from('relationships')
    .select('*')
    .or(`contact_a_id.eq.${contactId},contact_b_id.eq.${contactId}`)
    .order('strength', { ascending: false });
  if (error) throw error;

  // Get all neighbor IDs
  const neighborIds = new Set();
  rels.forEach(r => {
    if (r.contact_a_id !== contactId) neighborIds.add(r.contact_a_id);
    if (r.contact_b_id !== contactId) neighborIds.add(r.contact_b_id);
  });

  // Fetch neighbor contact info
  if (neighborIds.size === 0) return { relationships: rels, neighbors: [] };

  const { data: neighbors, error: nErr } = await supabase
    .from('contacts')
    .select('id, full_name, company, role_title, category, is_high_profile, connection_count')
    .in('id', [...neighborIds]);
  if (nErr) throw nErr;

  return { relationships: rels, neighbors };
}

// Find shortest path between two contacts (BFS on relationships)
export function findPath(edges, sourceId, targetId) {
  const adj = {};
  edges.forEach(e => {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    if (!adj[s]) adj[s] = [];
    if (!adj[t]) adj[t] = [];
    adj[s].push({ node: t, edge: e });
    adj[t].push({ node: s, edge: e });
  });

  const visited = new Set([sourceId]);
  const queue = [[sourceId]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (current === targetId) return path;

    for (const neighbor of (adj[current] || [])) {
      if (!visited.has(neighbor.node)) {
        visited.add(neighbor.node);
        queue.push([...path, neighbor.node]);
      }
    }
  }
  return null; // no path found
}

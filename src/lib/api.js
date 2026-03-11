import { supabase } from './supabase';

// Fetch pipeline stages
export async function fetchStages(pipelineType) {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_type', pipelineType)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// Fetch contacts with stage info and computed days
export async function fetchContacts(filters = {}) {
  let query = supabase
    .from('contacts_with_days')
    .select('*, pipeline_stages(*)');

  if (filters.pipelineType) {
    query = query.eq('pipeline_type', filters.pipelineType);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,company.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }
  if (filters.stageId) {
    query = query.eq('stage_id', filters.stageId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Update a contact
export async function updateContact(id, updates) {
  updates.user_edited_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select('*, pipeline_stages(*)')
    .single();
  if (error) throw error;
  return data;
}

// Create a contact
export async function createContact(contact) {
  const { data, error } = await supabase
    .from('contacts')
    .insert(contact)
    .select('*, pipeline_stages(*)')
    .single();
  if (error) throw error;
  return data;
}

// Delete a contact
export async function deleteContact(id) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Fetch interactions for a contact
export async function fetchInteractions(contactId) {
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('contact_id', contactId)
    .order('interaction_date', { ascending: false });
  if (error) throw error;
  return data;
}

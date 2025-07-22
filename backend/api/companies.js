import supabase from "../supabase/client.js";

/**
 * Companies API - Functions to interact with the companies table in Supabase
 */

/**
 * Get all companies with optional filtering
 * @param {Object} filters - Optional filters for the query
 * @param {String} filters.status - Filter by status
 * @param {Number} filters.priority - Filter by priority
 * @param {Boolean} filters.emailVerified - Filter by email verification status
 * @param {Number} filters.limit - Limit the number of results
 * @param {Number} filters.offset - Offset for pagination
 * @returns {Promise<Array>} - Array of companies
 */
export async function getCompanies(filters = {}) {
  let query = supabase.from("companies").select("*");

  // Apply filters if provided
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.emailVerified !== undefined) {
    query = query.eq("email_verified", filters.emailVerified);
  }

  // Apply sorting - default to priority and then created_at
  query = query
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  // Apply pagination if provided
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.offset(filters.offset);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching companies:", error);
    throw error;
  }

  return data;
}

/**
 * Get a single company by ID
 * @param {String} id - Company ID
 * @returns {Promise<Object>} - Company object
 */
export async function getCompanyById(id) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(`Error fetching company with ID ${id}:`, error);
    throw error;
  }

  return data;
}

/**
 * Create a new company
 * @param {Object} company - Company data
 * @returns {Promise<Object>} - Created company object
 */
export async function createCompany(company) {
  const { data, error } = await supabase
    .from("companies")
    .insert([company])
    .select();

  if (error) {
    console.error("Error creating company:", error);
    throw error;
  }

  return data[0];
}

/**
 * Update an existing company
 * @param {String} id - Company ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated company object
 */
export async function updateCompany(id, updates) {
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    console.error(`Error updating company with ID ${id}:`, error);
    throw error;
  }

  return data[0];
}

/**
 * Delete a company
 * @param {String} id - Company ID
 * @returns {Promise<void>}
 */
export async function deleteCompany(id) {
  const { error } = await supabase.from("companies").delete().eq("id", id);

  if (error) {
    console.error(`Error deleting company with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Get companies that are ready to be contacted today
 * @param {Number} limit - Maximum number of companies to return
 * @returns {Promise<Array>} - Array of companies
 */
export async function getCompaniesForDailyEmails(limit) {
  // Get companies that:
  // 1. Have a verified email
  // 2. Have not been contacted yet (status = pending)
  // 3. Ordered by priority (1 is highest)
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("email_verified", true)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching companies for daily emails:", error);
    throw error;
  }

  return data;
}

/**
 * Update company status after sending an email
 * @param {String} id - Company ID
 * @returns {Promise<Object>} - Updated company object
 */
export async function markCompanyAsContacted(id) {
  return updateCompany(id, {
    status: "contacted",
    updated_at: new Date().toISOString(),
  });
}

/**
 * Bulk import companies from a list
 * @param {Array} companies - Array of company objects
 * @returns {Promise<Array>} - Array of created companies
 */
export async function bulkImportCompanies(companies) {
  const { data, error } = await supabase
    .from("companies")
    .insert(companies)
    .select();

  if (error) {
    console.error("Error bulk importing companies:", error);
    throw error;
  }

  return data;
}

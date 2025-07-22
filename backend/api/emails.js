import supabase from "../supabase/client.js";

/**
 * Emails API - Functions to interact with the emails table in Supabase
 */

/**
 * Create a new email record
 * @param {Object} email - Email data
 * @returns {Promise<Object>} - Created email object
 */
export async function createEmail(email) {
  const { data, error } = await supabase
    .from("emails")
    .insert([email])
    .select();

  if (error) {
    console.error("Error creating email record:", error);
    throw error;
  }

  return data[0];
}

/**
 * Update an existing email record
 * @param {String} id - Email ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated email object
 */
export async function updateEmail(id, updates) {
  const { data, error } = await supabase
    .from("emails")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    console.error(`Error updating email with ID ${id}:`, error);
    throw error;
  }

  return data[0];
}

/**
 * Get all emails for a specific company
 * @param {String} companyId - Company ID
 * @returns {Promise<Array>} - Array of emails
 */
export async function getEmailsByCompanyId(companyId) {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`Error fetching emails for company ${companyId}:`, error);
    throw error;
  }

  return data;
}

/**
 * Get a single email by ID
 * @param {String} id - Email ID
 * @returns {Promise<Object>} - Email object
 */
export async function getEmailById(id) {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(`Error fetching email with ID ${id}:`, error);
    throw error;
  }

  return data;
}

/**
 * Mark an email as sent
 * @param {String} id - Email ID
 * @param {String} messageId - Provider's message ID for tracking
 * @returns {Promise<Object>} - Updated email object
 */
export async function markEmailAsSent(id, messageId) {
  return updateEmail(id, {
    status: "sent",
    sent_at: new Date().toISOString(),
    message_id: messageId,
  });
}

/**
 * Mark an email as opened
 * @param {String} id - Email ID
 * @returns {Promise<Object>} - Updated email object
 */
export async function markEmailAsOpened(id) {
  return updateEmail(id, {
    status: "opened",
    opened_at: new Date().toISOString(),
  });
}

/**
 * Mark an email as clicked
 * @param {String} id - Email ID
 * @returns {Promise<Object>} - Updated email object
 */
export async function markEmailAsClicked(id) {
  return updateEmail(id, {
    status: "clicked",
    clicked_at: new Date().toISOString(),
  });
}

/**
 * Mark an email as replied
 * @param {String} id - Email ID
 * @returns {Promise<Object>} - Updated email object
 */
export async function markEmailAsReplied(id) {
  return updateEmail(id, {
    status: "replied",
    replied_at: new Date().toISOString(),
  });
}

/**
 * Mark an email as bounced
 * @param {String} id - Email ID
 * @returns {Promise<Object>} - Updated email object
 */
export async function markEmailAsBounced(id) {
  return updateEmail(id, {
    status: "bounced",
  });
}

/**
 * Get email statistics
 * @returns {Promise<Object>} - Email statistics
 */
export async function getEmailStatistics() {
  const { data: total, error: totalError } = await supabase
    .from("emails")
    .select("count", { count: "exact" });

  if (totalError) {
    console.error("Error fetching total email count:", totalError);
    throw totalError;
  }

  const { data: sent, error: sentError } = await supabase
    .from("emails")
    .select("count", { count: "exact" })
    .eq("status", "sent");

  if (sentError) {
    console.error("Error fetching sent email count:", sentError);
    throw sentError;
  }

  const { data: opened, error: openedError } = await supabase
    .from("emails")
    .select("count", { count: "exact" })
    .eq("status", "opened");

  if (openedError) {
    console.error("Error fetching opened email count:", openedError);
    throw openedError;
  }

  const { data: clicked, error: clickedError } = await supabase
    .from("emails")
    .select("count", { count: "exact" })
    .eq("status", "clicked");

  if (clickedError) {
    console.error("Error fetching clicked email count:", clickedError);
    throw clickedError;
  }

  const { data: replied, error: repliedError } = await supabase
    .from("emails")
    .select("count", { count: "exact" })
    .eq("status", "replied");

  if (repliedError) {
    console.error("Error fetching replied email count:", repliedError);
    throw repliedError;
  }

  const { data: bounced, error: bouncedError } = await supabase
    .from("emails")
    .select("count", { count: "exact" })
    .eq("status", "bounced");

  if (bouncedError) {
    console.error("Error fetching bounced email count:", bouncedError);
    throw bouncedError;
  }

  return {
    total: total[0].count,
    sent: sent[0].count,
    opened: opened[0].count,
    clicked: clicked[0].count,
    replied: replied[0].count,
    bounced: bounced[0].count,
    openRate: sent[0].count > 0 ? (opened[0].count / sent[0].count) * 100 : 0,
    clickRate:
      opened[0].count > 0 ? (clicked[0].count / opened[0].count) * 100 : 0,
    replyRate: sent[0].count > 0 ? (replied[0].count / sent[0].count) * 100 : 0,
    bounceRate:
      sent[0].count > 0 ? (bounced[0].count / sent[0].count) * 100 : 0,
  };
}

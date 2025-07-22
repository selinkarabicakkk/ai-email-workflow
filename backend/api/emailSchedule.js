import supabase from "../supabase/client.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the config directory
dotenv.config({ path: path.join(__dirname, "../../config/.env") });

// Daily email limit and warmup increase rate
const DAILY_EMAIL_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || "5", 10);
const EMAIL_WARMUP_INCREASE_RATE = parseInt(
  process.env.EMAIL_WARMUP_INCREASE_RATE || "2",
  10
);

/**
 * Get the email schedule for a specific date
 * @param {Date} date - Date to get the schedule for
 * @returns {Promise<Object>} - Email schedule
 */
export async function getEmailSchedule(date) {
  const dateString = date.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("email_schedule")
    .select("*")
    .eq("scheduled_date", dateString)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "no rows returned" error
    console.error(
      `Error fetching email schedule for date ${dateString}:`,
      error
    );
    throw error;
  }

  return data;
}

/**
 * Create or update the email schedule for a specific date
 * @param {Date} date - Date to create or update the schedule for
 * @param {Number} limit - Email limit for the date
 * @returns {Promise<Object>} - Created or updated email schedule
 */
export async function createOrUpdateEmailSchedule(date, limit) {
  const dateString = date.toISOString().split("T")[0];

  // Check if the schedule already exists
  const existingSchedule = await getEmailSchedule(date);

  if (existingSchedule) {
    // Update the existing schedule
    const { data, error } = await supabase
      .from("email_schedule")
      .update({
        emails_limit: limit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSchedule.id)
      .select();

    if (error) {
      console.error(
        `Error updating email schedule for date ${dateString}:`,
        error
      );
      throw error;
    }

    return data[0];
  } else {
    // Create a new schedule
    const { data, error } = await supabase
      .from("email_schedule")
      .insert([
        {
          scheduled_date: dateString,
          emails_limit: limit,
          emails_sent: 0,
          is_completed: false,
        },
      ])
      .select();

    if (error) {
      console.error(
        `Error creating email schedule for date ${dateString}:`,
        error
      );
      throw error;
    }

    return data[0];
  }
}

/**
 * Increment the emails sent count for a specific date
 * @param {Date} date - Date to increment the count for
 * @returns {Promise<Object>} - Updated email schedule
 */
export async function incrementEmailsSent(date) {
  const dateString = date.toISOString().split("T")[0];

  // Get the current schedule
  const schedule = await getEmailSchedule(date);

  if (!schedule) {
    throw new Error(`No email schedule found for date ${dateString}`);
  }

  // Check if we've reached the limit
  if (schedule.emails_sent >= schedule.emails_limit) {
    throw new Error(`Email limit reached for date ${dateString}`);
  }

  // Increment the emails sent count
  const { data, error } = await supabase
    .from("email_schedule")
    .update({
      emails_sent: schedule.emails_sent + 1,
      is_completed: schedule.emails_sent + 1 >= schedule.emails_limit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", schedule.id)
    .select();

  if (error) {
    console.error(
      `Error incrementing emails sent for date ${dateString}:`,
      error
    );
    throw error;
  }

  return data[0];
}

/**
 * Generate email schedules for the next N days
 * @param {Number} days - Number of days to generate schedules for
 * @returns {Promise<Array>} - Array of created or updated email schedules
 */
export async function generateEmailSchedules(days = 30) {
  const schedules = [];

  // Get the most recent schedule
  const { data: latestSchedule, error } = await supabase
    .from("email_schedule")
    .select("*")
    .order("scheduled_date", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching latest email schedule:", error);
    throw error;
  }

  // Determine the starting limit
  let currentLimit = DAILY_EMAIL_LIMIT;

  if (latestSchedule && latestSchedule.length > 0) {
    currentLimit = latestSchedule[0].emails_limit + EMAIL_WARMUP_INCREASE_RATE;
  }

  // Generate schedules for the next N days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    // Create or update the schedule
    const schedule = await createOrUpdateEmailSchedule(date, currentLimit);
    schedules.push(schedule);

    // Increase the limit for the next day
    currentLimit += EMAIL_WARMUP_INCREASE_RATE;
  }

  return schedules;
}

/**
 * Get the remaining email quota for today
 * @returns {Promise<Number>} - Remaining email quota
 */
export async function getRemainingEmailQuota() {
  const today = new Date();
  const schedule = await getEmailSchedule(today);

  if (!schedule) {
    // No schedule for today, create one
    const newSchedule = await createOrUpdateEmailSchedule(
      today,
      DAILY_EMAIL_LIMIT
    );
    return newSchedule.emails_limit;
  }

  return Math.max(0, schedule.emails_limit - schedule.emails_sent);
}

/**
 * Check if we can send more emails today
 * @returns {Promise<Boolean>} - Whether we can send more emails today
 */
export async function canSendMoreEmails() {
  const remainingQuota = await getRemainingEmailQuota();
  return remainingQuota > 0;
}

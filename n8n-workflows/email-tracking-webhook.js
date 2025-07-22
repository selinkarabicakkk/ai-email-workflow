/**
 * Email Tracking Webhook for n8n
 *
 * This script is designed to be used as a Function node in n8n after a Webhook node.
 * It handles tracking events from email service providers (e.g., SendGrid, Mailgun).
 *
 * To use this script:
 * 1. Create a new n8n workflow
 * 2. Add a Webhook node (e.g., /webhook/email-tracking)
 * 3. Add a Function node after the Webhook node and paste this script
 * 4. Configure the necessary credentials in n8n
 */

// This is the main function that will be executed by n8n
async function execute() {
  // Import required libraries
  const { createClient } = require("@supabase/supabase-js");

  // Supabase configuration (from n8n credentials)
  const supabaseUrl = $credentials.supabase.url;
  const supabaseKey = $credentials.supabase.apiKey;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get the webhook payload
  const payload = $input.body;
  const provider = $input.params.provider || "sendgrid"; // Default to SendGrid

  // Process the webhook based on the provider
  switch (provider.toLowerCase()) {
    case "sendgrid":
      return processSendGridWebhook(payload, supabase);
    case "mailgun":
      return processMailgunWebhook(payload, supabase);
    default:
      return {
        success: false,
        error: `Unsupported provider: ${provider}`,
      };
  }
}

/**
 * Process a SendGrid webhook event
 * @param {Array} payload - SendGrid webhook payload
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} - Processing result
 */
async function processSendGridWebhook(payload, supabase) {
  // SendGrid sends an array of events
  if (!Array.isArray(payload)) {
    return {
      success: false,
      error: "Invalid SendGrid webhook payload",
    };
  }

  const results = [];

  // Process each event
  for (const event of payload) {
    try {
      // Get the email record by message ID
      const { data: emails, error: emailError } = await supabase
        .from("emails")
        .select("*")
        .eq("message_id", event.sg_message_id)
        .limit(1);

      if (emailError) {
        throw emailError;
      }

      // If no email found, skip this event
      if (!emails || emails.length === 0) {
        results.push({
          event: event.event,
          messageId: event.sg_message_id,
          status: "skipped",
          reason: "Email not found",
        });
        continue;
      }

      const email = emails[0];

      // Update the email record based on the event type
      switch (event.event) {
        case "open":
          // Update the email record
          const { error: openError } = await supabase
            .from("emails")
            .update({
              status: "opened",
              opened_at: new Date(event.timestamp * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.id);

          if (openError) {
            throw openError;
          }

          results.push({
            event: event.event,
            messageId: event.sg_message_id,
            emailId: email.id,
            status: "success",
          });
          break;

        case "click":
          // Update the email record
          const { error: clickError } = await supabase
            .from("emails")
            .update({
              status: "clicked",
              clicked_at: new Date(event.timestamp * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.id);

          if (clickError) {
            throw clickError;
          }

          results.push({
            event: event.event,
            messageId: event.sg_message_id,
            emailId: email.id,
            status: "success",
            url: event.url,
          });
          break;

        case "bounce":
          // Update the email record
          const { error: bounceError } = await supabase
            .from("emails")
            .update({
              status: "bounced",
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.id);

          if (bounceError) {
            throw bounceError;
          }

          // Update the company record
          const { error: companyError } = await supabase
            .from("companies")
            .update({
              email_verified: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.company_id);

          if (companyError) {
            throw companyError;
          }

          results.push({
            event: event.event,
            messageId: event.sg_message_id,
            emailId: email.id,
            status: "success",
            reason: event.reason,
          });
          break;

        default:
          results.push({
            event: event.event,
            messageId: event.sg_message_id,
            emailId: email.id,
            status: "skipped",
            reason: "Unsupported event type",
          });
      }
    } catch (error) {
      console.error(`Error processing SendGrid event ${event.event}:`, error);
      results.push({
        event: event.event,
        messageId: event.sg_message_id,
        status: "error",
        error: error.message,
      });
    }
  }

  return {
    success: true,
    message: `Processed ${results.length} SendGrid events`,
    results,
  };
}

/**
 * Process a Mailgun webhook event
 * @param {Object} payload - Mailgun webhook payload
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} - Processing result
 */
async function processMailgunWebhook(payload, supabase) {
  try {
    // Get the email record by message ID
    const { data: emails, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("message_id", payload["message-id"])
      .limit(1);

    if (emailError) {
      throw emailError;
    }

    // If no email found, return an error
    if (!emails || emails.length === 0) {
      return {
        success: false,
        error: "Email not found",
        messageId: payload["message-id"],
      };
    }

    const email = emails[0];

    // Update the email record based on the event type
    switch (payload.event) {
      case "opened":
        // Update the email record
        const { error: openError } = await supabase
          .from("emails")
          .update({
            status: "opened",
            opened_at: new Date(payload.timestamp * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        if (openError) {
          throw openError;
        }

        return {
          success: true,
          event: payload.event,
          messageId: payload["message-id"],
          emailId: email.id,
        };

      case "clicked":
        // Update the email record
        const { error: clickError } = await supabase
          .from("emails")
          .update({
            status: "clicked",
            clicked_at: new Date(payload.timestamp * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        if (clickError) {
          throw clickError;
        }

        return {
          success: true,
          event: payload.event,
          messageId: payload["message-id"],
          emailId: email.id,
          url: payload.url,
        };

      case "bounced":
        // Update the email record
        const { error: bounceError } = await supabase
          .from("emails")
          .update({
            status: "bounced",
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        if (bounceError) {
          throw bounceError;
        }

        // Update the company record
        const { error: companyError } = await supabase
          .from("companies")
          .update({
            email_verified: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.company_id);

        if (companyError) {
          throw companyError;
        }

        return {
          success: true,
          event: payload.event,
          messageId: payload["message-id"],
          emailId: email.id,
          reason: payload.reason,
        };

      default:
        return {
          success: false,
          error: `Unsupported event type: ${payload.event}`,
          messageId: payload["message-id"],
          emailId: email.id,
        };
    }
  } catch (error) {
    console.error(`Error processing Mailgun event ${payload.event}:`, error);
    return {
      success: false,
      error: error.message,
      event: payload.event,
      messageId: payload["message-id"],
    };
  }
}

// Return the result of the execute function
return execute();

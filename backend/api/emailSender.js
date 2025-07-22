import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the config directory
dotenv.config({ path: path.join(__dirname, "../../config/.env") });

// SendGrid API key and from email
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

// Check if the required environment variables are set
if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
  console.warn(
    "Warning: SendGrid API key or from email is not set in the .env file. Email sending will not work."
  );
}

/**
 * Send an email using SendGrid API
 * @param {String} to - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} body - Email body (HTML)
 * @param {String} plainText - Plain text version of the email
 * @param {Object} options - Additional options
 * @param {String} options.replyTo - Reply-to email address
 * @param {String} options.cc - CC email address
 * @param {String} options.bcc - BCC email address
 * @param {Array} options.attachments - Attachments
 * @returns {Promise<Object>} - SendGrid API response
 */
export async function sendEmail(to, subject, body, plainText, options = {}) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    throw new Error(
      "SendGrid API key or from email is not set in the .env file"
    );
  }

  try {
    // Prepare the email payload
    const payload = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject,
        },
      ],
      from: { email: SENDGRID_FROM_EMAIL },
      content: [
        {
          type: "text/plain",
          value: plainText || body.replace(/<[^>]*>/g, ""), // Strip HTML tags for plain text
        },
        {
          type: "text/html",
          value: body,
        },
      ],
    };

    // Add optional fields if provided
    if (options.replyTo) {
      payload.reply_to = { email: options.replyTo };
    }

    if (options.cc) {
      payload.personalizations[0].cc = [{ email: options.cc }];
    }

    if (options.bcc) {
      payload.personalizations[0].bcc = [{ email: options.bcc }];
    }

    if (options.attachments && Array.isArray(options.attachments)) {
      payload.attachments = options.attachments;
    }

    // Call SendGrid API
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API returned ${response.status}: ${errorText}`);
    }

    return {
      success: true,
      messageId: response.headers.get("x-message-id") || null,
    };
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
}

/**
 * Format the email body with HTML
 * @param {String} body - Plain text email body
 * @param {Object} userData - User data (name, signature, etc.)
 * @returns {String} - HTML formatted email body
 */
export function formatEmailBody(body, userData) {
  // Create a signature
  const signature = `
    <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
      <p style="margin: 0;">${userData.name || "Your Name"}</p>
      ${
        userData.title
          ? `<p style="margin: 0; color: #666;">${userData.title}</p>`
          : ""
      }
      ${
        userData.phone
          ? `<p style="margin: 0;">Phone: ${userData.phone}</p>`
          : ""
      }
      ${
        userData.email
          ? `<p style="margin: 0;">Email: ${userData.email}</p>`
          : ""
      }
      ${
        userData.linkedin
          ? `<p style="margin: 0;">LinkedIn: <a href="${userData.linkedin}">${userData.linkedin}</a></p>`
          : ""
      }
      ${
        userData.portfolio
          ? `<p style="margin: 0;">Portfolio: <a href="${userData.portfolio}">${userData.portfolio}</a></p>`
          : ""
      }
    </div>
  `;

  // Format the email body with HTML
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${userData.name || "Job Application"}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
        }
        p {
          margin-bottom: 16px;
        }
        a {
          color: #0366d6;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div>
        ${body.replace(/\n/g, "<br>")}
      </div>
      ${signature}
    </body>
    </html>
  `;
}

/**
 * Send a job application email
 * @param {Object} company - Company information
 * @param {Object} emailContent - Generated email content
 * @param {Object} userData - User data (name, signature, etc.)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - SendGrid API response
 */
export async function sendJobApplicationEmail(
  company,
  emailContent,
  userData,
  options = {}
) {
  // Format the email body with HTML
  const htmlBody = formatEmailBody(emailContent.body, userData);

  // Send the email
  return sendEmail(
    company.contact_email,
    emailContent.subject,
    htmlBody,
    emailContent.body,
    {
      replyTo: userData.email,
      ...options,
    }
  );
}

/**
 * Daily Email Workflow for n8n
 *
 * This script is designed to be used as a Function node in n8n.
 * It handles the daily email sending process, including:
 * 1. Getting companies to contact
 * 2. Generating personalized email content
 * 3. Sending emails
 * 4. Updating the database
 *
 * To use this script:
 * 1. Create a new n8n workflow
 * 2. Add a Schedule trigger (e.g., daily at 10 AM)
 * 3. Add a Function node and paste this script
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

  // SendGrid configuration (from n8n credentials)
  const sendgridApiKey = $credentials.sendgrid.apiKey;
  const sendgridFromEmail = $credentials.sendgrid.fromEmail;

  // User data (should be stored in n8n workflow variables)
  const userData = {
    name: $workflow.variables.userName,
    title: $workflow.variables.userTitle,
    email: $workflow.variables.userEmail,
    phone: $workflow.variables.userPhone,
    linkedin: $workflow.variables.userLinkedin,
    portfolio: $workflow.variables.userPortfolio,
    skills: $workflow.variables.userSkills,
    experience: $workflow.variables.userExperience,
    education: $workflow.variables.userEducation,
  };

  // Get today's date
  const today = new Date();
  const dateString = today.toISOString().split("T")[0];

  // Step 1: Get today's email schedule
  let schedule;
  try {
    const { data, error } = await supabase
      .from("email_schedule")
      .select("*")
      .eq("scheduled_date", dateString)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned" error
      throw error;
    }

    if (!data) {
      // No schedule for today, create one with default limit
      const { data: newSchedule, error: createError } = await supabase
        .from("email_schedule")
        .insert([
          {
            scheduled_date: dateString,
            emails_limit: 5, // Default limit
            emails_sent: 0,
            is_completed: false,
          },
        ])
        .select();

      if (createError) {
        throw createError;
      }

      schedule = newSchedule[0];
    } else {
      schedule = data;
    }
  } catch (error) {
    console.error("Error getting email schedule:", error);
    return { success: false, error: "Failed to get email schedule" };
  }

  // Check if we've reached the limit for today
  if (schedule.is_completed || schedule.emails_sent >= schedule.emails_limit) {
    return {
      success: true,
      message: "Email limit reached for today",
      schedule,
    };
  }

  // Step 2: Get companies to contact today
  const remainingQuota = schedule.emails_limit - schedule.emails_sent;
  let companies;
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("email_verified", true)
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .limit(remainingQuota);

    if (error) {
      throw error;
    }

    companies = data;
  } catch (error) {
    console.error("Error getting companies:", error);
    return { success: false, error: "Failed to get companies" };
  }

  if (companies.length === 0) {
    return { success: true, message: "No companies to contact today" };
  }

  // Step 3: Get the default email template
  let template;
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data.length === 0) {
      // Use a default template if none is found
      template = {
        name: "Default Template",
        subject_template: "Job Application - {{company.name}}",
        body_template:
          "Create a professional and personalized email introducing myself and expressing interest in potential job opportunities at the company.",
      };
    } else {
      template = data[0];
    }
  } catch (error) {
    console.error("Error getting email template:", error);
    return { success: false, error: "Failed to get email template" };
  }

  // Step 4: Process each company
  const results = [];
  for (const company of companies) {
    try {
      // Step 4.1: Generate email content using Gemini API
      const generatedContent = await generateEmailContent(
        company,
        template,
        userData
      );

      // Step 4.2: Send the email using SendGrid
      const emailResult = await sendEmail(
        company.contact_email,
        generatedContent.subject,
        formatEmailBody(generatedContent.body, userData),
        generatedContent.body,
        {
          replyTo: userData.email,
          apiKey: sendgridApiKey,
          fromEmail: sendgridFromEmail,
        }
      );

      // Step 4.3: Create email record in the database
      const { data: emailRecord, error: emailRecordError } = await supabase
        .from("emails")
        .insert([
          {
            company_id: company.id,
            subject: generatedContent.subject,
            body: generatedContent.body,
            sent_at: new Date().toISOString(),
            status: "sent",
            email_provider: "sendgrid",
            message_id: emailResult.messageId,
            ai_generated: true,
            template_used: template.name,
          },
        ])
        .select();

      if (emailRecordError) {
        throw emailRecordError;
      }

      // Step 4.4: Update company status
      const { error: companyUpdateError } = await supabase
        .from("companies")
        .update({
          status: "contacted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (companyUpdateError) {
        throw companyUpdateError;
      }

      // Step 4.5: Increment emails sent count
      const { error: scheduleUpdateError } = await supabase
        .from("email_schedule")
        .update({
          emails_sent: schedule.emails_sent + 1,
          is_completed: schedule.emails_sent + 1 >= schedule.emails_limit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      if (scheduleUpdateError) {
        throw scheduleUpdateError;
      }

      // Update the schedule in memory
      schedule.emails_sent += 1;
      schedule.is_completed = schedule.emails_sent >= schedule.emails_limit;

      // Add the result to the results array
      results.push({
        company: company.name,
        email: company.contact_email,
        subject: generatedContent.subject,
        status: "sent",
        emailId: emailRecord[0].id,
      });

      // Check if we've reached the limit
      if (schedule.is_completed) {
        break;
      }
    } catch (error) {
      console.error(`Error processing company ${company.name}:`, error);
      results.push({
        company: company.name,
        email: company.contact_email,
        status: "error",
        error: error.message,
      });
    }
  }

  return {
    success: true,
    message: `Processed ${results.length} companies`,
    results,
    schedule,
  };
}

/**
 * Generate email content using Gemini API
 * @param {Object} company - Company information
 * @param {Object} template - Email template
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - Generated email content
 */
async function generateEmailContent(company, template, userData) {
  // Gemini API key (from n8n credentials)
  const geminiApiKey = $credentials.gemini.apiKey;

  // Construct the prompt
  const prompt = `
You are an expert job application email writer. Your task is to create a personalized email for a job application.

COMPANY INFORMATION:
Name: ${company.name}
Industry: ${company.industry || "Technology"}
Location: ${company.location || "Unknown"}
Company Size: ${company.company_size || "Unknown"}
Website: ${company.website || "Unknown"}

APPLICANT INFORMATION:
Name: ${userData.name}
Title: ${userData.title || "Computer Engineering Graduate"}
Skills: ${userData.skills || "Programming, Problem Solving, Teamwork"}
Experience: ${
    userData.experience || "Recent graduate with internship experience"
  }
Education: ${
    userData.education || "Bachelor of Science in Computer Engineering"
  }
Portfolio/GitHub: ${userData.portfolio || "Available upon request"}
LinkedIn: ${userData.linkedin || "Available upon request"}

TEMPLATE GUIDANCE:
${
  template.body_template ||
  "Create a professional and personalized email introducing myself and expressing interest in potential job opportunities at the company."
}

INSTRUCTIONS:
1. Create a personalized email that introduces the applicant and expresses interest in job opportunities at the company.
2. Highlight relevant skills and experience that would be valuable to the company.
3. Show that you've researched the company by mentioning specific details about them.
4. Keep the email concise, professional, and engaging.
5. Include a clear call to action (e.g., request for an interview, meeting, or further discussion).
6. Create an attention-grabbing subject line.
7. Format your response as follows:

SUBJECT: [Your subject line here]

[Your email body here]

Be creative, professional, and personalized. Avoid generic templates and make sure the email stands out.
`;

  // Call Gemini API
  const response = await $http.request({
    method: "POST",
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    },
  });

  // Extract the generated content
  const generatedText = response.body.candidates[0].content.parts[0].text;

  // Parse the generated content
  const subjectMatch = generatedText.match(/SUBJECT:\s*(.*?)(?:\n|$)/);
  const subject = subjectMatch ? subjectMatch[1].trim() : "Job Application";

  const bodyMatch = generatedText.match(/SUBJECT:.*?(?:\n|$)([\s\S]*)/);
  const body = bodyMatch ? bodyMatch[1].trim() : generatedText;

  return { subject, body, raw: generatedText };
}

/**
 * Send an email using SendGrid API
 * @param {String} to - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} body - Email body (HTML)
 * @param {String} plainText - Plain text version of the email
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - SendGrid API response
 */
async function sendEmail(to, subject, body, plainText, options = {}) {
  // Call SendGrid API
  const response = await $http.request({
    method: "POST",
    url: "https://api.sendgrid.com/v3/mail/send",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject,
        },
      ],
      from: { email: options.fromEmail },
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
      reply_to: options.replyTo ? { email: options.replyTo } : undefined,
    },
  });

  return {
    success: true,
    messageId: response.headers["x-message-id"] || null,
  };
}

/**
 * Format the email body with HTML
 * @param {String} body - Plain text email body
 * @param {Object} userData - User data
 * @returns {String} - HTML formatted email body
 */
function formatEmailBody(body, userData) {
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

// Return the result of the execute function
return execute();

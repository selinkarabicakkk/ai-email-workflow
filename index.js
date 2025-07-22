import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  getCompaniesForDailyEmails,
  markCompanyAsContacted,
} from "./backend/api/companies.js";
import { createEmail, markEmailAsSent } from "./backend/api/emails.js";
import {
  findBestEmailForPerson,
  verifyEmail,
} from "./backend/api/emailVerification.js";
import { generateEmailContent } from "./backend/api/aiContentGenerator.js";
import { sendJobApplicationEmail } from "./backend/api/emailSender.js";
import {
  getRemainingEmailQuota,
  incrementEmailsSent,
} from "./backend/api/emailSchedule.js";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the config directory
dotenv.config({ path: path.join(__dirname, "config/.env") });

/**
 * Main function to run the email workflow
 */
async function main() {
  try {
    console.log("Starting AI Email Workflow...");

    // Check the remaining email quota for today
    const remainingQuota = await getRemainingEmailQuota();
    console.log(`Remaining email quota for today: ${remainingQuota}`);

    if (remainingQuota <= 0) {
      console.log("Email quota reached for today. Exiting...");
      return;
    }

    // Get companies to contact today
    const companies = await getCompaniesForDailyEmails(remainingQuota);
    console.log(`Found ${companies.length} companies to contact today.`);

    if (companies.length === 0) {
      console.log("No companies to contact today. Exiting...");
      return;
    }

    // User data (should be loaded from a config file or environment variables)
    const userData = {
      name: process.env.USER_NAME || "Your Name",
      title: process.env.USER_TITLE || "Computer Engineering Graduate",
      email: process.env.USER_EMAIL || "your.email@example.com",
      phone: process.env.USER_PHONE || "Your Phone Number",
      linkedin:
        process.env.USER_LINKEDIN || "https://linkedin.com/in/yourprofile",
      portfolio: process.env.USER_PORTFOLIO || "https://yourportfolio.com",
      skills:
        process.env.USER_SKILLS || "Programming, Problem Solving, Teamwork",
      experience:
        process.env.USER_EXPERIENCE ||
        "Recent graduate with internship experience",
      education:
        process.env.USER_EDUCATION ||
        "Bachelor of Science in Computer Engineering",
    };

    // Process each company
    for (const company of companies) {
      try {
        console.log(`Processing company: ${company.name}`);

        // Verify email if not already verified
        if (!company.email_verified) {
          console.log(`Email not verified for ${company.name}. Verifying...`);

          if (!company.contact_email) {
            // Try to find an email address for the company
            console.log(
              `No contact email for ${company.name}. Finding email...`
            );
            const domain = company.website
              .replace(/^https?:\/\//, "")
              .replace(/\/.*$/, "");
            const email = await findBestEmailForPerson(
              domain,
              "hr",
              company.name
            );

            if (email) {
              company.contact_email = email.value;
              console.log(`Found email: ${company.contact_email}`);
            } else {
              console.log(
                `Could not find email for ${company.name}. Skipping...`
              );
              continue;
            }
          }

          // Verify the email
          const verification = await verifyEmail(company.contact_email);

          if (!verification.isValid) {
            console.log(
              `Email ${company.contact_email} is not valid. Skipping...`
            );
            continue;
          }

          console.log(`Email ${company.contact_email} is valid.`);
        }

        // Generate email content
        console.log(`Generating email content for ${company.name}...`);
        const emailContent = await generateEmailContent(
          company,
          {
            body_template:
              "Create a professional and personalized email introducing myself and expressing interest in potential job opportunities at the company.",
          },
          userData
        );

        // Send the email
        console.log(
          `Sending email to ${company.name} at ${company.contact_email}...`
        );
        const emailResult = await sendJobApplicationEmail(
          company,
          emailContent,
          userData
        );

        // Create email record
        console.log(`Creating email record...`);
        const email = await createEmail({
          company_id: company.id,
          subject: emailContent.subject,
          body: emailContent.body,
          status: "sent",
          sent_at: new Date().toISOString(),
          email_provider: "sendgrid",
          message_id: emailResult.messageId,
          ai_generated: true,
          template_used: "default",
        });

        // Mark the company as contacted
        console.log(`Marking company ${company.name} as contacted...`);
        await markCompanyAsContacted(company.id);

        // Increment the emails sent count
        console.log(`Incrementing emails sent count...`);
        await incrementEmailsSent(new Date());

        console.log(`Successfully processed company: ${company.name}`);
      } catch (error) {
        console.error(`Error processing company ${company.name}:`, error);
      }
    }

    console.log("AI Email Workflow completed successfully.");
  } catch (error) {
    console.error("Error running AI Email Workflow:", error);
  }
}

// Run the main function
if (process.argv[2] === "run") {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
} else {
  console.log("To run the email workflow, use: node index.js run");
}

export default main;

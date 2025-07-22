import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the config directory
dotenv.config({ path: path.join(__dirname, "../../config/.env") });

// Gemini API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Check if the required environment variables are set
if (!GEMINI_API_KEY) {
  console.warn(
    "Warning: Gemini API key is not set in the .env file. AI content generation will not work."
  );
}

/**
 * Generate personalized email content using Gemini API
 * @param {Object} company - Company information
 * @param {Object} template - Email template with variables
 * @param {Object} userData - User data (name, skills, experience, etc.)
 * @returns {Promise<Object>} - Generated email content
 */
export async function generateEmailContent(company, template, userData) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is not set in the .env file");
  }

  try {
    // Construct the prompt for Gemini
    const prompt = constructPrompt(company, template, userData);

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gemini API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Extract the generated content
    const generatedText = data.candidates[0].content.parts[0].text;

    // Parse the generated content to extract subject and body
    const { subject, body } = parseGeneratedContent(generatedText);

    return {
      subject,
      body,
      raw: generatedText,
    };
  } catch (error) {
    console.error("Error generating email content:", error);
    throw error;
  }
}

/**
 * Construct a prompt for Gemini API
 * @param {Object} company - Company information
 * @param {Object} template - Email template with variables
 * @param {Object} userData - User data (name, skills, experience, etc.)
 * @returns {String} - Prompt for Gemini API
 */
function constructPrompt(company, template, userData) {
  return `
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
}

/**
 * Parse the generated content to extract subject and body
 * @param {String} content - Generated content from Gemini API
 * @returns {Object} - Parsed content with subject and body
 */
function parseGeneratedContent(content) {
  // Extract the subject line
  const subjectMatch = content.match(/SUBJECT:\s*(.*?)(?:\n|$)/);
  const subject = subjectMatch ? subjectMatch[1].trim() : "Job Application";

  // Extract the body (everything after the subject line)
  const bodyMatch = content.match(/SUBJECT:.*?(?:\n|$)([\s\S]*)/);
  const body = bodyMatch ? bodyMatch[1].trim() : content;

  return { subject, body };
}

/**
 * Generate multiple variations of email content
 * @param {Object} company - Company information
 * @param {Object} template - Email template with variables
 * @param {Object} userData - User data (name, skills, experience, etc.)
 * @param {Number} variations - Number of variations to generate
 * @returns {Promise<Array>} - Array of generated email content variations
 */
export async function generateEmailVariations(
  company,
  template,
  userData,
  variations = 3
) {
  const results = [];

  for (let i = 0; i < variations; i++) {
    try {
      const content = await generateEmailContent(company, template, userData);
      results.push(content);
    } catch (error) {
      console.error(`Error generating email variation ${i + 1}:`, error);
    }
  }

  return results;
}

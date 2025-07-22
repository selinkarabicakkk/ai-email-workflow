import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the config directory
dotenv.config({ path: path.join(__dirname, "../../config/.env") });

// Hunter.io API key
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

// Check if the required environment variables are set
if (!HUNTER_API_KEY) {
  console.warn(
    "Warning: Hunter API key is not set in the .env file. Email verification will not work."
  );
}

/**
 * Verify an email address using Hunter.io API
 * @param {String} email - Email address to verify
 * @returns {Promise<Object>} - Verification result
 */
export async function verifyEmail(email) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter API key is not set in the .env file");
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${HUNTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(
        `Hunter API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      email,
      isValid: data.data.status === "valid",
      status: data.data.status,
      score: data.data.score,
      result: data.data.result,
      isDisposable: data.data.disposable,
      isWebmail: data.data.webmail,
      isAcceptAll: data.data.accept_all,
    };
  } catch (error) {
    console.error(`Error verifying email ${email}:`, error);
    throw error;
  }
}

/**
 * Find email addresses for a domain using Hunter.io API
 * @param {String} domain - Domain to search for email addresses
 * @param {String} firstName - Optional first name of the person
 * @param {String} lastName - Optional last name of the person
 * @returns {Promise<Array>} - Array of email addresses
 */
export async function findEmailsByDomain(
  domain,
  firstName = "",
  lastName = ""
) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter API key is not set in the .env file");
  }

  try {
    let url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}`;

    if (firstName) {
      url += `&first_name=${firstName}`;
    }

    if (lastName) {
      url += `&last_name=${lastName}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Hunter API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Extract email addresses from the response
    const emails = data.data.emails.map((email) => ({
      value: email.value,
      firstName: email.first_name,
      lastName: email.last_name,
      position: email.position,
      confidence: email.confidence,
      type: email.type,
      sources: email.sources,
    }));

    return emails;
  } catch (error) {
    console.error(`Error finding emails for domain ${domain}:`, error);
    throw error;
  }
}

/**
 * Find the most likely email address for a person at a company
 * @param {String} domain - Company domain
 * @param {String} firstName - First name of the person
 * @param {String} lastName - Last name of the person
 * @returns {Promise<Object>} - Most likely email address
 */
export async function findBestEmailForPerson(domain, firstName, lastName) {
  const emails = await findEmailsByDomain(domain, firstName, lastName);

  // If we found an exact match for the person, return it
  const exactMatch = emails.find(
    (email) =>
      email.firstName?.toLowerCase() === firstName.toLowerCase() &&
      email.lastName?.toLowerCase() === lastName.toLowerCase()
  );

  if (exactMatch) {
    return exactMatch;
  }

  // If we found emails for the domain, try to determine the pattern
  if (emails.length > 0) {
    // Get the most common pattern from the domain
    const patterns = await getEmailPattern(domain);

    if (patterns.length > 0) {
      // Use the most common pattern to generate an email
      const pattern = patterns[0];
      let email = "";

      switch (pattern) {
        case "first_last":
          email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
          break;
        case "firstlast":
          email = `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`;
          break;
        case "first.last":
          email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
          break;
        case "first":
          email = `${firstName.toLowerCase()}@${domain}`;
          break;
        case "last.first":
          email = `${lastName.toLowerCase()}.${firstName.toLowerCase()}@${domain}`;
          break;
        case "lastfirst":
          email = `${lastName.toLowerCase()}${firstName.toLowerCase()}@${domain}`;
          break;
        case "first_initial.last":
          email = `${firstName
            .charAt(0)
            .toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
          break;
        case "first_initiallast":
          email = `${firstName
            .charAt(0)
            .toLowerCase()}${lastName.toLowerCase()}@${domain}`;
          break;
        default:
          // Default to first.last@domain.com
          email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
      }

      // Verify the generated email
      try {
        const verification = await verifyEmail(email);

        if (verification.isValid) {
          return {
            value: email,
            firstName,
            lastName,
            confidence: "generated",
            type: "personal",
            sources: [],
          };
        }
      } catch (error) {
        console.warn(`Could not verify generated email ${email}:`, error);
      }
    }
  }

  // If no exact match or pattern match, return the first email with the highest confidence
  if (emails.length > 0) {
    // Sort by confidence
    emails.sort((a, b) => b.confidence - a.confidence);
    return emails[0];
  }

  // If no emails found, return null
  return null;
}

/**
 * Get the email pattern for a domain
 * @param {String} domain - Domain to get the email pattern for
 * @returns {Promise<Array>} - Array of email patterns
 */
export async function getEmailPattern(domain) {
  if (!HUNTER_API_KEY) {
    throw new Error("Hunter API key is not set in the .env file");
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-count?domain=${domain}&api_key=${HUNTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(
        `Hunter API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Extract email patterns from the response
    if (data.data && data.data.pattern) {
      return [data.data.pattern];
    }

    return [];
  } catch (error) {
    console.error(`Error getting email pattern for domain ${domain}:`, error);
    throw error;
  }
}

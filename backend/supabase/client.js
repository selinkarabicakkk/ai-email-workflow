import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the config directory
dotenv.config({ path: path.join(__dirname, "../../config/.env") });

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Check if the required environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL and key must be set in the .env file");
  process.exit(1);
}

// Create a Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

# AI Email Workflow for Job Applications

An automated system for sending personalized job application emails using AI content generation, email verification, and scheduled delivery.

## Architecture

- **Database**: Supabase for storing company information and email tracking
- **Workflow Automation**: n8n for orchestrating the entire process
- **Email Service**: SendGrid/Mailgun for reliable email delivery
- **AI Content Generation**: Gemini API for personalized email content
- **Email Verification**: Hunter.io/Clearbit for finding and validating email addresses

## Project Structure

```
ai-email-workflow/
├── backend/               # Backend services
│   ├── supabase/          # Supabase schema definitions and client
│   └── api/               # API modules for different services
├── n8n-workflows/         # n8n workflow definitions
├── email-templates/       # Base email templates
├── ai-prompts/            # Prompts for Gemini API
└── config/                # Configuration files
```

## Prerequisites

- Node.js (v16 or higher)
- Supabase account
- n8n (local or cloud)
- SendGrid or Mailgun account
- Hunter.io API key
- Gemini API key

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/selinkarabicakkk/ai-email-workflow.git
cd ai-email-workflow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and update it with your credentials:

```bash
cp config/env.example config/.env
```

Edit the `.env` file with your API keys and personal information.

### 4. Supabase Setup

1. Create a new Supabase project
2. Run the schema.sql script in the SQL editor to create the necessary tables
3. Update the `.env` file with your Supabase URL and key

### 5. n8n Setup

1. Install n8n (if using locally):

   ```bash
   npm install -g n8n
   ```

2. Start n8n:

   ```bash
   n8n start
   ```

3. Import the workflow files from the `n8n-workflows` directory

### 6. Email Service Provider Setup

#### SendGrid

1. Create a SendGrid account
2. Verify your sender domain (SPF, DKIM, DMARC)
3. Create an API key and update the `.env` file
4. Set up event webhooks to point to your n8n webhook URL

#### Mailgun (Alternative)

1. Create a Mailgun account
2. Verify your sender domain
3. Create an API key and update the `.env` file
4. Set up event webhooks to point to your n8n webhook URL

## Usage

### Adding Companies

Add companies to the database using the Supabase interface or by creating a script to import them from a CSV file.

Required fields:

- name: Company name
- website: Company website URL
- industry: Company industry
- location: Company location
- contact_email: HR or recruiter email (optional, will be found automatically if not provided)

### Running the Workflow

#### Manual Execution

```bash
node index.js run
```

#### Scheduled Execution

Set up the n8n workflow to run on a schedule (e.g., daily at 10 AM).

### Monitoring

Monitor the email statistics in the Supabase database:

- Number of emails sent
- Open rate
- Click rate
- Reply rate

## Workflow Process

1. **Company Selection**: Select companies to contact based on priority and daily limit
2. **Email Verification**: Verify email addresses using Hunter.io API
3. **Content Generation**: Generate personalized email content using Gemini API
4. **Email Sending**: Send emails using SendGrid/Mailgun
5. **Tracking**: Track email opens, clicks, and replies
6. **Reporting**: Update the database with email status and statistics

## License

MIT

## Author

Your Name

## Acknowledgements

- Supabase for the database
- n8n for workflow automation
- SendGrid/Mailgun for email delivery
- Hunter.io for email verification
- Google for Gemini API

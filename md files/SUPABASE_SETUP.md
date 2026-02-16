# Supabase Setup Guide

This application requires a Supabase project to function. Follow these steps to set up your Supabase backend.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js installed on your machine

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in the project details:
   - **Name**: Choose a name for your project (e.g., "james-newsystem")
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the region closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (this may take a few minutes)

## Step 2: Get Your API Credentials

1. Once your project is ready, go to **Settings** → **API**
2. You'll find two important values:
   - **Project URL**: This is your `VITE_SUPABASE_URL`
   - **anon/public key**: This is your `VITE_SUPABASE_ANON_KEY`

## Step 3: Configure Environment Variables

1. In your project root, copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and replace the placeholder values:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Save the file

## Step 4: Run Database Migrations

Apply all the database migrations to set up your schema:

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref your-project-id
   ```

3. Apply migrations:
   ```bash
   supabase db push
   ```

   Or manually run the SQL files in the Supabase SQL Editor:
   - Go to **SQL Editor** in your Supabase dashboard
   - Copy and paste each migration file from `supabase/migrations/` in order
   - Execute each migration

## Step 5: Set Up Authentication

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Enable **Email** provider (should be enabled by default)
3. Configure email templates if needed

## Step 6: Configure Row Level Security (RLS)

The migrations should have set up RLS policies automatically. Verify by:

1. Go to **Authentication** → **Policies**
2. Check that policies exist for all tables
3. Ensure the `is_owner_or_developer` function exists

## Step 7: Test Your Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:8080 in your browser
3. Try to sign up with a new account
4. If successful, you should be able to log in and use the application

## Troubleshooting

### Error: "Missing Supabase environment variables"

- Make sure your `.env` file exists in the project root
- Verify that the variable names are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart your development server after creating/modifying the `.env` file

### Error: "Failed to fetch" or connection errors

- Check that your Supabase project is running (not paused)
- Verify the URL is correct (should end with `.supabase.co`)
- Check your internet connection

### Authentication not working

- Verify email provider is enabled in Supabase dashboard
- Check that RLS policies are properly configured
- Look for errors in the browser console

### Database errors

- Ensure all migrations have been applied
- Check the Supabase logs in the dashboard
- Verify table structures match the schema

## Security Notes

- **Never commit your `.env` file** to version control
- The `.env` file is already in `.gitignore`
- Use different Supabase projects for development and production
- Rotate your keys if they are ever exposed

## Next Steps

After setup is complete:

1. Create your first admin user account
2. Configure role-based permissions
3. Import any initial data
4. Set up email templates for notifications
5. Configure storage buckets if needed

## Support

For Supabase-specific issues:
- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com

For application-specific issues:
- Check the project README.md
- Review the migration files in `supabase/migrations/`
- Check the browser console for errors


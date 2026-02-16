-- 035_add_assigned_agent_to_contacts.sql
-- Add assignedAgent column to contacts table for sales agent assignment

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'assignedAgent'
    ) THEN
        ALTER TABLE public.contacts 
        ADD COLUMN "assignedAgent" TEXT;
    END IF;
END $$;

-- Create index for faster queries on assigned agent
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_agent 
ON public.contacts("assignedAgent");

-- Add comment for documentation
COMMENT ON COLUMN public.contacts."assignedAgent" IS 'Sales agent assigned to this customer contact';


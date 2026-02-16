-- Create personal_comments table
CREATE TABLE IF NOT EXISTS public.personal_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_personal_comments_contact_id ON public.personal_comments(contact_id);
CREATE INDEX idx_personal_comments_author_id ON public.personal_comments(author_id);

-- Create sales_reports table
CREATE TABLE IF NOT EXISTS public.sales_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, quantity, price}
  total_amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',
  sales_agent TEXT NOT NULL,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_reports_contact_id ON public.sales_reports(contact_id);
CREATE INDEX idx_sales_reports_approval_status ON public.sales_reports(approval_status);

-- Create discount_requests table
CREATE TABLE IF NOT EXISTS public.discount_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
  request_date DATE NOT NULL,
  discount_percentage DECIMAL(5, 2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_discount_requests_contact_id ON public.discount_requests(contact_id);
CREATE INDEX idx_discount_requests_status ON public.discount_requests(status);

-- Create updated_contact_details table
CREATE TABLE IF NOT EXISTS public.updated_contact_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  changed_fields JSONB NOT NULL, -- {fieldName: {oldValue, newValue}}
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_updated_contact_details_contact_id ON public.updated_contact_details(contact_id);
CREATE INDEX idx_updated_contact_details_approval_status ON public.updated_contact_details(approval_status);

-- Create sales_progress table
CREATE TABLE IF NOT EXISTS public.sales_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  inquiry_date DATE NOT NULL,
  inquiry TEXT NOT NULL,
  stage TEXT NOT NULL,
  stage_changed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_closure_date DATE,
  outcome TEXT CHECK (outcome IN ('closed_won', 'closed_lost', NULL)),
  outcome_date TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_progress_contact_id ON public.sales_progress(contact_id);
CREATE INDEX idx_sales_progress_stage ON public.sales_progress(stage);

-- Create incident_reports table
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  incident_date DATE NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('product_quality', 'service_quality', 'delivery', 'other')),
  description TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  attachments TEXT[],
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_incident_reports_contact_id ON public.incident_reports(contact_id);
CREATE INDEX idx_incident_reports_approval_status ON public.incident_reports(approval_status);

-- Create sales_returns table
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  incident_report_id UUID NOT NULL REFERENCES public.incident_reports(id) ON DELETE RESTRICT,
  return_date DATE NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, quantity, originalPrice, refundAmount}
  total_refund DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('processed', 'pending')),
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_returns_contact_id ON public.sales_returns(contact_id);
CREATE INDEX idx_sales_returns_incident_report_id ON public.sales_returns(incident_report_id);

-- Create purchase_history table
CREATE TABLE IF NOT EXISTS public.purchase_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, quantity, price}
  total_amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'overdue')),
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchase_history_contact_id ON public.purchase_history(contact_id);
CREATE INDEX idx_purchase_history_payment_status ON public.purchase_history(payment_status);

-- Create inquiry_history table
CREATE TABLE IF NOT EXISTS public.inquiry_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  inquiry_date DATE NOT NULL,
  product TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('converted', 'pending', 'cancelled')),
  converted_to_purchase BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inquiry_history_contact_id ON public.inquiry_history(contact_id);
CREATE INDEX idx_inquiry_history_status ON public.inquiry_history(status);

-- Create payment_terms table
CREATE TABLE IF NOT EXISTS public.payment_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  terms_type TEXT NOT NULL CHECK (terms_type IN ('cash', 'credit', 'installment')),
  credit_days INTEGER,
  installment_months INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'upgraded', 'downgraded')),
  previous_terms TEXT,
  changed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_terms_contact_id ON public.payment_terms(contact_id);
CREATE INDEX idx_payment_terms_status ON public.payment_terms(status);

-- Create customer_metrics table (aggregate/summary)
CREATE TABLE IF NOT EXISTS public.customer_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
  average_monthly_purchase DECIMAL(12, 2) DEFAULT 0,
  purchase_frequency INTEGER DEFAULT 0, -- Days between purchases
  outstanding_balance DECIMAL(12, 2) DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  last_purchase_date DATE,
  average_order_value DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'PHP',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customer_metrics_contact_id ON public.customer_metrics(contact_id);

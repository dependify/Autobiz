-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- Row Level Security (RLS) helper function
-- This checks the current tenant context set by the application
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT COALESCE(
    current_setting('app.current_tenant_id', true)::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;

-- Enable RLS on all tenant-scoped tables
-- (Applied after Drizzle creates the tables)

-- Contacts RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_tenant_id());

-- Interactions RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interactions
  USING (tenant_id = current_tenant_id());

-- Deals RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON deals
  USING (tenant_id = current_tenant_id());

-- Content pieces RLS
ALTER TABLE content_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON content_pieces
  USING (tenant_id = current_tenant_id());

-- Keywords RLS
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON keywords
  USING (tenant_id = current_tenant_id());

-- Invoices RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_tenant_id());

-- Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON transactions
  USING (tenant_id = current_tenant_id());

-- Social accounts RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON social_accounts
  USING (tenant_id = current_tenant_id());

-- Social posts RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON social_posts
  USING (tenant_id = current_tenant_id());

-- Call logs RLS
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON call_logs
  USING (tenant_id = current_tenant_id());

-- Campaigns RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaigns
  USING (tenant_id = current_tenant_id());

-- Proposals RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON proposals
  USING (tenant_id = current_tenant_id());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS contacts_tenant_idx ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS contacts_stage_idx ON contacts(tenant_id, stage);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS contacts_lead_score_idx ON contacts(tenant_id, lead_score DESC);

CREATE INDEX IF NOT EXISTS interactions_contact_idx ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS interactions_tenant_idx ON interactions(tenant_id);

CREATE INDEX IF NOT EXISTS deals_tenant_idx ON deals(tenant_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(tenant_id, stage);
CREATE INDEX IF NOT EXISTS deals_contact_idx ON deals(contact_id);

CREATE INDEX IF NOT EXISTS content_pieces_tenant_idx ON content_pieces(tenant_id);
CREATE INDEX IF NOT EXISTS content_pieces_status_idx ON content_pieces(tenant_id, status);
CREATE INDEX IF NOT EXISTS content_pieces_type_idx ON content_pieces(tenant_id, type);

CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS invoices_contact_idx ON invoices(contact_id);

CREATE INDEX IF NOT EXISTS social_posts_tenant_idx ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS social_posts_status_idx ON social_posts(tenant_id, status);
CREATE INDEX IF NOT EXISTS social_posts_scheduled_idx ON social_posts(scheduled_at) WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS call_logs_tenant_idx ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS call_logs_contact_idx ON call_logs(contact_id);

-- Vector similarity search indexes (IVFFlat for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS contacts_embedding_idx ON contacts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS content_embedding_idx ON content_pieces USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS call_transcript_embedding_idx ON call_logs USING ivfflat (transcript_embedding vector_cosine_ops) WITH (lists = 100);

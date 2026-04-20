-- Persist checkout payloads outside Stripe metadata limits.
CREATE TABLE IF NOT EXISTS checkout_contexts (
  order_id UUID PRIMARY KEY,
  reservation_group_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  address_to JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_contexts_reservation_group_id
  ON checkout_contexts(reservation_group_id);

CREATE INDEX IF NOT EXISTS idx_checkout_contexts_user_email
  ON checkout_contexts(user_email);

ALTER TABLE checkout_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage checkout contexts" ON checkout_contexts
  FOR ALL USING (auth.role() = 'service_role');

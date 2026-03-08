-- Add Shippo order ID to orders table for combined-shipment tracking
-- When multiple orders are combined into one Shippo order, all share this ID

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shippo_order_id TEXT;

COMMENT ON COLUMN public.orders.shippo_order_id IS 'Shippo order object_id when this order is fulfilled via Shippo (single or combined shipment).';

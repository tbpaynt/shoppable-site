-- Update tracking_info table to work with Shippo
alter table public.tracking_info
add column if not exists shippo_tracking_id text,
add column if not exists shippo_webhook_id text,
add column if not exists status text,
add column if not exists status_details jsonb,
add column if not exists location jsonb,
add column if not exists eta timestamp with time zone,
add column if not exists last_updated timestamp with time zone;

-- Create index for faster lookups
create index if not exists idx_tracking_info_shippo_tracking_id
on public.tracking_info(shippo_tracking_id);

-- Create function to handle tracking updates
create or replace function public.handle_tracking_update()
returns trigger as $$
begin
  -- Call the Edge Function
  perform
    net.http_post(
      url := current_setting('app.settings.tracking_notifications_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.tracking_notifications_key')
      ),
      body := jsonb_build_object(
        'type', TG_OP,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )
    );
  return NEW;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists on_tracking_update on public.tracking_info;
create trigger on_tracking_update
  after update on public.tracking_info
  for each row
  execute function public.handle_tracking_update();

-- Create the settings
alter database postgres set "app.settings.tracking_notifications_url" = 'https://your-project-ref.supabase.co/functions/v1/tracking-notifications';
alter database postgres set "app.settings.tracking_notifications_key" = 'your-anon-key'; 
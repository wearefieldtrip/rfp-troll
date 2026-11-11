-- When "Mark as sent" was clicked. questions_sent_on stays the day the team says it was sent, which can differ.
alter table public.rfps add column questions_sent_at timestamptz;

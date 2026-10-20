-- Each RFP gets its own Drive folder. Files are staged in Supabase Storage, then moved to Drive by the sync-rfp-folder function.
alter table public.rfps
  add column drive_folder_id text,
  add column drive_rfp_subfolder_id text,
  add column drive_folder_url text,
  add column drive_status text not null default 'pending'
    check (drive_status in ('pending', 'syncing', 'ready', 'failed')),
  add column drive_error text;

-- Set once a document has been copied into Drive; its storage_path then becomes 'drive:<file id>'.
alter table public.rfp_documents add column drive_file_id text;

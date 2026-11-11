-- Which version of the tagging instructions last tagged a past RFP, so a better prompt can re-tag the ones tagged by an older one.
alter table public.rfps add column ai_tag_version integer;

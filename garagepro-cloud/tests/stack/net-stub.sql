create schema if not exists net;
create table if not exists net.calls (id serial, url text, body jsonb, headers jsonb, at timestamptz default now());
create or replace function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql security definer as $$ insert into net.calls(url,body,headers) values (url,body,headers) returning id $$;
grant usage on schema net to anon, authenticated, service_role;

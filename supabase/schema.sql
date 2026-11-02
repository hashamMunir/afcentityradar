-- AFC Entity Radar — Supabase schema. Run once in Supabase → SQL Editor.
-- Principles: least privilege (Row Level Security everywhere), no screening queries stored,
-- usage counters keyed by account id or a daily-rotating hashed IP.

-- 1) Profiles: one row per user, created automatically at sign-up
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free','pro','team','enterprise')),
  use_type text not null default 'personal' check (use_type in ('personal','research','journalism','ngo','business')),
  stripe_customer_id text,
  stripe_subscription_id text,
  referred_by uuid references auth.users(id) on delete set null,
  bonus_checks int not null default 0 check (bonus_checks between 0 and 1000),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
-- No insert/update/delete policies: only the server (service role) and the trigger below can write.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- 2) Usage counters (no personal data: subject is "u:<user id>" or "a:<hashed ip>")
create table if not exists public.usage (
  subject text not null,
  period text not null,              -- 'YYYY-MM-DD' (anonymous) or 'YYYY-MM' (accounts)
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, period)
);
alter table public.usage enable row level security;   -- no policies: invisible to browsers
revoke all on public.usage from anon, authenticated;

-- 3) Atomic quota check: returns remaining checks after consuming one, or -1 if the limit is reached
create or replace function public.consume_check(p_subject text, p_period text, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.usage(subject, period, count) values (p_subject, p_period, 1)
  on conflict (subject, period) do update set count = public.usage.count + 1, updated_at = now()
    where public.usage.count < p_limit
  returning count into v;
  if v is null then return -1; end if;
  return p_limit - v;
end $$;
revoke all on function public.consume_check(text, text, int) from public, anon, authenticated;
grant execute on function public.consume_check(text, text, int) to service_role;

-- 4) Create the profile at sign-up; reward the referrer with 10 extra monthly checks (viral loop, capped)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref uuid; ut text;
begin
  ut := coalesce(new.raw_user_meta_data->>'use_type', 'personal');
  if ut not in ('personal','research','journalism','ngo','business') then ut := 'personal'; end if;
  begin ref := (new.raw_user_meta_data->>'referred_by')::uuid; exception when others then ref := null; end;
  if ref = new.id then ref := null; end if;
  insert into public.profiles(id, email, use_type, referred_by) values (new.id, new.email, ut, ref);
  if ref is not null then
    update public.profiles set bonus_checks = least(bonus_checks + 10, 500) where id = ref;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 5) Housekeeping: delete old usage rows (run daily with pg_cron if enabled, or manually)
create or replace function public.purge_old_usage() returns void language sql security definer set search_path = public as $$
  delete from public.usage where updated_at < now() - interval '120 days';
$$;
revoke all on function public.purge_old_usage() from public, anon, authenticated;

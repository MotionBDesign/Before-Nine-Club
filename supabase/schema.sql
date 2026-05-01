-- Before Nine Club Database Schema

-- Members table
create table members (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  phone text,
  stripe_customer_id text unique,
  subscription_status text default 'inactive' check (subscription_status in ('active', 'paused', 'cancelled', 'inactive')),
  subscription_id text,
  is_admin boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Events table
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date timestamp with time zone not null,
  location text,
  max_attendees integer,
  created_at timestamp with time zone default now()
);

-- RSVPs table
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(member_id, event_id)
);

-- Attendance tracking (actual attendance, not just RSVPs)
create table attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  attended boolean default false,
  checked_in_at timestamp with time zone,
  unique(member_id, event_id)
);

-- Subscription history (track pauses, changes)
create table subscription_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  action text not null check (action in ('subscribed', 'paused', 'resumed', 'cancelled', 'payment_failed', 'payment_succeeded')),
  stripe_event_id text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Row Level Security
alter table members enable row level security;
alter table events enable row level security;
alter table rsvps enable row level security;
alter table attendance enable row level security;
alter table subscription_history enable row level security;

-- Policies: Members can read their own data
create policy "Members can view own profile" on members
  for select using (auth.uid() = id);

create policy "Members can update own profile" on members
  for update using (auth.uid() = id);

-- Policies: Everyone can view events
create policy "Anyone can view events" on events
  for select using (true);

-- Policies: Admins can manage events
create policy "Admins can manage events" on events
  for all using (
    exists (select 1 from members where id = auth.uid() and is_admin = true)
  );

-- Policies: Members can manage their own RSVPs
create policy "Members can view own RSVPs" on rsvps
  for select using (member_id = auth.uid());

create policy "Members can manage own RSVPs" on rsvps
  for all using (member_id = auth.uid());

-- Policies: Admins can view all RSVPs
create policy "Admins can view all RSVPs" on rsvps
  for select using (
    exists (select 1 from members where id = auth.uid() and is_admin = true)
  );

-- Login tokens for magic link auth
create table login_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  token text unique not null,
  expires_at timestamp with time zone not null,
  used boolean default false,
  created_at timestamp with time zone default now()
);

-- Sessions for authenticated users
create table sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  token text unique not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Indexes
create index idx_members_email on members(email);
create index idx_members_stripe_customer on members(stripe_customer_id);
create index idx_events_date on events(event_date);
create index idx_rsvps_event on rsvps(event_id);
create index idx_rsvps_member on rsvps(member_id);
create index idx_login_tokens_token on login_tokens(token);
create index idx_sessions_token on sessions(token);

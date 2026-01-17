-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Enrollments (Teller connections)
create table enrollments (
  id uuid primary key default uuid_generate_v4(),
  teller_enrollment_id text unique not null,
  access_token text not null,
  institution text not null,
  institution_name text not null,
  created_at timestamptz default now(),
  last_polled_at timestamptz
);

-- Accounts
create table accounts (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid references enrollments(id) on delete cascade,
  teller_account_id text unique not null,
  name text not null,
  type text not null check (type in ('depository', 'credit')),
  subtype text not null,
  last_four text,
  is_liquid boolean default true,
  is_primary_payment boolean default false,
  payment_day_of_month int check (payment_day_of_month between 1 and 31),
  created_at timestamptz default now()
);

-- Balances (historical snapshots)
create table balances (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade,
  ledger decimal not null,
  available decimal,
  polled_at timestamptz default now()
);

-- Recurring rules
create table recurring_rules (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  amount decimal not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'once')),
  anchor_date date not null,
  end_date date,
  active boolean default true,
  created_at timestamptz default now()
);

-- Index for fast balance lookups
create index idx_balances_account_polled on balances(account_id, polled_at desc);

-- Index for projection queries
create index idx_rules_active on recurring_rules(active) where active = true;

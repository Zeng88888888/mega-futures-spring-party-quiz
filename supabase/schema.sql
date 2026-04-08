create extension if not exists pgcrypto;

create type game_mode as enum ('competition', 'survival');
create type game_status as enum ('draft', 'registering', 'live_question', 'round_result', 'ended');
create type player_status as enum ('waiting', 'active', 'submitted', 'eliminated', 'finished', 'invalid');
create type answer_status as enum ('correct', 'wrong', 'no_answer');

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists question_banks (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mode game_mode not null,
  status game_status not null default 'draft',
  join_code text not null unique,
  bank_id uuid references question_banks(id) on delete restrict,
  question_count integer not null check (question_count > 0),
  competition_seconds integer,
  current_round integer not null default 0,
  leaderboard_size integer not null default 10,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  nickname text not null,
  department text not null,
  employee_id text not null,
  status player_status not null default 'waiting',
  is_valid boolean not null default true,
  total_score integer not null default 0,
  total_response_ms integer not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, employee_id)
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references question_banks(id) on delete restrict,
  content text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  question_id uuid not null references questions(id) on delete restrict,
  order_no integer not null check (order_no > 0),
  unique (game_id, order_no),
  unique (game_id, question_id)
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  selected_option text check (selected_option in ('A', 'B', 'C', 'D')),
  answer_status answer_status not null default 'no_answer',
  is_correct boolean not null default false,
  response_ms integer,
  score integer not null default 0,
  answered_at timestamptz,
  unique (question_id, player_id)
);

create table if not exists round_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  published_at timestamptz,
  alive_count integer,
  eliminated_count integer,
  created_at timestamptz not null default now(),
  unique (game_id, round_no)
);

create table if not exists player_round_statuses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  answer_status answer_status not null,
  survived boolean not null default false,
  eliminated_in_round boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, player_id)
);

create index if not exists idx_players_game_status on players(game_id, status);
create index if not exists idx_players_game_valid on players(game_id, is_valid);
create index if not exists idx_answers_game_round on answers(game_id, round_no);
create index if not exists idx_round_results_game_round on round_results(game_id, round_no);
create index if not exists idx_questions_bank_id on questions(bank_id);
create index if not exists idx_games_bank_id on games(bank_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_games_updated_at on games;
create trigger trg_games_updated_at
before update on games
for each row
execute function set_updated_at();

drop trigger if exists trg_players_updated_at on players;
create trigger trg_players_updated_at
before update on players
for each row
execute function set_updated_at();

drop trigger if exists trg_questions_updated_at on questions;
create trigger trg_questions_updated_at
before update on questions
for each row
execute function set_updated_at();

drop trigger if exists trg_question_banks_updated_at on question_banks;
create trigger trg_question_banks_updated_at
before update on question_banks
for each row
execute function set_updated_at();

alter table question_banks enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table questions enable row level security;
alter table game_questions enable row level security;
alter table answers enable row level security;
alter table round_results enable row level security;
alter table player_round_statuses enable row level security;

drop policy if exists "Public can read live game basics" on games;
create policy "Public can read live game basics"
on games
for select
using (true);

drop policy if exists "Public can read question banks" on question_banks;
drop policy if exists "Public can read active questions" on questions;

drop policy if exists "Public can read visible players" on players;
drop policy if exists "Public can read game questions" on game_questions;
drop policy if exists "Public can read published round results" on round_results;
drop policy if exists "Public can read player round status" on player_round_statuses;

drop policy if exists "Prototype can insert games" on games;
drop policy if exists "Prototype can update games" on games;
drop policy if exists "Prototype can manage question banks" on question_banks;
drop policy if exists "Prototype can insert players" on players;
drop policy if exists "Prototype can update players" on players;
drop policy if exists "Prototype can manage questions" on questions;
drop policy if exists "Prototype can manage game questions" on game_questions;
drop policy if exists "Prototype can manage answers" on answers;
drop policy if exists "Prototype can manage round results" on round_results;
drop policy if exists "Prototype can manage player round statuses" on player_round_statuses;

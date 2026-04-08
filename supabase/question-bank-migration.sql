create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games add column if not exists bank_id uuid references public.question_banks(id) on delete restrict;
alter table public.questions add column if not exists bank_id uuid references public.question_banks(id) on delete restrict;

create index if not exists idx_questions_bank_id on public.questions(bank_id);
create index if not exists idx_games_bank_id on public.games(bank_id);

do $$
declare
  default_bank_id uuid;
begin
  insert into public.question_banks (title, description)
  values ('題庫一', '預設題庫')
  on conflict (title) do nothing;

  select id into default_bank_id from public.question_banks where title = '題庫一' limit 1;

  update public.questions
  set bank_id = default_bank_id
  where bank_id is null;

  update public.games
  set bank_id = default_bank_id
  where bank_id is null;
end $$;

alter table public.question_banks enable row level security;

drop trigger if exists trg_question_banks_updated_at on public.question_banks;
create trigger trg_question_banks_updated_at
before update on public.question_banks
for each row
execute function public.set_updated_at();

drop policy if exists "Public can read question banks" on public.question_banks;
drop policy if exists "Prototype can manage question banks" on public.question_banks;

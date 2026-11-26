-- Rotina — rode UMA vez no Supabase: SQL Editor > New query > colar > Run
-- Cria as tabelas das demandas e das anotações. Os dados são PRIVADOS de cada usuário (cada um vê só os seus).

create table if not exists public.rot_demandas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text not null,
  descricao text,
  data date not null,
  hora text,                                           -- 'HH:MM' (opcional)
  prioridade text not null default 'media' check (prioridade in ('alta','media','baixa')),
  foco boolean not null default false,
  concluida boolean not null default false,
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rot_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text,
  texto text,
  cor text not null default 'amarelo' check (cor in ('amarelo','azul','verde','rosa','cinza')),
  fixada boolean not null default false,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rot_demandas_user_data_idx on public.rot_demandas (user_id, data);
create index if not exists rot_notas_user_idx on public.rot_notas (user_id, created_at desc);

alter table public.rot_demandas enable row level security;
alter table public.rot_notas enable row level security;

drop policy if exists "rot_demandas_dono" on public.rot_demandas;
create policy "rot_demandas_dono" on public.rot_demandas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "rot_notas_dono" on public.rot_notas;
create policy "rot_notas_dono" on public.rot_notas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

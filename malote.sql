-- Malote NF — rode UMA vez no Supabase: SQL Editor > New query > colar > Run
-- Cria as tabelas do malote e as regras de acesso (mesmo esquema de workspace compartilhado do site).

create table if not exists public.orc_malotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text,
  ano int not null,
  mes int not null check (mes between 0 and 11),      -- 0 = janeiro ... 11 = dezembro
  semana int not null check (semana between 1 and 5), -- semana do mês
  created_at timestamptz not null default now()
);

create table if not exists public.orc_malote_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  malote_id uuid not null references public.orc_malotes(id) on delete cascade,
  nf text not null,
  fornecedor text not null,
  data_compra date not null,
  data_vencimento date not null,
  created_at timestamptz not null default now()
);

create index if not exists orc_malote_notas_malote_idx on public.orc_malote_notas (malote_id);
create index if not exists orc_malotes_periodo_idx on public.orc_malotes (ano, mes, semana);

alter table public.orc_malotes enable row level security;
alter table public.orc_malote_notas enable row level security;

drop policy if exists "malotes_workspace" on public.orc_malotes;
create policy "malotes_workspace" on public.orc_malotes
  for all to authenticated
  using (user_id = coalesce(public.orc_workspace_id(), auth.uid()))
  with check (user_id = coalesce(public.orc_workspace_id(), auth.uid()));

drop policy if exists "malote_notas_workspace" on public.orc_malote_notas;
create policy "malote_notas_workspace" on public.orc_malote_notas
  for all to authenticated
  using (user_id = coalesce(public.orc_workspace_id(), auth.uid()))
  with check (user_id = coalesce(public.orc_workspace_id(), auth.uid()));

grant select, insert, update, delete on public.orc_malotes to authenticated;
grant select, insert, update, delete on public.orc_malote_notas to authenticated;

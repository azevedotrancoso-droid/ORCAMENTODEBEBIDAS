-- Administrativo (RNC e Recusa/Devolução) — rode UMA vez no Supabase: SQL Editor > New query > colar > Run
-- Mesmo esquema de workspace compartilhado do restante do site (função public.orc_workspace_id()).

create table if not exists public.orc_relatorios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null check (tipo in ('RNC','RDM')),   -- RNC = não conformidade | RDM = recusa e devolução de mercadoria
  ano int not null,
  seq int not null,                                   -- sequência dentro do tipo e do ano
  numero text not null,                               -- ex.: RNC-2026-0001
  status text not null default 'aberto',
  fornecedor text,
  nf text,
  data_ref date,                                      -- data de abertura (RNC) ou do relatório (RDM)
  valor numeric(14,2) not null default 0,             -- valor afetado (RNC) ou recusado/devolvido (RDM)
  resumo text,
  dados jsonb not null default '{}'::jsonb,           -- conteúdo completo do relatório
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists orc_relatorios_numero_uq on public.orc_relatorios (user_id, tipo, ano, seq);
create index if not exists orc_relatorios_lista_idx on public.orc_relatorios (user_id, tipo, ano, data_ref desc);

alter table public.orc_relatorios enable row level security;

drop policy if exists "relatorios_workspace" on public.orc_relatorios;
create policy "relatorios_workspace" on public.orc_relatorios
  for all to authenticated
  using (user_id = coalesce(public.orc_workspace_id(), auth.uid()))
  with check (user_id = coalesce(public.orc_workspace_id(), auth.uid()));

grant select, insert, update, delete on public.orc_relatorios to authenticated;

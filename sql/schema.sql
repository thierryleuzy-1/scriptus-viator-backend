-- Scriptus Viator — schéma Supabase (Postgres)
-- À coller intégralement dans l'éditeur SQL de Supabase (voir README.md, étape 3).
-- Peut être exécuté plusieurs fois sans danger (IF NOT EXISTS partout).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- persons : une ligne par personne à qui Thierry donne accès à l'app, via un
-- lien unique (slug) créé depuis la page d'administration — jamais par la
-- personne elle-même.
-- ---------------------------------------------------------------------------
create table if not exists persons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- projects : le(s) projet(s) poïétique(s) d'une personne. Une seule ligne
-- avec status='active' par personne à la fois (appliqué côté application,
-- voir lib/storage.ts — pas une contrainte SQL stricte, pour rester simple).
--
-- entries (jsonb) porte exactement la forme produite par blankEntries() /
-- normalizeEntries() dans l'artefact « Scriptus Viator — Base » :
--   { inception: {sessions:[...], experience:{checkins:[...]}, compilation:null|{...}},
--     gestation: {...}, creation: {...}, "mise-au-monde": {...}, "post-partum": {...},
--     naissance: {metaAnalyse:{poietique:null|{...}, praxeologique:null|{...}}},
--     experienceGlobale: {journal:[...]} }
--
-- stage_status et phase_text_overrides portent les deux champs de PROJECT
-- (dans l'artefact Base) qui n'étaient pas prévus dans les colonnes listées
-- au départ dans le cahier des charges — voir la note « choix de jugement »
-- dans le résumé final.
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  poietic_title text,
  working_title text,
  genre text,
  started text,
  author_name text,
  place text,
  entries jsonb not null,
  stage_status jsonb,
  phase_text_overrides jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);

create index if not exists projects_person_id_idx on projects(person_id);
create index if not exists projects_person_status_idx on projects(person_id, status);

-- ---------------------------------------------------------------------------
-- praxeologie_entries : la praxéologie est globale PAR PERSONNE (pas par
-- projet) — cohérent avec « une méthode qui se précise projet après projet ».
-- ---------------------------------------------------------------------------
create table if not exists praxeologie_entries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  d text,
  stage text,
  type text not null check (type in ('probleme', 'decouverte', 'apprentissage')),
  status text check (status in ('ouvert', 'resolu')),
  text text not null,
  created_at timestamptz default now()
);

create index if not exists praxeologie_entries_person_id_idx on praxeologie_entries(person_id);

-- ---------------------------------------------------------------------------
-- coaching_notes : une note de Thierry par étape (les cinq étapes-témoignage +
-- "naissance") et par personne — un outil d'accompagnement, visible par la
-- personne elle-même dans sa propre app. Écrire à nouveau remplace la note
-- existante (upsert sur la contrainte unique ci-dessous), jamais d'historique.
-- ---------------------------------------------------------------------------
create table if not exists coaching_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  phase_key text not null check (phase_key in ('inception','gestation','creation','mise-au-monde','post-partum','naissance')),
  text text not null default '',
  updated_at timestamptz default now(),
  unique (person_id, phase_key)
);
create index if not exists coaching_notes_person_id_idx on coaching_notes(person_id);

-- ---------------------------------------------------------------------------
-- Pas de RLS activé : le backend n'appelle Supabase que depuis le serveur,
-- avec la clé de service (SUPABASE_SERVICE_KEY), jamais depuis le navigateur.
-- Si tu actives un jour RLS sur ces tables, le backend continuera de
-- fonctionner (la clé de service contourne RLS), mais toute requête directe
-- depuis le navigateur avec la clé publique serait alors bloquée par défaut.
-- ---------------------------------------------------------------------------

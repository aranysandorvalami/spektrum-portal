-- =====================================================================
-- Spektrum Managers – közös Supabase séma (portál + 5 app)
-- Appok: concert, budget, library, network, rider
-- Minden munkatér (régi "partíció" / "adatbázis") adata egy jsonb dokumentum,
-- pontosan abban a formában, ahogy a régi /api/data visszaadta.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- TÁBLÁK
-- ---------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique check (length(btrim(username)) between 2 and 60),
  display_name  text,
  email         text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'disabled')),
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.app_roles (
  app         text not null check (app in ('concert', 'budget', 'library', 'network', 'rider')),
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name        text not null,
  description text,
  is_system   boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  primary key (app, key)
);

create table public.app_members (
  app     text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role    text not null,
  primary key (app, user_id),
  foreign key (app, role) references public.app_roles (app, key) on update cascade
);

create table public.app_settings (
  app               text primary key check (app in ('concert', 'budget', 'library', 'network', 'rider')),
  default_workspace text not null
);

create table public.user_prefs (
  user_id             uuid not null references public.profiles (id) on delete cascade,
  app                 text not null,
  preferred_workspace text,
  primary key (user_id, app)
);

create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  app        text not null check (app in ('concert', 'budget', 'library', 'network', 'rider')),
  name       text not null check (name ~ '^[a-z0-9_\-]{1,60}$'),
  title      text not null,
  subtitle   text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (app, name)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (workspace_id, user_id)
);

create table public.access_requests (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- A régi rendszerből átvett jogosultságok: amikor valaki ezzel az e-mail címmel
-- regisztrál, automatikusan megkapja őket. Kliensről nem olvasható.
create table public.pending_grants (
  email         text primary key,
  username      text,
  display_name  text,
  is_superadmin boolean not null default false,
  apps          jsonb not null default '{}'::jsonb  -- {"concert": {"role": "admin", "workspaces": ["turne_2026"]}, ...}
);

create index on public.app_members (user_id);
create index on public.workspace_members (user_id);
create index on public.access_requests (user_id);

-- ---------------------------------------------------------------------
-- SEGÉDFÜGGVÉNYEK (security definer, hogy az RLS ne hívja önmagát rekurzívan)
-- ---------------------------------------------------------------------

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved');
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.status = 'approved' and p.is_superadmin);
$$;

-- A bejelentkezett felhasználó szerepköre egy appban (nincs külön beállítva → editor)
create or replace function public.app_role(p_app text)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not public.is_approved() then null
    when public.is_superadmin() then 'superadmin'
    else coalesce((select m.role from public.app_members m where m.app = p_app and m.user_id = auth.uid()), 'editor')
  end;
$$;

create or replace function public.has_perm(p_app text, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when public.is_superadmin() then true
    when not public.is_approved() then false
    else coalesce((select (r.permissions ->> p_perm)::boolean from public.app_roles r
                   where r.app = p_app and r.key = public.app_role(p_app)), false)
  end;
$$;

-- Az appok a szerkesztési jogot más-más kulccsal hívják
create or replace function public.edit_perm_key(p_app text)
returns text language sql immutable set search_path = '' as $$
  select case p_app
    when 'concert' then 'can_edit_concerts'
    when 'budget'  then 'can_edit'
    when 'rider'   then 'can_edit_riders'
    else 'can_edit_devices'
  end;
$$;

create or replace function public.is_ws_member(p_ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_superadmin()
      or (public.is_approved() and exists (
            select 1 from public.workspace_members wm where wm.workspace_id = p_ws and wm.user_id = auth.uid()));
$$;

create or replace function public.can_edit_ws(p_ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_ws_member(p_ws)
     and coalesce((select public.app_role(w.app) <> 'viewer' and public.has_perm(w.app, public.edit_perm_key(w.app))
                   from public.workspaces w where w.id = p_ws), false);
$$;

create or replace function public.manages_ws(p_ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_superadmin()
      or (public.is_ws_member(p_ws)
          and coalesce((select public.has_perm(w.app, 'can_manage_dbs') from public.workspaces w where w.id = p_ws), false));
$$;

-- Látja-e a bejelentkezett felhasználó ezt a profilt (saját, főadmin, vagy kérelmező az általa kezelt munkatérre)
create or replace function public.can_see_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid()
      or public.is_superadmin()
      or exists (select 1 from public.access_requests ar
                 where ar.user_id = p_user and public.manages_ws(ar.workspace_id));
$$;

-- ---------------------------------------------------------------------
-- TRIGGEREK
-- ---------------------------------------------------------------------

-- Új regisztráció → profil (pending); ha van régi jogosultság az e-mailhez, azonnal alkalmazza
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_username text;
  v_display  text;
  v_grant    public.pending_grants%rowtype;
  v_app      text;
  v_cfg      jsonb;
  v_ws       text;
begin
  select * into v_grant from public.pending_grants g where lower(g.email) = lower(new.email);

  v_username := coalesce(nullif(btrim(v_grant.username), ''),
                         nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
                         split_part(new.email, '@', 1));
  v_display  := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
                         nullif(btrim(v_grant.display_name), ''), v_username);

  -- egyedi felhasználónév biztosítása
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := v_username || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username, display_name, email, status, is_superadmin)
  values (new.id, v_username, v_display, lower(new.email),
          case when v_grant.email is not null then 'approved' else 'pending' end,
          coalesce(v_grant.is_superadmin, false));

  if v_grant.email is not null then
    for v_app, v_cfg in select * from jsonb_each(v_grant.apps) loop
      if v_cfg ? 'role' and exists (select 1 from public.app_roles r where r.app = v_app and r.key = v_cfg ->> 'role') then
        insert into public.app_members (app, user_id, role) values (v_app, new.id, v_cfg ->> 'role')
        on conflict do nothing;
      end if;
      for v_ws in select jsonb_array_elements_text(coalesce(v_cfg -> 'workspaces', '[]'::jsonb)) loop
        insert into public.workspace_members (workspace_id, user_id)
        select w.id, new.id from public.workspaces w where w.app = v_app and w.name = v_ws
        on conflict do nothing;
      end loop;
    end loop;
    delete from public.pending_grants where email = v_grant.email;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- E-mail cím változás (megerősítés után) → profil szinkron
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Saját profil szerkesztésekor a státuszt, főadmin jogot és e-mailt nem lehet átírni
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_superadmin() then
    if new.id = auth.uid() and old.is_superadmin and not new.is_superadmin then
      raise exception 'Saját főadmin jogodat nem veheted el.';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.is_superadmin is distinct from old.is_superadmin
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Ehhez a mezőhöz nincs jogosultságod.';
  end if;
  return new;
end;
$$;

create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Munkatér mentésekor rögzítjük, ki és mikor módosította
create or replace function public.touch_workspace()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger touch_workspace
  before update on public.workspaces
  for each row execute function public.touch_workspace();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.app_roles         enable row level security;
alter table public.app_members       enable row level security;
alter table public.app_settings      enable row level security;
alter table public.user_prefs        enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.access_requests   enable row level security;
alter table public.pending_grants    enable row level security;  -- nincs policy → kliensről elérhetetlen

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_see_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_super on public.profiles for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- app_roles
create policy app_roles_select on public.app_roles for select to authenticated
  using (public.is_approved());
create policy app_roles_write on public.app_roles for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- app_members
create policy app_members_select on public.app_members for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin());
create policy app_members_write on public.app_members for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- app_settings
create policy app_settings_select on public.app_settings for select to authenticated
  using (public.is_approved());
create policy app_settings_write on public.app_settings for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- user_prefs
create policy user_prefs_own on public.user_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_approved());

-- workspaces
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_ws_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.can_edit_ws(id)) with check (public.can_edit_ws(id));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (public.is_superadmin());
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.is_superadmin());

-- Sima tagok csak a tartalmat írhatják, az azonosítót / appot / nevet nem
revoke update on public.workspaces from authenticated, anon;
grant update (title, subtitle, data) on public.workspaces to authenticated;

-- workspace_members
create policy wm_select on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.manages_ws(workspace_id));
create policy wm_write on public.workspace_members for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- access_requests
create policy ar_select on public.access_requests for select to authenticated
  using (user_id = auth.uid() or public.manages_ws(workspace_id));
create policy ar_insert on public.access_requests for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved()
              and not exists (select 1 from public.workspace_members wm
                              where wm.workspace_id = access_requests.workspace_id and wm.user_id = auth.uid()));
create policy ar_delete on public.access_requests for delete to authenticated
  using (user_id = auth.uid() or public.manages_ws(workspace_id));

-- anon semmit nem lát
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- RPC-K
-- ---------------------------------------------------------------------

-- Az összes munkatér neve egy appban (csatlakozási kérelemhez) – tartalom nélkül
create or replace function public.list_workspace_names(p_app text)
returns table (name text) language sql stable security definer set search_path = '' as $$
  select w.name from public.workspaces w
  where w.app = p_app and public.is_approved()
  order by w.name;
$$;

-- Csatlakozási kérelem elbírálása (főadmin, vagy a munkatér adminja)
create or replace function public.decide_access_request(p_app text, p_ws_name text, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid;
begin
  select id into v_ws from public.workspaces where app = p_app and name = p_ws_name;
  if v_ws is null then raise exception 'Nincs ilyen munkatér.'; end if;
  if not public.manages_ws(v_ws) then raise exception 'Ez a munkatér nem tartozik a felügyeleted alá!'; end if;
  if not exists (select 1 from public.access_requests where workspace_id = v_ws and user_id = p_user) then
    raise exception 'Nincs ilyen kérelem.';
  end if;
  delete from public.access_requests where workspace_id = v_ws and user_id = p_user;
  if p_approve then
    insert into public.workspace_members (workspace_id, user_id) values (v_ws, p_user) on conflict do nothing;
  end if;
end;
$$;

-- Munkatárs beállítása egy appban (főadmin): név, szerepkör, munkaterek
create or replace function public.admin_save_app_user(
  p_app text, p_user uuid, p_username text, p_display_name text, p_role text, p_workspaces text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_superadmin() then raise exception 'Csak Főadminisztrátor jogosult!'; end if;
  if p_user = auth.uid() and p_role <> 'superadmin' then
    raise exception 'Saját főadmin jogodat nem veheted el.';
  end if;

  update public.profiles
     set username = coalesce(nullif(btrim(p_username), ''), username),
         display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
         is_superadmin = (p_role = 'superadmin')
   where id = p_user;

  if p_role = 'superadmin' then
    delete from public.app_members where app = p_app and user_id = p_user;
  else
    insert into public.app_members (app, user_id, role) values (p_app, p_user, p_role)
    on conflict (app, user_id) do update set role = excluded.role;
  end if;

  delete from public.workspace_members wm
   using public.workspaces w
   where wm.workspace_id = w.id and w.app = p_app and wm.user_id = p_user;
  insert into public.workspace_members (workspace_id, user_id)
  select w.id, p_user from public.workspaces w
   where w.app = p_app and w.name = any (coalesce(p_workspaces, '{}'))
  on conflict do nothing;
end;
$$;

-- Hozzáférés megvonása egy appból (az app "törlés" gombja)
create or replace function public.admin_remove_app_user(p_app text, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_superadmin() then raise exception 'Csak Főadminisztrátor jogosult!'; end if;
  if p_user = auth.uid() then raise exception 'Saját fiókodat nem törölheted!'; end if;
  delete from public.app_members where app = p_app and user_id = p_user;
  delete from public.workspace_members wm using public.workspaces w
   where wm.workspace_id = w.id and w.app = p_app and wm.user_id = p_user;
  delete from public.access_requests ar using public.workspaces w
   where ar.workspace_id = w.id and w.app = p_app and ar.user_id = p_user;
end;
$$;

-- Új munkatér (főadmin), a létrehozó automatikusan tag lesz
create or replace function public.create_workspace(p_app text, p_name text, p_title text, p_subtitle text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid;
begin
  if not public.is_superadmin() then raise exception 'Csak Főadminisztrátor hozhat létre új munkateret!'; end if;
  insert into public.workspaces (app, name, title, subtitle)
  values (p_app, p_name, p_title, p_subtitle)
  on conflict (app, name) do nothing
  returning id into v_ws;
  if v_ws is null then raise exception 'Ilyen nevű munkatér már létezik.'; end if;
  insert into public.workspace_members (workspace_id, user_id) values (v_ws, auth.uid()) on conflict do nothing;
end;
$$;

-- Csatlakozási kérelem leadása (a kérelmező nem látja a munkatér azonosítóját, csak a nevét)
create or replace function public.request_access(p_app text, p_ws_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid;
begin
  if not public.is_approved() then raise exception 'A fiókod még nincs jóváhagyva.'; end if;
  select id into v_ws from public.workspaces where app = p_app and name = p_ws_name;
  if v_ws is null then raise exception 'Nincs ilyen munkatér.'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = v_ws and user_id = auth.uid()) then
    raise exception 'Már van hozzáférésed ehhez a munkatérhez.';
  end if;
  insert into public.access_requests (workspace_id, user_id) values (v_ws, auth.uid()) on conflict do nothing;
end;
$$;

-- Belépés felhasználónévvel: a felhasználónévhez tartozó e-mail cím (bejelentkezés előtt hívható)
create or replace function public.login_email(p_login text)
returns text language sql stable security definer set search_path = '' as $$
  select email from public.profiles where lower(username) = lower(btrim(p_login)) limit 1;
$$;

-- Egy munkatér lehetséges feladat-felelősei: jóváhagyott tagok és főadminok (e-mail cím nélkül)
create or replace function public.list_assignable_users(p_app text, p_ws_name text)
returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, coalesce(nullif(p.display_name, ''), p.username)
  from public.workspaces w
  join public.profiles p on p.status = 'approved'
   and (p.is_superadmin or exists (select 1 from public.workspace_members wm
                                   where wm.workspace_id = w.id and wm.user_id = p.id))
  where w.app = p_app and w.name = p_ws_name and public.is_ws_member(w.id)
  order by 3;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.login_email(text) to anon, authenticated;
grant execute on function public.list_assignable_users(text, text) to authenticated;
grant execute on function public.is_approved(), public.is_superadmin(), public.app_role(text),
  public.has_perm(text, text), public.edit_perm_key(text), public.is_ws_member(uuid), public.can_edit_ws(uuid),
  public.manages_ws(uuid), public.can_see_profile(uuid), public.list_workspace_names(text), public.request_access(text, text),
  public.decide_access_request(text, text, uuid, boolean),
  public.admin_save_app_user(text, uuid, text, text, text, text[]),
  public.admin_remove_app_user(text, uuid), public.create_workspace(text, text, text, text)
  to authenticated;

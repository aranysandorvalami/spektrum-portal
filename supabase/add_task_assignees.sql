-- Feladat-felelősök – futtasd le egyszer a Supabase Dashboard → SQL Editor-ban.
-- Egy munkatér lehetséges felelősei: a munkatér jóváhagyott tagjai és a főadminok
-- (csak név és felhasználónév, e-mail cím nélkül). Csak a munkatér tagja hívhatja.

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

revoke execute on function public.list_assignable_users(text, text) from public, anon;
grant execute on function public.list_assignable_users(text, text) to authenticated;

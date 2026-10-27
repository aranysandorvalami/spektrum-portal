-- Belépés felhasználónévvel – futtasd le egyszer a Supabase Dashboard → SQL Editor-ban.
-- A felhasználónévhez tartozó e-mail címet adja vissza, így a portál azzal léptet be.

create or replace function public.login_email(p_login text)
returns text language sql stable security definer set search_path = '' as $$
  select email from public.profiles where lower(username) = lower(btrim(p_login)) limit 1;
$$;

revoke execute on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;

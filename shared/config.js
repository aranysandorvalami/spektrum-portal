// Supabase kapcsolat – a Supabase Dashboard → Project Settings → API oldalról.
// A "publishable" / "anon" kulcs nyilvános, nyugodtan lehet itt (az adatokat az RLS védi).
// SOHA ne tegyél ide "service_role" / "secret" kulcsot!
window.SPEKTRUM_CONFIG = {
  supabaseUrl: "https://casnrnyniowcamjtctnv.supabase.co",
  supabaseKey: "IDE_JON_A_PUBLISHABLE_KULCS"
};

// Supabase kapcsolat – a Supabase Dashboard → Project Settings → API oldalról.
// A "publishable" / "anon" kulcs nyilvános, nyugodtan lehet itt (az adatokat az RLS védi).
// SOHA ne tegyél ide "service_role" / "secret" kulcsot!
window.SPEKTRUM_CONFIG = {
  supabaseUrl: "https://jhpgrpefreyiwcfxpvra.supabase.co",
  supabaseKey: "sb_publishable_aQfhekeLZnrNEajyLxaqZQ_2jzL2a5J"
};

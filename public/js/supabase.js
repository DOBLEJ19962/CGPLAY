// public/js/supabase.js
// Cliente global de Supabase (solo ANON key).
// NO pongas aquí la SERVICE_ROLE_KEY.

(function () {
  const SUPABASE_URL = "https://esgaqcsgilnvbfmkyxvf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ2FxY3NnaWxudmJmbWt5eHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MjA0NjAsImV4cCI6MjA4NjA5NjQ2MH0.SAQISHaSh2WkxfWFWcDmB9y-Q7B5LVZRg-TidS6Fh00";

  // Supabase JS v2 expone: window.supabase.createClient
  if (!window.supabase || !window.supabase.createClient) {
    console.error(
      "Supabase library no está cargada. Asegúrate de incluir @supabase/supabase-js antes de este archivo."
    );
    return;
  }

  // Cliente global
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Exponer globalmente
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  window.sb = client;

  // Helpers útiles (opcionales)
  window.sbAuth = {
    signUp: (email, password) => client.auth.signUp({ email, password }),
    signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
    signOut: () => client.auth.signOut(),
    getSession: () => client.auth.getSession(),
    getUser: () => client.auth.getUser(),
    onAuthStateChange: (cb) => client.auth.onAuthStateChange(cb),
  };

  console.log("✅ Supabase listo (window.sb)");
})();

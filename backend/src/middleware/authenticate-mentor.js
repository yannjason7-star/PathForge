const { createClient } = require('@supabase/supabase-js');

function authenticateMentor(request, response, next) {
  void authenticate(request, response).then(next).catch(next);
}

async function authenticate(request, response) {
  const authorization = request.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw httpError(401, 'Authentification requise.');
  }

  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être configurées.');
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${match[1]}` },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !authData.user) {
    throw httpError(401, 'Session invalide ou expirée.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, status, first_name, last_name')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.role !== 'mentor') {
    throw httpError(403, 'Accès réservé aux mentors.');
  }
  if (profile.status !== 'active') {
    throw httpError(403, 'Votre compte mentor n’est pas encore actif.');
  }

  request.supabase = supabase;
  request.mentor = profile;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = { authenticateMentor, httpError };

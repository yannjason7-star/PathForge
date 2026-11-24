require('dotenv').config();

const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être configurées dans backend/.env.');
  }

  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const email = (await prompt.question('Email du compte Mentor actif : ')).trim();
  prompt.close();

  if (!email) throw new Error('Une adresse email est requise.');
  const password = await readHidden('Mot de passe (saisie masquée) : ');
  if (!password) throw new Error('Un mot de passe est requis.');

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error('Connexion refusée ; vérifie les identifiants du compte Mentor.');
  }

  const apiUrl = (process.env.MENTOR_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${data.session.access_token}` };

  try {
    const dashboard = await getJson(apiUrl, '/api/mentor/dashboard', headers);
    console.log(`GET /api/mentor/dashboard : ${dashboard.status}`);

    const menteesResponse = await getJson(apiUrl, '/api/mentor/incubes', headers);
    const mentees = menteesResponse.body.incubés;
    if (!Array.isArray(mentees)) throw new Error('La réponse de la liste des incubés est invalide.');
    console.log(`GET /api/mentor/incubes : ${menteesResponse.status} (${mentees.length} incubé(s))`);

    const availability = await getJson(apiUrl, '/api/mentor/availability', headers);
    console.log(`GET /api/mentor/availability : ${availability.status}`);

    const appointments = await getJson(apiUrl, '/api/mentor/appointments', headers);
    console.log(`GET /api/mentor/appointments : ${appointments.status}`);

    if (mentees.length > 0) {
      const incubeId = mentees[0].id;
      const detail = await getJson(apiUrl, `/api/mentor/incubes/${incubeId}`, headers);
      console.log(`GET /api/mentor/incubes/:incubeId : ${detail.status}`);

      const messages = await getJson(apiUrl, `/api/mentor/messages/${incubeId}`, headers);
      console.log(`GET /api/mentor/messages/:incubeId : ${messages.status}`);

      const deliverableId = detail.body.livrables?.[0]?.id;
      if (deliverableId) {
        const download = await getJson(
          apiUrl,
          `/api/mentor/deliverables/${deliverableId}/download`,
          headers,
        );
        if (typeof download.body.url !== 'string') {
          throw new Error('La route du livrable n’a pas renvoyé d’URL signée.');
        }
        console.log(`GET /api/mentor/deliverables/:deliverableId/download : ${download.status}`);
      }
    }

    console.log('Vérification terminée ; aucune donnée n’a été modifiée.');
  } finally {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

async function getJson(baseUrl, path, headers) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${path} a renvoyé une réponse qui n’est pas du JSON.`);
  }

  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : 'Erreur API sans détail.';
    throw new Error(`${path} a renvoyé HTTP ${response.status} : ${message}`);
  }

  return { status: response.status, body };
}

function readHidden(message) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Lance ce script dans un terminal interactif.'));
  }

  return new Promise((resolve, reject) => {
    const previousRawMode = stdin.isRaw;
    let password = '';

    function finish(error) {
      stdin.removeListener('data', onData);
      stdin.setRawMode(previousRawMode);
      if (!previousRawMode) stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    }

    function onData(buffer) {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') {
          finish(new Error('Saisie annulée.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          password = Array.from(password).slice(0, -1).join('');
          continue;
        }
        password += character;
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
    stdout.write(message);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

const { randomUUID } = require('node:crypto');
const express = require('express');
const { google } = require('googleapis');
const { z } = require('zod');
const { authenticateMentor, httpError } = require('../middleware/authenticate-mentor');

const mentorRouter = express.Router();
const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

const uuidSchema = z.string().uuid();
const feedbackSchema = z.object({
  feedback: z.string().trim().min(1).max(3000),
});
const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timeZone: z.string().trim().min(1).max(64),
}).refine((value) => value.startTime < value.endTime, {
  message: 'L’heure de fin doit être après l’heure de début.',
  path: ['endTime'],
}).refine((value) => isValidTimeZone(value.timeZone), {
  message: 'Le fuseau horaire doit être un identifiant IANA valide.',
  path: ['timeZone'],
});
const messageSchema = z.object({
  incubeId: uuidSchema,
  content: z.string().trim().min(1).max(5000),
});
const appointmentStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

mentorRouter.use(authenticateMentor);

mentorRouter.get('/dashboard', asyncHandler(async (request, response) => {
  const { supabase, mentor } = request;
  const projects = await getAssignedProjects(supabase, mentor.id);
  const now = new Date();
  const { start, end } = currentWeekRange(now);
  const [appointments, unreadMessages, notifications] = await Promise.all([
    supabase.from('appointments')
      .select('id, incube_id, date_time, status')
      .eq('mentor_id', mentor.id)
      .in('status', ['accepted', 'pending'])
      .gte('date_time', start)
      .lt('date_time', end)
      .order('date_time', { ascending: true }),
    supabase.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', mentor.id)
      .is('read_at', null),
    supabase.from('notifications')
      .select('id, kind, title, body, entity_id, created_at, read_at')
      .eq('user_id', mentor.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  throwIfError(appointments.error);
  throwIfError(unreadMessages.error);
  throwIfError(notifications.error);

  response.json({
    mentor: {
      id: mentor.id,
      firstName: mentor.first_name,
      lastName: mentor.last_name,
    },
    stats: {
      incubésSuivis: new Set(projects.map((project) => project.incube_id)).size,
      rendezVousSemaine: (appointments.data || []).length,
      messagesNonLus: unreadMessages.count || 0,
    },
    prochainsRendezVous: appointments.data || [],
    alertes: notifications.data || [],
  });
}));

mentorRouter.get('/incubes', asyncHandler(async (request, response) => {
  const projects = await getAssignedProjects(request.supabase, request.mentor.id);
  const mentees = await buildMenteeSummaries(request.supabase, projects);
  response.json({ incubés: mentees });
}));

mentorRouter.get('/incubes/:incubeId', asyncHandler(async (request, response) => {
  const incubeId = parseUuid(request.params.incubeId);
  const projects = await getAssignedProjects(request.supabase, request.mentor.id);
  const menteeProjects = projects.filter((project) => project.incube_id === incubeId);
  if (menteeProjects.length === 0) throw httpError(404, 'Incubé introuvable.');

  const [profileResult, progressionResult, deliverableResult] = await Promise.all([
    request.supabase.from('profiles')
      .select('id, first_name, last_name')
      .eq('id', incubeId)
      .maybeSingle(),
    request.supabase.from('progressions')
      .select('id, formation_id, is_completed')
      .eq('user_id', incubeId),
    request.supabase.from('deliverables')
      .select('id, project_id, file_url, feedback_mentor, created_at')
      .in('project_id', menteeProjects.map((project) => project.id))
      .order('created_at', { ascending: false }),
  ]);
  throwIfError(profileResult.error);
  throwIfError(progressionResult.error);
  throwIfError(deliverableResult.error);
  if (!profileResult.data) throw httpError(404, 'Profil de l’incubé introuvable.');

  const progressions = progressionResult.data || [];
  const formations = await getFormationTitles(
    request.supabase,
    progressions.map((progression) => progression.formation_id),
  );
  const formationById = new Map(formations.map((formation) => [formation.id, formation.title]));

  response.json({
    incubé: profileResult.data,
    projets: menteeProjects,
    formations: progressions.map((progression) => ({
      ...progression,
      title: formationById.get(progression.formation_id) || null,
    })),
    livrables: deliverableResult.data || [],
  });
}));

mentorRouter.get('/deliverables/:deliverableId/download', asyncHandler(async (request, response) => {
  const deliverableId = parseUuid(request.params.deliverableId);
  const deliverable = await getDeliverableForMentor(
    request.supabase,
    request.mentor.id,
    deliverableId,
  );
  const bucket = process.env.SUPABASE_DELIVERABLES_BUCKET || 'deliverables';
  const objectPath = storageObjectPath(deliverable.file_url, bucket, process.env.SUPABASE_URL);
  const { data, error } = await request.supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 300);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error('Supabase Storage n’a pas généré de lien signé.');
  response.json({ url: data.signedUrl, expiresInSeconds: 300 });
}));

mentorRouter.put('/deliverables/:deliverableId/feedback', asyncHandler(async (request, response) => {
  const deliverableId = parseUuid(request.params.deliverableId);
  const parsed = feedbackSchema.safeParse(request.body);
  if (!parsed.success) throw httpError(400, validationMessage(parsed.error));

  const { data, error } = await request.supabase.rpc('submit_mentor_feedback', {
    p_deliverable_id: deliverableId,
    p_feedback: parsed.data.feedback,
  });
  throwIfError(error);
  response.json({ livrable: data });
}));

mentorRouter.get('/availability', asyncHandler(async (request, response) => {
  const { data, error } = await request.supabase.from('mentor_availability')
    .select('id, day_of_week, start_time, end_time, time_zone, is_active')
    .eq('mentor_id', request.mentor.id)
    .order('day_of_week')
    .order('start_time');
  throwIfError(error);
  response.json({ disponibilités: data || [] });
}));

mentorRouter.post('/availability', asyncHandler(async (request, response) => {
  const parsed = availabilitySchema.safeParse(request.body);
  if (!parsed.success) throw httpError(400, validationMessage(parsed.error));

  const { data, error } = await request.supabase.from('mentor_availability')
    .insert({
      mentor_id: request.mentor.id,
      day_of_week: parsed.data.dayOfWeek,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      time_zone: parsed.data.timeZone,
    })
    .select('id, day_of_week, start_time, end_time, time_zone, is_active')
    .single();
  throwIfError(error);
  response.status(201).json({ disponibilité: data });
}));

mentorRouter.delete('/availability/:availabilityId', asyncHandler(async (request, response) => {
  const availabilityId = parseUuid(request.params.availabilityId);
  const { data, error } = await request.supabase.from('mentor_availability')
    .delete()
    .eq('id', availabilityId)
    .eq('mentor_id', request.mentor.id)
    .select('id')
    .maybeSingle();
  throwIfError(error);
  if (!data) throw httpError(404, 'Disponibilité introuvable.');
  response.status(204).end();
}));

mentorRouter.get('/appointments', asyncHandler(async (request, response) => {
  const { data, error } = await request.supabase.from('appointments')
    .select('id, incube_id, date_time, status, meeting_url')
    .eq('mentor_id', request.mentor.id)
    .order('date_time', { ascending: true });
  throwIfError(error);
  response.json({ rendezVous: data || [] });
}));

mentorRouter.patch('/appointments/:appointmentId', asyncHandler(async (request, response) => {
  const appointmentId = parseUuid(request.params.appointmentId);
  const parsed = appointmentStatusSchema.safeParse(request.body);
  if (!parsed.success) throw httpError(400, validationMessage(parsed.error));

  let meetingUrl = null;
  let meetingLinkStatus = 'not_requested';
  if (parsed.data.status === 'accepted') {
    const appointment = await getPendingAppointment(
      request.supabase,
      request.mentor.id,
      appointmentId,
    );
    const meeting = await createGoogleMeetLink(appointment);
    meetingUrl = meeting.url;
    meetingLinkStatus = meeting.status;
  }

  const { data, error } = await request.supabase.rpc('update_mentor_appointment', {
    p_appointment_id: appointmentId,
    p_status: parsed.data.status,
    p_meeting_url: meetingUrl,
  });
  throwIfError(error);
  response.json({ rendezVous: data, meetingLinkStatus });
}));

mentorRouter.get('/messages/:incubeId', asyncHandler(async (request, response) => {
  const incubeId = parseUuid(request.params.incubeId);
  await assertAssignedIncube(request.supabase, request.mentor.id, incubeId);

  const { data, error } = await request.supabase.from('messages')
    .select('id, sender_id, receiver_id, content, created_at, read_at')
    .or(`and(sender_id.eq.${request.mentor.id},receiver_id.eq.${incubeId}),and(sender_id.eq.${incubeId},receiver_id.eq.${request.mentor.id})`)
    .order('created_at', { ascending: true })
    .limit(200);
  throwIfError(error);
  response.json({ messages: data || [] });
}));

mentorRouter.post('/messages', asyncHandler(async (request, response) => {
  const parsed = messageSchema.safeParse(request.body);
  if (!parsed.success) throw httpError(400, validationMessage(parsed.error));
  await assertAssignedIncube(request.supabase, request.mentor.id, parsed.data.incubeId);

  const { data, error } = await request.supabase.from('messages')
    .insert({
      sender_id: request.mentor.id,
      receiver_id: parsed.data.incubeId,
      content: parsed.data.content,
    })
    .select('id, sender_id, receiver_id, content, created_at, read_at')
    .single();
  throwIfError(error);
  response.status(201).json({ message: data });
}));

mentorRouter.put('/messages/:messageId/read', asyncHandler(async (request, response) => {
  const messageId = parseUuid(request.params.messageId);
  const { data, error } = await request.supabase.rpc('mark_mentor_message_read', {
    p_message_id: messageId,
  });
  throwIfError(error);
  response.json({ message: data });
}));

mentorRouter.put('/notifications/:notificationId/read', asyncHandler(async (request, response) => {
  const notificationId = parseUuid(request.params.notificationId);
  const { data, error } = await request.supabase.rpc('mark_mentor_notification_read', {
    p_notification_id: notificationId,
  });
  throwIfError(error);
  response.json({ notification: data });
}));

async function getAssignedProjects(supabase, mentorId) {
  const { data, error } = await supabase.from('projects')
    .select('id, incube_id, title, status')
    .eq('mentor_id', mentorId)
    .order('title');
  throwIfError(error);
  return data || [];
}

async function buildMenteeSummaries(supabase, projects) {
  const incubeIds = [...new Set(projects.map((project) => project.incube_id))];
  if (incubeIds.length === 0) return [];

  const [profilesResult, progressionResult] = await Promise.all([
    supabase.from('profiles')
      .select('id, first_name, last_name')
      .in('id', incubeIds),
    supabase.from('progressions')
      .select('user_id, formation_id, is_completed')
      .in('user_id', incubeIds),
  ]);
  throwIfError(profilesResult.error);
  throwIfError(progressionResult.error);

  const progressions = progressionResult.data || [];
  const formations = await getAllFormationTitles(supabase);
  const availableFormationIds = new Set(formations.map((formation) => formation.id));
  const totalFormations = availableFormationIds.size;
  const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const progressionByIncube = new Map();
  for (const progression of progressions) {
    const current = progressionByIncube.get(progression.user_id) || new Set();
    if (progression.is_completed && availableFormationIds.has(progression.formation_id)) {
      current.add(progression.formation_id);
    }
    progressionByIncube.set(progression.user_id, current);
  }

  return incubeIds.map((id) => {
    const profile = profilesById.get(id);
    const completed = progressionByIncube.get(id)?.size || 0;
    const menteeProjects = projects.filter((project) => project.incube_id === id);
    return {
      id,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
      projets: menteeProjects,
      progression: {
        terminées: completed,
        total: totalFormations,
        pourcentage: totalFormations > 0
          ? Math.round((completed / totalFormations) * 100)
          : 0,
      },
    };
  });
}

async function getFormationTitles(supabase, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const { data, error } = await supabase.from('formations')
    .select('id, title')
    .in('id', uniqueIds);
  throwIfError(error);
  return data || [];
}

async function getAllFormationTitles(supabase) {
  const { data, error } = await supabase.from('formations').select('id, title');
  throwIfError(error);
  return data || [];
}

async function getDeliverableForMentor(supabase, mentorId, deliverableId) {
  const { data: deliverable, error } = await supabase.from('deliverables')
    .select('id, project_id, file_url, feedback_mentor')
    .eq('id', deliverableId)
    .maybeSingle();
  throwIfError(error);
  if (!deliverable) throw httpError(404, 'Livrable introuvable.');

  const { data: project, error: projectError } = await supabase.from('projects')
    .select('id')
    .eq('id', deliverable.project_id)
    .eq('mentor_id', mentorId)
    .maybeSingle();
  throwIfError(projectError);
  if (!project) throw httpError(404, 'Livrable introuvable.');
  return deliverable;
}

async function assertAssignedIncube(supabase, mentorId, incubeId) {
  const { data, error } = await supabase.from('projects')
    .select('id')
    .eq('mentor_id', mentorId)
    .eq('incube_id', incubeId)
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw httpError(404, 'Incubé non assigné à ce mentor.');
}

async function getPendingAppointment(supabase, mentorId, appointmentId) {
  const { data, error } = await supabase.from('appointments')
    .select('id, incube_id, date_time, status')
    .eq('id', appointmentId)
    .eq('mentor_id', mentorId)
    .eq('status', 'pending')
    .maybeSingle();
  throwIfError(error);
  if (!data) throw httpError(404, 'Demande de rendez-vous en attente introuvable.');
  return data;
}

async function createGoogleMeetLink(appointment) {
  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
  ];
  const configured = required.filter((name) => Boolean(process.env[name]));
  if (configured.length === 0) return { url: null, status: 'not_configured' };
  if (configured.length !== required.length) {
    throw new Error('La configuration Google Calendar est incomplète.');
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const calendar = google.calendar({ version: 'v3', auth });
  const start = new Date(appointment.date_time);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const { data } = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: 'Rendez-vous de mentorat PathForge',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });
  const url = data.hangoutLink
    || data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
  if (!url) throw new Error('Google Calendar n’a pas renvoyé de lien Google Meet.');
  return { url, status: 'created' };
}

function currentWeekRange(date) {
  const startDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (startDate.getUTCDay() + 6) % 7;
  startDate.setUTCDate(startDate.getUTCDate() - daysSinceMonday);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

function storageObjectPath(fileUrl, bucket, supabaseUrl) {
  if (typeof fileUrl !== 'string' || fileUrl.trim() === '') {
    throw httpError(404, 'Fichier du livrable introuvable.');
  }
  const value = fileUrl.trim();
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(value);
    if (!supabaseUrl || parsed.origin !== new URL(supabaseUrl).origin) {
      throw httpError(400, 'Le livrable ne référence pas un fichier Supabase Storage valide.');
    }
    const marker = `/storage/v1/object/`;
    const objectIndex = parsed.pathname.indexOf(marker);
    if (objectIndex < 0) throw httpError(400, 'URL de livrable invalide.');

    const [storageType, bucketName, ...segments] = parsed.pathname
      .slice(objectIndex + marker.length)
      .split('/');
    if (!['public', 'sign', 'authenticated'].includes(storageType) || bucketName !== bucket) {
      throw httpError(400, 'Le fichier ne se trouve pas dans le stockage des livrables.');
    }
    return segments.map(decodeURIComponent).join('/');
  } catch (error) {
    if (error.status) throw error;
    throw httpError(400, 'URL de livrable invalide.');
  }
}

function parseUuid(value) {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw httpError(400, 'Identifiant invalide.');
  return parsed.data;
}

function validationMessage(error) {
  return error.issues.map((issue) => issue.message).join(' ');
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function throwIfError(error) {
  if (!error) return;
  if (error.code === '23505') throw httpError(409, 'Cette plage est déjà enregistrée.');
  if (error.code === 'P0002') throw httpError(404, 'Ressource introuvable.');
  if (error.code === '42501') throw httpError(403, 'Accès refusé.');
  if (error.code === '22023') throw httpError(400, 'Valeur invalide.');
  throw error;
}

module.exports = {
  currentWeekRange,
  mentorRouter,
  storageObjectPath,
};

// Resolve the server session before exposing an application action. Display
// storage and URL parameters cannot grant a job-seeker action.
export async function loadJobApplication(jobId, { resolveSession, request }) {
  const session = await resolveSession({ force: true });
  if (!session) return { kind: 'anonymous' };
  if (session.user.role === 'recruiter') return { kind: 'recruiter' };
  if (session.user.role !== 'job_seeker') throw new Error('Your account type could not be verified. Please try again.');
  const { application } = await request(`/applications/job/${jobId}`, undefined, 'GET');
  // A job the person accepted and later left can be applied for again.
  return application && !application.quitAt ? { kind: 'applied', application } : { kind: 'ready' };
}

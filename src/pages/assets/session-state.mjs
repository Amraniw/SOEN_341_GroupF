// One small request lifecycle shared by public and workspace session consumers.
// It never treats transport failure or malformed data as an anonymous session.
export function createSessionResolver(load) {
  let state = { status: 'idle', user: null, error: null };
  let pending;
  let generation = 0;

  function reset() {
    generation += 1;
    pending = undefined;
    state = { status: 'idle', user: null, error: null };
  }

  function resolve({ force = false } = {}) {
    // Even a forced retry shares an already-running check.
    if (pending) return pending;
    if (!force && ['authenticated', 'unauthenticated'].includes(state.status)) {
      return Promise.resolve(state.user);
    }
    const version = generation;
    state = { ...state, status: 'loading', error: null };
    pending = Promise.resolve().then(load).catch((error) => {
      if (error.status === 401 || error.status === 403) return { user: null };
      throw error;
    }).then((data) => {
      if (!data || !Object.hasOwn(data, 'user') || (data.user !== null && (
        !Number.isSafeInteger(data.user?.id) || data.user.id < 1 ||
        typeof data.user.name !== 'string' || !data.user.name.trim() ||
        typeof data.user.email !== 'string' || !data.user.email.trim()
      ))) {
        throw new Error('Your account status could not be checked. Please try again.');
      }
      if (version === generation) {
        state = { status: data.user ? 'authenticated' : 'unauthenticated', user: data.user, error: null };
      }
      return data.user;
    }).catch((error) => {
      if (version === generation) state = { ...state, status: 'error', error };
      throw error;
    }).finally(() => {
      if (version === generation) pending = undefined;
    });
    return pending;
  }

  return { resolve, reset, get state() { return state; } };
}

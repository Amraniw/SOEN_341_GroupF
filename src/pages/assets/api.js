// Same-origin requests use the backend's HttpOnly session cookie.
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function request(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: multipart ? undefined : { 'Content-Type': 'application/json' },
      body: multipart ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status >= 500) {
        throw new ApiError(
          'The service is having trouble right now. Your details are still here—please try again.',
          response.status
        );
      }
      if (response.status === 404 || response.status === 405) {
        throw new ApiError(
          'This service is not available right now. Please try again later.',
          response.status
        );
      }
      throw new ApiError(
        data?.error || 'We could not complete your request. Please try again.',
        response.status
      );
    }
    if (!data)
      throw new ApiError(
        'The service returned an unexpected response. Please try again.'
      );
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.name === 'AbortError'
        ? 'The request timed out. It may have completed. Check before trying again.'
        : 'We could not connect. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timeout);
  }
}

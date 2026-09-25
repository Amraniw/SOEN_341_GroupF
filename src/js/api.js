(function initializeCareerConnectApi() {
  const configuredBase = document.querySelector('meta[name="api-base"]')?.content?.trim() || '';

  async function request(path, options = {}) {
    let response;

    try {
      response = await fetch(`${configuredBase}${path}`, {
        credentials: 'include',
        ...options,
      });
    } catch (error) {
      throw new Error('CareerConnect could not reach the server. Make sure the application is running through the integrated backend.');
    }

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : {};

    if (!response.ok) {
      const requestError = new Error(body.error || 'Something went wrong. Please try again.');
      requestError.status = response.status;
      throw requestError;
    }

    return body;
  }

  window.CareerConnectAPI = { request };
})();

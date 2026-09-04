'use strict';

(() => {
  const tokenKey = 'placementPortalToken';

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const token = sessionStorage.getItem(tokenKey);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  window.portalApi = Object.freeze({
    clearToken: () => sessionStorage.removeItem(tokenKey),
    getToken: () => sessionStorage.getItem(tokenKey),
    request,
    setToken: (token) => sessionStorage.setItem(tokenKey, token)
  });
})();

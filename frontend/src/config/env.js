const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

let parsedApiBaseUrl;
try {
  parsedApiBaseUrl = new URL(rawApiBaseUrl);
} catch {
  throw new Error('Invalid frontend API configuration.');
}

if (!['http:', 'https:'].includes(parsedApiBaseUrl.protocol) || !parsedApiBaseUrl.hostname) {
  throw new Error('Invalid frontend API configuration.');
}

export const frontendEnv = Object.freeze({
  apiBaseUrl: rawApiBaseUrl.replace(/\/$/, ''),
});

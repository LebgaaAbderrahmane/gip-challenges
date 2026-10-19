/**
 * The API configuration.
 *
 * The three service base URLs are PUBLIC — they are bundled into the
 * JavaScript every visitor downloads — so only URLs belong here. The
 * VITE_ prefix is what makes them public, and it is also why a credential
 * must never be given a VITE_ name.
 *
 * The local fallbacks let the portfolio be developed against the services
 * running on the development machine.
 */

const read = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  // A trailing slash would produce "https://host//api/items".
  return trimmed.replace(/\/+$/, '');
};

export const API_BASE_URLS = {
  lostFound: read(
    import.meta.env.VITE_LOST_FOUND_API_URL,
    'http://localhost:3001',
  ),
  auth: read(import.meta.env.VITE_AUTH_API_URL, 'http://localhost:3002'),
  flashSale: read(
    import.meta.env.VITE_FLASH_SALE_API_URL,
    'http://localhost:3003',
  ),
} as const;

/** How long a request may take before it is treated as failed. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Whether a service is configured to a real deployment.
 *
 * A local address means the API is probably not running, and the tester
 * says so plainly rather than showing a confusing network error.
 */
export const isDeployed = (baseUrl: string): boolean =>
  !/^https?:\/\/localhost(:\d+)?/i.test(baseUrl);

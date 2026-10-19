/**
 * Loading the local .env file.
 *
 * A service needs DATABASE_URL, JWT_SECRET and PORT before it can start, and
 * in development those are naturally written in a file next to the service
 * rather than typed into the shell every time. There is a `.env.example` for
 * each service showing exactly what belongs there.
 *
 * Node has had a built-in loader for this since v20.12, so no dependency is
 * needed. Two properties of it matter:
 *
 *   - A variable already present in the environment WINS over the file. That
 *     is what makes this safe in production: Render sets the real variables,
 *     the file is not there, and nothing is overwritten.
 *   - A missing file is not an error. In production there is no file, and the
 *     variables come from the platform instead.
 */

/**
 * Loads the .env file for a service, if it has one.
 *
 * @param path The file to load. Defaults to `.env` beside the service.
 * @returns Whether a file was actually read.
 */
export function loadLocalEnv(path: string = '.env'): boolean {
  try {
    process.loadEnvFile(path);
    return true;
  } catch {
    // No file. The variables come from the environment instead.
    return false;
  }
}

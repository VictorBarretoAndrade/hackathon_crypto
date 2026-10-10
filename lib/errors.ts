/** An error that maps to an HTTP status. The message is shown to the user. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The server is missing configuration (keys, secrets). */
export class ConfigError extends HttpError {
  constructor(message: string) {
    super(503, message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (message: string) => new HttpError(400, message);

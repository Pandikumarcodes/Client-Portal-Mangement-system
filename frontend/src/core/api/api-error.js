export class ApiClientError extends Error {
  constructor({ status, code, message, details, cause }) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

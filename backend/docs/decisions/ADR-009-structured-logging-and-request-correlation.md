# ADR-009: Add Structured Logging and Request Correlation

## Status

Accepted

## Context

The modular-monolith process needs consistent operational events and a way to correlate HTTP work
across asynchronous execution. Console strings, complete request serialization, and ad hoc loggers
would make logs difficult to process and could disclose request bodies, query values,
authorization, cookies, credentials, or infrastructure configuration.

Request identifiers are useful for diagnostics but are untrusted client input and must not become
authentication or authorization credentials.

## Decision

Use Pino as the centralized application logger and pino-http for one status-aware HTTP completion
event per ordinary request. Logs are newline-delimited JSON with ISO timestamps and without
pino-pretty or external transports. `LOG_LEVEL` is centrally validated and defaults to debug in
development, silent in tests, and info in production.

Every request receives an `X-Request-Id` before HTTP logging. Valid client-provided IDs containing
only a bounded safe character set are preserved; missing or invalid values are replaced with a
generated UUID. AsyncLocalStorage propagates a context containing only `{ requestId }` across
promises, timers, and other asynchronous continuations.

The pino-http completion event contains only request ID, method, URL path without query values,
status code, and response time. Request bodies, query objects and values, authorization headers,
cookies, Set-Cookie values, passwords, tokens, credentials, uploaded contents, and complete request
or response objects are excluded.

HTTP response generation remains separate from internal logging. Unknown HTTP 500 failures produce
one dedicated safe event containing only correlation ID, status code, public error code, and a
sanitized error name. Raw errors, messages, causes, stacks, headers, bodies, query values, and
validation details are not logged.

Application process lifecycle messages use the centralized logger. Direct terminal output in the
MongoDB and DNS diagnostic scripts remains a narrow exception because those commands have an
intentional CLI output contract.

External log shipping, persistent log storage, audit logging, metrics, and tracing are deferred.
This observability boundary remains inside the modular monolith.

## Alternatives considered

Independent loggers per module were rejected because they would fragment configuration, redaction,
and service metadata. Logging complete request or response objects was rejected because framework
serializers may include sensitive headers and future fields. Logging request bodies or query values
was rejected because they can contain credentials and personal data.

Accepting arbitrary client request IDs was rejected because unbounded or control-character input
could corrupt logs. Generating a second ID inside pino-http was rejected because all middleware and
asynchronous work must share one correlation value.

Pretty printing and external transports were rejected because production logs should remain
machine-readable and no shipping provider has been selected. Operational logs were not reused as
audit logs because audit requirements and retention policy are separate concerns.

## Consequences

Application and HTTP events have a consistent JSON format, every response exposes its correlation
ID, and asynchronous code can retrieve that ID without retaining complete request objects.
Completion-event levels reflect HTTP outcome and unknown server errors receive safe metadata-only
diagnostics.

Operators must parse JSON logs or provide formatting outside the application. Future code must use
the root logger, `request.log`, or `getRequestId()` as appropriate and must continue excluding
secrets. External delivery, retention, audit logging, metrics, and distributed tracing require
later architectural decisions.

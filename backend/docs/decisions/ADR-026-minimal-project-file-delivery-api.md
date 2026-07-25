# Title

Minimal tenant-scoped Project File delivery API

# Status

Accepted

# Context

Organization Admins need a small way to deliver files under existing Projects. The capability must
preserve tenant isolation and the existing Project ownership boundary without becoming a public
drive, collaboration system, attachment platform, or cloud-storage integration.

# Decision

Project Files are tenant-owned and Project-scoped. Before every upload, list, metadata read,
download, or metadata update, the service verifies the Project through the existing tenant-scoped
Project repository lookup. Only authenticated Organization Admins are supported. Client users and
Super Admins have no Project File access.

Metadata is stored in MongoDB; binary content is not. The MVP uses local filesystem storage behind
a storage adapter so a future approved cloud implementation can replace filesystem operations
without rewriting controllers or services. Runtime files are ignored by Git, storage paths and
generated stored names are never exposed, and no storage directory is mounted statically.

Uploads use the multipart field `file`, allow exactly one file, and accept an optional description
of at most 500 characters. The maximum file size is 10 MiB. Only PDF, PNG, JPEG, plain text, CSV,
Word Open XML, and Excel Open XML MIME types are accepted. Multer is the single multipart dependency
introduced because the repository had no multipart parser. Server-generated cryptographically
random names use an extension selected from the approved MIME mapping and are independent from the
untrusted original name.

Downloads stream through the authenticated backend route using trusted metadata and an attachment
content disposition. No public or signed URL mechanism exists. Metadata status is either `active`
or `archived`; archiving does not delete content. Hard deletion and content replacement are not
supported. If binary persistence succeeds but MongoDB metadata creation fails, the adapter attempts
a compensating removal while preserving the original database error.

Tests remain offline and use temporary local directories. Virus scanning, Client-user access,
previews, versioning, public links, and cloud storage are deferred.

# Alternatives considered

- Storing binary content in MongoDB or GridFS was rejected because it expands database concerns and
  is unnecessary for this portfolio MVP.
- Public directories, public URLs, and signed sharing links were rejected because every access must
  pass through authentication, tenant context, Project verification, and file metadata verification.
- Browser-direct and cloud-provider uploads were rejected because they add provider SDKs, credential
  handling, and a broader upload lifecycle.
- In-memory upload buffering was rejected in favor of controlled temporary files and streaming
  persistence.

# Consequences

The backend must have write access to `PROJECT_FILE_STORAGE_ROOT`, which defaults to
`./storage/project-files`. Local files require deployment-specific persistence and backup choices.
Multiple application instances cannot share files without replacing the adapter. The explicit
allowlist, 10 MiB limit, one-file rule, path containment, random filenames, private download
streaming, and safe errors reduce the MVP attack surface, but virus scanning is intentionally not
provided.

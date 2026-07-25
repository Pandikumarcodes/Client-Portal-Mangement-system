# Title

Minimal secure Project File delivery frontend

# Status

Accepted

# Context

Organization Admins need a small deliverable-file interface under an existing Project. The backend
provides tenant-scoped upload, list, metadata, download, and metadata-update routes. The frontend
must preserve the existing authentication boundary and avoid becoming a public drive, preview
system, attachment platform, or cloud-storage interface.

# Decision

Project Files are presented inside the parent Project experience. The Project detail page contains
the list, single status filter, backend pagination, empty states, and Upload File action. There is no
top-level Files navigation item. Upload, detail, and edit pages use nested Project routes, and every
route remains inside the authenticated Organization Admin role boundary. Client and Super Admin
users are not supported.

Uploads use multipart `FormData` with exactly one binary field named `file` and an optional
description. The browser sets the multipart boundary; the frontend never manually sets multipart
`Content-Type`. Usability validation enforces the 10 MiB limit and the backend-approved PDF, PNG,
JPEG, plain text, CSV, Word Open XML, and Excel Open XML MIME values. The backend remains
authoritative for file safety.

All requests reuse the configured API base URL, in-memory access token, credentials behavior, and
safe error normalization. The API utility supports FormData without JSON conversion and a focused
Blob response mode without changing existing JSON behavior. Downloads use authenticated fetch,
create a temporary object URL, trigger an attachment download with a sanitized filename, remove the
temporary anchor, and revoke the object URL. No public download URLs are generated.

Only safe metadata is retained locally while a screen is mounted. Project File metadata, File
objects, Blobs, and object URLs are never persisted in browser storage. Generated stored names and
storage paths are never displayed.

Metadata editing supports only description and status. Status is `active` or `archived`; archiving
does not delete content, and archived files remain viewable and downloadable. Restoring changes the
same metadata status back to `active`. Hard deletion and file replacement are not supported.

# Alternatives considered

A top-level Files area, public or signed links, unauthenticated navigation, direct-to-storage
uploads, multiple-file upload, browser-storage caching, previews, thumbnails, versioning, deletion,
replacement, Client access, cloud SDKs, and new upload or download dependencies were rejected
because they expand the feature beyond minimal authenticated Project delivery.

# Consequences

Organization Admins can upload one approved deliverable, list and filter metadata, view details,
download through the authenticated backend, edit descriptions, and archive or restore metadata
without leaving Project context. Object URLs exist only for the duration of a download action and
are revoked immediately afterward. Cloud storage remains an implementation concern behind the
backend adapter. Previews, thumbnails, versioning, public links, hard deletion, replacement, Client
access, and cloud storage UI remain deferred. No new frontend dependency was installed.

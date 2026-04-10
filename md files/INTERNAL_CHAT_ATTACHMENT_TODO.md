# Internal Chat Attachment TODO

## Goal

Add file attachments to the internal chat system using the current stack:

- Frontend: React
- Backend: PHP
- Storage: local filesystem
- Database: local MySQL

Keep the implementation simple, reviewable, and compatible with the existing internal chat architecture.

## Preferred Approach

### If MySQL schema changes are allowed

1. Add attachment metadata storage linked to internal chat messages.
2. Upload files through a PHP endpoint using `multipart/form-data`.
3. Save files to local disk under `api/public/uploads/internal-chat/`.
4. Store metadata only in MySQL:
   - message id
   - original filename
   - stored path or public URL
   - mime type
   - file size
5. Return attachment data together with message payloads.

### If MySQL schema must stay frozen

1. Keep normal chat messages in `tblsms`.
2. Upload files through a PHP endpoint using `multipart/form-data`.
3. Save files to local disk under `api/public/uploads/internal-chat/`.
4. Store attachment metadata in a file-backed JSON sidecar keyed by message id.
5. Enrich fetched chat messages with attachment metadata on the backend.

This is the safest no-schema-change option on the current stack.

## Backend Tasks

1. Add `POST /api/v1/internal-chat/attachments`.
2. Validate auth and conversation access before accepting uploads.
3. Restrict allowed file types.
4. Enforce max file size.
5. Generate safe unique filenames.
6. Save files to a dedicated internal chat uploads directory.
7. Return normalized attachment metadata in JSON.
8. Attach metadata to message fetch responses.
9. Consider delete/cleanup behavior for orphaned files.

## Frontend Tasks

1. Add an attachment button to the internal chat composer.
2. Upload selected files before or during message send.
3. Show upload progress or at least uploading state.
4. Support optimistic UI carefully.
5. Render image preview for images.
6. Render filename/link UI for non-image files.
7. Handle upload failures cleanly without losing the text draft.

## Validation Rules

1. Allow only expected file types.
2. Reject oversized files.
3. Sanitize filenames.
4. Never trust client mime type alone.
5. Ensure users can only attach files to conversations they can access.

## Nice To Have

1. Thumbnail previews for images.
2. Download-friendly filenames.
3. Attachment removal before send.
4. Basic cleanup job for unused uploaded files.

## Risks To Revisit

1. File-backed metadata can grow over time if schema remains frozen.
2. Local filesystem storage needs backup and cleanup discipline.
3. Historical messages should degrade gracefully if attachment metadata is missing.
4. Large files can affect PHP request time and UX.

## Files Likely To Touch

- `/Users/melsonleanbacuen/Documents/james-system/api/src/Controllers/InternalChatController.php`
- `/Users/melsonleanbacuen/Documents/james-system/api/src/Repositories/InternalChatRepository.php`
- `/Users/melsonleanbacuen/Documents/james-system/api/src/bootstrap.php`
- `/Users/melsonleanbacuen/Documents/james-system/james-newsystem/components/InternalChatLauncher.tsx`
- `/Users/melsonleanbacuen/Documents/james-system/james-newsystem/services/internalChatLocalApiService.ts`

## Current Recommendation

If this is revisited soon, start with:

1. local filesystem upload
2. small allowed file list
3. one attachment per message
4. backend validation first
5. JSON sidecar metadata only if the MySQL freeze still applies

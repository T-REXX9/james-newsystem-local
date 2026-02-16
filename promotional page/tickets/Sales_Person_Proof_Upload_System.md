# Sales Person Proof Upload System

## Objective

Implement the proof upload interface for sales persons to submit screenshot evidence of platform postings.

## Scope

**Included:**
- Create `UploadProofModal.tsx` with drag-and-drop zone
- Implement file validation (type: PNG/JPG, size: max 10MB)
- Implement client-side image compression if > 5MB
- Add optional post URL field
- Show upload progress indicator
- Handle upload errors gracefully
- Display rejection reason when re-uploading
- Update posting status to "Pending Review" after upload
- Real-time update to owner's pending review list

**Excluded:**
- Proof review interface (owner ticket)
- Notification delivery (integration ticket)

## Acceptance Criteria

- [ ] Drag-and-drop zone accepts PNG/JPG files
- [ ] File validation prevents invalid file types and sizes
- [ ] Images > 5MB are compressed client-side before upload
- [ ] Upload progress indicator shows during upload
- [ ] Optional URL field accepts valid URLs
- [ ] Success message appears after successful upload
- [ ] Rejection reason is displayed when re-uploading rejected proof
- [ ] Posting status updates to "Pending Review" immediately
- [ ] Upload errors show clear error messages
- [ ] Interface matches wireframe from Core Flows

## Technical References

- **Core Flows**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/3884e2ef-91f6-4615-a6b1-b7522e088ff8` (Sales Person Flows 9-10)
- **Tech Plan**: `spec:187d664a-8b1f-483b-a606-15fe734b049f/5fd7de40-a5b7-4c37-ae0f-5420b0b52d57` (Upload Proof Flow)

## Dependencies

- **Requires**: Ticket #2 (Service Layer) must be completed first
- **Requires**: Ticket #5 (Sales Person Dashboard) for integration
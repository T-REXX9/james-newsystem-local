# Call Forwarding / Calling System Notes

## Summary

This file started as a carrier-based call forwarding idea, but the repo now implements a different approach: a staff-phone calling system with a web click-to-call request, a Flutter companion app, call-log synchronization, device health monitoring, and missed-call auto-reply support.

The current implementation does **not** silently forward live calls through carrier USSD codes. Instead, the website confirms a call request, the registered staff phone receives it, and the native Android dialer is opened on that device. The actual call still begins when the staff member uses the phone’s dialer.

## What the repo actually contains

### 1) Web application
- `james-newsystem/`
- React/Vite UI for customer, sales, and management screens
- Reusable call action components such as:
  - `CallCustomerButton`
  - `CallAccountabilityPanel`
- Calling-related views show device health and hardware call metadata

### 2) API
- `api/`
- PHP/MySQL backend that handles:
  - staff login
  - device registration and heartbeat
  - dial-request queueing and polling
  - call-log ingestion
  - hardware call history queries
  - missed-call auto-reply settings and audit history
- Devices are bound to a staff account and cannot be silently reassigned

### 3) Android companion app
- `calling_app/`
- Flutter app used by staff phones
- Responsibilities:
  - sign in with James staff credentials
  - register the device ID
  - run a visible foreground service
  - send heartbeat updates
  - poll or receive dial requests
  - open the native dialer
  - sync call-log metadata back to the API

## Implemented call flows

### A. Daily Call Monitoring workflow
This is the agent-facing calling flow used in the web app.

1. The agent opens Daily Call Monitoring.
2. The system can claim a customer so another agent does not work the same customer at the same time.
3. The customer detail / contact window opens.
4. The agent reviews customer information and works the call.
5. The agent submits a report after the call.
6. The report is saved as call activity and becomes visible in management views.

### B. Website click-to-call workflow
This is the reusable call button flow used in supported screens.

1. The user presses **Call customer**.
2. The website asks for confirmation.
3. The system queues a dial request for the authenticated staff phone.
4. The companion phone app receives the request.
5. The app opens the native dialer.
6. The request is marked as dialed or failed.

### C. Hardware call-log sync
The companion phone can upload metadata for inbound, outbound, and missed calls.

Stored metadata includes:
- staff account
- device ID
- phone number
- direction
- duration
- timestamp
- customer match when available

The system explicitly does **not** record audio.

## Current calling-related capabilities visible in the codebase

- Device registration and heartbeat tracking
- Team-scoped vs self-scoped device/call visibility
- Call history filters by staff, customer, direction, and date range
- Device health labels such as:
  - background active
  - app open
  - permission missing
  - no network
  - device offline
- Missed-call auto-reply settings for Master Users
- Realtime notification plus polling fallback for dial requests

## Important implementation detail

The original idea here was carrier forwarding via USSD codes such as `*21*number#`.
That is **not** what the repo currently implements.

The implemented system is more like:
- web-requested click-to-call
- registered staff phone handling
- native Android dialer launch
- metadata logging and accountability

## Files worth reading

- `docs/calling_solution.md`
- `Calling_System_Implementation_Status.md`
- `api/src/Controllers/CallSystemController.php`
- `api/src/Repositories/CallSystemRepository.php`
- `james-newsystem/services/callingSystemService.ts`
- `james-newsystem/components/CallCustomerButton.tsx`
- `james-newsystem/components/CallAccountabilityPanel.tsx`
- `calling_app/lib/main.dart`
- `calling_app/lib/calling_background_service.dart`
- `calling_app/lib/calling_api_client.dart`

## Practical takeaway

If the goal is to understand this repo, treat it as a **call monitoring and click-to-call accountability system**, not a carrier call-forwarding demo.

If the goal is to build a true carrier-forwarding feature later, that would be a separate design and likely a separate implementation path.

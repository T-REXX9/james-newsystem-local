# Mobile App Spec (Android Dialer Companion)

## Purpose
Build an Android app that interfaces with the existing web app and Supabase to enable sales agents to place and manage customer calls. The app must support automatic calling when an agent presses "Call" in the web app and must implement carrier call forwarding behavior described in `call forwarding idea.md`.

## Goals
- Allow an agent to initiate a call from the web app and have the Android device place it automatically.
- Support carrier-based call forwarding via USSD codes when an agent is marked absent.
- Maintain a complete audit trail of call and forwarding events in Supabase.
- Provide reliable real-time updates between web app and device.

## Non-Goals
- Building a VoIP system or third-party SIP stack.
- Handling SMS.
- iOS support.
 - Web app acting as the audio endpoint for PSTN calls (SIM calls are handled on device only).

## Assumptions
- Each sales agent has a dedicated Android device with a SIM and a phone number.
- Supabase is the source of truth for agent availability, call queue items, and audit logs.
- The Android app is granted the necessary permissions and can be set as the default dialer.

## User Roles
- Sales Agent: initiates/receives calls, toggles availability, may accept forwarded calls.
- Supervisor/Manager: monitors call activity and agent availability in the web app.

## Core User Flows
### 1) Auto Call Flow
1. Agent clicks "Call" in the web app daily call monitoring.
2. Web app writes a "call_request" record in Supabase with target phone number, agent ID, and job metadata.
3. Android app receives the request via Supabase realtime subscription.
4. App initiates the call via `ACTION_CALL`.
5. App logs call start/stop, result, and duration to Supabase.

### 1b) Command Relay (Web -> Device)
1. Web app writes a "device_command" record (e.g., `dial`, `forward_enable`, `forward_disable`).
2. Android app receives the command via Supabase realtime subscription.
3. Android app executes the command and writes a "device_event" ack with success/failure.
4. Web app updates UI based on the ack.

### 2) Call Forwarding Flow (Carrier USSD)
1. Agent A is set to "absent" in Supabase (from web app or device).
2. Android app for Agent A receives status update.
3. App dials carrier forwarding USSD (e.g., `*21*agentBnumber#`) via `ACTION_CALL`.
4. App logs forwarding enable event to Supabase.
5. When Agent A returns, app dials disable USSD (`#21#`) and logs event.

### 3) Forwarded Call Handling
1. Agent B receives forwarded call on their device.
2. Agent B answers the call.
3. App logs call events and associates it with the forwarding record.

### 4) Incoming Call Notification (Device -> Web)
1. Incoming call reaches the Android device (SIM/PSTN).
2. Android app detects ringing state and logs a `device_event` with caller number.
3. Web app receives realtime event and shows notification/status.
4. Agent answers on the Android device; web app shows "answered" once device logs it.

### 5) Remote Answer (Best-Effort, Optional)
1. Web app writes a `device_command` to answer an incoming call.
2. Android app attempts to answer via `TelecomManager.acceptRingingCall()`.
3. App logs success/failure (may fail due to OEM/OS restrictions).

## Functional Requirements
### Calling
- Place outbound calls using `ACTION_CALL`.
- Support automatic call initiation from a Supabase "call_request".
- Persist call metadata: call ID, agent ID, phone number, timestamps, duration, status.

### Call Forwarding (per `call forwarding idea.md`)
- Support USSD codes:
  - Enable unconditional: `*21*fullnumber#`
  - Disable: `#21#`
  - Conditional (busy): `*67*number#`
  - Conditional (unanswered): `*61*number#`
- Detect agent availability changes and apply forwarding accordingly.
- Log all forwarding enable/disable events with timestamps, carrier code used, and target agent number.
- Support carrier-specific configurations (Globe, Smart/Sun) via configurable templates.

### Availability & Status
- Agent can set availability in app.
- Device syncs status changes to Supabase in real time.

### Logging & Audit
- Log every call and forwarding action to Supabase.
- Record:
  - Agent ID
  - Target number
  - Event type (call_start, call_end, forward_enable, forward_disable)
  - Timestamp
  - Result/status
  - Device ID

### Notifications
- Receive realtime updates from Supabase for call requests and forwarding changes.
- Optionally display local notifications for new call requests or status changes.
- Web app shows incoming-call notifications based on `device_events`.

## Non-Functional Requirements
- Reliability: auto-call and forwarding actions should execute within 3 seconds of Supabase event receipt under normal connectivity.
- Offline behavior: queue call requests if device is offline; retry when online.
- Security: use Supabase Row Level Security (RLS) and device-specific auth.
- Privacy: only store minimal call data needed for audit and operations.
 - Constraint: web app is control/visibility only; audio is always handled by Android device for PSTN calls.

## Permissions & Android Requirements
- `CALL_PHONE` (required).
- `READ_PHONE_STATE` (required for call state detection).
- `READ_CALL_LOG` (optional, only if needed for validation).
- `ANSWER_PHONE_CALLS` (required for best-effort remote answer).
- Device should be set as default dialer to improve call handling and logging.

## Supabase Data Model (Proposed)
### Tables
- `call_requests`
  - id, agent_id, phone_number, status, created_at, updated_at
- `call_logs`
  - id, call_request_id, agent_id, phone_number, status, started_at, ended_at, duration_ms, device_id
- `agent_status`
  - agent_id, status, updated_at
- `forwarding_logs`
  - id, agent_id, target_agent_id, target_number, action, carrier_code, created_at
- `device_commands`
  - id, agent_id, command_type, payload_json, status, created_at, updated_at
- `device_events`
  - id, agent_id, event_type, payload_json, created_at

### Realtime
- Subscribe to `call_requests` and `agent_status` changes.

## Error Handling
- If call initiation fails, update `call_requests.status` with error code.
- If forwarding USSD fails, retry up to 2 times and log failure.
- If carrier code format missing, show a blocking error and notify supervisor.
- If remote answer fails, log `device_event` with failure reason and require manual answer on device.

## Configuration
- Carrier code templates stored in Supabase and synced to device.
- Default behavior:
  - If agent is absent, enable unconditional forwarding to next available agent.
  - If agent is present, disable forwarding.

## UX Notes
- Minimal UI: status indicator, call queue list, logs view.
- Clear feedback when a call is being placed or forwarding toggled.
- Manual override toggle for forwarding (with audit log).

## Testing
- Unit tests for Supabase event handling logic.
- Instrumentation tests for call intents (mocked).
- Manual field tests for each carrier (Globe, Smart/Sun).

## Open Questions
- How is "next available agent" determined in Supabase?
- Should forwarded calls be linked to the original call request or handled as new calls?
- Which call statuses must be displayed in the web app (missed, busy, declined)?
- Should remote answer be enabled by default or restricted to specific roles/devices?

## Milestones
1. Supabase schema + realtime subscriptions.
2. Auto call flow with logging.
3. Call forwarding automation.
4. QA on target devices and carriers.

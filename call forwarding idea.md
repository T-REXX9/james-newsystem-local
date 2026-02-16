# Call Forwarding Idea

## Overview
Implement call forwarding for sales agents using carrier-provided USSD codes, allowing automatic redirection of incoming calls from an absent agent's phone to an available agent. This ensures seamless call handling with full audit trails via Supabase.

## How It Works
- **Trigger Forwarding:** When sales agent 1 is marked "absent" in the Supabase database (via web app or status update), their dialer app automatically dials the carrier forwarding code (e.g., `*21*agent2number#`) using Android's `ACTION_CALL` intent.
- **Forwarding Mechanism:** The call is forwarded wirelessly over the cellular network to agent 2's phone.
- **Notification:** Agent 2 receives a real-time notification via the web app about the forwarded call.
- **Answering:** Agent 2 answers the call on their device.
- **Logging/Audit Trail:** All actions (forwarding enable/disable, call details, timestamps, agents involved) are logged to Supabase for tracking who handled what call.

## Requirements
- **Permissions:** `CALL_PHONE` and `READ_PHONE_STATE` in Android manifest.
- **Carrier Support:** Confirmed for Philippine telcos (Globe: `*143#` menu, but forwarding via `*21*number#`; Smart/Sun: `*123#` menu, forwarding `*21*number#`).
- **Codes:**
  - Enable unconditional forwarding: `*21*fullnumber#`
  - Disable: `#21#`
  - Conditional (busy): `*67*number#`
  - Conditional (unanswered): `*61*number#`
- **App Integration:** Default dialer app to handle calls and logging.
- **Supabase:** Real-time subscriptions for status updates and notifications.

## Benefits
- No third-party VoIP providers needed.
- Wireless forwarding via carrier.
- Full audit trail for compliance.
- Easy automation with existing Android APIs.

## Potential Challenges
- Carrier-specific code variations; test per telco.
- Requires cellular signal.
- Manual override possible if needed.

## Implementation Steps
1. Detect agent status via Supabase real-time.
2. Dial forwarding code programmatically.
3. Log events to Supabase.
4. Notify agents via web app.
5. Handle call events for audit.

Test thoroughly on target devices and carriers.
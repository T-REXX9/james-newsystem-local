# Sales agent homepage repeatedly refetches `agent-snapshot`, causing very slow load times

## Summary
The sales agent homepage (`Daily Call Monitoring`) repeatedly requests the same `agent-snapshot` payload while the page is still loading. In the reported session, the same request was fired multiple times and each response was about `3.1 MB`, with individual requests taking roughly `18s` to `55s`.

This creates a compounding slowdown:
- the homepage overfetches a very large payload
- polling triggers another full reload of the same payload
- overlapping requests can stack when a previous request has not completed yet

## Impact
- Sales agent homepage appears to take ~30 seconds or longer to load
- Network tab is flooded with repeated `agent-snapshot` requests
- Browser downloads the same `3.1 MB` payload multiple times
- Client-side processing work is repeated for the same data set

## Evidence
- Reported endpoint: `GET /api/v1/daily-call-monitoring/agent-snapshot?main_id=1&viewer_user_id=63`
- Observed repeated requests in browser Network panel
- Observed request durations in the screenshot: about `18.21s`, `24.87s`, `29.16s`, `29.96s`, `33.60s`, `40.37s`, `41.89s`, `45.41s`, `55.59s`
- Observed payload size: about `3,115 kB` per request

Local benchmark of the same endpoint showed the backend itself can respond quickly when called directly, but the payload is still very large:
- contacts: `246`
- inquiries: `11,004`
- purchases: `10,885`
- payload size: about `3.1 MB`

## Suspected Root Cause
The frontend subscribes to periodic updates and calls the full snapshot loader each time.

### Code pointers
- [DailyCallMonitoringView.tsx](/Users/melsonleanbacuen/Documents/james-system/james-newsystem/components/DailyCallMonitoringView.tsx)
  - `loadAgentData()` calls `fetchAgentSnapshotForDailyCall(...)`
  - `useEffect(...)` subscribes to update callbacks with `onUpdate: loadAgentData`
- [dailyCallMonitoringService.ts](/Users/melsonleanbacuen/Documents/james-system/james-newsystem/services/dailyCallMonitoringService.ts)
  - `fetchAgentSnapshotForDailyCall(...)` downloads the full snapshot
  - `subscribeToDailyCallMonitoringUpdates(...)` uses `window.setInterval(..., 45000)`

### Why this is likely happening
- The page polls every `45` seconds
- The polled action re-fetches the full `agent-snapshot`
- If one request is still in flight when the next poll fires, another large request can start
- The page processes full contacts, inquiries, and purchases even though the initial view only needs a small subset

## Reproduction Steps
1. Sign in as sales agent `sales.agent.20260228@local`
2. Open the homepage / dashboard
3. Open browser DevTools Network tab and filter to `Fetch/XHR`
4. Observe repeated `agent-snapshot?main_id=1&viewer_user_id=63` requests
5. Observe that each request downloads about `3.1 MB`
6. Observe that homepage load time becomes very slow as repeated requests continue

## Expected Result
- Homepage should issue one initial snapshot request on load
- Snapshot refresh should not overlap with an in-flight request
- Homepage should load summary data quickly and lazily fetch heavy detail data only when needed

## Actual Result
- Homepage repeatedly requests the full snapshot
- Large payload is downloaded multiple times
- User sees very slow load times and repeated network activity

## Proposed Fix
1. Add an in-flight guard so `loadAgentData()` cannot start a new fetch while the previous fetch is still running.
2. Stop polling the full snapshot every `45` seconds, or reduce polling to a lightweight summary endpoint.
3. Split the snapshot payload:
   - homepage summary + visible rows only
   - purchases/inquiries fetched lazily when opening a customer or detail panel
4. Consider request cancellation with `AbortController` when a new refresh replaces an older request.
5. Add client-side instrumentation so repeated snapshot calls are visible in logs during debugging.

## Acceptance Criteria
- [ ] Homepage does not issue overlapping `agent-snapshot` requests
- [ ] Only one initial snapshot request is made during first load
- [ ] Polling does not re-download the full `3.1 MB` payload unnecessarily
- [ ] Sales agent homepage loads noticeably faster under the same account/data set
- [ ] Network panel no longer shows repeated stacked `agent-snapshot` calls during idle viewing
- [ ] Heavy purchase/inquiry data is fetched lazily or paginated

## Priority
High

## Notes
This issue appears to be a frontend-triggered amplification problem, not just a slow SQL query. Even if backend optimization is still worthwhile, the repeated full refetch loop should be fixed first because it multiplies the cost of an already large response.

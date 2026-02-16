# 🎯 PIPELINE PAGE - COMPLETE FEATURE SUMMARY & NAVIGATION

**Last Updated:** December 29, 2025  
**Status:** Planning & Documentation Phase

---

## 📋 TABLE OF CONTENTS

1. [Core Pipeline Features](#core-pipeline-features)
2. [Role-Based Views](#role-based-views)
3. [Permission Matrix](#permission-matrix)
4. [Navigation Shortcuts](#navigation-shortcuts)
5. [Integration Points](#integration-points)
6. [UI Components Per Role](#ui-components-per-role)

---

## 📋 CORE PIPELINE FEATURES

### 1. KANBAN BOARD 🎨
**Visual Layout:**
- **4 Columns:** Qualification → Proposal → Negotiation → Closed Lost/Blocked
- **Drag-and-Drop:** Move deals between stages with mouse
- **Real-time Updates:** Live sync with Supabase database
- **Responsive Design:** Works on desktop, tablet, and mobile

**Technical Details:**
- Uses `@dnd-kit/core` for drag-and-drop functionality
- Real-time subscriptions via `useRealtimeList` hook
- Horizontal scrolling for mobile devices
- Sticky column headers for easy navigation

---

### 2. DEAL CARDS 💳
**Information Displayed Per Card:**

| Field | Description | Format |
|-------|-------------|---------|
| **Deal Title** | Name of the deal/opportunity | Text |
| **Company Name** | Customer company name | Text with past name support |
| **Deal Value** | Estimated deal value | Currency (₱) |
| **Weighted Value** | Deal value × win probability | Currency (₱) |
| **Win Probability** | Probability of closing | Percentage badge |
| **Owner Avatar** | Sales agent profile picture | Avatar image |
| **Owner Name** | Assigned sales agent | Text |
| **Days in Stage** | How long deal has been in current stage | Number of days |
| **Stalled Alert** | Warning if deal exceeds rooting days | Badge with icon |
| **Exit Evidence** | What qualifies deal to exit stage | Text |
| **Next Step** | Required action to advance deal | Text |

**Card States:**
- **Normal:** White background, standard border
- **Stalled:** Rose-tinted background, warning badge
- **Hover:** Shadow increase, border highlight
- **Dragging:** Opacity reduction, transform scale

---

### 3. TOOLBAR ACTIONS 🔧
**Available Actions:**

| Action | Description | Access Level |
|--------|-------------|--------------|
| **Add Deal** | Create new deal in Qualification stage | All roles |
| **Pipeline Selector** | Switch between multiple pipelines | All roles |
| **Quick Filter** | Search deals by title/company | All roles |
| **Advanced Filters** | Filter by owner, value, stage, date | All roles |
| **View Options** | Toggle between Kanban and List view | All roles |
| **Export** | Export deals to CSV/Excel | Owner, Manager |
| **Print** | Print pipeline view | All roles |

---

### 4. STATISTICS RAIL 📊
**Top-Level Metrics:**

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Total Pipeline Value** | Sum of all deal values | Σ(deal.value) |
| **Weighted Forecast** | Expected revenue based on probability | Σ(deal.value × stage.probability) |
| **Avg Days in Stage** | Average time deals stay in each stage | Σ(daysInStage) / count |
| **Stage Distribution** | Number of deals per stage | Count by stageId |

**Per-Column Statistics:**

| Metric | Description | Display |
|--------|-------------|---------|
| **Count** | Number of deals in stage | Badge on column header |
| **Total Value** | Sum of deal values in stage | Currency (₱) |
| **Avg Age** | Average days deals in stage | Number of days |
| **Win Probability** | Stage's win probability | Percentage |

---

### 5. STAGE GUIDANCE 📖
**Information Displayed Per Stage:**

| Field | Description | Example |
|-------|-------------|---------|
| **Entry Criteria** | What qualifies deal to enter stage | "Intent captured / inbound signal" |
| **Exit Criteria** | What qualifies deal to exit stage | "BANT validated, buyer engaged" |
| **Rooting Days** | Max days before considered stalled | 5 days |
| **Key Activities** | Required actions in this stage | "Document pain points, Map stakeholders" |
| **Win Probability** | Stage's win probability | 10% (Qualification) |

---

### 6. ALERTS & NOTIFICATIONS 🔔
**Alert Types:**

| Alert Type | Trigger | Recipient | Action |
|-----------|----------|-----------|---------|
| **Stalled Deal Alert** | Deal exceeds rooting days | Deal owner | Review and advance deal |
| **High-Value Deal Alert** | Deal value > ₱1M | Owner, Manager | Prioritize review |
| **Stage Movement Alert** | Deal moved to next stage | Deal owner | Acknowledge update |
| **Won Notification** | Deal closed won | Deal owner, Manager | Celebrate! |
| **Lost Notification** | Deal closed lost | Deal owner, Manager | Review reason |

**Notification Channels:**
- In-app notification bell
- Email notification (optional)
- Push notification (mobile)

---

### 7. QUICK ACTIONS ⚡
**Actions Per Deal Card:**

| Action | Description | Result |
|--------|-------------|---------|
| **Create Sales Order** | Generate sales order from deal | Redirects to Sales Order page |
| **Add Follow-up Task** | Create task linked to deal | Task appears in Tasks view |
| **Schedule Call** | Schedule call with customer | Redirects to Call Monitoring |
| **Send Proposal** | Send proposal via email | Opens email compose modal |
| **View Customer Profile** | Open customer details | Redirects to Customer Database |
| **Edit Deal** | Modify deal details | Opens edit modal |
| **Delete Deal** | Remove deal from pipeline | Confirmation dialog |

---

### 8. ADVANCED FILTERS 🔍
**Filter Options:**

| Filter Type | Options | Example |
|------------|---------|---------|
| **By Owner** | My Deals, Team Deals, All Deals | "My Deals" |
| **By Value Range** | ₱0-100K, ₱100K-500K, ₱500K-1M, ₱1M+ | "₱500K-1M" |
| **By Stage** | Qualification, Proposal, Negotiation, Lost | "Negotiation" |
| **By Days in Stage** | 0-7, 8-14, 15-30, 30+ | "8-14 days" |
| **By Probability** | 0-20%, 21-40%, 41-60%, 61-80%, 81-100% | "61-80%" |
| **By Customer Type** | VIP1, VIP2, Regular | "VIP1" |

**Filter Combinations:**
- Multiple filters can be applied simultaneously
- Filters persist in user preferences
- Quick filter presets available

---

## 👤 ROLE-BASED VIEWS

### 👑 OWNER VIEW

**What Owner Can See:**
- ✅ **All deals** from all agents
- ✅ **Team performance** dashboard
- ✅ **Revenue forecasting** (total pipeline, weighted forecast)
- ✅ **Win/loss analysis** by agent
- ✅ **Bottleneck identification** by stage
- ✅ **Deal velocity** metrics
- ✅ **Conversion funnel** analysis

**What Owner Can Do:**
- ✅ **View all deals** (no restrictions)
- ✅ **Reassign deals** between agents
- ✅ **Override stage movements**
- ✅ **Access deal analytics** (reports, charts)
- ✅ **Manage pipelines** (create, edit, delete pipelines)
- ✅ **Set stage probabilities** (adjust win % per stage)
- ✅ **Configure rooting days** (max days per stage)

**Owner Dashboard View:**
```
┌─────────────────────────────────────────────────┐
│ 📊 PIPELINE OVERVIEW                         │
├─────────────────────────────────────────────────┤
│ Total Pipeline: ₱120M  │ Weighted: ₱85M   │
│ Win Rate: 68%         │ Avg Velocity: 45d  │
├─────────────────────────────────────────────────┤
│ 🏆 TEAM PERFORMANCE                         │
├─────────────────────────────────────────────────┤
│ Sarah: 12 deals, ₱3.2M, 68% win rate     │
│ Esther: 8 deals, ₱1.5M, 42% win rate     │
│ Miguel: 6 deals, ₱1.25M, 28% win rate    │
├─────────────────────────────────────────────────┤
│ 🚧 BOTTLENECKS                              │
├─────────────────────────────────────────────────┤
│ Negotiation: 15 deals stuck (14+ days)       │
│ Root cause: Legal review delay                │
└─────────────────────────────────────────────────┘
```

**Owner Additional Features:**
- 📈 Pipeline Analytics Dashboard
- 📊 Team Performance Report
- 📉 Win/Loss Analysis by Agent
- 🎯 Forecast Accuracy Report
- 🔔 Stalled Deal Alerts (all teams)
- 📋 Pipeline Configuration Settings

---

### 👨‍💼 MANAGER VIEW

**What Manager Can See:**
- ✅ **Team deals** (agents under their supervision)
- ✅ **Team performance** metrics
- ✅ **Revenue forecasting** for their team
- ✅ **Agent coaching** opportunities
- ✅ **Deal velocity** for their team

**What Manager Can Do:**
- ✅ **View team deals** (assigned to their agents)
- ✅ **Reassign deals** within their team
- ✅ **Override stage movements** (team deals only)
- ✅ **Access team analytics** (reports, charts)
- ✅ **Provide coaching** based on deal data
- ✅ **Escalate deals** to Owner

**Manager Dashboard View:**
```
┌─────────────────────────────────────────────────┐
│ 📊 TEAM PIPELINE OVERVIEW                   │
├─────────────────────────────────────────────────┤
│ Team Total: ₱45M      │ Weighted: ₱32M    │
│ Team Win Rate: 62%     │ Avg Velocity: 48d  │
├─────────────────────────────────────────────────┤
│ 👥 AGENT PERFORMANCE                        │
├─────────────────────────────────────────────────┤
│ Sarah: 12 deals, ₱3.2M, 68% win rate     │
│ Esther: 8 deals, ₱1.5M, 42% win rate     │
│ Miguel: 6 deals, ₱1.25M, 28% win rate    │
├─────────────────────────────────────────────────┤
│ 🎯 COACHING OPPORTUNITIES                  │
├─────────────────────────────────────────────────┤
│ Esther: 5 deals stuck in Qualification     │
│ Action: Focus on BANT validation            │
└─────────────────────────────────────────────────┘
```

**Manager Additional Features:**
- 📊 Team Performance Dashboard
- 🎯 Agent Coaching Insights
- 📈 Team Revenue Forecast
- 🔔 Stalled Deal Alerts (team only)
- 📋 Deal Assignment Management

---

### 👤 SALES AGENT VIEW

**What Sales Agent Can See:**
- ✅ **My deals only** (assigned to them)
- ✅ **My performance** metrics
- ✅ **My revenue** forecast
- ✅ **My tasks** linked to deals
- ✅ **My stalled deals** alerts

**What Sales Agent Can Do:**
- ✅ **View my deals** (assigned to them only)
- ✅ **Create new deals**
- ✅ **Move deals** between stages
- ✅ **Edit deal details**
- ✅ **Add follow-up tasks**
- ✅ **Create sales orders** from deals
- ✅ **Schedule calls** from deals

**Sales Agent Dashboard View:**
```
┌─────────────────────────────────────────────────┐
│ 📊 MY PIPELINE                             │
├─────────────────────────────────────────────────┤
│ My Total: ₱3.2M      │ Weighted: ₱2.1M   │
│ My Win Rate: 68%       │ Avg Velocity: 42d  │
├─────────────────────────────────────────────────┤
│ 🎯 MY DEALS BY STAGE                      │
├─────────────────────────────────────────────────┤
│ Qualification: 3 deals (₱450K)            │
│ Proposal: 5 deals (₱1.2M)                 │
│ Negotiation: 4 deals (₱1.55M)             │
├─────────────────────────────────────────────────┤
│ ⚠️ STALLED DEALS                           │
├─────────────────────────────────────────────────┤
│ Deal A: Stuck 12 days in Qualification     │
│ Deal B: Stuck 8 days in Proposal           │
└─────────────────────────────────────────────────┘
```

**Sales Agent Additional Features:**
- 📋 My Deals Dashboard
- ✅ Quick Actions (Create Order, Add Task, Call)
- 🔔 Stalled Deal Alerts (my deals only)
- 📊 My Performance Metrics
- 🎯 My Revenue Forecast

---

### 👥 JUNIOR ASSOCIATE VIEW

**What Junior Associate Can See:**
- ✅ **My deals only** (assigned to them)
- ✅ **My performance** metrics
- ✅ **My revenue** forecast
- ✅ **My tasks** linked to deals
- ✅ **My stalled deals** alerts

**What Junior Associate Can Do:**
- ✅ **View my deals** (assigned to them only)
- ✅ **Create new deals** (with approval)
- ✅ **Move deals** between stages (with approval)
- ✅ **Edit deal details** (limited fields)
- ✅ **Add follow-up tasks**
- ✅ **View sales orders** (read-only)

**Junior Associate Dashboard View:**
```
┌─────────────────────────────────────────────────┐
│ 📊 MY PIPELINE                             │
├─────────────────────────────────────────────────┤
│ My Total: ₱350K      │ Weighted: ₱120K    │
│ My Win Rate: 15%       │ Avg Velocity: 60d  │
├─────────────────────────────────────────────────┤
│ 🎯 MY DEALS BY STAGE                      │
├─────────────────────────────────────────────────┤
│ Qualification: 5 deals (₱200K)            │
│ Proposal: 1 deal (₱100K)                  │
│ Negotiation: 0 deals                        │
├─────────────────────────────────────────────────┤
│ ⚠️ COACHING NEEDED                         │
├─────────────────────────────────────────────────┤
│ Focus: BANT validation needed               │
│ Avg time in Qualification: 25 days          │
└─────────────────────────────────────────────────┘
```

**Junior Associate Additional Features:**
- 📋 My Deals Dashboard
- ✅ Limited Quick Actions (Add Task, Call)
- 🔔 Stalled Deal Alerts (my deals only)
- 📊 My Performance Metrics
- 🎯 My Revenue Forecast
- 📝 Approval Workflow (for deal creation/stage movement)

---

### 👨‍💻 SUPPORT STAFF VIEW

**What Support Staff Can See:**
- ✅ **Read-only view** of all deals
- ✅ **Customer information** linked to deals
- ✅ **Sales order details** from deals

**What Support Staff Can Do:**
- ✅ **View deals** (read-only)
- ✅ **Search deals** by customer/company
- ✅ **View customer profile** from deal
- ✅ **View sales order** from deal
- ❌ **Cannot create/edit/delete deals**

**Support Staff Dashboard View:**
```
┌─────────────────────────────────────────────────┐
│ 📊 DEAL SEARCH                             │
├─────────────────────────────────────────────────┤
│ Search by: Company, Deal Title, Customer    │
├─────────────────────────────────────────────────┤
│ 🔍 SEARCH RESULTS                           │
├─────────────────────────────────────────────────┤
│ Deal: Jiffy Lube QC - Monthly Restock      │
│ Customer: Jiffy Lube QC                    │
│ Stage: Proposal                             │
│ Sales Order: SO-2024-1234                  │
└─────────────────────────────────────────────────┘
```

**Support Staff Additional Features:**
- 🔍 Deal Search
- 👥 Customer Profile Lookup
- 📦 Sales Order Lookup
- 📋 Read-only Deal View

---

## 🔐 PERMISSION MATRIX

| Feature | Owner | Manager | Sales Agent | Junior | Support |
|---------|--------|---------|-------------|---------|----------|
| **View All Deals** | ✅ | ❌ | ❌ | ❌ | ✅ (RO) |
| **View Team Deals** | ✅ | ✅ | ❌ | ❌ | ✅ (RO) |
| **View My Deals** | ✅ | ✅ | ✅ | ✅ | ✅ (RO) |
| **Create Deal** | ✅ | ✅ | ✅ | ⚠️ (Approval) | ❌ |
| **Edit Deal** | ✅ | ✅ | ✅ | ⚠️ (Limited) | ❌ |
| **Delete Deal** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Move Stage** | ✅ | ✅ | ✅ | ⚠️ (Approval) | ❌ |
| **Reassign Deal** | ✅ | ✅ (Team) | ❌ | ❌ | ❌ |
| **Create Sales Order** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Add Task** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Analytics** | ✅ | ✅ (Team) | ✅ (Self) | ✅ (Self) | ❌ |
| **Configure Pipeline** | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ = Full access
- ⚠️ = Limited access / Requires approval
- ❌ = No access
- (RO) = Read-only

---

## 🔗 NAVIGATION SHORTCUTS

### 1. TOPBAR NAVIGATION 📌
**Location:** Main topbar navigation (top section)

**Shortcut:**
```
Sales ▾
├── 📊 Pipelines ← Click here!
└── 📦 Sales Orders
```

**Module ID:** `sales-pipeline-board`  
**Access:** All roles (based on permissions)

---

### 2. DASHBOARD WIDGET 📊
**Location:** Dashboard page → Metrics Rail / Widget Grid

**Shortcut:**
```
┌─────────────────────────────────────┐
│ 📊 PIPELINE OVERVIEW              │
├─────────────────────────────────────┤
│ Total: ₱120M  │ Weighted: ₱85M │
│ [View Full Pipeline →] ← Click!   │
└─────────────────────────────────────┘
```

**Action:** Click "View Full Pipeline" → Opens Pipeline View

---

### 3. CUSTOMER DATABASE 👥
**Location:** Customer Details page

**Shortcuts:**

#### A. "View Pipeline History" Button
```
┌─────────────────────────────────────┐
│ CUSTOMER: BANAWE AUTO SUPPLY     │
├─────────────────────────────────────┤
│ [View Pipeline History →] ← Click!  │
└─────────────────────────────────────┘
```
**Action:** Opens Pipeline View filtered by this customer only

#### B. "Create New Deal" Button
```
┌─────────────────────────────────────┐
│ CUSTOMER: BANAWE AUTO SUPPLY     │
├─────────────────────────────────────┤
│ [Create New Deal →] ← Click!      │
└─────────────────────────────────────┘
```
**Action:** Opens "Add Deal" modal with customer pre-filled, then redirects to Pipeline View

#### C. Pipeline History Tab
```
┌─────────────────────────────────────┐
│ [Overview] [Orders] [Pipeline] ← Click!
├─────────────────────────────────────┤
│ • Deal A - Won (₱500K)          │
│ • Deal B - Lost (₱200K)          │
│ • Deal C - Negotiation (₱1.2M)    │
└─────────────────────────────────────┘
```
**Action:** Click on any deal → Opens Pipeline View with that deal highlighted

---

### 4. SALES INQUIRY 📞
**Location:** Sales Inquiry page → Inquiry Details

**Shortcuts:**

#### A. "Add to Pipeline" Button
```
┌─────────────────────────────────────┐
│ INQUIRY: Motul Oil Pricing       │
├─────────────────────────────────────┤
│ [Add to Pipeline →] ← Click!     │
└─────────────────────────────────────┘
```
**Action:** Creates new deal in Qualification stage, then redirects to Pipeline View

#### B. "Convert to Deal" Action
```
┌─────────────────────────────────────┐
│ INQUIRY ACTIONS                   │
├─────────────────────────────────────┤
│ ✓ Mark as Resolved               │
│ 🔄 Convert to Deal → ← Click!     │
│ 📝 Add Follow-up                 │
└─────────────────────────────────────┘
```
**Action:** Converts inquiry to deal, opens Pipeline View

---

### 5. SALES ORDER 📦
**Location:** Sales Order page → Order Details

**Shortcuts:**

#### A. "View Source Deal" Button
```
┌─────────────────────────────────────┐
│ SALES ORDER: SO-2024-1234        │
├─────────────────────────────────────┤
│ Source: Deal "Jiffy Lube QC"     │
│ [View Deal →] ← Click!            │
└─────────────────────────────────────┘
```
**Action:** Opens Pipeline View with that deal highlighted

#### B. Deal Link in Order Summary
```
┌─────────────────────────────────────┐
│ ORDER SUMMARY                     │
├─────────────────────────────────────┤
│ Customer: Jiffy Lube QC          │
│ Deal: [Jiffy Lube QC - Restock] ← Click!
│ Stage: Negotiation                │
└─────────────────────────────────────┘
```
**Action:** Click on deal name → Opens Pipeline View

---

### 6. TASKS VIEW ✅
**Location:** Tasks page → Task Details

**Shortcuts:**

#### A. "View Linked Deal" Button
```
┌─────────────────────────────────────┐
│ TASK: Follow up with Jiffy Lube   │
├─────────────────────────────────────┤
│ Linked Deal: Jiffy Lube QC        │
│ [View Deal →] ← Click!             │
└─────────────────────────────────────┘
```
**Action:** Opens Pipeline View with that deal highlighted

#### B. Deal Badge on Task Card
```
┌─────────────────────────────────────┐
│ 📋 Follow up with Jiffy Lube     │
│ [Deal: Jiffy Lube QC] ← Click!    │
│ Due: Nov 15, 2023                │
└─────────────────────────────────────┘
```
**Action:** Click on deal badge → Opens Pipeline View

---

### 7. DAILY CALL MONITORING 📞
**Location:** Daily Call Monitoring page → Call Details

**Shortcuts:**

#### A. "Create Deal from Call" Button
```
┌─────────────────────────────────────┐
│ CALL: Sarah → Tracy Nguyen        │
├─────────────────────────────────────┤
│ Outcome: Positive (Interested)      │
│ [Create Deal →] ← Click!          │
└─────────────────────────────────────┘
```
**Action:** Creates new deal from call data, opens Pipeline View

#### B. "Add to Existing Deal" Action
```
┌─────────────────────────────────────┐
│ CALL ACTIONS                     │
├─────────────────────────────────────┤
│ 📝 Add Note                     │
│ 🔄 Add to Existing Deal → ← Click! │
│ ➕ Create New Deal               │
└─────────────────────────────────────┘
```
**Action:** Opens deal selector modal, then redirects to Pipeline View

---

### 8. SALES REPORT 📊
**Location:** Sales Report page → Report Details

**Shortcuts:**

#### A. "View Pipeline" Button
```
┌─────────────────────────────────────┐
│ SALES REPORT: November 2024       │
├─────────────────────────────────────┤
│ Pipeline: [View →] ← Click!       │
│ Forecast: ₱85M                   │
└─────────────────────────────────────┘
```
**Action:** Opens Pipeline View filtered by deals from this report period

#### B. Deal Links in Report
```
┌─────────────────────────────────────┐
│ TOP DEALS THIS MONTH             │
├─────────────────────────────────────┤
│ 1. [Jiffy Lube QC - ₱1.2M] ← Click!
│ 2. [Banawe Auto - ₱800K] ← Click!
│ 3. [Cebu Car Care - ₱650K] ← Click!
└─────────────────────────────────────┘
```
**Action:** Click on any deal → Opens Pipeline View with that deal highlighted

---

### 9. MANAGEMENT DASHBOARD 🏆
**Location:** Management Dashboard page → Sales Performance

**Shortcuts:**

#### A. "View Pipeline" Button
```
┌─────────────────────────────────────┐
│ SALES PERFORMANCE                │
├─────────────────────────────────────┤
│ Pipeline Value: ₱120M            │
│ [View Pipeline →] ← Click!        │
└─────────────────────────────────────┘
```
**Action:** Opens Pipeline View

#### B. Agent Pipeline Links
```
┌─────────────────────────────────────┐
│ AGENT PERFORMANCE                │
├─────────────────────────────────────┤
│ Sarah: 12 deals [View →] ← Click! │
│ Esther: 8 deals [View →] ← Click! │
│ Miguel: 6 deals [View →] ← Click! │
└─────────────────────────────────────┘
```
**Action:** Click "View" → Opens Pipeline View filtered by that agent

---

### 10. NOTIFICATIONS 🔔
**Location:** Notification Center → Notification Details

**Shortcuts:**

#### A. "View Deal" Button
```
┌─────────────────────────────────────┐
│ 🔔 Stalled Deal Alert            │
├─────────────────────────────────────┤
│ Deal "Jiffy Lube QC" stuck 8 days │
│ [View Deal →] ← Click!            │
└─────────────────────────────────────┘
```
**Action:** Opens Pipeline View with that deal highlighted

#### B. Deal Links in Notifications
```
┌─────────────────────────────────────┐
│ NOTIFICATIONS                    │
├─────────────────────────────────────┤
│ 🎉 Deal "Banawe Auto" won!      │
│    [View Deal →] ← Click!         │
│ ⚠️ Deal "Shell Select" stalled    │
│    [View Deal →] ← Click!         │
└─────────────────────────────────────┘
```
**Action:** Click on deal link → Opens Pipeline View

---

### 11. KEYBOARD SHORTCUTS ⌨️
**Global Shortcuts:**

| Shortcut | Action | Access |
|----------|--------|--------|
| `Alt + P` | Open Pipeline View | All roles |
| `Ctrl/Cmd + Shift + P` | Open Pipeline View | All roles |
| `Alt + 3` → `P` | Go to Sales → Pipelines | All roles |

**Usage:** Press shortcut anywhere in app → Opens Pipeline View

---

### 12. BREADCRUMBS 🍞
**Location:** Top of every page

**Example:**
```
Home > Sales > Pipelines ← Click!
```

**Action:** Click "Pipelines" → Opens Pipeline View

---

### 13. TOP NAVIGATION 🔝
**Location:** Top bar navigation menu

**Shortcut:**
```
Sales ▾
├── 📊 Pipelines ← Click!
├── 👥 Customer Database
├── 📦 Sales Orders
└── 📋 Sales Reports
```

**Action:** Click "Pipelines" → Opens Pipeline View

---

### 14. QUICK SEARCH 🔍
**Location:** Global search bar (top right)

**Shortcut:**
```
Search: "pipeline deals" → [Enter]
```

**Action:** Opens Pipeline View with search results

---

### 15. SAVED SHORTCUTS ⭐
**Location:** Topbar navigation quick-access group

**Shortcut:**
```
⭐ Saved Shortcuts
├── 📊 Pipelines ← Click!
├── 👥 Customer Database
└── 📋 My Tasks
```

**Action:** Click "Pipelines" → Opens Pipeline View from saved topbar shortcuts

---

## 📊 NAVIGATION SUMMARY TABLE

| From Page | Shortcut Type | Action | Result |
|-----------|--------------|---------|---------|
| **Topbar** | Direct link | Click "Pipelines" | Opens Pipeline View |
| **Dashboard** | Widget button | Click "View Full Pipeline" | Opens Pipeline View |
| **Customer Database** | "View Pipeline History" | Click button | Opens Pipeline View (filtered by customer) |
| **Customer Database** | "Create New Deal" | Click button | Creates deal → Opens Pipeline View |
| **Sales Inquiry** | "Add to Pipeline" | Click button | Creates deal → Opens Pipeline View |
| **Sales Inquiry** | "Convert to Deal" | Click action | Converts inquiry → Opens Pipeline View |
| **Sales Order** | "View Source Deal" | Click button | Opens Pipeline View (deal highlighted) |
| **Tasks** | "View Linked Deal" | Click button | Opens Pipeline View (deal highlighted) |
| **Daily Call Monitoring** | "Create Deal from Call" | Click button | Creates deal → Opens Pipeline View |
| **Sales Report** | "View Pipeline" | Click button | Opens Pipeline View (filtered by report) |
| **Management Dashboard** | "View Pipeline" | Click button | Opens Pipeline View |
| **Notifications** | "View Deal" | Click button | Opens Pipeline View (deal highlighted) |
| **Keyboard** | Global shortcut | Press `Alt + P` | Opens Pipeline View |
| **Breadcrumbs** | Navigation | Click "Pipelines" | Opens Pipeline View |
| **Top Nav** | Menu item | Click "Pipelines" | Opens Pipeline View |
| **Quick Search** | Search | Type "pipeline deals" | Opens Pipeline View |
| **Favorites** | Favorite item | Click "Pipelines" | Opens Pipeline View |

---

## 🔗 INTEGRATION POINTS

### 1. LEAD TO DEAL FLOW 🔄
**Integration:** Sales Inquiry → Pipeline

**Flow:**
```
New Inquiry → Add to Pipeline → Qualification Stage → Proposal → Negotiation → Won/Lost
```

**Features:**
- Auto-populate deal fields from inquiry data
- Set initial stage = 'prospective'
- Link inquiry to deal for reference

---

### 2. CUSTOMER TO DEAL CONNECTION 👥
**Integration:** Customer Database → Pipeline

**Flow:**
```
Customer Database → Create New Deal → Pipeline View
```

**Features:**
- One-click deal creation from customer profile
- Auto-fill company/contact info
- Pipeline history tab in customer details

---

### 3. PIPELINE TO SALES ORDER 📦
**Integration:** Pipeline → Sales Order

**Flow:**
```
Pipeline Deal → Create Sales Order → Order Slip → Invoice
```

**Features:**
- "Create Sales Order" button on Proposal/Negotiation deals
- Auto-populate customer, items, pricing
- Link deal to sales order

---

### 4. PIPELINE TO TASKS ✅
**Integration:** Pipeline → Tasks

**Flow:**
```
Pipeline Deal → Add Follow-up Task → Task View
```

**Features:**
- "Add Task" button on deal cards
- Auto-link task to deal
- Set due date based on stage rooting days

---

### 5. PIPELINE TO CALL MONITORING 📞
**Integration:** Pipeline → Daily Call Monitoring

**Flow:**
```
Pipeline Deal → Schedule Call → Call Monitoring
```

**Features:**
- "Schedule Call" button on deal cards
- Auto-populate customer/contact info
- Link call to deal

---

## 🎨 UI COMPONENTS PER ROLE

### Owner UI:
- 📊 Full analytics dashboard
- 📈 Revenue charts & graphs
- 🏆 Team leaderboards
- 🚧 Bottleneck alerts
- ⚙️ Pipeline configuration panel

### Manager UI:
- 📊 Team analytics dashboard
- 📈 Team revenue charts
- 🎯 Coaching insights panel
- 👥 Agent performance cards
- 🔄 Deal assignment panel

### Sales Agent UI:
- 📋 My deals kanban board
- 🎯 Quick action buttons
- 🔔 Stalled deal alerts
- ✅ Task integration
- 📊 My performance metrics

### Junior Associate UI:
- 📋 My deals kanban board
- ✅ Limited quick actions
- 🔔 Stalled deal alerts
- 📝 Approval workflow
- 📊 My performance metrics

### Support Staff UI:
- 🔍 Search interface
- 👥 Customer profile view
- 📦 Sales order lookup
- 📋 Read-only deal view

---

## 📊 SUMMARY TABLE

| Role | View Scope | Key Features | Primary Goal |
|-------|-----------|---------------|---------------|
| **Owner** | All deals, all teams | Analytics, forecasting, pipeline config | Strategic oversight |
| **Manager** | Team deals | Team performance, coaching, deal assignment | Team optimization |
| **Sales Agent** | My deals only | Deal management, quick actions, tasks | Close deals efficiently |
| **Junior** | My deals only | Deal management (limited), approvals | Learn & close deals |
| **Support** | Read-only | Search, lookup, customer info | Assist customers |

---

## 🚀 IMPLEMENTATION PRIORITY

### HIGH PRIORITY ⭐⭐⭐
1. Add "Create Deal" button in Customer Database
2. Add "Create Sales Order" button in Pipeline cards
3. Add Pipeline widget in Dashboard
4. Add Stalled Deal notifications

### MEDIUM PRIORITY ⭐⭐
5. Add "Add Task" button in Pipeline cards
6. Add Pipeline History tab in Customer Database
7. Add Pipeline filters (by owner, value, stage)

### LOW PRIORITY ⭐
8. Add Pipeline reports
9. Add mobile-friendly view
10. Add advanced analytics

---

## 📝 NOTES

- All features are based on existing `PipelineView.tsx` component
- Uses Supabase real-time subscriptions for live updates
- Implements role-based access control (RBAC)
- Integrates with existing modules: Customer Database, Sales Orders, Tasks, Dashboard

---

**Document Version:** 1.0  
**Last Updated:** December 29, 2025  
**Author:** Kilo Code AI Assistant

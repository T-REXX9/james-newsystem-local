Legacy Codebase Analysis: Maintenance Module
Customer Data
Purpose: To manage the master list of all customers, serving as a comprehensive database for customer profiles, contact details, business terms, and transaction history. Key Features:

Customer Profile Management: Comprehensive input fields for company details, addresses (office/delivery), tax info (TIN, VAT), credit limits, and status.
Contact Management: Ability to add multiple contact persons with detailed info (Name, Position, Contact Numbers).
Terms & History: Logs for tracking history of terms, quotas, and class codes.
Bulk Actions: Admin tools for bulk assignment of sales teams, price groups, and visibility status.
Search & Filter: Robust search functionality by keyword and status filters (Active, Inactive, Blacklisted, etc.). Workflow:
View List: User navigates to the page to see a searchable list of customers.
Add/Edit: user fills out the detailed form (including dynamic contact rows) and saves.
Manage Contacts: Within the customer record, user adds or removes contact persons. Business Rules:
Critical fields like Customer Code and Name are likely required.
Access to bulk actions and deletion is restricted to specific user roles (e.g., Main ID/Admin).
Daily Call Monitoring
Purpose: To track and monitor the daily sales activities of salespersons, ensuring client engagement goals are met. Key Features:

Salesperson Filtering: Automatically filters customer lists based on the logged-in salesperson (or shows all for admins).
Period Views: Supports Daily, Monthly, and Bi-monthly (1st & 2nd half) views of call activity.
Activity Drill-down: Clicking a customer links to a detailed activity report (report/activity/calls/view). Workflow:
Select View: User toggles between Daily, Monthly, or Bi-monthly views.
Review List: User scans the list of assigned customers and their call status.
Investigate: User clicks on a specific customer to view detailed call logs. Business Rules:
Salespersons can only see their own assigned customers unless they are Admins.
Bi-monthly view splits the month into 1-15 and 16-30 day periods.
Customer Group
Purpose: To categorize customers into segments (e.g., VIP, Regular) for organized management and reporting. Key Features:

Group Management: Simple CRUD (Create, Read, Update, Delete) interface for customer groups.
Search: functionality to find groups by name. Workflow:
Create: User clicks "Create New", enters a group name, and saves.
Edit/Delete: User selects an existing group to modify or remove it. Business Rules:
Group names must be unique (implied best practice).
Confirmations are required before deletion.
Pipeline (Prospect Data)
Purpose: To manage potential new business, tracking leads (prospects) before they are converted into full customers. Key Features:

Lead Profiling: similar structure to Customer Data but specifically for leads ("Prospects").
Sales Assignment: Automatically assigns the prospect to the creating salesperson.
Qualification Data: Captures initial business data like Business Line, Area, and potential Terms. Workflow:
Lead Entry: Salesperson enters new prospect details and contact info.
Follow-up: User updates the record with comments and terms as the relationship progresses.
Conversion: Eventually converted to a Customer (implied workflow, though this page handles the "Prospect" stage). Business Rules:
Separate database/table from approved Customers.
Salesman is auto-assigned to the current user upon creation.
Suppliers
Purpose: To maintain a database of product vendors and suppliers. Key Features:

Supplier Registry: Stores Name, Code, and Remarks for each supplier.
Quick Management: Inline-style or modal-based editing (depending on specific UI flow) with checking for deletion. Workflow:
Register: User inputs Supplier Name and Code.
Maintain: User updates remarks or details as vendor relationships change. Business Rules:
Supplier Code is a key identifier.
Special Price (Price Group)
Purpose: To define pricing tiers or groups (e.g., Retail, Wholesale, Distributor) used for differentiated pricing strategies. Key Features:

Group Definition: Interface to create and name price groups.
Assignment: These groups are likely used in Inventory/Product pages to assign specific prices. Workflow:
Define Group: User creates a new Price Group (e.g., "Special Algo").
Management: User edits or deletes groups as pricing strategies evolve. Business Rules:
Acts as a master list for pricing categories; actual price amounts are defined per product linked to these groups.
Category Management
Purpose: To organize products into logical categories for inventory and sales reporting. Key Features:

Category List: Simple management of category names. Workflow:
Add Category: User enters a new category name (e.g., "Medicine", "Equipment").
Organize: User ensures category names are accurate for product assignment. Business Rules:
Categories are used to group items in inventory and sales reports.
Courier Management
Purpose: To manage a list of logistics partners or courier services used for delivery. Key Features:

Courier Registry: Stores names of shipping/courier companies. Workflow:
Add Courier: User adds a new courier partner to the system. Business Rules:
Used for selection during shipping/dispatch workflows.
Remark Templates
Purpose: To manage standard, pre-defined remarks or notes for use in transactions (e.g., invoices, orders) to ensure consistency. Key Features:

Template Library: Stores reusable text snippets for remarks. Workflow:
Create Template: User types a common remark (e.g., "Deliver on Weekends") and saves it.
Usage: (Implied) Users select these templates during transaction entry to save typing time. Business Rules:
Standardizes communication on official documents.
Staff
Purpose: To manage system users, their roles, and basic profile information. Key Features:

User Registry: Lists all staff with contact info (Email, Mobile) and Group/Role.
Access Control: "GR Access" (Goods Receipt?) specific permission link.
Search & Sort: Filter users by name or date registered. Workflow:
Onboard: Admin adds a new user, filling in name, role, and credentials.
Maintain: Admin updates user details or permissions (GR Access). Business Rules:
Some features (like GR Access) are conditional based on user type (tempusertype == 1).
Team
Purpose: To organize staff members into functional teams (e.g., Sales Team A, Support Team B). Key Features:

Group/Team Management: CRUD interface for team names. Workflow:
Create Team: Admin defines a new team.
Assignment: (Implied) Users are assigned to these teams in their profile settings. Business Rules:
Used for grouping performance reports or lead assignments.
Approver
Purpose: To configure the hierarchy of approvals for business transactions (e.g., PO approvals, Credit Limit approvals). Key Features:

Hierarchy Definition: Assigns specific users to approval levels (Order 1, Order 2, etc.).
Visual Management: Sidebar list of existing approvers for quick navigation. Workflow:
Select Approver: Admin selects a user from the staff list.
Set Level: Admin assigns an "Order" (e.g., 1 for initial approval, 5 for final).
Save: The approval chain is updated. Business Rules:
Enforces a sequential or tiered approval process for sensitive operations.
Activity Logs
Purpose: To audit and monitor system usage and user actions for security and accountability. Key Features:

Report Generation: Generates logs based on Date Range (Today, Week, Custom) and specific Staff member. Workflow:
Filter: User selects a report type (e.g., "This Week") and a specific user (or "All").
Generate: System produces a report of actions taken by the selected user(s) in that period. Business Rules:
Provides an audit trail for system changes.
System Access (Users Generated Report)
Purpose: To report on specific system access events, likely focusing on specific high-value modules or login history (referenced as "GR Access" contextually or general usage). Key Features:

Access Reporting: Similar filtering to Activity Logs (Date, Staff) but likely viewing a different set of data (Access vs. Actions). Workflow:
Configure Report: Select date range and staff.
View: Generate report to see access history. Business Rules:
Monitors who accessed what/when.


Server Maintenance
Purpose: To manage the technical health of the application server and data. Key Features:

Database Backup: One-click download of the SQL database.
Excel Backup: List of generated backups available for download.
Server Control: "Power Off" functionality to shut down the server.
Status Monitoring: Visual indicators of Server Online/Offline status. Workflow:
Backup: Admin clicks "Download Database" before major changes.
Shutdown: In emergency or maintenance windows, Admin initiates "Power Off" (with warnings). Business Rules:
Critical Access: Highly restricted functionality.
Safety: Warnings provided before shutdown to ensure no users are encoding data.
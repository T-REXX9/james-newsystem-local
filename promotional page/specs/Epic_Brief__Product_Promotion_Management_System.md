# Epic Brief: Product Promotion Management System

## Summary

The business currently lacks a systematic way to manage product promotions across multiple sales channels (social media and online marketplaces). The owner creates promotional pricing manually but has no visibility into whether sales persons actually post these promotions to the intended platforms, no proof of posting, and no way to track promotion effectiveness. This results in inconsistent promotion execution, missed sales opportunities, and inability to make data-driven decisions about which promotions work. This Epic introduces a Product Promotion Management system within the Sales module that enables the owner to create and manage promotional campaigns, assign them to sales persons, track posting compliance through screenshot verification, receive timely expiration alerts, and measure promotion performance through automated sales tracking.

## Context & Problem

### Who's Affected

**Primary Users:**
- **Business Owner** - Creates promotional campaigns, sets pricing strategies, monitors execution, and makes decisions about promotion effectiveness
- **Sales Persons** - Execute promotions by posting to various platforms and providing proof of posting

**Secondary Stakeholders:**
- Customers who benefit from promotional pricing
- The business as a whole through increased sales and better inventory turnover

### Current State & Pain Points

**For the Owner:**
1. **No Centralized Promotion Management** - Promotions are communicated informally (verbal, chat, email) with no single source of truth
2. **Zero Visibility into Execution** - Cannot verify if sales persons actually posted promotions to the intended platforms
3. **No Accountability** - No proof of posting means no way to hold sales team accountable for promotion execution
4. **Manual Expiration Tracking** - Must manually remember when promotions expire, leading to missed opportunities to extend successful promotions or end unsuccessful ones
5. **No Performance Data** - Cannot measure which promotions drive sales, making it impossible to optimize promotional strategy
6. **Pricing Complexity** - Products have multiple price tiers (AA, BB, CC, DD, VIP1, VIP2) but no way to set promotional prices per tier systematically

**For Sales Persons:**
1. **Unclear Expectations** - No clear record of which promotions they should be posting and to which platforms
2. **No Tracking** - Cannot track which promotions they've already posted vs. pending
3. **Communication Gaps** - May miss promotion updates or changes communicated informally

### Business Impact

- **Lost Revenue** - Promotions not executed consistently means missed sales opportunities
- **Inefficient Resource Allocation** - Cannot identify which promotions work, leading to continued investment in ineffective campaigns
- **Team Friction** - Lack of accountability creates tension between owner and sales team
- **Competitive Disadvantage** - Competitors with better promotion execution capture market share
- **Inventory Issues** - Cannot use promotions strategically to move slow-moving inventory

### Where in the Product

This feature will be added to the **Sales module** as a new section accessible from the main navigation. The owner will access it through a dedicated "Product Promotions" menu item, while sales persons will see promotions both in their dashboard (as a widget showing active/pending promotions) and in a dedicated page for detailed management.

The feature integrates with existing systems:
- **Product Database** (`file:components/ProductDatabase.tsx`) - For product selection and pricing
- **Sales Orders/Invoices** - For automatic performance tracking
- **Notification System** (`file:components/NotificationProvider.tsx`) - For alerts and reminders
- **RBAC System** - For owner-only access control

### Success Criteria

The feature will be successful when:
1. Owner can create, manage, and track all promotions in one place
2. Sales persons have clear visibility into what needs to be posted
3. Owner receives verifiable proof (screenshots) of all promotion postings
4. Owner gets timely alerts (7 days before expiration) to make extension decisions
5. Owner can view sales performance data to evaluate promotion effectiveness
6. The system reduces manual coordination overhead by at least 80%
# Pages Not Yet Fully Migrated to Local API Endpoints

This file tracks routed pages in the new system that are still using Supabase directly, or are still mixed between local API endpoints and Supabase.

## Criteria

- `Not fully migrated` means the page still depends on:
  - direct `supabase` usage in the component, or
  - a service that is still Supabase-backed, or
  - a mixed service path that uses both local API and Supabase.
- Static placeholder pages with no active backend integration are not listed here.

## Pages Still Needing Migration

### Mixed Local API + Supabase

1. `dashboard` / `home`
   - Sales Agent landing path
   - Routed through daily call monitoring
   - References:
     - `james-newsystem/components/DailyCallMonitoringView.tsx`
     - `james-newsystem/services/supabaseService.ts`
     - `james-newsystem/services/dailyCallMonitoringService.ts`

2. `sales-transaction-daily-call-monitoring`
   - Same backend situation as the Sales Agent dashboard path
   - References:
     - `james-newsystem/components/DailyCallMonitoringView.tsx`
     - `james-newsystem/services/supabaseService.ts`
     - `james-newsystem/services/dailyCallMonitoringService.ts`

3. `communication-productivity-daily-call-monitoring`
   - Same backend situation as the Sales Agent dashboard path
   - References:
     - `james-newsystem/components/DailyCallMonitoringView.tsx`
     - `james-newsystem/services/supabaseService.ts`
     - `james-newsystem/services/dailyCallMonitoringService.ts`

4. `warehouse-inventory-stock-adjustment`
   - Uses Supabase-backed stock adjustment service and Supabase-linked helpers
   - References:
     - `james-newsystem/components/StockAdjustmentView.tsx`
     - `james-newsystem/services/stockAdjustmentService.ts`
     - `james-newsystem/services/supabaseService.ts`

5. `ai-service-escalations`
   - Uses Supabase-backed escalation service and also reads profiles from `supabaseService`
   - References:
     - `james-newsystem/components/AIEscalationPanel.tsx`
     - `james-newsystem/services/aiEscalationService.ts`
     - `james-newsystem/services/supabaseService.ts`

### Still Supabase-Backed

6. `pipelines` / `sales-pipeline-board`
   - References:
     - `james-newsystem/components/PipelineView.tsx`
     - `james-newsystem/services/supabaseService.ts`

7. `management` / `sales-performance-management-dashboard`
   - References:
     - `james-newsystem/components/ManagementView.tsx`
     - `james-newsystem/services/supabaseService.ts`

8. `tasks` / `communication-productivity-tasks`
   - References:
     - `james-newsystem/components/TasksView.tsx`
     - `james-newsystem/services/supabaseService.ts`

9. `maintenance-profile-server-maintenance` / `recyclebin`
   - References:
     - `james-newsystem/components/RecycleBinView.tsx`
     - `james-newsystem/services/recycleBinService.ts`

10. `maintenance-customer-customer-group`
    - Direct Supabase usage in component
    - References:
      - `james-newsystem/components/Maintenance/Customer/CustomerGroups.tsx`

11. `maintenance-customer-pipeline`
    - Direct Supabase usage in component
    - References:
      - `james-newsystem/components/Maintenance/Customer/Pipeline.tsx`

12. `maintenance-product-suppliers`
    - Direct Supabase usage in component
    - References:
      - `james-newsystem/components/Maintenance/Product/Suppliers.tsx`

13. `maintenance-product-category-management`
    - Direct Supabase usage in component
    - References:
      - `james-newsystem/components/Maintenance/Product/Categories.tsx`

14. `maintenance-product-courier-management`
    - Direct Supabase usage in component
    - References:
      - `james-newsystem/components/Maintenance/Product/Couriers.tsx`

15. `maintenance-product-remark-templates`
    - Direct Supabase usage in component
    - References:
      - `james-newsystem/components/Maintenance/Product/RemarkTemplates.tsx`

16. `ai-service-dashboard`
    - References:
      - `james-newsystem/components/AIDashboardView.tsx`
      - `james-newsystem/services/aiConversationService.ts`
      - `james-newsystem/services/aiEscalationService.ts`

17. `ai-service-standard-answers`
    - References:
      - `james-newsystem/components/AIStandardAnswersView.tsx`
      - `james-newsystem/services/aiStandardAnswerService.ts`

18. `maintenance-system-loyalty-discounts`
    - References:
      - `james-newsystem/components/LoyaltyDiscountRulesView.tsx`
      - `james-newsystem/services/loyaltyDiscountService.ts`

19. `maintenance-system-profit-protection`
    - References:
      - `james-newsystem/components/ProfitThresholdSettings.tsx`
      - `james-newsystem/services/profitProtectionService.ts`

## Excluded From This List

- Placeholder/static pages without active backend integration, such as:
  - `accounting-reports-accounting-overview`
  - `james-newsystem/components/ReportsView.tsx`
- Pages already wired to local API services are intentionally excluded.

## App-Wide Note

Notifications are still Supabase-based at the app shell level:

- `james-newsystem/components/NotificationProvider.tsx`
- `james-newsystem/services/supabaseService.ts`

That means some pages that are otherwise migrated may still receive Supabase-driven notification behavior.

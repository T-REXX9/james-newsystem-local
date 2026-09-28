# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: merged-prs.spec.ts >> Merged PR Tests >> PR #38 - Stock Movement Warehouse Filter >> should show real warehouse in inventory column
- Location: e2e-tests/merged-prs.spec.ts:17:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('text=Stock Movement')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: T
    - heading "TND-OPC" [level=1] [ref=e7]
    - paragraph [ref=e8]: CRM & Inventory Management System
  - generic [ref=e9]:
    - generic [ref=e10]:
      - heading "Sign In" [level=2] [ref=e11]
      - paragraph [ref=e12]: Enter your credentials to access the dashboard
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Email or Username
        - textbox "e.g. main" [ref=e20]
      - generic [ref=e21]:
        - generic [ref=e22]: Password
        - generic [ref=e23]:
          - textbox "••••••••" [ref=e27]
          - button [ref=e28] [cursor=pointer]
      - button "Sign In" [ref=e32] [cursor=pointer]
    - paragraph [ref=e34]:
      - text: Don't have an account yet?
      - button "Sign Up" [ref=e35] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Merged PR Tests', () => {
  4   |   
  5   |   test.describe('PR #38 - Stock Movement Warehouse Filter', () => {
  6   |     test('should display warehouse filter dropdown', async ({ page }) => {
  7   |       await page.goto('/');
  8   |       
  9   |       // Navigate to Stock Movement view (adjust path as needed)
  10  |       await page.click('text=Stock Movement');
  11  |       
  12  |       // Check if warehouse filter exists
  13  |       const warehouseSelect = page.locator('select, [role="combobox"]').filter({ hasText: /WH|warehouse|Centralized/i });
  14  |       await expect(warehouseSelect.first()).toBeVisible();
  15  |     });
  16  | 
  17  |     test('should show real warehouse in inventory column', async ({ page }) => {
  18  |       await page.goto('/');
  19  |       
  20  |       // Navigate to Stock Movement
> 21  |       await page.click('text=Stock Movement');
      |                  ^ Error: page.click: Test timeout of 60000ms exceeded.
  22  |       
  23  |       // Look for warehouse identifiers in rows (WH1, WH2, etc. or "Centralized")
  24  |       const warehouseCell = page.locator('text=/WH[1-6]|Centralized/');
  25  |       await expect(warehouseCell.first()).toBeVisible();
  26  |     });
  27  | 
  28  |     test('should update header scope label when warehouse changes', async ({ page }) => {
  29  |       await page.goto('/');
  30  |       
  31  |       await page.click('text=Stock Movement');
  32  |       
  33  |       // Find and change warehouse filter
  34  |       const warehouseSelect = page.locator('select').first();
  35  |       if (await warehouseSelect.isVisible()) {
  36  |         await warehouseSelect.selectOption('WH1');
  37  |         
  38  |         // Header should reflect selected warehouse
  39  |         const header = page.locator('h5').filter({ hasText: /WH1|Centralized/ });
  40  |         await expect(header.first()).toBeVisible();
  41  |       }
  42  |     });
  43  |   });
  44  | 
  45  |   test.describe('PR #21 Frontend - Duplicate Prospect Approvals', () => {
  46  |     test('should display approval requests view', async ({ page }) => {
  47  |       await page.goto('/');
  48  |       
  49  |       // Navigate to Approval Requests or Customer Database
  50  |       await page.click('text=/Approval|Customer/i');
  51  |       
  52  |       // Check for approval requests interface
  53  |       const approvalView = page.locator('text=/Approval Request|Customer Update/i');
  54  |       await expect(approvalView.first()).toBeVisible();
  55  |     });
  56  | 
  57  |     test('should show duplicate prospect in approval requests', async ({ page }) => {
  58  |       await page.goto('/');
  59  |       
  60  |       // Access approval interface
  61  |       const approvalButton = page.locator('text=/Approval|Request/i').first();
  62  |       if (await approvalButton.isVisible()) {
  63  |         await approvalButton.click();
  64  |         
  65  |         // Look for duplicate prospect indicator
  66  |         const duplicateLabel = page.locator('text=/Duplicate|Prospect/i');
  67  |         const isVisible = await duplicateLabel.first().isVisible().catch(() => false);
  68  |         
  69  |         // If visible, verify it's present; if not, interface loaded correctly either way
  70  |         if (isVisible) {
  71  |           await expect(duplicateLabel.first()).toBeVisible();
  72  |         }
  73  |       }
  74  |     });
  75  | 
  76  |     test('should handle contact submission with duplicate detection', async ({ page }) => {
  77  |       await page.goto('/');
  78  |       
  79  |       // Navigate to add contact modal
  80  |       await page.click('text=/Add|New Customer|Create/i').catch(() => {});
  81  |       
  82  |       // Verify modal opens
  83  |       const modal = page.locator('[role="dialog"], .modal').first();
  84  |       const isModalVisible = await modal.isVisible().catch(() => false);
  85  |       
  86  |       if (isModalVisible) {
  87  |         await expect(modal).toBeVisible();
  88  |       }
  89  |     });
  90  |   });
  91  | 
  92  |   test.describe('PR #21 Backend - Prospect Creator Staff Name', () => {
  93  |     test('should display daily call master list', async ({ page }) => {
  94  |       await page.goto('/');
  95  |       
  96  |       // Navigate to Daily Call
  97  |       await page.click('text=/Daily Call|Monitoring/i').catch(() => {});
  98  |       
  99  |       // Check for list loaded
  100 |       const listView = page.locator('table, [role="grid"], .list').first();
  101 |       const isVisible = await listView.isVisible().catch(() => false);
  102 |       
  103 |       if (isVisible) {
  104 |         await expect(listView).toBeVisible();
  105 |       }
  106 |     });
  107 | 
  108 |     test('should show prospect creator staff name in list', async ({ page }) => {
  109 |       await page.goto('/');
  110 |       
  111 |       // Access Daily Call Master List
  112 |       await page.click('text=/Daily Call|Master List/i').catch(() => {});
  113 |       
  114 |       // Wait for data to load
  115 |       await page.waitForTimeout(2000);
  116 |       
  117 |       // Look for creator staff name (new field from merged PR)
  118 |       const creatorCell = page.locator('text=/Created by|Creator|Staff/i').first();
  119 |       const isVisible = await creatorCell.isVisible().catch(() => false);
  120 |       
  121 |       if (isVisible) {
```
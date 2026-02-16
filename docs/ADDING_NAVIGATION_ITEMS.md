# How to Add New Navigation Items

This guide explains how to add new pages/modules to the topbar navigation.

## Quick Steps

### 1. Add the Menu Item to Topbar Config

Edit `utils/topbarMenuConfig.ts` and add your new item to the appropriate menu:

```typescript
export const TOPBAR_MENU_CONFIG = [
  // ... existing menus ...
  {
    id: 'your-section',
    label: 'YOUR SECTION',
    icon: YourIcon,
    submenus: [
      {
        id: 'your-submenu',
        label: 'YOUR SUBMENU',
        icon: YourIcon,
        items: [
          {
            id: 'your-new-page',
            label: 'Your New Page',
            route: 'your-new-page',
            icon: YourIcon,
          },
        ],
      },
    ],
  },
];
```

**Available Main Menus:**
- `HOME` - Core dashboard
- `WAREHOUSE` - Inventory, Purchasing, Reports
- `SALES` - Transactions, Reports
- `ACCOUNTING` - Transactions, Accounting, Reports
- `MAINTENANCE` - Customer, Product, Profile
- `COMMUNICATION` - Text Menu

### 2. Import the Icon

At the top of `utils/topbarMenuConfig.ts`, import your icon from lucide-react:

```typescript
import { 
  LayoutDashboard, 
  Mail, 
  // ... other icons ...
  YourIcon  // Add your new icon here
} from 'lucide-react';
```

Browse available icons at: https://lucide.dev/icons/

### 3. Add to Available Modules List

Edit `constants.ts` and add your module to `AVAILABLE_APP_MODULES`:

```typescript
export const AVAILABLE_APP_MODULES = [
  // ... existing modules ...
  { id: 'your-new-page', label: 'Your New Page' },
];
```

This ensures the module appears in access control settings.

### 4. Add Route Handler in App.tsx

Edit `App.tsx` and add a case in the `renderContent()` function:

```typescript
const renderContent = () => {
  switch (activeTab) {
    // ... existing cases ...
    case 'your-new-page':
      return (
        <div className="h-full overflow-y-auto">
          <YourNewPageComponent />
        </div>
      );
    // ... rest of cases ...
  }
};
```

### 5. Create Your Component

Create your new page component in `components/YourNewPage.tsx`:

```typescript
import React from 'react';

const YourNewPage: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your New Page</h1>
      {/* Your content here */}
    </div>
  );
};

export default YourNewPage;
```

### 6. Configure Access Control (Optional)

If you want to restrict access to certain roles:

Edit `components/TopbarNavigation.tsx` and add special logic in `canAccessRoute()`:

```typescript
const canAccessRoute = (routeId: string) => {
  // ... existing logic ...
  
  // Special case: Your new page only for specific roles
  if (routeId === 'your-new-page') {
    return user.role === 'Owner' || user.role === 'Manager';
  }
  
  // ... rest of logic ...
};
```

## Example: Adding a "Reports" Page

### Step 1: Add to Topbar Config
```typescript
{
  id: 'reports',
  label: 'REPORTS',
  icon: FileBarChart,
  submenus: [
    {
      id: 'reports-main',
      label: 'MAIN',
      icon: FileBarChart,
      items: [
        { id: 'reports', label: 'Reports', route: 'reports', icon: FileBarChart },
      ],
    },
  ],
},
```

### Step 2: Import Icon
```typescript
import { FileBarChart } from 'lucide-react';
```

### Step 3: Add to Constants
```typescript
{ id: 'reports', label: 'Reports' },
```

### Step 4: Add Route
```typescript
case 'reports':
  return (
    <div className="h-full overflow-y-auto">
      <ReportsView />
    </div>
  );
```

### Step 5: Create Component
```typescript
// components/ReportsView.tsx
import React from 'react';

const ReportsView: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <p>Your reports content here</p>
    </div>
  );
};

export default ReportsView;
```

## Tips

### Icon Selection
- Choose icons that clearly represent the feature
- Keep icon style consistent (all from lucide-react)
- Preview icons at https://lucide.dev/icons/

### Grouping
- Place related items in the same group
- Groups are separated by visual dividers
- Order items logically within groups

### Naming
- Use clear, concise labels (2-3 words max)
- Be consistent with existing naming patterns
- Avoid abbreviations unless widely understood

### Access Control
- By default, items respect the `access_rights` array
- Owners always see all items
- Add special cases only when needed

## Testing

After adding a new item, test:

1. ✅ Item appears in topbar for authorized users
2. ✅ Item is hidden for unauthorized users
3. ✅ Clicking item navigates to correct page
4. ✅ Tooltip shows correct label
5. ✅ Active state highlights correctly
6. ✅ Item appears in Settings > Access Control

Run tests:
```bash
npm run test
```

## Troubleshooting

- If the menu item doesn't appear, confirm the user has the route in `access_rights`.
- If the route renders "Coming Soon", add a case to `App.tsx`.
- If the menu item still doesn't appear, verify the ID matches in `utils/topbarMenuConfig.ts` and `constants.ts`.
- If an icon doesn't render, confirm the lucide icon is imported and capitalized.
- If access control fails, review `components/TopbarNavigation.tsx` `canAccessRoute()`.

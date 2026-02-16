# Role-Based Permission TND OPC - Codebase Wiki

## Overview

This is a comprehensive sales management and customer relationship management (CRM) system built with React 19, TypeScript, and Vite. The application features role-based access control, sales pipeline management, customer database, product inventory, and call monitoring capabilities.

## Technology Stack

- **Frontend**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 6.2.0
- **UI Framework**: Tailwind CSS (utility classes)
- **State Management**: React hooks and context
- **Data Visualization**: Recharts 3.4.1
- **Drag & Drop**: @dnd-kit/core and @dnd-kit/sortable
- **Icons**: Lucide React
- **Database**: Supabase (with local storage mock)
- **AI Integration**: Google Gemini API
- **Testing**: Vitest with React Testing Library

## Project Structure

```
├── components/           # React components
│   ├── __tests__/       # Component tests
│   ├── *.tsx           # Component files
│   └── mockData.ts     # Mock data definitions
├── data/               # Static data files
├── lib/                # Utility libraries
├── services/           # API and business logic
│   └── __tests__/     # Service tests
├── references/         # Documentation and requirements
├── App.tsx            # Main application component
├── types.ts           # TypeScript type definitions
├── constants.ts       # Application constants and mock data
└── vite.config.ts     # Vite configuration
```

## Core Features

### 1. Role-Based Access Control
- **User Profiles**: `UserProfile` interface with role-based permissions
- **Module Access**: `AVAILABLE_APP_MODULES` defines accessible features
- **Permission System**: `access_rights` array controls module visibility

### 2. Sales Pipeline Management
- **Deal Stages**: `DealStage` enum (New → Discovery → Qualified → Proposal → Negotiation → Closed Won/Lost)
- **Pipeline Columns**: Configurable stages with probability weighting
- **Deal Tracking**: `PipelineDeal` interface with value, stage, and owner information

### 3. Customer Database
- **Contact Management**: Comprehensive `Contact` interface with company details
- **Customer Status**: Active, Inactive, Prospective, Blacklisted
- **Contact Persons**: Multiple contacts per company with roles
- **Sales History**: Transaction records and interaction tracking

### 4. Product Inventory
- **Product Catalog**: `Product` interface with detailed specifications
- **Multi-Warehouse**: Stock tracking across 6 warehouses
- **Price Tiers**: Multiple price groups (AA, BB, CC, DD, VIP1, VIP2)
- **Reorder Management**: Automated reorder reports with status tracking

### 5. Call Monitoring & Communication
- **Call Logging**: `CallLogEntry` with outcomes and follow-up actions
- **Multi-Channel**: Call, text, email, and chat support
- **Performance Metrics**: Agent call statistics and conversion rates
- **Daily Monitoring**: Automated call log generation

### 6. Task Management
- **Task Assignment**: `Task` interface with priorities and due dates
- **Status Tracking**: Todo, In Progress, Done states
- **Agent Assignment**: Task delegation to team members

### 7. Analytics & Reporting
- **Dashboard Metrics**: Revenue, active deals, win rates, pipeline value
- **Visual Charts**: Pie charts for regional distribution, bar charts for revenue
- **Top Products**: Performance tracking by product category

## Key Components

### Layout Components
- **App.tsx**: Main application router and layout orchestrator
- **TopNav.tsx**: Application header with role-aware topbar navigation
- **TopbarNavigation.tsx**: Dropdown navigation menus with role-based visibility

### Core Views
- **Dashboard.tsx**: Overview with metrics and charts
- **PipelineView.tsx**: Drag-and-drop sales pipeline management
- **CustomerDatabase.tsx**: Customer search and management
- **ProductDatabase.tsx**: Product catalog and inventory
- **CallMonitoringView.tsx**: Daily call tracking and agent performance
- **TasksView.tsx**: Task management and assignment
- **StaffView.tsx**: Team member management and performance

### Utility Components
- **MetricsCard.tsx**: Reusable metric display component
- **CompanyName.tsx**: Company branding component
- **ToastProvider.tsx**: Notification system

## Data Models

### Core Types (types.ts)

#### Customer Management
```typescript
interface Contact {
  id: string;
  company: string;
  customerSince: string;
  team: string;
  salesman: string;
  status: CustomerStatus;
  contactPersons: ContactPerson[];
  // ... extensive fields for business logic
}
```

#### Sales Pipeline
```typescript
interface PipelineDeal {
  id: string;
  title: string;
  company: string;
  value: number;
  stageId: string;
  ownerName?: string;
  // ... deal-specific fields
}
```

#### Product Catalog
```typescript
interface Product {
  id: string;
  part_no: string;
  brand: string;
  price_aa: number;
  price_bb: number;
  // ... multiple price tiers and warehouse stocks
}
```

## Mock Data System

### Constants (constants.ts)
- **MOCK_CONTACTS**: 12 sample customers with realistic business data
- **MOCK_PRODUCTS**: 6 automotive parts with multi-warehouse inventory
- **MOCK_AGENTS**: 15 sales team members with performance metrics
- **MOCK_TASKS**: Sample tasks for demonstration
- **PIPELINE_COLUMNS**: Configurable sales stages

### Data Generation
- **generateCallMonitoringSeed()**: Creates 30 days of realistic call data
- **REPORT_PIE_DATA**: Regional distribution metrics
- **TOP_PRODUCTS_DATA**: Performance ranking data

## Services Architecture

### Supabase Integration
- **lib/supabaseClient.ts**: Supabase client configuration
- **services/supabaseService.ts**: Data access layer with CRUD operations
- **services/geminiService.ts**: AI-powered lead scoring and insights

### AI Features
- **Lead Scoring**: `LeadScoreResult` with win probability prediction
- **AI Enrichment**: Contact records with AI-generated insights
- **Next Best Actions**: Recommended follow-up activities

## Development Workflow

### Build Commands
```bash
npm install          # Install dependencies
npm run dev          # Development server (localhost:8080)
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run test suite
```

### Environment Setup
- **VITE_API_KEY**: Required for AI features (exposed to the browser)
- **VITE_SUPABASE_URL**: Supabase project URL (exposed to the browser)
- **VITE_SUPABASE_ANON_KEY**: Supabase anon key (exposed to the browser)
- **.env.local**: Local environment configuration
- **Vite Configuration**: Environment variable injection

## Testing Strategy

### Test Structure
- **Component Tests**: Located in `components/__tests__/`
- **Service Tests**: Located in `services/__tests__/`
- **Test Setup**: `vitest.setup.ts` with custom matchers
- **Testing Library**: React component testing utilities

### Mock Strategy
- **Supabase Mocking**: `vi.mock('../services/supabaseService')`
- **Data Isolation**: Test-specific data fixtures
- **UI Testing**: `screen.getByRole` and accessibility queries

## Security & Configuration

### Access Control
- **Role-Based UI**: Menu items filtered by user permissions
- **Module Security**: `access_rights` array controls feature access
- **Data Protection**: No sensitive data in client-side storage

### Configuration Management
- **Environment Variables**: API keys and configuration
- **Build Optimization**: Vite production optimizations
- **Asset Management**: Static asset handling

## Deployment Considerations

### Production Build
- **Output Directory**: `dist/` folder
- **Asset Optimization**: Vite build pipeline
- **Environment Configuration**: Production-specific settings

### API Integration
- **Supabase Connection**: Replace mock with real Supabase instance
- **Gemini API**: AI service integration
- **Authentication**: User authentication system

## Extending the Application

### Adding New Modules
1. Update `AVAILABLE_APP_MODULES` in constants.ts
2. Create component in `components/` directory
3. Add route in `App.tsx`
4. Update permissions in user profiles

### Data Model Extensions
1. Add interfaces to `types.ts`
2. Update mock data in `constants.ts`
3. Extend service layer in `services/`
4. Add corresponding tests

### UI Components
- Follow existing naming conventions (PascalCase)
- Use Tailwind utility classes for styling
- Implement responsive design patterns
- Add accessibility attributes

## Best Practices

### Code Organization
- **Single Responsibility**: Each component has one clear purpose
- **Type Safety**: Comprehensive TypeScript usage
- **Consistent Naming**: camelCase for functions, PascalCase for components
- **File Structure**: Logical grouping and clear separation

### Performance
- **Lazy Loading**: Route-based code splitting
- **Memoization**: React.memo for expensive components
- **Bundle Optimization**: Vite tree-shaking and minification
- **Image Optimization**: Efficient asset loading

### Testing
- **Coverage**: Comprehensive test coverage for critical paths
- **Mock Data**: Realistic test data fixtures
- **User Interactions**: Test user workflows and edge cases
- **Accessibility**: ARIA attributes and keyboard navigation

## Troubleshooting

### Common Issues
- **Build Failures**: Check TypeScript types and imports
- **Mock Data Issues**: Verify data structure matches interfaces
- **Test Failures**: Ensure mocks are properly configured
- **Environment Issues**: Check .env.local configuration

### Debug Tools
- **React DevTools**: Component state and props inspection
- **Vite Dev Server**: Hot module replacement and error overlay
- **Console Logging**: Strategic logging for debugging
- **Network Tab**: API request inspection

## Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Analytics**: More sophisticated reporting and insights
- **Mobile App**: React Native mobile application
- **Integration Hub**: Third-party service integrations

### Technical Improvements
- **State Management**: Redux or Zustand for complex state
- **Performance**: Virtual scrolling for large datasets
- **Offline Support**: Service worker implementation
- **PWA Features**: Progressive web app capabilities

---

*This wiki serves as a comprehensive guide for developers working on the Role-Based Permission TND OPC system. For specific implementation details, refer to the inline code documentation and test files.*

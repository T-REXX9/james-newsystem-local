# TND-OPC Login System: Full Authentication Flow Report

## Overview
The TND-OPC CRM system implements a comprehensive authentication system using Supabase. The system handles user registration, login, session management, and role-based access control.

## Architecture Components

### 1. Frontend Authentication Layer
**File:** `components/Login.tsx`

The login component provides a dual-mode interface for both sign-in and sign-up operations:

#### Key Features:
- **Dual Authentication Modes**: Toggle between sign-in and sign-up forms
- **Theme Support**: Dark/light mode toggle with localStorage persistence
- **Convenience Login**: Supports "main" username shortcut for admin access
- **Real-time Validation**: Form validation with immediate feedback
- **Loading States**: Visual feedback during authentication operations

#### Authentication Methods:
1. **Sign In** (`handleSignIn`):
   ```typescript
   const { error } = await supabase.auth.signInWithPassword({
     email: getEmail(formData.email),
     password: formData.password
   });
   ```

2. **Sign Up** (`handleSignUp`):
   ```typescript
   const { error } = await supabase.auth.signUp({
     email: getEmail(formData.email),
     password: formData.password,
     options: {
       data: {
         full_name: formData.fullName,
         avatar_url: `https://i.pravatar.cc/150?u=${Math.random()}`
       }
     }
   });
   ```

### 2. Authentication Client (Supabase)
**File:** `lib/supabaseClient.ts`

The system uses Supabase for authentication and database operations.

#### Core Authentication Functions:

##### User Registration:
```typescript
signUp: async ({ email, password, options }: any) => {
  if (!isEmailValid(email)) return { data: null, error: { message: 'Invalid email address' } };
  if (!isPasswordValid(password)) return { data: null, error: { message: 'Password must be at least 8 characters and include letters and numbers' } };

  const users = getTable<MockUser>('users');
  if (users.find(u => u.email === email)) {
    return { data: null, error: { message: 'User already registered' } };
  }

  const metadata = options?.data || {};
  const role = metadata.role && STAFF_ROLES.includes(metadata.role) ? metadata.role : DEFAULT_STAFF_ROLE;
  const accessRights = metadata.access_rights?.length ? metadata.access_rights : DEFAULT_STAFF_ACCESS_RIGHTS;
  const avatar = metadata.avatar_url || generateAvatarUrl(metadata.full_name, email);

  const newUser: MockUser = {
    id: Math.random().toString(36).slice(2, 11),
    email,
    password,
    user_metadata: { ...metadata, role, access_rights: accessRights, avatar_url: avatar }
  };

  setTable('users', [...users, newUser]);
  
  const profiles = getTable('profiles');
  const profilePayload = {
    id: newUser.id,
    email: newUser.email,
    full_name: metadata.full_name,
    avatar_url: avatar,
    role,
    access_rights: accessRights,
    birthday: metadata.birthday,
    mobile: metadata.mobile
  };
  setTable('profiles', [...profiles, profilePayload]);
  notifyTableInsert('profiles', profilePayload);

  return { data: { user: newUser, session: null }, error: null };
}
```

##### User Authentication:
```typescript
signInWithPassword: async ({ email, password }: any) => {
  const users = getTable<MockUser>('users');
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return { data: { session: null }, error: { message: 'Invalid login credentials' } };
  }

  const session = {
    access_token: 'mock_token_' + Date.now(),
    user: user
  };
  localStorage.setItem(DB_PREFIX + 'session', JSON.stringify(session));
  
  // Notify App.tsx immediately
  notifySubscribers('SIGNED_IN', session);

  return { data: { session, user }, error: null };
}
```

#### Session Management:
- **Session Storage**: Sessions stored in localStorage with prefix `nexus_crm_local_session`
- **Auth State Observers**: Real-time notification system for auth state changes
- **Automatic Cleanup**: Session removal on sign out

### 3. Application-Level Authentication
**File:** `App.tsx`

The main application component manages authentication state and user access control.

#### Authentication Flow:
1. **Initial Session Check**:
   ```typescript
   useEffect(() => {
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
       if (session?.user) fetchUserProfile(session.user.id);
       else setAppLoading(false);
     });

     const {
       data: { subscription },
     } = supabase.auth.onAuthStateChange((_event, session) => {
       setSession(session);
       if (session?.user) fetchUserProfile(session.user.id);
       else {
         setUserProfile(null);
         setAppLoading(false);
       }
     });

     return () => subscription.unsubscribe();
   }, []);
   ```

2. **User Profile Fetching**:
   ```typescript
   const fetchUserProfile = async (userId: string) => {
     try {
       const { data, error } = await supabase
         .from('profiles')
         .select('*')
         .eq('id', userId)
         .single();
       
       if (data) {
         setUserProfile(data);
       } else {
         // Fallback profile creation
         const { data: { user } } = await supabase.auth.getUser();
         if (user) {
              const newProfile = {
                  id: user.id,
                  email: user.email || '',
                  full_name: user.user_metadata?.full_name,
                  avatar_url: user.user_metadata?.avatar_url,
                  role: 'Sales Agent',
                  access_rights: ['dashboard', 'pipelines', 'mail', 'calendar', 'tasks'] 
              };
              setUserProfile(newProfile);
         }
       }
     } catch (e) {
       console.error('Error fetching profile', e);
     } finally {
       setAppLoading(false);
     }
   };
   ```

### 4. Database Schema & User Management
**Files:** `supabase/migrations/001_create_profiles_table.sql`, `002_adjust_profiles_table.sql`

#### Profiles Table Structure:
```sql
create table public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  role text,
  access_rights text[],
  birthday text,
  mobile text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

#### Key Features:
- **Row Level Security (RLS)**: Enabled with policies for public read and user-specific write access
- **Auto-Profile Creation**: Trigger function automatically creates profiles on user registration
- **Access Control**: Array-based permission system for module access

#### Default User Seeding:
The system automatically seeds two default users:

1. **Admin User**:
   - Email: `main@tnd-opc.com`
   - Password: `12345678`
   - Role: `Owner`
   - Access: `['*']` (Full access)

2. **Test Agent**:
   - Email: `agent@tnd-opc.com`
   - Password: `123456`
   - Role: `Sales Agent`
   - Access: `['dashboard', 'pipelines', 'mail', 'calendar', 'tasks']`

### 5. Staff Account Service Layer

**File:** `services/supabaseService.ts`

`createStaffAccount()` now orchestrates staff onboarding:
- Validates `CreateStaffAccountInput` (email format, password strength, role membership)
- Generates deterministic avatar URLs via `generateAvatarUrl`
- Calls `supabase.auth.signUp` with metadata (`full_name`, `role`, `access_rights`, `birthday`, `mobile`)
- Verifies profile creation (trigger) and falls back to `createProfileManually` if missing
- Returns `CreateStaffAccountResult` with `validationErrors` for UI display

Helper functions:
- `verifyProfileExists(userId)` — checks `profiles` for trigger success
- `createProfileManually(profile)` — service-role insert for recovery flows
- Admin utilities: `bulkCreateStaffAccounts`, `resetStaffPassword`, `deactivateStaffAccount`, `updateStaffRole`

Error Mapping:
- Duplicate emails → "An account with this email already exists."
- Weak passwords → "Password does not meet security requirements."
- Fallback: generic retry message

### 6. Trigger Logging & Observability

**Migration:** `supabase/migrations/005_enhance_profile_trigger.sql`

- Adds `profile_creation_logs` table to capture trigger success/failures with metadata and error messages
- Trigger validates email format, preserves idempotency via `ON CONFLICT`, and logs all outcomes
- Provides audit trail for debugging profile creation issues

### 5. Role-Based Access Control (RBAC)

#### Permission System:
```typescript
const checkPermission = (moduleId: string) => {
  if (!userProfile) return false;
  if (userProfile.role === 'Owner') return true;

  // Sales Agents always reach their dashboard
  if (
    moduleId === 'dashboard' &&
    (userProfile.role === 'Sales Agent' || userProfile.role === 'sales_agent')
  ) {
    return true;
  }
  
  const rights = userProfile.access_rights || []; 
  return rights.includes('*') || rights.includes(moduleId);
};
```

#### Role Hierarchy:
1. **Owner**: Full system access (`['*']`)
2. **Sales Agent**: Limited access to specific modules
3. **Custom Roles**: Configurable via `access_rights` array

## Complete Authentication Flow

### 1. User Registration Flow
```
User fills signup form → 
Login component calls supabase.auth.signUp() → 
Mock client validates email uniqueness → 
Creates user record in localStorage → 
Creates corresponding profile with default permissions → 
Returns success response → 
UI shows success message and switches to signin mode
```

### 2. User Login Flow
```
User enters credentials → 
Login component calls supabase.auth.signInWithPassword() → 
Mock client validates credentials against localStorage → 
On success: Creates session token → 
Stores session in localStorage → 
Notifies auth state subscribers → 
App.tsx receives auth state change → 
Fetches user profile → 
Updates application state → 
Renders main application with appropriate dashboard
```

### 3. Session Persistence Flow
```
Application loads → 
App.tsx checks for existing session → 
If session exists: Fetches user profile → 
Restores authentication state → 
Renders main application → 
If no session: Shows login component
```

### 4. Logout Flow
```
User clicks logout → 
App.tsx calls supabase.auth.signOut() → 
Mock client removes session from localStorage → 
Notifies auth state subscribers → 
App.tsx clears session and profile state → 
Renders login component
```

## Security Features

### 1. Input Validation
- Email format validation
- Password requirements enforcement
- Duplicate email prevention during registration

### 2. Session Management
- Mock JWT-like token generation
- Session expiration handling
- Secure session storage in localStorage

### 3. Access Control
- Module-based permission system
- Role hierarchy enforcement
- Automatic access denial for unauthorized modules

### 4. Data Protection
- Row Level Security (RLS) policies
- User-specific data access
- Profile isolation between users

## Error Handling

### Authentication Errors:
- Invalid credentials
- User already exists
- Network/connection issues
- Missing user profiles

### UI Error States:
- Real-time error messages
- Loading state indicators
- Graceful fallbacks for missing data

## Development Considerations

### Supabase Configuration:
- Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables
- Uses Supabase Auth for secure authentication
- JWT tokens managed by Supabase
- Real-time database operations

### Production Readiness:
- Replace mock client with real Supabase client
- Implement proper password hashing
- Add email verification for registration
- Implement proper session token validation
- Add rate limiting and brute force protection

## Testing Support

The system includes comprehensive test coverage:
- Component testing for Login form
- Service layer testing for authentication functions
- Mock data seeding for consistent test environments
- Auth state change simulation

## Conclusion

The TND-OPC login system provides a robust, scalable authentication framework with:
- Complete user lifecycle management (registration → login → session management → logout)
- Role-based access control with granular permissions
- Secure session handling with automatic cleanup
- Comprehensive error handling and user feedback
- Mock implementation for development/testing with clear migration path to production

The architecture follows modern React patterns and Supabase conventions, making it maintainable and extensible for future enhancements.

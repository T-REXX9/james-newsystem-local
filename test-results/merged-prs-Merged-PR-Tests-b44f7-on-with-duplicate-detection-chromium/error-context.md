# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: merged-prs.spec.ts >> Merged PR Tests >> PR #21 Frontend - Duplicate Prospect Approvals >> should handle contact submission with duplicate detection
- Location: e2e-tests/merged-prs.spec.ts:76:5

# Error details

```
Test timeout of 60000ms exceeded.
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
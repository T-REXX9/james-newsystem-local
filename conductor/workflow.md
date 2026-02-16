# Development Workflow

## Principles
1.  **Test-Driven Development (TDD):** Write tests before implementation.
2.  **Atomic Commits:** Commit changes after every completed task.
3.  **Documentation:** Keep documentation up-to-date with code changes.

## Phase Completion Verification and Checkpointing Protocol
At the end of each phase, perform the following:
1.  **Verify:** Run all tests to ensure no regressions.
2.  **Lint:** Ensure code adheres to style guides.
3.  **Checkpoint:** Create a git tag for the completed phase (e.g., `phase-1-complete`).

## Task Execution Flow
1.  **Context:** Understand the task requirements.
2.  **Test:** Write a failing test case.
3.  **Implement:** Write the minimum code to pass the test.
4.  **Refactor:** Improve code structure without changing behavior.
5.  **Verify:** Run all tests.
6.  **Commit:** Commit changes with a descriptive message.
    -   **Format:** `type(scope): description`
    -   **Record:** Use `git notes` to store the task summary and status.

## Quality Standards
-   **Test Coverage:** Maintain >80% code coverage.
-   **Linting:** Zero linting errors required.
-   **Formatting:** Auto-format code on save/commit.
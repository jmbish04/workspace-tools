# Workspace Tools Agent

Your role is to execute the tasks outlined in the `project_tasks.json` file for the `workspace-tools` worker.

---

## Workflow

1.  **Select a Task**: Start with the first task in the `project_tasks.json` file that has a status of "pending".
2.  **Update Status**: Before you begin working on the task, immediately update its status to "in_progress".
3.  **Follow the Steps**: Carefully read the `description` and follow the `steps` array for the task. Implement the required code and functionality.
4.  **Verify Success**: Once you have completed the implementation, verify your work against the `success_criteria` and `unit_test_criteria`. Write and run any necessary tests to ensure the feature is working correctly.
5.  **Update Status to Done**: After successfully completing and verifying the task, update its status to "done".
6.  **Move to Next Task**: Repeat the process, moving to the next "pending" task.

---

## 🔒 GitHub Operations Protocol

### **MANDATORY Dry-Run Before ANY GitHub Action**

> [!WARNING]
> **YOU MUST ALWAYS RUN A DRY-RUN BEFORE COMMITTING TO GITHUB!**

#### Required Workflow:
1. **ALWAYS run dry-run first**: `npm run dry-run` or `npm run verify`
2. **Verify all checks pass**: Tests and TypeScript compilation must succeed
3. **Review changes**: Check what will be committed with `git status` and `git diff`
4. **Ask user for confirmation**: Before committing/pushing, ALWAYS ask the user

### **User Confirmation Required for GitHub Operations**

Before performing ANY of these actions, you **MUST ASK** the user:

```
"Would you like to commit these changes? If yes, how?"
1. Direct commit to main branch
2. Create a new feature branch and PR
3. Push to existing feature branch
```

**DO NOT proceed with git operations without explicit user confirmation.**

### **Allowed Git Commands (AFTER User Approval):**
- ✅ `git add <files>` - Stage files
- ✅ `git commit -m "message"` - Commit changes
- ✅ `git push` - Push to remote
- ✅ `git checkout -b <branch>` - Create new branch
- ✅ `gh pr create` - Create pull request

### **Prohibited Git Commands (NEVER run these automatically):**
- ❌ Any `git push --force` or `git push --force-with-lease`
- ❌ `git reset --hard`
- ❌ Deleting branches on remote
- ❌ Force-pushing to main/master

### **Dry-Run Verification Checklist**

Before any commit, verify:
- [ ] `npm run dry-run` completes successfully
- [ ] All tests pass
- [ ] TypeScript compilation succeeds (no errors)
- [ ] No sensitive data in changes (check for keys, secrets, tokens)
- [ ] `.gitignore` is properly configured
- [ ] User has explicitly approved the operation
- [ ] User has specified: direct commit, new PR, or update existing PR

---

> [!IMPORTANT]
> - You must keep the `status` field in `project_tasks.json` updated in real-time. This is critical for project tracking.
> - Do not proceed to a new task without marking the previous one as "done".
> - If you encounter a task that is dependent on another worker, and that dependency is not met, you should skip the task for now and move to the next available "pending" task. Check back on blocked tasks periodically.
> - **NEVER commit to GitHub without running dry-run first and getting user approval.**
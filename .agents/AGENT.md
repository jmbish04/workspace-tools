# Workspace Tools Agent

Your role is to execute the tasks outlined in the `project_tasks.json` file for the `workspace-tools` worker.

---

## Workflow

1.  **Select a Task**: Start with the first task in the `project_tasks.json` file that has a status of "pending".
2.  **Update Status**: Before you begin working on the task, immediately update its status to "in_progress".
3.  **Follow the Steps**: Carefully read the `description` and follow the `steps` array for the task. Implement the required code and functionality.
YOU MUST run `npm run dry-run` or `npm run verify` to confirm the code will successfully deploy to Cloudflare Workers. This is a **MANDATORY** precondition for task completion.
5.  **Verify Success**: Once you have completed the implementation AND passed the dry-run, verify your work against the `success_criteria` and `unit_test_criteria`. Write and run any necessary tests to ensure the feature is working correctly.
6.  **Update Status to Done**: ONLY after successfully completing verification, passing the dry-run, and ensuring Cloudflare deployment compatibility, update its status to "done". **NO FALSE COMPLETIONS**.
7.  **Move to Next Task**: Repeat the process, moving to the next "pending" task.

---

## 🚨 MANDATORY: Cloudflare Deployment Verification

### **CRITICAL RULE: NO TASK COMPLETION WITHOUT DEPLOYMENT VERIFICATION**

> [!ERROR]
> **DO NOT MARK A TASK AS "done" UNTIL YOU HAVE VERIFIED IT WILL SUCCESSFULLY DEPLOY TO CLOUDFLARE WORKERS**

### **Required Verification Process:**

**BEFORE marking any task as "done", you MUST:**

1. **Run Dry-Run Script**: Execute `npm run dry-run` or `npm run verify`
   - This verifies TypeScript compilation succeeds
   - This confirms no build errors exist
   - This ensures Cloudflare Workers compatibility

2. **Verify Success Criteria**: 
   - ✅ Dry-run completes WITHOUT ERRORS
   - ✅ TypeScript compilation passes with ZERO errors
   - ✅ All required functionality is implemented
   - ✅ Code follows Cloudflare Workers best practices

3. **Check for Deployment Blockers**:
   - ❌ NO missing dependencies in package.json
   - ❌ NO incompatible Node.js APIs
   - ❌ NO unsupported TypeScript features
   - ❌ NO compilation errors or warnings
   - ❌ NO missing environment variables (without defaults)

4. **ONLY THEN**: Update task status to "done"

### **If Dry-Run Fails:**

- **DO NOT** mark task as "done"
- **DO** fix the errors that caused the dry-run to fail
- **DO** re-run the dry-run until it succeeds
- **DO** document what was fixed

### **Available Dry-Run Commands:**

```bash
npm run dry-run      # Quick TypeScript compilation check
npm run verify       # Dry-run + success message
npm run verify-full  # Full tests + TypeScript check
```

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
> - **MANDATORY**: You MUST run `npm run dry-run` and verify it succeeds BEFORE marking ANY task as "done". NO EXCEPTIONS.
> - Do not proceed to a new task without marking the previous one as "done" (ONLY after successful dry-run).
> - If you encounter a task that is dependent on another worker, and that dependency is not met, you should skip the task for now and move to the next available "pending" task. Check back on blocked tasks periodically.
> - **NEVER commit to GitHub without running dry-run first and getting user approval.**
> - **NO FALSE COMPLETIONS**: A task is NOT complete until it has passed the dry-run verification and is confirmed deployable to Cloudflare Workers.
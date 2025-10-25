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

> [!IMPORTANT]
> - You must keep the `status` field in `project_tasks.json` updated in real-time. This is critical for project tracking.
> - Do not proceed to a new task without marking the previous one as "done".
> - If you encounter a task that is dependent on another worker, and that dependency is not met, you should skip the task for now and move to the next available "pending" task. Check back on blocked tasks periodically.
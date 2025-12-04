Based on the comprehensive codebase provided, the app is a solid, functional **Offline-First Expense Tracker** with PWA capabilities, Supabase sync, and basic AI integration.

Here are the most logical next steps for development, prioritized by **User Value** and **Technical Robustness**.

### 1. Feature Expansion: Recurring Expenses (Subscriptions)
Currently, the app only handles one-off manual entries. A key feature for any finance app is handling automatic recurring costs (Rent, Netflix, Spotify).

*   **Why:** Reduces user friction and ensures budgets are accurate even if the user forgets to log fixed costs.
*   **Implementation Plan:**
    *   **Database:** Create a `recurring_expenses` table (similar to `expenses` but with `frequency`, `next_due_date`, and `active` status).
    *   **Logic:**
        *   **Client-side:** On app startup (`useOfflineSync` or a new hook), check if any `next_due_date` has passed.
        *   **Action:** If passed, automatically insert a new record into the `expenses` table and update the `next_due_date` in the recurring table.
    *   **UI:** Add a "Recurring" toggle in the `AddExpenseWizard` or a dedicated "Subscriptions" view in the Dashboard.

### 2. Technical Refinement: Robust Sync Architecture (Soft Deletes)
The current `use-offline-sync.ts` has a critical limitation: **Deletions might not sync correctly across devices**, and the "pull" logic is limited to the last 50 items (`.limit(50)`). If a user edits an old transaction on Device A, Device B might never see it.

*   **Why:** Data integrity is the hardest part of offline-first apps. The current approach will eventually lead to data drift.
*   **Implementation Plan:**
    *   **Soft Deletes:** Instead of `DELETE FROM expenses`, add a `deleted_at` column. When a user deletes an expense, mark `deleted_at = NOW()` and `sync_status = 'pending'`.
    *   **Sync Logic:** Update the pull logic to fetch *all* records where `updated_at > last_sync_timestamp`, regardless of how old the record is. This ensures edits to old history are captured.
    *   **Cleanup:** Filter out `deleted_at IS NOT NULL` records in the UI (Dexie queries) but keep them in the DB for sync purposes.

### 3. Feature Expansion: Income Tracking & Multiple Wallets
The database `categories` table already supports `type: 'income'`, but the UI is heavily focused on expenses and "Total Spent."

*   **Why:** Users need to know "Money Left" (Net Worth), not just "Money Spent."
*   **Implementation Plan:**
    *   **Wallets/Accounts:** Create an `accounts` table (e.g., Cash, Bank, Credit Card).
    *   **Expense Association:** Link expenses to an account.
    *   **UI Updates:**
        *   Update `AddExpenseWizard` to support "Income" (green UI theme vs red).
        *   Update `DashboardView` to show "Balance" (Income - Expense).
        *   Add a visual distinction between Cash and Card transactions.

### 4. AI Enhancement: Receipt Scanning (OCR)
You already have Gemini integrated for categorization and insights. The next logical step for an "AI Expense Tracker" is image recognition.

*   **Why:** Typing amounts and selecting categories is tedious. Taking a photo is fast.
*   **Implementation Plan:**
    *   **Frontend:** Add a Camera button to the `AddExpensePage`.
    *   **Backend:** Create a route `/api/ai/scan-receipt`.
    *   **AI Logic:** Send the image (base64) to Gemini Pro Vision.
    *   **Prompt:** "Extract total amount, date, and merchant from this receipt. Suggest a category ID from this list: [category_list]."
    *   **Wizard:** Pre-fill the `AddExpenseWizard` with the AI response.

### 5. Data Portability: CSV Import
You currently have an Export feature (`handleExportData` in settings), but no way to Import.

*   **Why:** New users often come from Excel or other apps. Migrating history is a major blocker to adoption.
*   **Implementation Plan:**
    *   **Library:** Use `papaparse` for CSV parsing.
    *   **UI:** A drag-and-drop zone in Settings.
    *   **Mapping:** A simple interface to map CSV columns (Date, Amount, Note) to the App's schema.
    *   **Batch Insert:** Use Dexie's `bulkAdd` for performance.

### Recommended Immediate Roadmap

1.  **Fix Sync (Soft Deletes):** Do this first. It's much harder to fix sync issues once users have production data.
2.  **Recurring Expenses:** High value, moderate effort.
3.  **Income Support:** Unlock the existing database capability in the UI.
4.  **Receipt OCR:** The "Cool factor" feature for marketing/portfolio.
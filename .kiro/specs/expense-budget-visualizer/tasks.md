# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side expense tracker using vanilla HTML, CSS, and JavaScript. The implementation follows the layered event-driven architecture defined in the design: a single `index.html`, `css/style.css`, and `js/app.js`, with Chart.js v4 loaded from CDN. All data is persisted in Local Storage. Tasks are ordered so each step produces working, integrated code — there is no orphaned logic at any checkpoint.

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` at the workspace root with the full HTML structure described in the design: `#app`, `header > #balance-display`, `main` containing sections `#input-section`, `#category-section`, `#limit-section`, `#chart-section`, `#monthly-section`, `#list-section`, and `#global-error`
  - Add all required IDs and element types: `form#transaction-form`, `#item-name`, `#item-amount`, `#item-category`, `form#category-form`, `#category-name`, `select#limit-category`, `#limit-amount`, `button#set-limit`, `button#remove-limit`, `canvas#pie-chart`, `div#chart-placeholder`, `button#open-monthly`, `dialog#monthly-dialog` (with `select#month-select`, `select#year-select`, `div#monthly-results`, `button#close-monthly`), `div#transaction-list`, `div#list-empty-state`
  - Include a `<link>` to `css/style.css` and a `<script defer src="js/app.js">` at the bottom of `<head>`
  - Include Chart.js v4 CDN `<script>` tag: `https://cdn.jsdelivr.net/npm/chart.js`
  - Create the empty files `css/style.css` and `js/app.js` so the page loads without errors
  - _Requirements: 9.4_

- [x] 2. Implement constants, state object, and utility functions
  - [x] 2.1 Write the `// === CONSTANTS ===` section in `js/app.js`
    - Define `STORAGE_KEYS` (`ebv_transactions`, `ebv_categories`, `ebv_limits`), `DEFAULT_CATEGORIES` (`['Food', 'Transport', 'Fun']`), and validation limits (`MAX_NAME_LEN = 100`, `MAX_AMOUNT = 999_999_999.99`, `MAX_CATEGORY_NAME_LEN = 50`, `MAX_CUSTOM_CATEGORIES = 50`)
    - _Requirements: 1.1, 5.1, 5.6, 6.1_
  - [x] 2.2 Write the `// === STATE ===` section
    - Declare the module-level `state` object with fields: `transactions: []`, `categories: ['Food', 'Transport', 'Fun']`, `limits: {}`, `storageUnavailable: false`, `chartInstance: null`
    - _Requirements: 8.5_
  - [x] 2.3 Implement `generateId()` and `formatAmount(amount)`
    - `generateId()` uses `crypto.randomUUID()` with a `Date.now() + Math.random()` string fallback
    - `formatAmount(amount)` uses `Intl.NumberFormat` with `'en-US'` locale and `'USD'` currency style, falling back to manual formatting if `Intl` is unavailable; must produce `$1,234.56` style strings with exactly 2 decimal places
    - _Requirements: 2.2, 3.1, 7.3_

- [x] 3. Implement Storage Layer
  - [x] 3.1 Write the `// === STORAGE ===` section in `js/app.js`
    - Implement `loadAll()`: wraps every `localStorage` read in try/catch; on any failure sets `state.storageUnavailable = true`; parses JSON for `ebv_transactions`, `ebv_categories`, `ebv_limits`; on JSON parse error resets that key to its default and logs a console warning; populates `state` from parsed values
    - Implement `saveTransactions()`, `saveCategories()`, `saveLimits()`: each wraps `localStorage.setItem` in try/catch; on `QuotaExceededError` shows a toast/alert; on other errors logs to console
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 3.2 Write property test for Local Storage round-trip (Property 10)
    - **Property 10: Local Storage round-trip preserves all application data**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
    - In `tests/property.test.html`, load fast-check via CDN and write a property test that generates arbitrary arrays of transactions, arrays of custom category name strings, and limit maps, serializes them via the save functions (or directly via `JSON.stringify`), then calls `loadAll()` equivalents and asserts structural/value equivalence

- [x] 4. Implement Validation Layer
  - [x] 4.1 Write the `// === VALIDATION ===` section in `js/app.js`
    - `validateTransaction(name, amount, category)`: returns `{ valid: bool, errors: { name?, amount?, category? } }`; name must be non-empty and ≤ 100 chars (after trimming whitespace); amount must be a number > 0, ≤ 999,999,999.99, with at most 2 decimal places; category must be non-empty
    - `validateCategory(name)`: returns `{ valid: bool, error: string|null }`; name must be non-empty string of 1–50 characters; must not duplicate any existing category (case-insensitive match against `state.categories`); must not exceed 50 total custom categories
    - `validateLimit(value)`: returns `{ valid: bool, error: string|null }`; value must parse to a finite number in [0.01, 999,999,999.99]
    - _Requirements: 1.4, 1.5, 5.1, 5.3, 5.4, 5.6, 6.1, 6.6_
  - [ ]* 4.2 Write property test for transaction validation (Property 2)
    - **Property 2: Invalid transaction input is rejected and list is unchanged**
    - **Validates: Requirements 1.4, 1.5**
    - Generate arbitrary inputs where at least one of name/amount/category is invalid; assert `validateTransaction` returns `valid: false`
  - [ ]* 4.3 Write property test for spending limit validation (Property 8)
    - **Property 8: Spending limit validation accepts valid values and rejects invalid values**
    - **Validates: Requirements 6.1, 6.6**
    - Generate arbitrary numeric and non-numeric values; assert `validateLimit` returns `valid: true` iff value is in [0.01, 999,999,999.99]
  - [ ]* 4.4 Write property test for duplicate category rejection (Property 6)
    - **Property 6: Duplicate category names are rejected (case-insensitive)**
    - **Validates: Requirements 5.3**
    - Generate a category list and a new name whose lowercase matches an existing entry; assert `validateCategory` returns `valid: false`

- [x] 5. Implement computed aggregation helpers
  - [x] 5.1 Write the pure aggregation functions used by the Render Layer
    - `computeTotal(transactions)` → number: sum of all `amount` values
    - `computeCategoryTotals(transactions)` → `Record<string, number>`: sums amounts grouped by `category`
    - `isOverLimit(category, totals, limits)` → boolean: true iff `totals[category] >= limits[category]` and `limits[category]` is defined
    - `filterByMonth(transactions, month, year)` → `Transaction[]`: includes only transactions whose `timestamp` ISO string falls in the given month (1-indexed) and year
    - _Requirements: 3.1, 4.1, 6.3, 6.4, 7.2, 7.3_
  - [ ]* 5.2 Write property test for `computeTotal` and `computeCategoryTotals` (Property 1 partial, Property 5 partial)
    - **Property 1: Valid transaction addition increases list length and updates balance**
    - **Validates: Requirements 1.3, 3.1, 3.2**
    - Generate arrays of valid transactions; assert `computeTotal` equals the arithmetic sum of all amounts; assert `computeCategoryTotals` values sum to `computeTotal`
  - [ ]* 5.3 Write property test for `filterByMonth` (Property 9)
    - **Property 9: Monthly filter includes exactly the transactions for the selected period**
    - **Validates: Requirements 7.2, 7.3**
    - Generate arrays of transactions with arbitrary timestamps; for a randomly chosen month/year assert the filtered result contains exactly those transactions within that period

- [x] 6. Implement Transactions and Categories logic
  - [x] 6.1 Write the `// === TRANSACTIONS ===` section in `js/app.js`
    - `addTransaction(name, amount, category)`: creates a `Transaction` object using `generateId()`, current `new Date().toISOString()` timestamp; pushes to `state.transactions`; calls `saveTransactions()`; calls `renderAll()`
    - `deleteTransaction(id)`: saves a pre-deletion snapshot of `state.transactions`; removes the matching entry; calls `saveTransactions()`; if `saveTransactions` throws, restores the snapshot and displays the deletion-failed error message (Requirement 2.6); calls `renderAll()`
    - _Requirements: 1.3, 2.4, 2.6, 8.1, 8.2_
  - [x] 6.2 Write the `// === CATEGORIES ===` section in `js/app.js`
    - `addCategory(name)`: trims the name, calls `validateCategory`, on success pushes to `state.categories`, calls `saveCategories()`, calls `renderCategoryDropdowns()`
    - Ensure default categories are always present by initializing `state.categories` to `DEFAULT_CATEGORIES` if no custom categories are stored
    - _Requirements: 5.2, 5.5, 8.3_
  - [x] 6.3 Write the `// === LIMITS ===` section in `js/app.js`
    - `setLimit(category, value)`: parses and validates value with `validateLimit`; on success assigns `state.limits[category] = parsedValue`; calls `saveLimits()`; calls `renderAll()`
    - `removeLimit(category)`: deletes `state.limits[category]`; calls `saveLimits()`; calls `renderAll()`
    - _Requirements: 6.1, 6.2, 6.7, 8.4_

- [x] 7. Checkpoint — core logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Render Layer
  - [x] 8.1 Implement `renderBalance()` in the `// === RENDER ===` section
    - Reads `computeTotal(state.transactions)`; formats with `formatAmount`; updates `#balance-display` text content; if total is negative, the formatted string must include a negative sign before the currency symbol
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 8.2 Implement `renderList()`
    - Clears `#transaction-list`; if empty, shows `#list-empty-state` (Requirement 2.5) and hides the list
    - Renders transactions sorted by `timestamp` descending (Requirement 2.1)
    - Each row shows item name, `formatAmount(amount)` (Requirement 2.2), category, and a delete button with an accessible `aria-label`
    - Applies a `over-limit` CSS class and an indicator icon to any row whose category is over its spending limit (Requirement 6.3); removes that class from non-exceeded rows
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 6.3_
  - [x] 8.3 Implement `renderChart()`
    - Computes category totals with `computeCategoryTotals`; excludes categories with zero total (Requirement 4.1)
    - If no transactions, destroys any existing `state.chartInstance`, hides the canvas, shows `#chart-placeholder` (Requirement 4.4)
    - Otherwise hides placeholder, shows canvas; creates or updates `state.chartInstance` using `Chart` global; each segment's label shows category name and percentage rounded to 1 decimal place (Requirement 4.2)
    - Applies a distinct border style to any segment whose category is over its spending limit (Requirement 6.4)
    - Guards the entire function with `if (typeof Chart === 'undefined')` to handle CDN load failure (design error handling)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.4_
  - [x] 8.4 Implement `renderCategoryDropdowns()`
    - Populates `#item-category` and `select#limit-category` with options for every entry in `state.categories` (defaults + customs); preserves currently selected value where possible
    - _Requirements: 1.2, 5.2_
  - [x] 8.5 Implement `renderLimitControls()`
    - For the currently selected category in `#limit-category`, populates `#limit-amount` with the existing limit value if one exists; otherwise clears the field
    - _Requirements: 6.1_
  - [x] 8.6 Implement `renderAll()`
    - Calls `renderBalance()`, `renderList()`, `renderChart()`, `renderCategoryDropdowns()`, `renderLimitControls()` in sequence
    - _Requirements: 3.2, 3.3, 4.3, 6.5_
  - [ ]* 8.7 Write property test for category dropdown completeness (Property 4)
    - **Property 4: Category dropdown reflects the complete category set**
    - **Validates: Requirements 1.2, 5.2**
    - Generate arbitrary sets of custom category names; call `renderCategoryDropdowns()` against a stubbed DOM; assert the resulting options equal `DEFAULT_CATEGORIES` plus all custom names with no duplicates
  - [ ]* 8.8 Write property test for pie chart data correctness (Property 5)
    - **Property 5: Pie chart data matches category totals and percentages sum to 100%**
    - **Validates: Requirements 4.1, 4.2**
    - Generate arbitrary non-empty transaction arrays; compute category totals; assert each chart dataset value matches the category total and that rounded percentages sum to 100%
  - [ ]* 8.9 Write property test for overspend highlight correctness (Property 7)
    - **Property 7: Spending limit overspend detection is applied correctly to all visual indicators**
    - **Validates: Requirements 6.3, 6.4**
    - Generate arbitrary transactions and limits; assert `isOverLimit` returns true iff category total ≥ limit and that render functions apply the highlight class accordingly

- [x] 9. Implement Monthly Summary view
  - [x] 9.1 Write the `// === MONTHLY ===` section in `js/app.js`
    - `openMonthly()`: opens `dialog#monthly-dialog` (via `.showModal()` or display toggle); populates `#year-select` with options from 2000 to 2100 and `#month-select` with options January–December; defaults both to the current month and year (Requirement 7.1); calls `renderMonthly(currentMonth, currentYear)`
    - `renderMonthly(month, year)`: calls `filterByMonth(state.transactions, month, year)`; if empty shows no-data message (Requirement 7.4); otherwise renders total and per-category breakdown using `formatAmount` (Requirement 7.3) in `#monthly-results`
    - `closeMonthly()`: closes the dialog; leaves all stored data unchanged (Requirement 7.5)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10. Implement Event Listeners and initialization
  - [x] 10.1 Write the `// === EVENT LISTENERS ===` section in `js/app.js`
    - `form#transaction-form` submit: calls `validateTransaction`; on failure renders inline errors (via `<span class="field-error">` elements) adjacent to each offending input (Requirements 1.4, 1.5) and focuses the first errored field; on success calls `addTransaction(name, amount, category)`, clears all form fields, refocuses `#item-name` (Requirements 1.3, 1.6); on each `input` event on a field that previously had an error, clear that specific error (Requirement 1.7)
    - `form#category-form` submit: calls `validateCategory`; on failure shows error in `#category-error` (Requirements 5.3, 5.4, 5.6); on success calls `addCategory(name)` and clears the input
    - `button#set-limit` click: calls `validateLimit`; on failure shows error in `#limit-error` (Requirement 6.6); on success calls `setLimit(selectedCategory, value)`
    - `button#remove-limit` click: calls `removeLimit(selectedCategory)` (Requirement 6.7)
    - `select#limit-category` change: calls `renderLimitControls()` to update the displayed limit value
    - `button#open-monthly` click: calls `openMonthly()`
    - `button#close-monthly` click: calls `closeMonthly()`
    - `#month-select` and `#year-select` change: calls `renderMonthly(selectedMonth, selectedYear)`
    - `#transaction-list` delegated click: detects clicks on delete buttons, extracts transaction ID from `data-id` attribute, calls `deleteTransaction(id)`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.4, 5.2, 5.3, 5.4, 5.6, 6.6, 6.7, 7.1, 7.5_
  - [x] 10.2 Write the `// === INIT ===` section in `js/app.js`
    - Add `document.addEventListener('DOMContentLoaded', () => { loadAll(); if (state.storageUnavailable) { /* show #global-error */ } renderAll(); })`
    - Show `#global-error` banner if `state.storageUnavailable` is true after `loadAll()` (Requirement 8.6)
    - _Requirements: 8.5, 8.6, 9.1_
  - [ ]* 10.3 Write property test for valid transaction addition (Property 1)
    - **Property 1: Valid transaction addition increases list length and updates balance**
    - **Validates: Requirements 1.3, 3.1, 3.2**
    - Generate valid transaction inputs; call `addTransaction` against an in-memory state clone; assert list length increased by exactly 1 and `computeTotal` increased by exactly the transaction's amount
  - [ ]* 10.4 Write property test for transaction deletion (Property 3)
    - **Property 3: Transaction deletion removes exactly the targeted entry and adjusts the balance**
    - **Validates: Requirements 2.4, 3.3**
    - Generate a non-empty list of transactions and a random valid ID from that list; call `deleteTransaction(id)`; assert the resulting list has exactly the original entries minus the deleted one and `computeTotal` decreased by exactly the deleted amount

- [x] 11. Checkpoint — full logic wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement CSS styling
  - [x] 12.1 Write base layout and typography in `css/style.css`
    - Set up CSS custom properties for colors (primary, error, over-limit highlight), spacing, and font stack
    - Style `#app`, `header`, `main`, and `section` elements for a readable single-column or two-column layout
    - Ensure the page is responsive on common viewport widths
    - _Requirements: 9.3_
  - [x] 12.2 Style Input_Form, Category, and Limit sections
    - Style `form` elements, `input`, `select`, `button` controls with clear focus indicators for accessibility
    - Style `.field-error` spans with a distinct error color (red family) and position them adjacent to the offending input
    - Style `#category-error` and `#limit-error` similarly
    - _Requirements: 1.4, 1.5, 5.3, 6.6_
  - [x] 12.3 Style Transaction_List
    - Style `#transaction-list` with `overflow-y: auto` and a constrained max-height so it is scrollable (Requirement 2.3)
    - Style individual transaction rows with item name, formatted amount, category, and delete button laid out clearly
    - Define `.over-limit` class: distinct background color and an indicator icon (e.g., a warning icon via CSS content or a Unicode character) not applied to normal rows (Requirement 6.3)
    - Style `#list-empty-state` as a centered, muted placeholder text
    - _Requirements: 2.2, 2.3, 2.5, 6.3_
  - [x] 12.4 Style the Pie_Chart section and Monthly Summary dialog
    - Constrain `canvas#pie-chart` to a reasonable fixed width/height; center it
    - Style `#chart-placeholder` as a centered placeholder text; show/hide via CSS class toggled by JS
    - Style `dialog#monthly-dialog` (or fallback overlay div): centered modal with backdrop; accessible close button
    - _Requirements: 4.4, 7.1_
  - [x] 12.5 Style the Balance Display and Global Error banner
    - Style `#balance-display` prominently in the header; large font size, bold weight
    - Style `#global-error` as a persistent full-width warning banner (amber/yellow) that appears at the top of the page when Local Storage is unavailable
    - _Requirements: 3.1, 8.6_

- [x] 13. Implement `formatAmount` property test and amount formatting edge cases (Property 11)
  - [ ]* 13.1 Write property test for `formatAmount` (Property 11)
    - **Property 11: Amount formatting produces correct currency string for all non-negative values**
    - **Validates: Requirements 2.2, 3.1**
    - Generate arbitrary non-negative numbers; assert `formatAmount` returns a string starting with `$`, containing exactly two decimal digits, and using a thousands separator for values ≥ 1,000
  - [x] 13.2 Verify `formatAmount` is used consistently in all display sites
    - Audit `renderBalance()`, `renderList()`, and `renderMonthly()` to confirm all amount values are routed through `formatAmount`; fix any direct string concatenations found
    - _Requirements: 2.2, 3.1, 7.3_

- [x] 14. Final checkpoint — full integration
  - Ensure all tests pass across Chrome, Firefox, Edge, and Safari (use the browser compatibility checklist in the design). Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- All `*`-marked property tests use **fast-check** loaded via CDN in `tests/property.test.html`
- Each test file is tagged with `// Feature: expense-budget-visualizer, Property N: <property_text>` as defined in the design
- Checkpoints at tasks 7, 11, and 14 ensure incremental integration is validated before moving to the next phase
- The `dialog` element is used for the Monthly Summary; a `div` overlay fallback is applied if `HTMLDialogElement` is not supported
- No build tools, bundlers, or transpilers are used — all files run directly in the browser

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["3.1", "5.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 6, "tasks": ["8.6", "9.1"] },
    { "id": 7, "tasks": ["8.7", "8.8", "8.9", "10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.4", "12.5"] },
    { "id": 11, "tasks": ["13.1", "13.2"] }
  ]
}
```

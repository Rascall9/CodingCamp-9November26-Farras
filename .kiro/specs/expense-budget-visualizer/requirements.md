# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that enables users to track personal expenses, manage custom budget categories, set spending limits, and visualize spending distribution through interactive charts. The application stores all data in the browser's Local Storage and requires no backend server. It is built with HTML, CSS, and Vanilla JavaScript only, and is compatible with modern browsers (Chrome, Firefox, Edge, Safari). The app can be used as a standalone web page or packaged as a browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, amount, category, and timestamp.
- **Category**: A named label assigned to a Transaction (e.g., Food, Transport, Fun, or a user-defined custom category).
- **Default_Category**: One of the three built-in categories: Food, Transport, Fun.
- **Custom_Category**: A user-defined category name that extends the default set.
- **Input_Form**: The UI form containing fields for item name, amount, and category used to add a Transaction.
- **Transaction_List**: The scrollable UI component displaying all saved Transactions.
- **Balance_Display**: The UI element at the top of the App showing the total sum of all Transaction amounts.
- **Pie_Chart**: The visual chart showing spending distribution by category.
- **Spending_Limit**: A user-defined maximum amount for a Category, beyond which the App highlights overspending.
- **Monthly_Summary**: A filtered view of Transactions and totals scoped to a selected calendar month and year.
- **Local_Storage**: The browser's Web Storage API used to persist all application data client-side.
- **Chart_Library**: Chart.js (loaded via CDN), used to render the Pie_Chart.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to enter expense details through a form, so that I can record my spending quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for the item name with a maximum length of 100 characters, a numeric field for the amount accepting up to 2 decimal places, and a dropdown for the Category.
2. THE Input_Form SHALL populate the Category dropdown with all Default_Categories and all saved Custom_Categories.
3. WHEN the user submits the Input_Form with all fields filled and an amount greater than 0.00 and no greater than 999,999,999.99, THE App SHALL create a new Transaction and add it to the Transaction_List.
4. IF the user submits the Input_Form with one or more empty fields, THEN THE App SHALL display an inline validation error adjacent to each empty field and SHALL NOT create a Transaction.
5. IF the user submits the Input_Form with an amount that is not a number, is zero, is negative, or exceeds 999,999,999.99, THEN THE App SHALL display an inline validation error adjacent to the amount field and SHALL NOT create a Transaction.
6. WHEN a Transaction is successfully added, THE App SHALL clear all Input_Form fields and return focus to the item name field.
7. WHEN the user corrects a field that previously showed an inline validation error and resubmits the Input_Form with all fields valid, THE App SHALL remove the inline validation error for that field.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all saved Transactions sorted by Transaction date in descending order, with the most recently dated Transaction appearing first.
2. THE Transaction_List SHALL display each Transaction's item name, amount formatted with a currency symbol, thousands separator, and two decimal places, and Category.
3. THE Transaction_List SHALL be scrollable when the number of Transactions exceeds the visible area.
4. WHEN the user clicks the delete button on a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Local_Storage.
5. WHEN no Transactions exist, THE Transaction_List SHALL display an empty-state message indicating no expenses have been recorded.
6. IF a Transaction cannot be removed from Local_Storage, THEN THE App SHALL display an error message indicating the deletion failed and retain that Transaction in the Transaction_List.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending at a glance, so that I always know how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of the amounts of all current Transactions, formatted with a currency symbol, thousands separator, and exactly 2 decimal places.
2. WHEN a Transaction is added, THE Balance_Display SHALL update to reflect the new total within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 1 second without requiring a page reload.
4. WHEN no Transactions exist, THE Balance_Display SHALL display a total of zero formatted as "0.00" with the currency symbol.
5. IF the sum of all Transaction amounts is negative, THEN THE Balance_Display SHALL display the total with a negative sign preceding the currency symbol.

---

### Requirement 4: Visual Spending Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money goes.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display one segment per Category that has at least one Transaction, sized proportionally to that Category's total spending across all stored Transactions relative to the sum of all stored Transaction amounts, and SHALL exclude any Category whose total spending is zero.
2. THE Pie_Chart SHALL label each segment with the Category name and its percentage of total spending rounded to one decimal place, where the displayed percentages across all segments sum to 100%.
3. WHEN a Transaction is added or deleted, THE Pie_Chart SHALL update to reflect the current spending distribution within 1 second of the change.
4. WHEN no Transactions exist, THE Pie_Chart SHALL display a placeholder message indicating there is no data to visualize.
5. THE App SHALL render the Pie_Chart using the Chart_Library loaded via CDN.

---

### Requirement 5: Custom Categories

**User Story:** As a user, I want to create my own expense categories, so that I can tailor the App to my personal spending habits.

#### Acceptance Criteria

1. THE App SHALL provide a UI control for the user to enter and save a new Custom_Category name of 1 to 50 characters.
2. WHEN the user submits a non-empty, unique Custom_Category name of 1 to 50 characters, THE App SHALL add the Custom_Category to Local_Storage and make it available in the Input_Form Category dropdown within 1 second.
3. WHEN the user submits a Custom_Category name that already exists (case-insensitive), THE App SHALL display an inline error message and SHALL NOT create a duplicate Category.
4. WHEN the user submits an empty Custom_Category name, THE App SHALL display a validation error and SHALL NOT create the Category.
5. THE App SHALL persist all Custom_Categories in Local_Storage so that they are available after the browser is closed and reopened.
6. IF the total number of Custom_Categories already stored equals 50, THEN THE App SHALL display an error message indicating the category limit has been reached and SHALL NOT create the new Category.

---

### Requirement 6: Spending Limit and Overspending Highlight

**User Story:** As a user, I want to set a spending limit per category, so that I can be alerted when I exceed my budget for that category.

#### Acceptance Criteria

1. THE App SHALL allow the user to set a Spending_Limit for each Category (both Default_Categories and Custom_Categories), where the Spending_Limit must be a numeric value between 0.01 and 999,999,999.99 inclusive.
2. THE App SHALL persist all Spending_Limits in Local_Storage so that they survive a page reload.
3. WHEN the total spending for a Category meets or exceeds its Spending_Limit, THE App SHALL visually highlight that Category's entries in the Transaction_List with a distinct background color and an indicator icon that are not applied to non-exceeded categories.
4. WHEN the total spending for a Category meets or exceeds its Spending_Limit, THE App SHALL visually highlight that Category's segment in the Pie_Chart with a distinct border or pattern that is not applied to non-exceeded segments.
5. WHEN a Transaction is added or deleted and the Category total changes relative to its Spending_Limit, THE App SHALL update all highlights within 500 milliseconds without requiring a page reload.
6. IF a Spending_Limit input is a non-positive number, zero, or a non-numeric value, THEN THE App SHALL display a validation error message indicating the valid range, SHALL retain the invalid input in the field, and SHALL NOT save the Spending_Limit.
7. WHEN the user removes a Spending_Limit for a Category, THE App SHALL remove all overspending highlights for that Category and SHALL delete the Spending_Limit from Local_Storage.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my expenses filtered by month, so that I can track my spending patterns over time.

#### Acceptance Criteria

1. THE App SHALL provide a month/year selector control that allows the user to choose any calendar month and year between January 2000 and December 2100, defaulting to the current calendar month and year when the Monthly_Summary is first opened.
2. WHEN the user selects a month and year, THE App SHALL display only the Transactions whose timestamp falls within that calendar month and year in the Monthly_Summary.
3. THE Monthly_Summary SHALL display the total spending amount for the selected period and, for each Category that has at least one Transaction in that period, SHALL display the Category name and the sum of Transaction amounts belonging to that Category.
4. IF the selected month and year contain no Transactions, THEN THE Monthly_Summary SHALL display a message indicating that no expenses exist for the selected period.
5. WHEN the user dismisses or closes the Monthly_Summary view, THE App SHALL return to the full Transaction_List view without modifying any stored data.

---

### Requirement 8: Data Persistence

**User Story:** As a user, I want my data to be saved automatically, so that I do not lose my expense records when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE App SHALL write the updated Transaction list to Local_Storage within 100 milliseconds of the creation event.
2. WHEN a Transaction is deleted, THE App SHALL write the updated Transaction list to Local_Storage within 100 milliseconds of the deletion event.
3. WHEN a Custom_Category is created or deleted, THE App SHALL write the updated Custom_Category list to Local_Storage within 100 milliseconds of the mutation event.
4. WHEN a Spending_Limit is set or removed, THE App SHALL write the updated Spending_Limit data to Local_Storage within 100 milliseconds of the mutation event.
5. WHEN the App is loaded, THE App SHALL read all Transactions, Custom_Categories, and Spending_Limits from Local_Storage and restore the full application state before rendering the UI.
6. IF Local_Storage is unavailable or returns a parse error, THEN THE App SHALL display a warning message indicating that data cannot be saved and operate in a session-only mode without persisting data.

---

### Requirement 9: Performance and Compatibility

**User Story:** As a user, I want the App to load and respond quickly in any modern browser, so that I have a smooth experience without delays.

#### Acceptance Criteria

1. THE App SHALL render the initial UI and restore saved data within 2 seconds when measured on a device with a broadband connection of at least 10 Mbps download speed.
2. WHEN the user adds or deletes a Transaction, THE App SHALL update the Balance_Display, Transaction_List, and Pie_Chart within 300 milliseconds.
3. THE App SHALL render all UI components, persist and restore data, and apply all functional behaviors without error in the current stable releases of Chrome, Firefox, Edge, and Safari without polyfills or additional configuration.
4. THE App SHALL consist of exactly one HTML file, one CSS file inside a `css/` directory, and one JavaScript file inside a `js/` directory.

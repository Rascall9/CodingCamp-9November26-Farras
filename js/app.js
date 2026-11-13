// Expense & Budget Visualizer — application logic (populated in Tasks 2–13)

// === CONSTANTS ===

/** localStorage key names */
const STORAGE_KEYS = {
  transactions: 'ebv_transactions',
  categories:   'ebv_categories',
  limits:       'ebv_limits',
};

/** Categories present on a fresh install */
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

/** Maximum length for a transaction item name (characters) */
const MAX_NAME_LEN = 100;

/** Maximum allowed transaction amount */
const MAX_AMOUNT = 999_999_999.99;

/** Maximum length for a custom category name (characters) */
const MAX_CATEGORY_NAME_LEN = 50;

/** Maximum number of custom (user-created) categories */
const MAX_CUSTOM_CATEGORIES = 50;

// === STATE ===

const state = {
  /** @type {Transaction[]} */
  transactions: [],

  /** @type {string[]} All category names including defaults */
  categories: ['Food', 'Transport', 'Fun'],

  /** @type {Record<string, number>} category → spending limit */
  limits: {},

  /** @type {boolean} true when localStorage is unavailable */
  storageUnavailable: false,

  /** @type {Chart|null} Chart.js instance */
  chartInstance: null,
};

// === UTILS ===

/**
 * Generate a unique transaction ID.
 * Uses crypto.randomUUID() when available; falls back to
 * Date.now() + Math.random() string concatenation.
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: combine timestamp and random number to approximate uniqueness
  return String(Date.now()) + '-' + String(Math.random()).slice(2);
}

/**
 * Format a number as currency string.
 * Uses Intl.NumberFormat with 'en-US' locale and 'USD' currency style,
 * falling back to manual formatting if Intl is unavailable.
 * @param {number} amount
 * @returns {string}  e.g. "$1,234.56"
 */
function formatAmount(amount) {
  if (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  // Fallback: manual formatting to "$1,234.56" style
  const fixed = Number(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  // Insert thousands separators
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + withCommas + '.' + decPart;
}

// === AGGREGATIONS ===

/**
 * Sum all transaction amounts.
 * @param {Transaction[]} transactions
 * @returns {number} Total amount, or 0 for an empty array.
 */
function computeTotal(transactions) {
  if (!transactions || transactions.length === 0) return 0;
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Sum amounts grouped by category.
 * @param {Transaction[]} transactions
 * @returns {Record<string, number>} Map of category → total amount.
 *   Returns an empty object for an empty array.
 */
function computeCategoryTotals(transactions) {
  if (!transactions || transactions.length === 0) return {};
  return transactions.reduce((totals, t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    return totals;
  }, {});
}

/**
 * Determine whether a category has met or exceeded its spending limit.
 * @param {string} category
 * @param {Record<string, number>} totals   - Per-category spending totals.
 * @param {Record<string, number>} limits   - Per-category spending limits.
 * @returns {boolean} true only if limits[category] is defined AND
 *   totals[category] >= limits[category].
 */
function isOverLimit(category, totals, limits) {
  if (limits[category] === undefined) return false;
  return (totals[category] || 0) >= limits[category];
}

/**
 * Filter transactions to those whose timestamp falls in a given month and year.
 * @param {Transaction[]} transactions
 * @param {number} month  - 1-indexed (1 = January, 12 = December).
 * @param {number} year   - Full four-digit year.
 * @returns {Transaction[]} Only transactions whose timestamp belongs to that month/year.
 */
function filterByMonth(transactions, month, year) {
  if (!transactions || transactions.length === 0) return [];
  return transactions.filter((t) => {
    const d = new Date(t.timestamp);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
}

// === STORAGE ===

/**
 * Load all persisted data from localStorage into state.
 * Wraps every read in try/catch; on any failure sets state.storageUnavailable = true.
 * JSON parse errors reset that key to its default and log a console warning.
 * Categories are merged with DEFAULT_CATEGORIES (no duplicates).
 * Satisfies: Requirements 8.5, 8.6
 */
function loadAll() {
  // --- transactions ---
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.transactions);
    if (raw !== null) {
      try {
        state.transactions = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('ebv: corrupt transactions data — resetting to empty list.', parseErr);
        state.transactions = [];
      }
    } else {
      state.transactions = [];
    }
  } catch (err) {
    state.storageUnavailable = true;
    state.transactions = [];
  }

  // --- categories ---
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.categories);
    if (raw !== null) {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('ebv: corrupt categories data — resetting to defaults.', parseErr);
        parsed = [];
      }
      // Merge persisted categories with DEFAULT_CATEGORIES, avoiding duplicates (case-sensitive)
      const merged = [...DEFAULT_CATEGORIES];
      for (const cat of parsed) {
        if (!merged.includes(cat)) {
          merged.push(cat);
        }
      }
      state.categories = merged;
    } else {
      // No stored categories — start with defaults
      state.categories = [...DEFAULT_CATEGORIES];
    }
  } catch (err) {
    state.storageUnavailable = true;
    state.categories = [...DEFAULT_CATEGORIES];
  }

  // --- limits ---
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.limits);
    if (raw !== null) {
      try {
        state.limits = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('ebv: corrupt limits data — resetting to empty object.', parseErr);
        state.limits = {};
      }
    } else {
      state.limits = {};
    }
  } catch (err) {
    state.storageUnavailable = true;
    state.limits = {};
  }
}

/**
 * Persist the current transaction list to localStorage.
 * On QuotaExceededError shows an alert; other errors are logged.
 * Satisfies: Requirements 8.1, 8.2
 */
function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      alert('Storage is full. Your latest transaction could not be saved.');
    } else {
      console.error('ebv: failed to save transactions.', err);
    }
  }
}

/**
 * Persist the current category list to localStorage.
 * On QuotaExceededError shows an alert; other errors are logged.
 * Satisfies: Requirement 8.3
 */
function saveCategories() {
  try {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(state.categories));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      alert('Storage is full. Your latest category could not be saved.');
    } else {
      console.error('ebv: failed to save categories.', err);
    }
  }
}

/**
 * Persist the current spending limits to localStorage.
 * On QuotaExceededError shows an alert; other errors are logged.
 * Satisfies: Requirement 8.4
 */
function saveLimits() {
  try {
    localStorage.setItem(STORAGE_KEYS.limits, JSON.stringify(state.limits));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      alert('Storage is full. Your latest spending limit could not be saved.');
    } else {
      console.error('ebv: failed to save limits.', err);
    }
  }
}

// === VALIDATION ===

/**
 * Validate a new transaction's fields.
 * Satisfies: Requirements 1.4, 1.5
 *
 * @param {string} name      - Item name from the form input.
 * @param {*}      amount    - Amount value from the form input (may be string or number).
 * @param {string} category  - Selected category name.
 * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateTransaction(name, amount, category) {
  const errors = {};

  // --- name ---
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName.length === 0) {
    errors.name = 'Item name is required.';
  } else if (trimmedName.length > MAX_NAME_LEN) {
    errors.name = `Item name must be ${MAX_NAME_LEN} characters or fewer.`;
  }

  // --- amount ---
  const amountNum = Number(amount);
  if (
    amount === '' ||
    amount === null ||
    amount === undefined ||
    isNaN(amountNum) ||
    amountNum <= 0
  ) {
    errors.amount = 'Amount must be a number greater than 0.';
  } else if (amountNum > MAX_AMOUNT) {
    errors.amount = `Amount must not exceed ${MAX_AMOUNT}.`;
  } else if (!/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) {
    // Reject values with more than 2 decimal places or non-numeric formats
    errors.amount = 'Amount must have at most 2 decimal places.';
  }

  // --- category ---
  const trimmedCategory = typeof category === 'string' ? category.trim() : '';
  if (trimmedCategory.length === 0) {
    errors.category = 'Please select a category.';
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

/**
 * Validate a new custom category name.
 * Satisfies: Requirements 5.1, 5.3, 5.4, 5.6
 *
 * @param {string} name - Proposed category name.
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateCategory(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (trimmed.length === 0) {
    return { valid: false, error: 'Category name is required.' };
  }

  if (trimmed.length > MAX_CATEGORY_NAME_LEN) {
    return {
      valid: false,
      error: `Category name must be ${MAX_CATEGORY_NAME_LEN} characters or fewer.`,
    };
  }

  // Case-insensitive duplicate check against all existing categories
  const lowerTrimmed = trimmed.toLowerCase();
  const isDuplicate = state.categories.some(
    (cat) => cat.toLowerCase() === lowerTrimmed
  );
  if (isDuplicate) {
    return { valid: false, error: 'A category with that name already exists.' };
  }

  // Count non-default (custom) categories
  const customCount = state.categories.filter(
    (cat) => !DEFAULT_CATEGORIES.includes(cat)
  ).length;
  if (customCount >= MAX_CUSTOM_CATEGORIES) {
    return {
      valid: false,
      error: `You can have at most ${MAX_CUSTOM_CATEGORIES} custom categories.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validate a spending limit value.
 * Satisfies: Requirements 6.1, 6.6
 *
 * @param {*} value - The raw limit value (may be string or number).
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateLimit(value) {
  const num = Number(value);

  if (value === '' || value === null || value === undefined || isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Limit must be a valid number.' };
  }

  if (num < 0.01) {
    return { valid: false, error: 'Limit must be at least 0.01.' };
  }

  if (num > MAX_AMOUNT) {
    return { valid: false, error: `Limit must not exceed ${MAX_AMOUNT}.` };
  }

  return { valid: true, error: null };
}

// === TRANSACTIONS ===

/**
 * Create and persist a new transaction, then re-render the UI.
 * Satisfies: Requirements 1.3, 2.4, 8.1, 8.2
 *
 * @param {string} name      - Item name (will be trimmed).
 * @param {number|string} amount - Transaction amount (will be coerced to float).
 * @param {string} category  - Category name.
 */
function addTransaction(name, amount, category) {
  const transaction = {
    id: generateId(),
    name: name.trim(),
    amount: parseFloat(amount),
    category,
    timestamp: new Date().toISOString(),
  };

  state.transactions.push(transaction);
  saveTransactions();
  renderAll();
}

/**
 * Remove a transaction by ID, persist the change, and re-render the UI.
 * If saving fails, the deletion is rolled back and the user is notified.
 * Satisfies: Requirements 2.4, 2.6, 8.1, 8.2
 *
 * @param {string} id - The ID of the transaction to delete.
 */
function deleteTransaction(id) {
  // Keep a snapshot so we can roll back if the save fails
  const snapshot = [...state.transactions];

  state.transactions = state.transactions.filter((t) => t.id !== id);

  try {
    saveTransactions();
  } catch (err) {
    // Restore the pre-deletion state
    state.transactions = snapshot;

    // Notify the user via #global-error if it exists, otherwise fall back to alert
    const globalError = document.getElementById('global-error');
    if (globalError) {
      globalError.textContent = 'Deletion failed: could not save changes.';
      globalError.hidden = false;
    } else {
      alert('Deletion failed: could not save changes.');
    }
    return;
  }

  renderAll();
}

// === CATEGORIES ===

/**
 * Add a new custom category to the application.
 * Trims the name, validates it, persists on success, and refreshes the UI.
 * Satisfies: Requirements 5.2, 5.5, 8.3
 *
 * @param {string} name - The proposed category name (may be untrimmed).
 * @returns {void}
 */
function addCategory(name) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  const { valid, error } = validateCategory(trimmedName);
  if (!valid) {
    console.warn('ebv: addCategory rejected —', error);
    return;
  }

  state.categories.push(trimmedName);
  saveCategories();
  renderCategoryDropdowns();
}

// === LIMITS ===

/**
 * Set or update the spending limit for a category.
 * Validates the value first; silently returns on invalid input.
 * Satisfies: Requirements 6.1, 6.2, 8.4
 *
 * @param {string} category - The category name to apply the limit to.
 * @param {*}      value    - The limit value (may be string or number).
 */
function setLimit(category, value) {
  const { valid } = validateLimit(value);
  if (!valid) return;

  state.limits[category] = parseFloat(value);
  saveLimits();
  renderAll();
}

/**
 * Remove the spending limit for a category.
 * Satisfies: Requirements 6.7, 8.4
 *
 * @param {string} category - The category name whose limit should be removed.
 */
function removeLimit(category) {
  delete state.limits[category];
  saveLimits();
  renderAll();
}

// === RENDER ===

/**
 * Update the balance display element with the current computed total.
 * Uses computeTotal() to derive the total from state.transactions, then
 * formats it with formatAmount(). Intl.NumberFormat natively renders a
 * negative sign before the currency symbol for negative values (e.g. -$10.00).
 * Satisfies: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
function renderBalance() {
  const total = computeTotal(state.transactions);
  const formatted = formatAmount(total);
  document.getElementById('balance-display').textContent = formatted;
}

/**
 * Render the transaction list section.
 * Satisfies: Requirements 2.1, 2.2, 2.3, 2.5, 6.3
 */
function renderList() {
  const listEl = document.getElementById('transaction-list');
  const emptyEl = document.getElementById('list-empty-state');

  if (!listEl || !emptyEl) return;

  // Clear current list content
  listEl.innerHTML = '';

  if (state.transactions.length === 0) {
    // Show empty state, hide list
    emptyEl.removeAttribute('hidden');
    emptyEl.style.display = '';
    listEl.style.display = 'none';
    return;
  }

  // Hide empty state, show list
  emptyEl.setAttribute('hidden', '');
  emptyEl.style.display = 'none';
  listEl.style.display = '';

  // Sort descending by timestamp — most recent first (Requirement 2.1)
  const sorted = [...state.transactions].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Compute category totals once before the loop (Requirement 6.3)
  const categoryTotals = computeCategoryTotals(state.transactions);

  for (const t of sorted) {
    const row = document.createElement('div');
    row.setAttribute('role', 'listitem');
    row.classList.add('transaction-row');

    // Overspend highlight (Requirement 6.3)
    if (isOverLimit(t.category, categoryTotals, state.limits)) {
      row.classList.add('over-limit');

      const indicator = document.createElement('span');
      indicator.classList.add('over-limit-indicator');
      indicator.setAttribute('aria-label', 'Over spending limit');
      indicator.textContent = '⚠';
      row.appendChild(indicator);
    }

    // Item name (Requirement 2.3)
    const nameEl = document.createElement('span');
    nameEl.classList.add('transaction-name');
    nameEl.textContent = t.name;
    row.appendChild(nameEl);

    // Formatted amount (Requirement 2.2)
    const amountEl = document.createElement('span');
    amountEl.classList.add('transaction-amount');
    amountEl.textContent = formatAmount(t.amount);
    row.appendChild(amountEl);

    // Category (Requirement 2.3)
    const categoryEl = document.createElement('span');
    categoryEl.classList.add('transaction-category');
    categoryEl.textContent = t.category;
    row.appendChild(categoryEl);

    // Delete button (Requirement 2.4)
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-btn');
    deleteBtn.setAttribute('aria-label', `Delete ${t.name}`);
    deleteBtn.setAttribute('data-id', t.id);
    deleteBtn.textContent = 'Delete';
    row.appendChild(deleteBtn);

    listEl.appendChild(row);
  }
}

/**
 * Repopulate both category <select> dropdowns from state.categories,
 * restoring previously selected values where possible.
 * Satisfies: Requirements 1.2, 5.2
 */
function renderCategoryDropdowns() {
  const itemCategorySelect = document.getElementById('item-category');
  const limitCategorySelect = document.querySelector('select#limit-category');

  if (!itemCategorySelect || !limitCategorySelect) return;

  // Save previously selected values before clearing
  const prevItemCat = itemCategorySelect.value;
  const prevLimitCat = limitCategorySelect.value;

  // Clear existing options
  itemCategorySelect.innerHTML = '';
  limitCategorySelect.innerHTML = '';

  // Repopulate from state.categories
  for (const category of state.categories) {
    const opt1 = document.createElement('option');
    opt1.value = category;
    opt1.textContent = category;
    itemCategorySelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = category;
    opt2.textContent = category;
    limitCategorySelect.appendChild(opt2);
  }

  // Restore previously selected values if they still exist in the new options
  const itemOptions = Array.from(itemCategorySelect.options).map((o) => o.value);
  if (itemOptions.includes(prevItemCat)) {
    itemCategorySelect.value = prevItemCat;
  }

  const limitOptions = Array.from(limitCategorySelect.options).map((o) => o.value);
  if (limitOptions.includes(prevLimitCat)) {
    limitCategorySelect.value = prevLimitCat;
  }
}

/**
 * Render (or re-render) the pie chart using Chart.js.
 *
 * - Guards against Chart.js CDN load failure.
 * - Shows a placeholder when there is no data.
 * - Labels each segment as "Category (X.X%)".
 * - Applies a distinct thick border to any over-limit category segment.
 * - Always destroys the previous Chart instance before creating a new one to
 *   avoid Chart.js "canvas already in use" errors.
 *
 * Satisfies: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 6.4
 */
function renderChart() {
  // --- Guard: Chart.js unavailable (CDN load failure) ---
  if (typeof Chart === 'undefined') {
    const canvas = document.getElementById('pie-chart');
    const placeholder = document.getElementById('chart-placeholder');
    if (canvas) canvas.hidden = true;
    if (placeholder) {
      placeholder.textContent = 'Chart library could not be loaded.';
      placeholder.hidden = false;
    }
    return;
  }

  const canvas = document.getElementById('pie-chart');
  const placeholder = document.getElementById('chart-placeholder');

  // Compute per-category totals and filter to categories with spending > 0
  const allTotals = computeCategoryTotals(state.transactions);
  const activeCategories = Object.keys(allTotals).filter(
    (cat) => allTotals[cat] > 0
  );

  // --- No data: show placeholder, destroy any existing chart instance ---
  if (activeCategories.length === 0) {
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
    if (canvas) canvas.hidden = true;
    if (placeholder) {
      placeholder.hidden = false;
    }
    return;
  }

  // --- Data available: hide placeholder, show canvas ---
  if (placeholder) placeholder.hidden = true;
  if (canvas) canvas.hidden = false;

  // Compute total sum for percentage calculation
  const totalSum = activeCategories.reduce(
    (sum, cat) => sum + allTotals[cat],
    0
  );

  // Build labels with percentages (Req 4.2)
  const labels = activeCategories.map((cat) => {
    const pct = ((allTotals[cat] / totalSum) * 100).toFixed(1);
    return `${cat} (${pct}%)`;
  });

  // Data values
  const data = activeCategories.map((cat) => allTotals[cat]);

  // Colour palette — cycles through a set of distinct hues
  const BASE_COLORS = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(201, 203, 207, 0.8)',
    'rgba(255, 99,  71, 0.8)',
    'rgba(144, 238, 144, 0.8)',
    'rgba(135, 206, 235, 0.8)',
  ];

  const backgroundColor = activeCategories.map(
    (_, i) => BASE_COLORS[i % BASE_COLORS.length]
  );

  // Over-limit border styling (Req 6.4)
  const OVER_LIMIT_BORDER_COLOR  = 'rgba(220, 53, 69, 1)';   // bold red
  const NORMAL_BORDER_COLOR      = 'rgba(255, 255, 255, 0.9)';
  const OVER_LIMIT_BORDER_WIDTH  = 4;
  const NORMAL_BORDER_WIDTH      = 1;

  const borderColor = activeCategories.map((cat) =>
    isOverLimit(cat, allTotals, state.limits)
      ? OVER_LIMIT_BORDER_COLOR
      : NORMAL_BORDER_COLOR
  );

  const borderWidth = activeCategories.map((cat) =>
    isOverLimit(cat, allTotals, state.limits)
      ? OVER_LIMIT_BORDER_WIDTH
      : NORMAL_BORDER_WIDTH
  );

  // Destroy previous instance before creating a fresh one (Req 4.3)
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  // Create the Chart.js pie chart (Req 4.1, 4.5)
  state.chartInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor,
          borderWidth,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            /**
             * Show the raw formatted amount in the tooltip alongside the label.
             * @param {import('chart.js').TooltipItem} context
             * @returns {string}
             */
            label(context) {
              const cat = activeCategories[context.dataIndex];
              const amount = formatAmount(allTotals[cat]);
              const pct = ((allTotals[cat] / totalSum) * 100).toFixed(1);
              return ` ${cat}: ${amount} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Populate the limit amount input based on the currently selected category.
 * If the selected category already has a limit stored in state, the input is
 * pre-filled with that value; otherwise the input is cleared.
 * Satisfies: Requirement 6.1 (shows existing limit value when a category with
 * a limit is selected)
 */
function renderLimitControls() {
  const limitCategorySelect = document.querySelector('select#limit-category');
  const limitAmountInput = document.getElementById('limit-amount');

  if (!limitCategorySelect || !limitAmountInput) return;

  const selectedCategory = limitCategorySelect.value;

  if (state.limits[selectedCategory] !== undefined) {
    limitAmountInput.value = state.limits[selectedCategory];
  } else {
    limitAmountInput.value = '';
  }
}

// === MONTHLY ===

/**
 * Open the monthly summary dialog, populate the year/month selectors with
 * defaults for the current calendar month and year, then render the summary.
 * Satisfies: Requirement 7.1
 */
function openMonthly() {
  const dialog = document.getElementById('monthly-dialog');
  const yearSelect = document.getElementById('year-select');
  const monthSelect = document.getElementById('month-select');

  if (!dialog || !yearSelect || !monthSelect) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Populate year options 2000–2100 (Requirement 7.1)
  yearSelect.innerHTML = '';
  for (let y = 2000; y <= 2100; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }

  // Populate month options Jan–Dec with values 1–12
  // (May already be pre-populated in HTML; rebuild to ensure correctness)
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  monthSelect.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = MONTH_NAMES[m - 1];
    monthSelect.appendChild(opt);
  }

  // Default both selects to the current month and year (Requirement 7.1)
  yearSelect.value = currentYear;
  monthSelect.value = currentMonth;

  // Open the dialog (Requirement 7.1)
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.style.display = 'block';
  }

  // Show the summary for the current period
  renderMonthly(currentMonth, currentYear);
}

/**
 * Render the monthly summary for the given month and year inside
 * the #monthly-results container.
 *
 * - Filters transactions to the selected period with filterByMonth().
 * - If no transactions exist for the period, displays a 'no expenses' message.
 * - Otherwise shows the total and a per-category breakdown, both formatted
 *   with formatAmount().
 *
 * Satisfies: Requirements 7.2, 7.3, 7.4
 *
 * @param {number} month - 1-indexed calendar month (1 = January, 12 = December).
 * @param {number} year  - Full four-digit year.
 */
function renderMonthly(month, year) {
  const resultsEl = document.getElementById('monthly-results');
  if (!resultsEl) return;

  const filtered = filterByMonth(state.transactions, month, year);

  // No transactions for the period (Requirement 7.4)
  if (filtered.length === 0) {
    resultsEl.textContent = 'No expenses recorded for this period.';
    return;
  }

  // Compute total and per-category sums (Requirements 7.2, 7.3)
  const total = computeTotal(filtered);
  const categoryTotals = computeCategoryTotals(filtered);

  // Build the HTML output
  let html = `<p class="monthly-total"><strong>Total:</strong> ${formatAmount(total)}</p>`;
  html += '<ul class="monthly-category-list">';
  for (const [category, amount] of Object.entries(categoryTotals)) {
    html += `<li><span class="monthly-category-name">${category}</span>: <span class="monthly-category-amount">${formatAmount(amount)}</span></li>`;
  }
  html += '</ul>';

  resultsEl.innerHTML = html;
}

/**
 * Close the monthly summary dialog without modifying any stored data.
 * Uses dialog.close() when supported; falls back to hiding via CSS display.
 * Satisfies: Requirement 7.5
 */
function closeMonthly() {
  const dialog = document.getElementById('monthly-dialog');
  if (!dialog) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.style.display = 'none';
  }
  // No stored data is modified — Requirement 7.5
}

/**
 * Re-render every UI section in one call.
 * Satisfies: Requirements 3.2, 3.3, 4.3, 6.5
 */
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderCategoryDropdowns();
  renderLimitControls();
}

// === EVENT LISTENERS ===

/**
 * Wire all UI event handlers for the application.
 * Must be called once after the DOM is fully loaded.
 *
 * Satisfies: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 2.4,
 *            5.2, 5.3, 5.4, 5.6, 6.6, 6.7, 7.1, 7.5
 */
function initEventListeners() {

  // ── Helper: show or clear a single field-error span ──────────────────────
  /**
   * @param {string}      spanId   - The id of the <span class="field-error"> element.
   * @param {string|null} message  - Error text to show, or null/'' to clear.
   */
  function setFieldError(spanId, message) {
    const span = document.getElementById(spanId);
    if (!span) return;
    span.textContent = message || '';
  }

  // ── 1. Transaction form submit ────────────────────────────────────────────
  const transactionForm = document.getElementById('transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const nameInput     = document.getElementById('item-name');
      const amountInput   = document.getElementById('item-amount');
      const categoryInput = document.getElementById('item-category');

      const name     = nameInput     ? nameInput.value     : '';
      const amount   = amountInput   ? amountInput.value   : '';
      const category = categoryInput ? categoryInput.value : '';

      const { valid, errors } = validateTransaction(name, amount, category);

      // Clear all previous inline errors first
      setFieldError('item-name-error',     null);
      setFieldError('item-amount-error',   null);
      setFieldError('item-category-error', null);

      if (!valid) {
        // Show errors adjacent to offending fields (Requirements 1.4, 1.5)
        if (errors.name)     setFieldError('item-name-error',     errors.name);
        if (errors.amount)   setFieldError('item-amount-error',   errors.amount);
        if (errors.category) setFieldError('item-category-error', errors.category);

        // Focus the first field that has an error
        if (errors.name && nameInput) {
          nameInput.focus();
        } else if (errors.amount && amountInput) {
          amountInput.focus();
        } else if (errors.category && categoryInput) {
          categoryInput.focus();
        }
        return;
      }

      // All fields valid — add the transaction (Requirements 1.3, 1.6)
      addTransaction(name, amount, category);

      // Clear form fields
      if (nameInput)     nameInput.value     = '';
      if (amountInput)   amountInput.value   = '';
      if (categoryInput) categoryInput.selectedIndex = 0;

      // Return focus to the first input
      if (nameInput) nameInput.focus();
    });

    // ── 1.7 Clear individual field errors on user input / change ──────────
    // Requirement 1.7: when a field changes, clear its corresponding error.
    const nameInput = document.getElementById('item-name');
    if (nameInput) {
      nameInput.addEventListener('input', () => setFieldError('item-name-error', null));
    }

    const amountInput = document.getElementById('item-amount');
    if (amountInput) {
      amountInput.addEventListener('input', () => setFieldError('item-amount-error', null));
    }

    const categoryInput = document.getElementById('item-category');
    if (categoryInput) {
      categoryInput.addEventListener('change', () => setFieldError('item-category-error', null));
    }
  }

  // ── 2. Category form submit ───────────────────────────────────────────────
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const categoryNameInput = document.getElementById('category-name');
      const categoryError     = document.getElementById('category-error');

      const name = categoryNameInput ? categoryNameInput.value.trim() : '';

      const { valid, error } = validateCategory(name);

      if (!valid) {
        // Show error in #category-error (Requirements 5.3, 5.4, 5.6)
        if (categoryError) categoryError.textContent = error;
        return;
      }

      // Success: add category, clear input and error
      addCategory(name);
      if (categoryNameInput) categoryNameInput.value     = '';
      if (categoryError)     categoryError.textContent = '';
    });
  }

  // ── 3. Set-limit button click ─────────────────────────────────────────────
  const setLimitBtn = document.getElementById('set-limit');
  if (setLimitBtn) {
    setLimitBtn.addEventListener('click', () => {
      const limitCategorySelect = document.querySelector('select#limit-category');
      const limitAmountInput    = document.getElementById('limit-amount');
      const limitError          = document.getElementById('limit-error');

      const category = limitCategorySelect ? limitCategorySelect.value : '';
      const value    = limitAmountInput    ? limitAmountInput.value    : '';

      const { valid, error } = validateLimit(value);

      if (!valid) {
        // Show validation error (Requirement 6.6)
        if (limitError) limitError.textContent = error;
        return;
      }

      // Success: apply limit, clear error
      setLimit(category, value);
      if (limitError) limitError.textContent = '';
    });
  }

  // ── 4. Remove-limit button click ──────────────────────────────────────────
  const removeLimitBtn = document.getElementById('remove-limit');
  if (removeLimitBtn) {
    removeLimitBtn.addEventListener('click', () => {
      const limitCategorySelect = document.querySelector('select#limit-category');
      const category = limitCategorySelect ? limitCategorySelect.value : '';

      // Requirement 6.7: remove the limit for the selected category
      removeLimit(category);

      // Also clear any displayed error since the limit is gone
      const limitError = document.getElementById('limit-error');
      if (limitError) limitError.textContent = '';
    });
  }

  // ── 5. Limit-category select change ──────────────────────────────────────
  const limitCategorySelect = document.querySelector('select#limit-category');
  if (limitCategorySelect) {
    // Requirement 6.1: update the displayed limit value when the selection changes
    limitCategorySelect.addEventListener('change', () => {
      renderLimitControls();
    });
  }

  // ── 6. Open-monthly button click ─────────────────────────────────────────
  const openMonthlyBtn = document.getElementById('open-monthly');
  if (openMonthlyBtn) {
    // Requirement 7.1: open the monthly summary dialog
    openMonthlyBtn.addEventListener('click', () => {
      openMonthly();
    });
  }

  // ── 7. Close-monthly button click ────────────────────────────────────────
  const closeMonthlyBtn = document.getElementById('close-monthly');
  if (closeMonthlyBtn) {
    // Requirement 7.5: close the dialog without modifying stored data
    closeMonthlyBtn.addEventListener('click', () => {
      closeMonthly();
    });
  }

  // ── 8. Month-select and year-select change ────────────────────────────────
  const monthSelect = document.getElementById('month-select');
  const yearSelect  = document.getElementById('year-select');

  if (monthSelect) {
    // Requirement 7.2: re-render the monthly summary when the month changes
    monthSelect.addEventListener('change', () => {
      const month = parseInt(monthSelect.value, 10);
      const year  = yearSelect ? parseInt(yearSelect.value, 10) : new Date().getFullYear();
      renderMonthly(month, year);
    });
  }

  if (yearSelect) {
    // Requirement 7.2: re-render the monthly summary when the year changes
    yearSelect.addEventListener('change', () => {
      const year  = parseInt(yearSelect.value, 10);
      const month = monthSelect ? parseInt(monthSelect.value, 10) : new Date().getMonth() + 1;
      renderMonthly(month, year);
    });
  }

  // ── 9. Transaction-list delegated click (delete) ─────────────────────────
  const transactionList = document.getElementById('transaction-list');
  if (transactionList) {
    // Requirement 2.4: single delegated listener handles all delete buttons
    transactionList.addEventListener('click', (event) => {
      if (event.target.matches('button.delete-btn[data-id]')) {
        deleteTransaction(event.target.dataset.id);
      }
    });
  }
}

// === INIT ===

document.addEventListener('DOMContentLoaded', () => {
  // Requirement 8.5: restore persisted state from localStorage on page load
  loadAll();

  // Wire all DOM event handlers
  initEventListeners();

  // Requirement 8.6: if localStorage is unavailable, surface the global error banner
  if (state.storageUnavailable) {
    const globalError = document.getElementById('global-error');
    if (globalError) {
      globalError.hidden = false;
    }
  }

  // Requirement 9.1: perform the initial render of the full UI
  renderAll();
});

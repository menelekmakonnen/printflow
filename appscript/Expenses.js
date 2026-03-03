/**
 * PrintFlow — Expenses Module
 * CRUD operations for managing outgoing office expenses and stock purchases.
 */

const EXPENSES_HEADERS = [
    'expense_id', 'category', 'amount', 'description',
    'date_logged', 'payment_status', 'logged_by', 'payment_date'
];

/**
 * Get all expenses
 */
function handleGetExpenses(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    let expenses = getSheetData(SHEET_EXPENSES);

    // Optional category filter
    if (payload.category && payload.category !== 'all') {
        expenses = expenses.filter(e => e.category === payload.category);
    }

    // Sort by most recent
    expenses.sort((a, b) => new Date(b.date_logged) - new Date(a.date_logged));

    return jsonResponse(expenses);
}

/**
 * Add a new expense
 */
function handleAddExpense(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin', 'receptionist']);
    if (auth.error) return auth.error;

    const { category, amount, description, payment_status, payment_date } = payload;

    if (!category || !amount) {
        return errorResponse('Category and amount are required', 400);
    }

    const expenseId = 'EXP-' + Utilities.getUuid().split('-')[0].toUpperCase();
    const dDate = now();

    const expense = {
        expense_id: expenseId,
        category: category,
        amount: Number(amount),
        description: description || '',
        date_logged: dDate,
        payment_status: payment_status || 'paid',
        logged_by: auth.user.username,
        payment_date: payment_status === 'paid' ? (payment_date || dDate) : ''
    };

    appendRow(SHEET_EXPENSES, expense, EXPENSES_HEADERS);
    logActivity(auth.user.username, 'add_expense', `Logged expense: ${category} - ₵${amount}`);

    return jsonResponse(expense);
}

/**
 * Update an existing expense
 */
function handleUpdateExpense(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { expense_id, category, amount, description, payment_status, payment_date, edit_memo } = payload;

    if (!expense_id) return errorResponse('expense_id is required', 400);
    if (!edit_memo) return errorResponse('An edit memo is required to modify past expenses', 400);

    const existing = findRow(SHEET_EXPENSES, 'expense_id', expense_id);
    if (!existing) return errorResponse('Expense not found', 404);

    const updates = {};
    if (category !== undefined) updates.category = category;
    if (amount !== undefined) updates.amount = Number(amount);
    if (description !== undefined) updates.description = description;

    if (payment_status !== undefined) {
        updates.payment_status = payment_status;
        if (payment_status === 'paid' && existing.payment_status !== 'paid') {
            updates.payment_date = payment_date || now();
        }
    }

    updateRow(SHEET_EXPENSES, existing._rowIndex, updates);
    logActivity(auth.user.username, 'update_expense', `Edited expense ${expense_id}. Memo: ${edit_memo}`);

    return jsonResponse({ message: 'Expense updated successfully' });
}

/**
 * Delete an expense
 */
function handleDeleteExpense(payload) {
    const auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    const { expense_id, edit_memo } = payload;
    if (!expense_id) return errorResponse('expense_id is required', 400);
    if (!edit_memo) return errorResponse('An edit memo is required to delete expenses', 400);

    const existing = findRow(SHEET_EXPENSES, 'expense_id', expense_id);
    if (!existing) return errorResponse('Expense not found', 404);

    const sheet = getSheet(SHEET_EXPENSES);
    sheet.deleteRow(existing._rowIndex);

    logActivity(auth.user.username, 'delete_expense', `Deleted expense ${expense_id}. Memo: ${edit_memo}`);

    return jsonResponse({ message: 'Expense deleted successfully' });
}

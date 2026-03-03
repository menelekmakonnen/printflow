/**
 * PrintFlow — Inventory / Stock Module
 * CRUD operations for managing stock items, tracking usage, and deductions.
 */

const INVENTORY_HEADERS = [
    'item_id', 'item_name', 'low_stock_threshold', 'unit_cost',
    'quantity_in_pack', 'sku', 'product_type', 'status', 'created_at'
];

/**
 * Get all inventory items
 */
function handleGetInventory(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin', 'receptionist', 'designer', 'finisher']);
    if (auth.error) return auth.error;

    let inventory = getSheetData(SHEET_INVENTORY);

    // Optional category filter
    if (payload.category && payload.category !== 'all') {
        inventory = inventory.filter(item => item.category === payload.category);
    }

    // Sort alphabetically by name
    inventory.sort((a, b) => String(a.item_name).localeCompare(String(b.item_name)));

    return jsonResponse(inventory);
}

/**
 * Add a new inventory item / log a stock addition
 */
function handleAddInventoryItem(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin', 'receptionist']);
    if (auth.error) return auth.error;

    // A purchase happens in Pcks/Boxes, we convert to Sheets mathematically later
    const { item_name, low_stock_threshold, unit_cost, quantity_in_pack, sku, product_type, status } = payload;

    if (!item_name || !unit_cost) {
        return errorResponse('Item name and Unit Cost are required', 400);
    }

    const itemId = 'INV-' + Utilities.getUuid().split('-')[0].toUpperCase();

    // Status can be 'pending' (paid but not delivered) or 'arrived' (in stock)
    const stockStatus = status || 'arrived';

    const item = {
        item_id: itemId,
        item_name: item_name,
        low_stock_threshold: Number(low_stock_threshold || 0),
        unit_cost: Number(unit_cost || 0),
        quantity_in_pack: Number(quantity_in_pack || 1),
        sku: sku || '',
        product_type: product_type || 'material',
        status: stockStatus,
        created_at: now()
    };

    appendRow(SHEET_INVENTORY, item, INVENTORY_HEADERS);
    logActivity(auth.user.username, 'add_inventory', `Logged Stock Purchase: ${item_name} - ${stockStatus}`);

    // Auto-create an Expense Entry for this stock purchase
    try {
        const expenseId = 'EXP-' + Utilities.getUuid().split('-')[0].toUpperCase();
        const expenseTotal = Number(unit_cost);
        const expenseStatus = stockStatus === 'arrived' ? 'paid' : 'pending';
        appendRow(SHEET_EXPENSES, {
            expense_id: expenseId,
            category: 'Stock & Materials',
            amount: expenseTotal,
            description: `Stock Purchase: ${item_name}`,
            date_logged: now(),
            payment_status: expenseStatus,
            logged_by: auth.user.username,
            payment_date: expenseStatus === 'paid' ? now() : ''
        }, [
            'expense_id', 'category', 'amount', 'description',
            'date_logged', 'payment_status', 'logged_by', 'payment_date'
        ]);
    } catch (err) {
        Logger.log("Failed to auto log expense: " + err.message);
    }

    return jsonResponse(item);
}

/**
 * Update an inventory item (e.g. mark pending as arrived)
 */
function handleUpdateInventoryItem(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { item_id, item_name, low_stock_threshold, unit_cost, quantity_in_pack, sku, product_type, status, edit_memo } = payload;

    if (!item_id) return errorResponse('item_id is required', 400);

    const existing = findRow(SHEET_INVENTORY, 'item_id', item_id);
    if (!existing) return errorResponse('Item not found', 404);

    const updates = {};
    if (item_name !== undefined) updates.item_name = item_name;
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = Number(low_stock_threshold);
    if (unit_cost !== undefined) updates.unit_cost = Number(unit_cost);
    if (quantity_in_pack !== undefined) updates.quantity_in_pack = Number(quantity_in_pack);
    if (sku !== undefined) updates.sku = sku;
    if (product_type !== undefined) updates.product_type = product_type;
    if (status !== undefined) updates.status = status;

    updateRow(SHEET_INVENTORY, existing._rowIndex, updates);
    logActivity(auth.user.username, 'update_inventory', `Updated inventory item: ${existing.item_name}. Memo: ${edit_memo || 'Status Change'}`);

    return jsonResponse({ message: 'Item updated successfully' });
}

/**
 * Delete an inventory item
 */
function handleDeleteInventoryItem(payload) {
    const auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    const { item_id } = payload;
    if (!item_id) return errorResponse('item_id is required', 400);

    const existing = findRow(SHEET_INVENTORY, 'item_id', item_id);
    if (!existing) return errorResponse('Item not found', 404);

    const sheet = getSheet(SHEET_INVENTORY);
    sheet.deleteRow(existing._rowIndex);

    logActivity(auth.user.username, 'delete_inventory', `Deleted inventory item: ${existing.item_name}`);

    return jsonResponse({ message: 'Item deleted successfully' });
}

/**
 * Deduct multiple items from stock (used during job processing)
 */
function handleDeductInventory(payload) {
    const auth = requireAuth(payload.token, ['receptionist', 'designer', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { job_id, deductions } = payload; // deductions is an array: [{ item_id: 'INV-123', quantity: 50 }]

    if (!job_id || !deductions || !Array.isArray(deductions)) {
        return errorResponse('job_id and deductions array are required', 400);
    }

    const sheet = getSheet(SHEET_INVENTORY);
    const data = getSheetData(SHEET_INVENTORY);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const qtyColIndex = headers.indexOf('quantity_in_pack') + 1; // Used pack column now
    const updateColIndex = headers.indexOf('updated_at') + 1;

    let deductionLog = [];

    deductions.forEach(d => {
        const item = data.find(r => r.item_id === d.item_id);
        if (item) {
            // If item is 'packed', subtracting a sheet deduction will basically 
            // result in a fractional pack representation, or we deduce the unit size directly
            const newQty = Number(item.quantity_in_pack) - (Number(d.quantity) / (item.low_stock_threshold > 0 ? item.low_stock_threshold : 1));
            sheet.getRange(item._rowIndex, qtyColIndex).setValue(newQty);
            sheet.getRange(item._rowIndex, updateColIndex).setValue(now());
            deductionLog.push(`${d.quantity} ${item.unit} of ${item.item_name}`);
        }
    });

    logActivity(auth.user.username, 'deduct_inventory', `Deducted for Job ${job_id}: ${deductionLog.join(', ')}`);

    return jsonResponse({ message: 'Inventory updated successfully' });
}

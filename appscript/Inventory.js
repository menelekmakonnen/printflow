/**
 * PrintFlow — Inventory / Stock Module
 * CRUD operations for managing stock items, tracking usage, and deductions.
 */

const INVENTORY_HEADERS = [
    'item_id', 'item_name', 'category', 'quantity_in_stock', 'unit',
    'min_threshold', 'unit_cost', 'created_by', 'updated_by', 'updated_at'
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
 * Add a new inventory item
 */
function handleAddInventoryItem(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { item_name, category, quantity_in_stock, unit, min_threshold, unit_cost } = payload;

    if (!item_name || !category || !unit) {
        return errorResponse('Item name, category, and unit are required', 400);
    }

    const existing = findRow(SHEET_INVENTORY, 'item_name', item_name);
    if (existing) {
        return errorResponse('An item with this name already exists', 400);
    }

    const itemId = 'INV-' + Utilities.getUuid().split('-')[0].toUpperCase();

    const item = {
        item_id: itemId,
        item_name: item_name,
        category: category,
        quantity_in_stock: Number(quantity_in_stock || 0),
        unit: unit,
        min_threshold: Number(min_threshold || 0),
        unit_cost: Number(unit_cost || 0),
        created_by: auth.user.username,
        updated_by: auth.user.username,
        updated_at: now()
    };

    appendRow(SHEET_INVENTORY, item, INVENTORY_HEADERS);
    logActivity(auth.user.username, 'add_inventory', `Added inventory item: ${item_name} (${quantity_in_stock} ${unit})`);

    return jsonResponse(item);
}

/**
 * Update an inventory item
 */
function handleUpdateInventoryItem(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { item_id, item_name, category, quantity_in_stock, unit, min_threshold, unit_cost } = payload;

    if (!item_id) return errorResponse('item_id is required', 400);

    const existing = findRow(SHEET_INVENTORY, 'item_id', item_id);
    if (!existing) return errorResponse('Item not found', 404);

    const updates = {
        updated_by: auth.user.username,
        updated_at: now()
    };

    if (item_name !== undefined) updates.item_name = item_name;
    if (category !== undefined) updates.category = category;
    if (quantity_in_stock !== undefined) updates.quantity_in_stock = Number(quantity_in_stock);
    if (unit !== undefined) updates.unit = unit;
    if (min_threshold !== undefined) updates.min_threshold = Number(min_threshold);
    if (unit_cost !== undefined) updates.unit_cost = Number(unit_cost);

    updateRow(SHEET_INVENTORY, existing._rowIndex, updates);
    logActivity(auth.user.username, 'update_inventory', `Updated inventory item: ${existing.item_name}`);

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
    const qtyColIndex = headers.indexOf('quantity_in_stock') + 1;
    const updateColIndex = headers.indexOf('updated_at') + 1;

    let deductionLog = [];

    deductions.forEach(d => {
        const item = data.find(r => r.item_id === d.item_id);
        if (item) {
            const newQty = Number(item.quantity_in_stock) - Number(d.quantity);
            // We allow negative values to indicate usage beyond stock on hand
            sheet.getRange(item._rowIndex, qtyColIndex).setValue(newQty);
            sheet.getRange(item._rowIndex, updateColIndex).setValue(now());
            deductionLog.push(`${d.quantity} ${item.unit} of ${item.item_name}`);
        }
    });

    logActivity(auth.user.username, 'deduct_inventory', `Deducted for Job ${job_id}: ${deductionLog.join(', ')}`);

    return jsonResponse({ message: 'Inventory updated successfully' });
}

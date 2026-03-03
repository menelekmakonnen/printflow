/**
 * PrintFlow — Products Backend (appscript/Products.js)
 */

const PRODUCT_HEADERS = [
    'item_id', 'item_name', 'description', 'rate', 'account', 'account_code',
    'tax_name', 'tax_percentage', 'tax_type', 'purchase_tax_name', 'purchase_tax_percentage',
    'purchase_tax_type', 'product_type', 'source', 'reference_id', 'last_sync_time',
    'status', 'usage_unit', 'unit_name', 'purchase_rate', 'purchase_account',
    'purchase_account_code', 'purchase_description', 'inventory_account', 'inventory_account_code',
    'inventory_valuation_method', 'reorder_point', 'vendor', 'vendor_number', 'opening_stock',
    'opening_stock_value', 'stock_on_hand', 'item_type', 'sellable', 'purchasable', 'track_inventory'
];

function handleGetProducts(payload) {
    const auth = requireAuth(payload.token);
    if (auth.error) return auth.error;

    let products = getSheetData(SHEET_PRODUCTS);

    if (payload.status) {
        products = products.filter(p => String(p.status).toLowerCase() === String(payload.status).toLowerCase());
    }

    return jsonResponse(products);
}

function handleAddProduct(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { item_name, rate } = payload;
    if (!item_name || rate === undefined) {
        return errorResponse('item_name and rate are required', 400);
    }

    const item_id = payload.item_id || Utilities.getUuid();

    // Create product row, defaulting missing fields to empty string
    const product = PRODUCT_HEADERS.reduce((acc, header) => {
        acc[header] = payload[header] !== undefined ? payload[header] : '';
        return acc;
    }, {});

    product.item_id = item_id;
    product.status = product.status || 'Active';
    product.item_name = item_name;
    product.rate = rate;

    appendRow(SHEET_PRODUCTS, product, PRODUCT_HEADERS);

    logActivity(auth.user.username, 'ADD_PRODUCT', `Added product/service: ${item_name}`);

    return jsonResponse({ success: true, item_id: item_id });
}

function handleUpdateProduct(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { item_id, updates } = payload;
    if (!item_id || !updates) {
        return errorResponse('item_id and updates are required', 400);
    }

    const existing = findRow(SHEET_PRODUCTS, 'item_id', item_id);
    if (!existing) {
        return errorResponse('Product not found', 404);
    }

    updateRow(SHEET_PRODUCTS, existing._rowIndex, updates);

    logActivity(auth.user.username, 'UPDATE_PRODUCT', `Updated product: ${existing.item_name || updates.item_name}`);

    return jsonResponse({ success: true, item_id: item_id });
}

function handleDeleteProduct(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { item_id } = payload;
    if (!item_id) {
        return errorResponse('item_id is required', 400);
    }

    const existing = findRow(SHEET_PRODUCTS, 'item_id', item_id);
    if (!existing) {
        return errorResponse('Product not found', 404);
    }

    const sheet = getSheet(SHEET_PRODUCTS);
    sheet.deleteRow(existing._rowIndex);

    logActivity(auth.user.username, 'DELETE_PRODUCT', `Deleted product: ${existing.item_name}`);

    return jsonResponse({ success: true, item_id: item_id });
}

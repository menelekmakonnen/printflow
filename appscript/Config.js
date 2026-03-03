/**
 * PrintFlow — Config Module
 * System configuration for Super Admin: entry types, job types, sections.
 */

const CONFIG_HEADERS = ['config_key', 'config_value', 'config_type', 'updated_by', 'updated_at'];

// Default job types
const DEFAULT_JOB_TYPES = [
    'business_cards', 'books', 'brochures', 'envelopes',
    'posters', 'banners', 'id_cards', 'general_print', 'other'
];

// Default expense categories
const DEFAULT_EXPENSE_CATEGORIES = [
    'Utilities', 'Equipment Maintenance', 'Rent', 'Salaries',
    'Internet/Comms', 'Courier/Delivery', 'Software Subscriptions',
    'Office Supplies', 'Advertising', 'Stock & Materials', 'Miscellaneous'
];

/**
 * Get all configuration entries
 */
function handleGetConfig(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const configs = getSheetData(SHEET_CONFIG);

    // If no config exists, return defaults
    if (configs.length === 0) {
        return jsonResponse({
            job_types: DEFAULT_JOB_TYPES,
            expense_categories: DEFAULT_EXPENSE_CATEGORIES,
            notification_channels: ['email'],
            company_name: 'PopOut Studios',
            currency: 'GHS',
            currency_symbol: '₵'
        });
    }

    // Build config object from rows
    const configObj = {};
    configs.forEach(c => {
        try {
            configObj[c.config_key] = c.config_type === 'json' ? JSON.parse(c.config_value) : c.config_value;
        } catch (e) {
            configObj[c.config_key] = c.config_value;
        }
    });

    // Ensure defaults exist
    if (!configObj.job_types) configObj.job_types = DEFAULT_JOB_TYPES;
    if (!configObj.expense_categories) configObj.expense_categories = DEFAULT_EXPENSE_CATEGORIES;
    if (!configObj.company_name) configObj.company_name = 'PopOut Studios';
    if (!configObj.currency) configObj.currency = 'GHS';
    if (!configObj.currency_symbol) configObj.currency_symbol = '₵';

    return jsonResponse(configObj);
}

/**
 * Update configuration values (batch)
 */
function handleUpdateConfig(payload) {
    const auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    // Payload can be a map of configs excluding reserved words
    const updates = { ...payload };
    delete updates.action;
    delete updates.token;

    const keys = Object.keys(updates);
    if (keys.length === 0) {
        return errorResponse('No configuration data provided', 400);
    }

    let updatedCount = 0;

    keys.forEach(config_key => {
        const config_value = updates[config_key];
        const existing = findRow(SHEET_CONFIG, 'config_key', config_key);
        const isJson = typeof config_value === 'object';
        const valueStr = isJson ? JSON.stringify(config_value) : String(config_value);

        if (existing) {
            updateRow(SHEET_CONFIG, existing._rowIndex, {
                config_value: valueStr,
                config_type: isJson ? 'json' : 'string',
                updated_by: auth.user.username,
                updated_at: now()
            });
        } else {
            appendRow(SHEET_CONFIG, {
                config_key: config_key,
                config_value: valueStr,
                config_type: isJson ? 'json' : 'string',
                updated_by: auth.user.username,
                updated_at: now()
            }, CONFIG_HEADERS);
        }
        updatedCount++;
    });

    logActivity(auth.user.username, 'update_config', `Updated ${updatedCount} config keys`);
    return jsonResponse({ message: `Updated ${updatedCount} configurations` });
}

/**
 * Add a new job type
 */
function handleAddJobType(payload) {
    const auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    const { job_type } = payload;
    if (!job_type) return errorResponse('job_type is required', 400);

    const existing = findRow(SHEET_CONFIG, 'config_key', 'job_types');
    let types = DEFAULT_JOB_TYPES;

    if (existing) {
        try {
            types = JSON.parse(existing.config_value);
        } catch (e) {
            types = DEFAULT_JOB_TYPES;
        }
    }

    const normalizedType = job_type.toLowerCase().replace(/\s+/g, '_');
    if (types.includes(normalizedType)) {
        return errorResponse('Job type already exists', 400);
    }

    types.push(normalizedType);

    // Save back
    if (existing) {
        updateRow(SHEET_CONFIG, existing._rowIndex, {
            config_value: JSON.stringify(types),
            updated_by: auth.user.username,
            updated_at: now()
        });
    } else {
        appendRow(SHEET_CONFIG, {
            config_key: 'job_types',
            config_value: JSON.stringify(types),
            config_type: 'json',
            updated_by: auth.user.username,
            updated_at: now()
        }, CONFIG_HEADERS);
    }

    logActivity(auth.user.username, 'add_job_type', `Added job type: ${normalizedType}`);
    return jsonResponse({ message: `Job type "${normalizedType}" added`, job_types: types });
}

/**
 * Remove a job type
 */
function handleRemoveJobType(payload) {
    const auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    const { job_type } = payload;
    if (!job_type) return errorResponse('job_type is required', 400);

    const existing = findRow(SHEET_CONFIG, 'config_key', 'job_types');
    let types = DEFAULT_JOB_TYPES;

    if (existing) {
        try { types = JSON.parse(existing.config_value); } catch (e) { }
    }

    types = types.filter(t => t !== job_type);

    if (existing) {
        updateRow(SHEET_CONFIG, existing._rowIndex, {
            config_value: JSON.stringify(types),
            updated_by: auth.user.username,
            updated_at: now()
        });
    }

    logActivity(auth.user.username, 'remove_job_type', `Removed job type: ${job_type}`);
    return jsonResponse({ message: `Job type "${job_type}" removed`, job_types: types });
}

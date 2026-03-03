/**
 * PrintFlow — Main Entry Point (Code.js)
 * Routes all API requests through doGet and doPost handlers.
 * Deploy as Web App: Execute as me, Anyone with access.
 */

/**
 * Handle GET requests (used for simple queries and health checks)
 */
function doGet(e) {
    const action = e && e.parameter ? e.parameter.action : 'health';

    if (action === 'health') {
        return jsonResponse({ message: 'PrintFlow API is running', version: '1.0.0' });
    }

    // For GET requests that need auth, pass token as query param
    const payload = e ? e.parameter : {};

    try {
        return routeAction(action, payload);
    } catch (err) {
        Logger.log('Error in doGet: ' + err.message);
        return errorResponse('Internal server error: ' + err.message, 500);
    }
}

/**
 * Handle POST requests (main API endpoint)
 */
function doPost(e) {
    let payload = {};

    try {
        if (e && e.postData && e.postData.contents) {
            payload = JSON.parse(e.postData.contents);
        }
    } catch (err) {
        return errorResponse('Invalid JSON in request body', 400);
    }

    const action = payload.action;
    if (!action) {
        return errorResponse('Action is required', 400);
    }

    try {
        return routeAction(action, payload);
    } catch (err) {
        Logger.log('Error in doPost: ' + err.stack);
        return errorResponse('Internal server error: ' + err.message, 500);
    }
}

/**
 * Route an action to its handler function
 */
function routeAction(action, payload) {
    const routes = {
        // Auth
        'login': handleLogin,
        'logout': handleLogout,
        'getMe': handleGetMe,

        'getJobs': handleGetJobs,
        'getJob': handleGetJob,
        'createJob': handleCreateJob,
        'approveJob': handleApproveJob,
        'receiveJob': handleReceiveJob,
        'processingComplete': handleProcessingComplete,
        'completeJob': handleCompleteJob,
        'uploadFile': handleUploadFile,
        'sendDesignReview': handleSendDesignReview,
        'getJobPublic': handleGetJobPublic,
        'submitDesignFeedback': handleSubmitDesignFeedback,

        // Users
        'getUsers': handleGetUsers,
        'createUser': handleCreateUser,
        'updateUser': handleUpdateUser,
        'disableUser': handleDisableUser,
        'enableUser': handleEnableUser,

        // Notifications
        'getNotifications': handleGetNotifications,

        // Config
        'getConfig': handleGetConfig,
        'updateConfig': handleUpdateConfig,
        'addJobType': handleAddJobType,
        'removeJobType': handleRemoveJobType,

        // Drive
        'initFolders': handleInitFolders,

        // Activity
        'getActivityLog': handleGetActivityLog,

        // Dashboard stats
        'getDashboardStats': handleGetDashboardStats,

        // Inventory
        'getInventory': handleGetInventory,
        'addInventoryItem': handleAddInventoryItem,
        'updateInventoryItem': handleUpdateInventoryItem,
        'deleteInventoryItem': handleDeleteInventoryItem,
        'deductInventory': handleDeductInventory
    };

    const handler = routes[action];
    if (!handler) {
        return errorResponse(`Unknown action: "${action}"`, 400);
    }

    return handler(payload);
}

/**
 * Log an activity to the Activity Log sheet
 */
const ACTIVITY_HEADERS = ['id', 'username', 'action', 'description', 'timestamp'];

function logActivity(username, action, description) {
    try {
        appendRow(SHEET_ACTIVITY, {
            id: Utilities.getUuid(),
            username: username,
            action: action,
            description: description,
            timestamp: now()
        }, ACTIVITY_HEADERS);
    } catch (e) {
        Logger.log('Activity log failed: ' + e.message);
    }
}

/**
 * Get activity log (admin/super_admin)
 */
function handleGetActivityLog(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    let activities = getSheetData(SHEET_ACTIVITY);

    if (payload.username) {
        activities = activities.filter(a => a.username === payload.username);
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit to last 100 entries
    activities = activities.slice(0, 100);

    return jsonResponse(activities);
}

/**
 * Get dashboard statistics (admin/super_admin)
 */
function handleGetDashboardStats(payload) {
    const auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    const jobs = getSheetData(SHEET_JOBS);

    const stats = {
        total_jobs: jobs.length,
        pending_payment: jobs.filter(j => j.status === 'pending_payment').length,
        approved: jobs.filter(j => j.status === 'approved').length,
        in_progress: jobs.filter(j => j.status === 'in_progress').length,
        finishing: jobs.filter(j => j.status === 'finishing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        total_revenue: jobs
            .filter(j => j.payment_status === 'paid')
            .reduce((sum, j) => sum + Number(j.total_amount || 0), 0),
        today_jobs: jobs.filter(j => {
            const created = new Date(j.created_at);
            const today = new Date();
            return created.toDateString() === today.toDateString();
        }).length
    };

    return jsonResponse(stats);
}

/**
 * One-time setup: initialize all sheet headers and Drive folders
 * Run this function manually from the Apps Script editor after first deploy.
 */
function setupPrintFlow() {
    // Set up sheet headers
    const sheets = {
        [SHEET_JOBS]: [
            'job_id', 'client_name', 'client_email', 'client_phone',
            'notification_pref', 'job_type', 'job_description',
            'total_amount', 'payment_status', 'status', 'case_folder_url',
            'created_by', 'updated_by',
            'created_at', 'approved_at', 'processing_started_at',
            'finishing_started_at', 'completed_at'
        ],
        [SHEET_USERS]: ['user_id', 'username', 'password_hash', 'display_name', 'roles', 'status', 'created_at'],
        [SHEET_SESSIONS]: ['token', 'username', 'roles', 'display_name', 'user_id', 'created_at', 'expires_at'],
        [SHEET_NOTIFICATIONS]: ['id', 'job_id', 'channel', 'notification_type', 'recipient', 'sent_at', 'status', 'error_message'],
        [SHEET_CONFIG]: ['config_key', 'config_value', 'config_type', 'updated_by', 'updated_at'],
        [SHEET_ACTIVITY]: ['id', 'username', 'action', 'description', 'timestamp']
    };

    const ss = getSpreadsheet();

    Object.entries(sheets).forEach(([tabName, headers]) => {
        let sheet = ss.getSheetByName(tabName);
        if (!sheet) {
            sheet = ss.insertSheet(tabName);
        }
        // Set headers if first row is empty
        const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
        if (!firstRow[0]) {
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            // Bold + freeze header row
            sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
            sheet.setFrozenRows(1);
        }
    });

    // Create initial super_admin account
    const existingAdmin = findRow(SHEET_USERS, 'username', 'admin');
    if (!existingAdmin) {
        const adminUser = {
            user_id: Utilities.getUuid(),
            username: 'admin',
            password_hash: hashPassword('admin123'),
            display_name: 'Super Admin',
            roles: 'super_admin',
            status: 'active',
            created_at: now()
        };
        appendRow(SHEET_USERS, adminUser, sheets[SHEET_USERS]);
        Logger.log('Created default super_admin: admin / admin123');
    }

    // Initialize Drive folders
    initializeDriveFolders();

    // Save default config
    const existingConfig = findRow(SHEET_CONFIG, 'config_key', 'job_types');
    if (!existingConfig) {
        appendRow(SHEET_CONFIG, {
            config_key: 'job_types',
            config_value: JSON.stringify(DEFAULT_JOB_TYPES),
            config_type: 'json',
            updated_by: 'system',
            updated_at: now()
        }, sheets[SHEET_CONFIG]);
    }

    Logger.log('PrintFlow setup complete!');
    return 'Setup complete. Default admin: admin / admin123';
}

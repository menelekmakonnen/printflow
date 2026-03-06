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
    if (action === 'debugProducts') {
        return jsonResponse(getSheetData('Products'));
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
        'cancelJob': handleCancelJob,
        'receiveJob': handleReceiveJob,
        'processingComplete': handleProcessingComplete,
        'completeJob': handleCompleteJob,
        'uploadFile': handleUploadFile,
        'sendDesignReview': handleSendDesignReview,
        'getJobPublic': handleGetJobPublic,
        'submitDesignFeedback': handleSubmitDesignFeedback,

        'getUsers': handleGetUsers,
        'createUser': handleCreateUser,
        'updateUser': handleUpdateUser,
        'disableUser': handleDisableUser,
        'enableUser': handleEnableUser,
        'updateProfile': handleUpdateProfile,

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
        'deductInventory': handleDeductInventory,

        // Products
        'getProducts': handleGetProducts,
        'addProduct': handleAddProduct,
        'updateProduct': handleUpdateProduct,
        'deleteProduct': handleDeleteProduct,

        // Expenses
        'getExpenses': handleGetExpenses,
        'addExpense': handleAddExpense,
        'updateExpense': handleUpdateExpense,
        'deleteExpense': handleDeleteExpense
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


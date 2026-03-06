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

        // DB Init via URL
        'setup': setupPrintFlow,

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
            'requires_delivery', 'delivery_fee', 'delivery_status',
            'total_amount', 'payment_status', 'status', 'case_folder_url',
            'requires_design', 'design_sample_url',
            'created_by', 'updated_by',
            'created_at', 'approved_at', 'processing_started_at',
            'finishing_started_at', 'completed_at'
        ],
        [SHEET_USERS]: ['user_id', 'username', 'password_hash', 'display_name', 'roles', 'status', 'created_at'],
        [SHEET_SESSIONS]: ['token', 'username', 'roles', 'display_name', 'user_id', 'created_at', 'expires_at'],
        [SHEET_NOTIFICATIONS]: ['id', 'job_id', 'channel', 'notification_type', 'recipient', 'sent_at', 'status', 'error_message'],
        [SHEET_CONFIG]: ['config_key', 'config_value', 'config_type', 'updated_by', 'updated_at'],
        [SHEET_ACTIVITY]: ['id', 'username', 'action', 'description', 'timestamp'],
        [SHEET_INVENTORY]: ['item_id', 'item_name', 'low_stock_threshold', 'unit_cost', 'quantity_in_pack', 'sku', 'product_type', 'status', 'created_at'],
        [SHEET_EXPENSES]: [
            'expense_id', 'category', 'amount', 'description',
            'date_logged', 'payment_status', 'logged_by', 'payment_date'
        ],
        [SHEET_PRODUCTS]: [
            'item_id', 'item_name', 'description', 'rate', 'account', 'account_code',
            'tax_name', 'tax_percentage', 'tax_type', 'purchase_tax_name', 'purchase_tax_percentage',
            'purchase_tax_type', 'product_type', 'source', 'reference_id', 'last_sync_time',
            'status', 'usage_unit', 'unit_name', 'purchase_rate', 'purchase_account',
            'purchase_account_code', 'purchase_description', 'inventory_account', 'inventory_account_code',
            'inventory_valuation_method', 'reorder_point', 'vendor', 'vendor_number', 'opening_stock',
            'opening_stock_value', 'stock_on_hand', 'item_type', 'sellable', 'purchasable', 'track_inventory'
        ]
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

    if (payload && payload.action === 'setup') {
        const adminUser = {
            user_id: Utilities.getUuid(),
            username: 'admin',
            password_hash: hashPassword('admin123'),
            display_name: 'Super Admin',
            roles: 'super_admin',
            status: 'active',
            created_at: now()
        };
        const existingAdmin = findRow(SHEET_USERS, 'username', 'admin');
        if (!existingAdmin) appendRow(SHEET_USERS, adminUser);
        return jsonResponse({ message: 'Setup Complete' });
    }

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

    const existingEstTax = findRow(SHEET_CONFIG, 'config_key', 'default_est_tax');
    if (!existingEstTax) {
        appendRow(SHEET_CONFIG, {
            config_key: 'default_est_tax',
            config_value: '0',
            config_type: 'number',
            updated_by: 'system',
            updated_at: now()
        }, sheets[SHEET_CONFIG]);
    }

    const existingFavicon = findRow(SHEET_CONFIG, 'config_key', 'favicon_base64');
    if (!existingFavicon) {
        appendRow(SHEET_CONFIG, {
            config_key: 'favicon_base64',
            config_value: '',
            config_type: 'string',
            updated_by: 'system',
            updated_at: now()
        }, sheets[SHEET_CONFIG]);
    }

    // Default Products Ingestion
    const productsSheet = ss.getSheetByName(SHEET_PRODUCTS);
    if (productsSheet && productsSheet.getLastRow() <= 1) {
        const defaultProductsTSV = `Item ID	Item Name	Description	Rate	Account	Account Code	Tax Name	Tax Percentage	Tax Type	Purchase Tax Name	Purchase Tax Percentage	Purchase Tax Type	Product Type	Source	Reference ID	Last Sync Time	Status	Usage unit	Unit Name	Purchase Rate	Purchase Account	Purchase Account Code	Purchase Description	Inventory Account	Inventory Account Code	Inventory Valuation Method	Reorder Point	Vendor	Vendor Number	Opening Stock	Opening Stock Value	Stock On Hand	Item Type	Sellable	Purchasable	Track Inventory
5767794000000094023	Logo Design (Corporate)	Corporate logo design for starting businesses (includes brand guideline and stationery designs)	GHS 400.00	Sales								service	14			Active			GHS 0.00													Sales	true	false	false
5767794000000094145	A4 Brochure Print	Printing of 18 paged A4 brochure	GHS 42.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000094154	Production Design Charge	Design service charge for production.	GHS 350.00	Sales								service	14			Active			GHS 0.00													Sales	true	false	false
5767794000000098069	T-Shirt Printing		GHS 20.00	Sales								service	14			Active			GHS 0.00													Sales	true	false	false
5767794000000098078	Bottle/Flask Branding	Branding of thermox bottle / flasks	GHS 15.00	Sales								service	14			Active			GHS 0.00													Sales	true	false	false
5767794000000098087	Apron Branding	Printing on Aprons	GHS 15.00	Sales								service	14			Active			GHS 0.00													Sales	true	false	false
5767794000000098188	PVC ID Card Print C/B	Printing of PVC ID card (color and black)	GHS 17.00	Sales								goods	14			Active			GHS 0.00													Sales	true	false	false
5767794000000098197	PVC Holographic Lamination	Laminating of PVC IDs	GHS 5.00	Sales								goods	14			Active			GHS 0.00													Sales	true	false	false
5767794000000099085	PVC ID Card Print C/C	Printing of PVC ID Card (colored bothsides)	GHS 34.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000099094	ID Tag + Plastic ID Holder	Round ID Tag with a plastic ID card holder	GHS 12.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000125001	Pull-up Banner [with Stand]	Printing of New Pull-up Banner with stand.	GHS 750.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000126001	Advertising Flyers [A5]	Printing of A5 Advertising flyers 	GHS 1.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000127001	Production Design Fee	Graphic design fee for production	GHS 150.00	Sales								service	12			Active			GHS 0.00													Sales	true	false	false
5767794000000158003	Envelope DL	Printing of DL Envelopes.	GHS 60.00	Sales								goods	12			Active	pack		GHS 0.00													Sales	true	false	false
5767794000000160090	Branded Paper Bags [Medium perfume]	4x9.2.5 inches sized paper bags (two-color print)	GHS 11.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000160101	Branded Paper Bags [lipcare Small]	Small-sized paper bags (two-color print)	GHS 7.50	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000160112	Branded Paper Bags [Small Jewelry]	Small-sized paper bags (two-color print)	GHS 7.50	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000160123	Branded Paper Bags [medium Jewelry]	4x9.2.5 inches sized paper bags (two-color print)	GHS 11.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000161023	A6 Membership Booklet	Printing of 16 paged A6 membership booklet with hard cover	GHS 19.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000179001	A4 Document Print	Printing of 92 paged A4 document with comb binding. 	GHS 148.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000180001	Catalogue Print	Printing of 306 paged document with perfect binding.	GHS 425.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000213001	Zeta Letterhead	Printing of 1 ream zeta letterhead 	GHS 550.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000279001	Business Cards Print	Printing of Business Cards (print and matte/soft-touch laminate - 100pcs)	GHS 160.00	Sales								goods	14			Active	pack		GHS 0.00													Sales	true	false	false
5767794000000345001	Advertising Banner	Printing of ads banner 12x6 ft	GHS 450.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000345012	Branded T-Shirt (Jersey)	Design and Printing of T-Shirt (jersey type)	GHS 50.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000350041	A4 Card Print	Printing of A4 250/300/350g card	GHS 3.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000353008	Sticker Print (A3)	Printing of A3 SAV	GHS 6.00	Sales								goods	14			Active			GHS 0.00													Sales	true	false	false
5767794000000368001	Branded T-shirt (Cotton)	Printing of a branded cotton t-shirt 	GHS 60.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000371003	A3 Artpaper 135g (Oneside)	Printing of A3 Artpaper 135g	GHS 3.00	Sales								goods	12			Active	sheets		GHS 0.00													Sales	true	false	false
5767794000000372001	A3 Artpaper 135g (F/B)	Printing of A3 Artpaper 135g	GHS 6.00	Sales								goods	12			Active	sheets		GHS 0.00													Sales	true	false	false
5767794000000373001	A4 Artpaper 135g (F/B)	Printing of A4 Artpaper 135g	GHS 3.00	Sales								goods	12			Active	sheets		GHS 0.00													Sales	true	false	false
5767794000000375001	A4 Artpaper 135g (Oneside)	Printing of A4 Artpaper 135g	GHS 1.50	Sales								goods	12			Active	sheets		GHS 0.00													Sales	true	false	false
5767794000000377067	A4 Bond Paper	Printing of A4 Bond paper	GHS 1.30	Sales								goods	14			Active	sheets		GHS 0.00													Sales	true	false	false
5767794000000395001	QR Code	Creation of QR Code 	GHS 150.00	Sales								service	12			Active			GHS 0.00													Sales	true	false	false
5767794000000420019	Round Sticker Label	Printing of round label stickers 2.5 inches	GHS 0.80	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000422019	Branded Cap	Printing on a Baseball cap (embroidery/print)	GHS 60.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000443019	A6 Tag Print + Lannyard	A6 printed tag, with pouch laminate and lanyard	GHS 8.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000443030	A5 Card Print	A5 250g card print with matte laminate	GHS 8.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000443041	Custom sized Brochure	Printing of 12x35 inches 250g card with matte laminate	GHS 35.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000443052	Express Production Charge	Extra charges for the express job production (within 32hours)	GHS 500.00	Sales								service	14			Active			GHS 0.00													Sales	true	false	false
5767794000000450003	Waybill Booklet (A4)	Printing of a carbonless A4 waybill booklet. 50 original and duplicate sheets	GHS 45.00	Sales								goods	14			Active	books		GHS 0.00													Sales	true	false	false
5767794000000453001	Advertising Stickers	Printing of advertising stickers ( 22x16 inches)	GHS 16.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000458019	Receipt Booklet (A5)	Printing of A5 carbonless booklet (50 original and duplicate sheets)	GHS 30.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000474001	Branded Lanyards	Branded cotton lanyards	GHS 15.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000477115	Letterhead Print (Zeta & Bond)	Printing of 1 ream letterhead (bond/zeta paper)	GHS 270.00	Sales								goods	14			Active	ream		GHS 0.00													Sales	true	false	false
5767794000000480023	A6 Card Print	Printing of A6 card F/B (mattecard 300g)	GHS 2.50	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000493001	A5 Brochure Print	Printing of 4-page A5 brochure with Matte laminate 	GHS 9.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000494001	Folder (A4)	Printing of a corporate folder with an inner pocket 	GHS 17.00	Sales								goods	12			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000496042	Pull-up Banner Print	Printing of pull-up banner (replacement)	GHS 180.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000501015	Tri-Fold Brochure	Printing of A4 trifold Brochure (135g/170g)	GHS 4.00	Sales								goods	14			Active	pcs	Pieces	GHS 0.00													Sales	true	false	false
5767794000000508001	A4 Bond Paper F/B	Printing of A4 Bond paper (duplex)	GHS 2.60	Sales								goods	14			Active	sheets		GHS 0.00													Sales	true	false	false
5767794000000513001	Sample Print	Production charge for a sample print.	GHS 100.00	Sales								goods	14			Active			GHS 0.00													Sales	true	false	false
5767794000000522039	Envelope C5 (Pack)	Printing of C5 envelope	GHS 100.00	Sales								goods	14			Active	pack		GHS 0.00													Sales	true	false	false
5767794000000522050	Envelope C4 (Pack)	Printing of C4 envelopes	GHS 135.00	Sales								goods	14			Active	pack		GHS 0.00													Sales	true	false	false`;

        const rowStrings = defaultProductsTSV.trim().split('\n');
        // Start from index 1 to skip TSV header row mapping
        const rows = rowStrings.slice(1).map(rowStr => {
            const cols = rowStr.split('\t');
            // Remove 'GHS ' suffix from the Rate column if present (it's index 3)
            let rateStr = cols[3] || '0';
            rateStr = rateStr.replace('GHS ', '').replace(',', '').trim();
            // Assign explicitly sized array to match standard PRODUCT_HEADERS
            const paddedRow = new Array(sheets[SHEET_PRODUCTS].length).fill('');
            for (let i = 0; i < cols.length; i++) {
                paddedRow[i] = i === 3 ? rateStr : cols[i];
            }
            return paddedRow;
        });

        // Fast batch insert
        productsSheet.getRange(2, 1, rows.length, sheets[SHEET_PRODUCTS].length).setValues(rows);
    }

    Logger.log('PrintFlow setup complete!');
    return 'Setup complete. Default admin: admin / admin123';
}

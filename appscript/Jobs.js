/**
 * PrintFlow — Jobs Module
 * CRUD operations and status transitions for print jobs.
 */

const JOB_HEADERS = [
    'job_id', 'client_name', 'client_email', 'client_phone',
    'notification_pref', 'job_type', 'job_description',
    'total_amount', 'payment_status', 'status', 'case_folder_url',
    'created_by', 'updated_by',
    'created_at', 'approved_at', 'processing_started_at',
    'finishing_started_at', 'completed_at'
];

// Valid status transitions (state machine)
const STATUS_TRANSITIONS = {
    pending_payment: { next: 'approved', roles: ['receptionist', 'admin', 'super_admin'] },
    approved: { next: 'in_progress', roles: ['designer', 'admin', 'super_admin'] },
    in_progress: { next: 'finishing', roles: ['designer', 'admin', 'super_admin'] },
    finishing: { next: 'completed', roles: ['finisher', 'admin', 'super_admin'] }
};

/**
 * Get all jobs with optional filters
 */
function handleGetJobs(payload) {
    const auth = requireAuth(payload.token);
    if (auth.error) return auth.error;

    let jobs = getSheetData(SHEET_JOBS);
    const { role } = auth.user;

    // Role-based filtering
    if (role === 'designer') {
        // Designer sees approved + in_progress, no financials/contact
        jobs = jobs.filter(j => ['approved', 'in_progress'].includes(j.status));
        jobs = jobs.map(j => ({
            job_id: j.job_id,
            job_type: j.job_type,
            job_description: j.job_description,
            status: j.status,
            created_at: j.created_at,
            processing_started_at: j.processing_started_at
        }));
    } else if (role === 'finisher') {
        // Finisher sees only finishing jobs, no financials/contact
        jobs = jobs.filter(j => j.status === 'finishing');
        jobs = jobs.map(j => ({
            job_id: j.job_id,
            job_type: j.job_type,
            job_description: j.job_description,
            status: j.status,
            created_at: j.created_at,
            finishing_started_at: j.finishing_started_at
        }));
    }

    // Status filter
    if (payload.status && payload.status !== 'all') {
        jobs = jobs.filter(j => j.status === payload.status);
    }

    // Search filter
    if (payload.search) {
        const s = payload.search.toLowerCase();
        jobs = jobs.filter(j =>
            String(j.job_id).toLowerCase().includes(s) ||
            String(j.client_name || '').toLowerCase().includes(s) ||
            String(j.job_type || '').toLowerCase().includes(s)
        );
    }

    // Sort by created_at descending (newest first)
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return jsonResponse(jobs);
}

/**
 * Get a single job by ID
 */
function handleGetJob(payload) {
    const auth = requireAuth(payload.token);
    if (auth.error) return auth.error;

    const job = findRow(SHEET_JOBS, 'job_id', payload.job_id);
    if (!job) return errorResponse('Job not found', 404);

    const { role } = auth.user;

    // Strip sensitive data for production roles
    if (role === 'designer' || role === 'finisher') {
        delete job.client_email;
        delete job.client_phone;
        delete job.total_amount;
        delete job.payment_status;
        delete job.notification_pref;
        delete job._rowIndex;
    }

    return jsonResponse(job);
}

/**
 * Create a new job
 */
function handleCreateJob(payload) {
    const auth = requireAuth(payload.token, ['receptionist', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { client_name, client_email, client_phone, notification_pref,
        job_type, job_description, total_amount } = payload;

    if (!client_name || !job_type || !total_amount) {
        return errorResponse('Client name, job type, and total amount are required', 400);
    }

    const jobId = generateJobId();

    // Create case folder in Drive
    let caseFolderUrl = '';
    try {
        caseFolderUrl = createCaseFolder(jobId);
    } catch (e) {
        Logger.log('Drive folder creation failed: ' + e.message);
    }

    const job = {
        job_id: jobId,
        client_name: client_name,
        client_email: client_email || '',
        client_phone: client_phone || '',
        notification_pref: notification_pref || 'email',
        job_type: job_type,
        job_description: job_description || '',
        total_amount: Number(total_amount),
        payment_status: 'pending',
        status: 'pending_payment',
        case_folder_url: caseFolderUrl,
        created_by: auth.user.username,
        updated_by: auth.user.username,
        created_at: now(),
        approved_at: '',
        processing_started_at: '',
        finishing_started_at: '',
        completed_at: ''
    };

    appendRow(SHEET_JOBS, job, JOB_HEADERS);
    logActivity(auth.user.username, 'create_job', `Created job ${jobId} for ${client_name}`);

    return jsonResponse(job);
}

/**
 * Approve a job (receptionist confirms payment)
 */
function handleApproveJob(payload) {
    const auth = requireAuth(payload.token, ['receptionist', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const job = findRow(SHEET_JOBS, 'job_id', payload.job_id);
    if (!job) return errorResponse('Job not found', 404);
    if (job.status !== 'pending_payment') {
        return errorResponse(`Cannot approve: job is "${job.status}", expected "pending_payment"`, 400);
    }

    updateRow(SHEET_JOBS, job._rowIndex, {
        status: 'approved',
        payment_status: 'paid',
        approved_at: now(),
        updated_by: auth.user.username
    });

    logActivity(auth.user.username, 'approve_job', `Approved job ${payload.job_id}`);

    // Send notification async
    try {
        sendJobNotification(payload.job_id, 'approved');
    } catch (e) {
        Logger.log('Notification failed: ' + e.message);
    }

    return jsonResponse({ message: `Job ${payload.job_id} approved`, status: 'approved' });
}

/**
 * Designer receives a job (starts processing)
 */
function handleReceiveJob(payload) {
    const auth = requireAuth(payload.token, ['designer', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const job = findRow(SHEET_JOBS, 'job_id', payload.job_id);
    if (!job) return errorResponse('Job not found', 404);
    if (job.status !== 'approved') {
        return errorResponse(`Cannot receive: job is "${job.status}", expected "approved"`, 400);
    }

    updateRow(SHEET_JOBS, job._rowIndex, {
        status: 'in_progress',
        processing_started_at: now(),
        updated_by: auth.user.username
    });

    logActivity(auth.user.username, 'receive_job', `Started processing job ${payload.job_id}`);

    try {
        sendJobNotification(payload.job_id, 'in_progress');
    } catch (e) {
        Logger.log('Notification failed: ' + e.message);
    }

    return jsonResponse({ message: `Job ${payload.job_id} in progress`, status: 'in_progress' });
}

/**
 * Designer marks processing complete → finishing stage
 */
function handleProcessingComplete(payload) {
    const auth = requireAuth(payload.token, ['designer', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const job = findRow(SHEET_JOBS, 'job_id', payload.job_id);
    if (!job) return errorResponse('Job not found', 404);
    if (job.status !== 'in_progress') {
        return errorResponse(`Cannot complete processing: job is "${job.status}", expected "in_progress"`, 400);
    }

    updateRow(SHEET_JOBS, job._rowIndex, {
        status: 'finishing',
        finishing_started_at: now(),
        updated_by: auth.user.username
    });

    logActivity(auth.user.username, 'processing_complete', `Processing done for job ${payload.job_id}`);

    return jsonResponse({ message: `Job ${payload.job_id} sent to finishing`, status: 'finishing' });
}

/**
 * Finisher marks job as completed
 */
function handleCompleteJob(payload) {
    const auth = requireAuth(payload.token, ['finisher', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const job = findRow(SHEET_JOBS, 'job_id', payload.job_id);
    if (!job) return errorResponse('Job not found', 404);
    if (job.status !== 'finishing') {
        return errorResponse(`Cannot complete: job is "${job.status}", expected "finishing"`, 400);
    }

    updateRow(SHEET_JOBS, job._rowIndex, {
        status: 'completed',
        completed_at: now(),
        updated_by: auth.user.username
    });

    logActivity(auth.user.username, 'complete_job', `Completed job ${payload.job_id}`);

    try {
        sendJobNotification(payload.job_id, 'completed');
    } catch (e) {
        Logger.log('Notification failed: ' + e.message);
    }

    return jsonResponse({ message: `Job ${payload.job_id} completed`, status: 'completed' });
}

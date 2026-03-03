/**
 * PrintFlow — Jobs Module
 * CRUD operations and status transitions for print jobs.
 */

const JOB_HEADERS = [
    'job_id', 'client_name', 'client_email', 'client_phone',
    'notification_pref', 'job_type', 'job_description',
    'total_amount', 'payment_status', 'status', 'case_folder_url',
    'requires_design', 'design_sample_url',
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
        caseFolderUrl = createCaseFolder(jobId, client_name);
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
        requires_delivery: payload.requires_delivery === true,
        delivery_fee: Number(payload.delivery_fee || 0),
        delivery_status: payload.delivery_status || 'none',
        total_amount: Number(total_amount),
        payment_status: 'pending',
        status: 'pending_payment',
        case_folder_url: caseFolderUrl,
        requires_design: payload.requires_design === true,
        design_sample_url: '',
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

    // Generate Invoice PDF and Email Client
    try {
        // We pass the payload items array so the notification can render the itemized table
        if (payload.items && payload.items.length > 0) {
            // Temporarily bind the tax pct to the job object so the email template can read it
            const taxPct = payload.tax_percentage || 0;
            job._tax_pct = taxPct;
            sendInvoiceEmail(job, payload.items);
            delete job._tax_pct; // Clean up before returning to frontend
        }
    } catch (e) {
        Logger.log('Failed to send invoice email: ' + e.message);
    }

    // Auto-log Delivery Expense if required
    if (payload.requires_delivery && Number(payload.delivery_fee) > 0) {
        try {
            const expenseId = 'EXP-' + Utilities.getUuid().split('-')[0].toUpperCase();
            appendRow(SHEET_EXPENSES, {
                expense_id: expenseId,
                category: 'Courier/Delivery',
                amount: Number(payload.delivery_fee),
                description: `Delivery for Job ${jobId} (${client_name})`,
                date_logged: now(),
                payment_status: 'pending',
                logged_by: auth.user.username,
                payment_date: ''
            }, [
                'expense_id', 'category', 'amount', 'description',
                'date_logged', 'payment_status', 'logged_by', 'payment_date'
            ]);
        } catch (err) {
            Logger.log('Failed to auto-log delivery expense: ' + err.message);
        }
    }

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

    return jsonResponse({ message: `Job ${payload.job_id} marked as completed`, status: 'completed' });
}

/**
 * Handle File Uploads for a newly created Job
 */
function handleUploadFile(payload) {
    const auth = requireAuth(payload.token, ['receptionist', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { job_id, filename, mimeType, base64Data } = payload;
    if (!job_id || !filename || !base64Data) {
        return errorResponse('Missing file upload parameters', 400);
    }

    const job = findRow(SHEET_JOBS, 'job_id', job_id);
    if (!job) return errorResponse('Job not found', 404);

    try {
        const fileUrl = uploadFileToJob(job_id, filename, mimeType || 'application/octet-stream', base64Data);
        logActivity(auth.user.username, 'upload_file', `Uploaded ${filename} to job ${job_id}`);
        return jsonResponse({ message: 'File uploaded successfully', file_url: fileUrl });
    } catch (e) {
        return errorResponse('Upload failed: ' + e.message, 500);
    }
}

/**
 * Send a design sample to the client for review
 */
function handleSendDesignReview(payload) {
    const auth = requireAuth(payload.token, ['designer', 'admin', 'super_admin']);
    if (auth.error) return auth.error;

    const { job_id, filename, mimeType, base64Data, messageToClient } = payload;
    if (!job_id || !base64Data) return errorResponse('Missing design file or job ID', 400);

    const job = findRow(SHEET_JOBS, 'job_id', job_id);
    if (!job) return errorResponse('Job not found', 404);

    try {
        const fileUrl = uploadDesignSample(job_id, filename, mimeType, base64Data);
        updateRow(SHEET_JOBS, job._rowIndex, {
            status: 'pending_design_approval',
            design_sample_url: fileUrl,
            updated_by: auth.user.username
        });

        logActivity(auth.user.username, 'send_design', `Sent design review to client for job ${job_id}`);

        // Try sending email
        try {
            sendDesignReviewEmail(job, fileUrl, messageToClient);
        } catch (emailErr) {
            Logger.log('Design email failed: ' + emailErr.message);
        }

        return jsonResponse({ message: 'Design sent for review', status: 'pending_design_approval' });
    } catch (e) {
        return errorResponse('Failed to send design: ' + e.message, 500);
    }
}

/**
 * Public route to get job details for the client review page
 */
function handleGetJobPublic(payload) {
    if (!payload.job_id) return errorResponse('Missing job ID', 400);

    const job = findRow(SHEET_JOBS, 'job_id', payload.job_id);
    if (!job) return errorResponse('Job not found', 404);

    // Only return safe fields
    return jsonResponse({
        job_id: job.job_id,
        client_name: job.client_name,
        job_type: job.job_type,
        status: job.status,
        design_sample_url: job.design_sample_url,
        requires_design: job.requires_design
    });
}

/**
 * Public route for client to submit design feedback
 */
function handleSubmitDesignFeedback(payload) {
    const { job_id, approved, feedback } = payload;
    if (!job_id || typeof approved !== 'boolean') return errorResponse('Invalid parameters', 400);

    const job = findRow(SHEET_JOBS, 'job_id', job_id);
    if (!job) return errorResponse('Job not found', 404);
    if (job.status !== 'pending_design_approval') {
        return errorResponse('Job is not pending design approval', 400);
    }

    const newStatus = approved ? 'approved_for_print' : 'design_rejected';

    updateRow(SHEET_JOBS, job._rowIndex, {
        status: newStatus,
        updated_by: 'CLIENT'
    });

    logActivity('CLIENT', 'design_feedback', `Client ${approved ? 'approved' : 'rejected'} design for ${job_id}. Feedback: ${feedback || 'None'}`);

    // Notify designer
    try {
        sendDesignFeedbackNotification(job, approved, feedback);
    } catch (e) {
        Logger.log('Feedback notification failed: ' + e.message);
    }

    return jsonResponse({ message: 'Feedback submitted successfully', status: newStatus });
}

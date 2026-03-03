/**
 * PrintFlow — Notifications Module
 * Sends email (Gmail) and Google Calendar notifications to clients.
 */

const NOTIFICATION_HEADERS = ['id', 'job_id', 'channel', 'notification_type', 'recipient', 'sent_at', 'status', 'error_message'];

const NOTIFICATION_MESSAGES = {
  approved: {
    subject: 'Job {JOB_ID} Approved — PopOut Studios',
    body: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">PopOut Studios</h1>
          <p style="color: #93c5fd; margin: 5px 0 0 0; font-size: 14px;">Print Office Operations</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1e3a5f; margin-top: 0;">✅ Job Approved</h2>
          <p>Dear <strong>{CLIENT_NAME}</strong>,</p>
          <p>Your payment has been received and your job has been approved. We will notify you when processing begins.</p>
          <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0;"><strong>Job Ticket:</strong> {JOB_ID}</p>
            <p style="margin: 5px 0 0 0;"><strong>Job Type:</strong> {JOB_TYPE}</p>
            <p style="margin: 5px 0 0 0;"><strong>Amount:</strong> ₵{AMOUNT}</p>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Thank you for choosing PopOut Studios.</p>
        </div>
      </div>`
  },
  in_progress: {
    subject: 'Job {JOB_ID} In Progress — PopOut Studios',
    body: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">PopOut Studios</h1>
          <p style="color: #93c5fd; margin: 5px 0 0 0; font-size: 14px;">Print Office Operations</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #2563eb; margin-top: 0;">🔄 Job In Progress</h2>
          <p>Dear <strong>{CLIENT_NAME}</strong>,</p>
          <p>Great news! Your job is now being processed. We will notify you when it is complete.</p>
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0;"><strong>Job Ticket:</strong> {JOB_ID}</p>
            <p style="margin: 5px 0 0 0;"><strong>Job Type:</strong> {JOB_TYPE}</p>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Thank you for your patience.</p>
        </div>
      </div>`
  },
  completed: {
    subject: 'Job {JOB_ID} Complete — PopOut Studios',
    body: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">PopOut Studios</h1>
          <p style="color: #93c5fd; margin: 5px 0 0 0; font-size: 14px;">Print Office Operations</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #10b981; margin-top: 0;">🎉 Job Complete!</h2>
          <p>Dear <strong>{CLIENT_NAME}</strong>,</p>
          <p>Your print job is now complete and ready for pickup or delivery. Thank you for your business!</p>
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0;"><strong>Job Ticket:</strong> {JOB_ID}</p>
            <p style="margin: 5px 0 0 0;"><strong>Job Type:</strong> {JOB_TYPE}</p>
            <p style="margin: 5px 0 0 0;"><strong>Amount Paid:</strong> ₵{AMOUNT}</p>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Thank you for choosing PopOut Studios. We look forward to serving you again!</p>
        </div>
      </div>`
  }
};

/**
 * Send a notification for a job status change
 */
function sendJobNotification(jobId, notificationType) {
  const job = findRow(SHEET_JOBS, 'job_id', jobId);
  if (!job) return;

  const template = NOTIFICATION_MESSAGES[notificationType];
  if (!template) return;

  const replacements = {
    '{JOB_ID}': job.job_id,
    '{CLIENT_NAME}': job.client_name,
    '{JOB_TYPE}': (job.job_type || '').replace(/_/g, ' '),
    '{AMOUNT}': Number(job.total_amount).toFixed(2)
  };

  let subject = template.subject;
  let body = template.body;

  Object.entries(replacements).forEach(([key, val]) => {
    subject = subject.split(key).join(val);
    body = body.split(key).join(val);
  });

  const pref = job.notification_pref || 'email';

  // Email notification
  if ((pref === 'email' || pref === 'both') && job.client_email) {
    try {
      GmailApp.sendEmail(job.client_email, subject, '', { htmlBody: body });
      logNotification(jobId, 'email', notificationType, job.client_email, 'sent', '');
    } catch (e) {
      logNotification(jobId, 'email', notificationType, job.client_email, 'failed', e.message);
    }
  }

  // Calendar notification (for completed jobs — create pickup reminder)
  if (notificationType === 'completed' && job.client_email) {
    try {
      const cal = CalendarApp.getDefaultCalendar();
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 1); // Reminder for next day
      eventDate.setHours(9, 0, 0, 0);

      cal.createEvent(
        `📦 Pickup: ${job.job_id} — ${job.client_name}`,
        eventDate,
        new Date(eventDate.getTime() + 30 * 60 * 1000),
        {
          description: `Job ${job.job_id} is ready for pickup.\nClient: ${job.client_name}\nType: ${job.job_type}\nAmount: ₵${Number(job.total_amount).toFixed(2)}`,
          guests: job.client_email,
          sendInvites: true
        }
      );
      logNotification(jobId, 'calendar', notificationType, job.client_email, 'sent', '');
    } catch (e) {
      logNotification(jobId, 'calendar', notificationType, job.client_email, 'failed', e.message);
    }
  }
}

/**
 * Log notification to the Notification Log sheet
 */
function logNotification(jobId, channel, notificationType, recipient, status, errorMessage) {
  const entry = {
    id: Utilities.getUuid(),
    job_id: jobId,
    channel: channel,
    notification_type: notificationType,
    recipient: recipient,
    sent_at: now(),
    status: status,
    error_message: errorMessage || ''
  };
  appendRow(SHEET_NOTIFICATIONS, entry, NOTIFICATION_HEADERS);
}

/**
 * Send an email to the client with a design review link
 */
function sendDesignReviewEmail(job, fileUrl, messageToClient) {
  if (!job.client_email) return;

  const reviewLink = `${NEXT_PUBLIC_SITE_URL}/review/${job.job_id}`;

  const subject = `Design Ready for Review: Job ${job.job_id} — PopOut Studios`;
  const body = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">PopOut Studios</h1>
        <p style="color: #93c5fd; margin: 5px 0 0 0; font-size: 14px;">Print Office Operations</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e3a5f; margin-top: 0;">🎨 Design Ready for Review</h2>
        <p>Dear <strong>${job.client_name}</strong>,</p>
        <p>Your design for Job <strong>${job.job_id}</strong> is ready for your review.</p>
        ${messageToClient ? `<div style="background: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #9ca3af;"><p style="margin: 0;"><em>Designer's Note:</em><br/>${messageToClient}</p></div>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${reviewLink}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Review & Approve Design</a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If the button above does not work, copy and paste this link into your browser:<br/>${reviewLink}</p>
        <p style="color: #6b7280; font-size: 13px;">Thank you for choosing PopOut Studios.</p>
      </div>
    </div>`;

  try {
    GmailApp.sendEmail(job.client_email, subject, '', { htmlBody: body });
    logNotification(job.job_id, 'email', 'design_review', job.client_email, 'sent', '');
  } catch (e) {
    logNotification(job.job_id, 'email', 'design_review', job.client_email, 'failed', e.message);
  }
}

/**
 * Notify the internal team (designer/admin) about client's design feedback
 */
function sendDesignFeedbackNotification(job, approved, feedback) {
  // Ideally this would go to the specific designer handling the case.
  // For now, we will log it to the notifications log. The system UI will show the status change.
  // We can also send an email to the generic admin/studio email if configured.

  const statusStr = approved ? 'Approved' : 'Requested Changes';
  const desc = `Client ${job.client_name} has ${statusStr} for Job ${job.job_id}. Feedback: "${feedback || 'None'}"`;

  logNotification(job.job_id, 'system', 'design_feedback_received', 'Internal Staff', 'sent', desc);
}

/**
 * Get notification history for a job (admin only)
 */
function handleGetNotifications(payload) {
  const auth = requireAuth(payload.token, ['admin', 'super_admin']);
  if (auth.error) return auth.error;

  let notifications = getSheetData(SHEET_NOTIFICATIONS);

  if (payload.job_id) {
    notifications = notifications.filter(n => n.job_id === payload.job_id);
  }

  notifications.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

  return jsonResponse(notifications);
}

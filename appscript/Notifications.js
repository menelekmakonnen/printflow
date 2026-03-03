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

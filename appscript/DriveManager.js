/**
 * PrintFlow — Drive Manager Module
 * Manages Google Drive folder structure for cases, staff, and users.
 */

/**
 * Initialize the full Drive folder structure (run once)
 */
function initializeDriveFolders() {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);

    const folders = ['Active Jobs', 'Completed Jobs', 'Cases', 'Staff', 'Users', 'Clients'];

    folders.forEach(name => {
        const existing = root.getFoldersByName(name);
        if (!existing.hasNext()) {
            root.createFolder(name);
            Logger.log(`Created folder: ${name}`);
        } else {
            Logger.log(`Folder already exists: ${name}`);
        }
    });

    return 'Folder structure initialized';
}

/**
 * Create a case folder for a new job, nested under a Client folder.
 * Now it creates: Clients -> [Client Name] -> [Job ID]
 */
function createCaseFolder(jobId, clientName) {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);

    // Make sure 'Clients' root exists
    const clientsFolder = getOrCreateSubfolder(root, 'Clients');

    // Sanitize client name for folder naming (avoid weird characters)
    const safeClientName = (clientName || 'Unknown Client').replace(/[/\\?%*:|"<>]/g, '-').trim();

    // Create/Get the specific Client's folder
    const specificClientFolder = getOrCreateSubfolder(clientsFolder, safeClientName);

    // Create the Job ID folder inside the Client's folder
    const jobFolder = specificClientFolder.createFolder(jobId);

    // Create sub-folders inside the case
    jobFolder.createFolder('Uploads');
    jobFolder.createFolder('Invoices'); // Added Invoices folder for automated PDFs

    return jobFolder.getUrl();
}

/**
 * Create a staff folder for a new user
 */
function createStaffFolder(displayName) {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    const staffFolder = getOrCreateSubfolder(root, 'Staff');

    const existing = staffFolder.getFoldersByName(displayName);
    if (!existing.hasNext()) {
        staffFolder.createFolder(displayName);
    }
}

/**
 * Move a completed job folder from Clients -> [Client] -> [JobID] to Completed Jobs
 * Since we moved to Client folders, we need to search across Clients to find the job folder.
 */
function archiveJobFolder(jobId) {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    const clientsFolder = getOrCreateSubfolder(root, 'Clients');
    const completedFolder = getOrCreateSubfolder(root, 'Completed Jobs');

    // We have to find the job folder. It's nested under SOME client folder.
    const clientIter = clientsFolder.getFolders();
    while (clientIter.hasNext()) {
        const clientFolder = clientIter.next();
        const folderIter = clientFolder.getFoldersByName(jobId);
        if (folderIter.hasNext()) {
            const folder = folderIter.next();
            completedFolder.addFolder(folder);
            clientFolder.removeFolder(folder);
            return; // Found and moved
        }
    }
}

/**
 * Get or create a subfolder inside a parent folder
 */
function getOrCreateSubfolder(parent, name) {
    const existing = parent.getFoldersByName(name);
    if (existing.hasNext()) return existing.next();
    return parent.createFolder(name);
}

/**
 * Handle folder initialization from API
 */
function handleInitFolders(payload) {
    const auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    const result = initializeDriveFolders();
    logActivity(auth.user.username, 'init_folders', 'Initialized Drive folder structure');
    return jsonResponse({ message: result });
}

/**
 * Upload a file to a job's Uploads folder
 */
function uploadFileToJob(jobId, filename, mimeType, base64Data) {
    const jobFolder = locateJobFolder(jobId);
    if (!jobFolder) throw new Error(`Could not locate folder for Job ID: ${jobId}`);

    const uploadsFolder = getOrCreateSubfolder(jobFolder, 'Uploads');

    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, filename);
    const file = uploadsFolder.createFile(blob);

    // Anyone with the link can view (important for displaying in dashboard)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
}

/**
 * Upload a design sample to a job's Designs folder
 */
function uploadDesignSample(jobId, filename, mimeType, base64Data) {
    const jobFolder = locateJobFolder(jobId);
    if (!jobFolder) throw new Error(`Could not locate folder for Job ID: ${jobId}`);

    const designsFolder = getOrCreateSubfolder(jobFolder, 'Designs');

    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, filename);
    const file = designsFolder.createFile(blob);

    // Anyone with the link can view (needed for public review page)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
}

/**
 * Helper to iterate through Clients and find the generic Job ID folder
 */
function locateJobFolder(jobId) {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);

    // First, look in Clients folder
    const clientsFolder = getOrCreateSubfolder(root, 'Clients');
    const clientIter = clientsFolder.getFolders();
    while (clientIter.hasNext()) {
        const clientFolder = clientIter.next();
        const folderIter = clientFolder.getFoldersByName(jobId);
        if (folderIter.hasNext()) {
            return folderIter.next();
        }
    }

    // Fallback: Look in legacy Cases folder just in case
    const casesFolder = getOrCreateSubfolder(root, 'Cases');
    const legacyIter = casesFolder.getFoldersByName(jobId);
    if (legacyIter.hasNext()) {
        return legacyIter.next();
    }

    return null;
}

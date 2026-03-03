/**
 * PrintFlow — Drive Manager Module
 * Manages Google Drive folder structure for cases, staff, and users.
 */

/**
 * Initialize the full Drive folder structure (run once)
 */
function initializeDriveFolders() {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);

    const folders = ['Active Jobs', 'Completed Jobs', 'Cases', 'Staff', 'Users'];

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
 * Create a case folder for a new job
 */
function createCaseFolder(jobId) {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    const casesFolder = getOrCreateSubfolder(root, 'Cases');
    const jobFolder = casesFolder.createFolder(jobId);

    // Create sub-folders inside the case
    jobFolder.createFolder('Uploads');

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
 * Move a completed job folder from Cases to Completed Jobs
 */
function archiveJobFolder(jobId) {
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    const casesFolder = getOrCreateSubfolder(root, 'Cases');
    const completedFolder = getOrCreateSubfolder(root, 'Completed Jobs');

    const folderIter = casesFolder.getFoldersByName(jobId);
    if (folderIter.hasNext()) {
        const folder = folderIter.next();
        completedFolder.addFolder(folder);
        casesFolder.removeFolder(folder);
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
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    const casesFolder = getOrCreateSubfolder(root, 'Cases');
    const jobFolder = getOrCreateSubfolder(casesFolder, jobId);
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
    const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    const casesFolder = getOrCreateSubfolder(root, 'Cases');
    const jobFolder = getOrCreateSubfolder(casesFolder, jobId);
    const designsFolder = getOrCreateSubfolder(jobFolder, 'Designs');

    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, filename);
    const file = designsFolder.createFile(blob);

    // Anyone with the link can view (needed for public review page)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
}

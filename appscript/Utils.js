/**
 * PrintFlow — Utility Functions
 * Shared helpers used across all modules.
 */

const SPREADSHEET_ID = '1iQebU6kPf3XmRw40zj8R_RMtx2TbQx8qKFhtlz9bq_A';
const DRIVE_ROOT_FOLDER_ID = '167_hLGwVmkJ5zFNR0g_z1QCq6lb6hWDk';

// Sheet tab names
const SHEET_JOBS = 'Jobs';
const SHEET_USERS = 'Users';
const SHEET_SESSIONS = 'Sessions';
const SHEET_NOTIFICATIONS = 'Notification Log';
const SHEET_CONFIG = 'Config';
const SHEET_ACTIVITY = 'Activity Log';
const SHEET_INVENTORY = 'Inventory';
const SHEET_PRODUCTS = 'Products';
const SHEET_EXPENSES = 'Expenses';

/**
 * Get the main spreadsheet
 */
function getSpreadsheet() {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Get a specific sheet tab, creating it if absent
 */
function getSheet(tabName) {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
        sheet = ss.insertSheet(tabName);
    }
    return sheet;
}

/**
 * Get all rows from a sheet as an array of objects keyed by header names
 */
function getSheetData(tabName) {
    const sheet = getSheet(tabName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    const rows = [];
    for (let i = 1; i < data.length; i++) {
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = data[i][idx];
        });
        row._rowIndex = i + 1; // 1-based row in sheet
        rows.push(row);
    }
    return rows;
}

/**
 * Append a row to a sheet
 */
function appendRow(tabName, rowObject, headers) {
    const sheet = getSheet(tabName);
    const existingData = sheet.getDataRange().getValues();

    // If sheet is empty, write headers first
    if (existingData.length === 0 || existingData[0].join('') === '') {
        sheet.appendRow(headers);
    }

    const hdr = headers || existingData[0];
    const rowArray = hdr.map(h => rowObject[h] !== undefined ? rowObject[h] : '');
    sheet.appendRow(rowArray);
}

/**
 * Update a specific cell by row index and column header
 */
function updateCell(tabName, rowIndex, header, value) {
    const sheet = getSheet(tabName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndex = headers.indexOf(header);
    if (colIndex === -1) throw new Error(`Column "${header}" not found in ${tabName}`);
    sheet.getRange(rowIndex, colIndex + 1).setValue(value);
}

/**
 * Update multiple cells in a row
 */
function updateRow(tabName, rowIndex, updates) {
    Object.entries(updates).forEach(([header, value]) => {
        updateCell(tabName, rowIndex, header, value);
    });
}

/**
 * Find a row by a column value
 */
function findRow(tabName, column, value) {
    const rows = getSheetData(tabName);
    return rows.find(r => String(r[column]) === String(value));
}

/**
 * Find all rows matching a condition
 */
function findRows(tabName, column, value) {
    const rows = getSheetData(tabName);
    return rows.filter(r => String(r[column]) === String(value));
}

/**
 * Generate a unique job ticket ID: TKT-YYYYMMDD-NNN
 */
function generateJobId() {
    const now = new Date();
    const dateStr = Utilities.formatDate(now, 'Africa/Accra', 'yyyyMMdd');
    const prefix = `TKT-${dateStr}-`;

    const jobs = getSheetData(SHEET_JOBS);
    const todaysJobs = jobs.filter(j => String(j.job_id).startsWith(prefix));
    const nextNum = todaysJobs.length + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generate a random session token
 */
function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

/**
 * Get current timestamp in ISO format
 */
function now() {
    return new Date().toISOString();
}

/**
 * Simple bcrypt-like password hashing using Apps Script's Utilities
 * (Not true bcrypt, but a SHA-256 hash with a salt for the MVP)
 */
function hashPassword(password) {
    const salt = Utilities.getUuid();
    const hash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        salt + password
    );
    const hashStr = hash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    return salt + ':' + hashStr;
}

/**
 * Verify a password against a stored hash
 */
function verifyPassword(password, stored) {
    const [salt, hashStr] = stored.split(':');
    const hash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        salt + password
    );
    const computedHash = hash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    return computedHash === hashStr;
}

/**
 * Create a JSON response for the web app
 */
function jsonResponse(data, status) {
    const output = JSON.stringify({
        success: status !== 'error',
        status: status || 'ok',
        data: data,
        timestamp: now()
    });
    return ContentService
        .createTextOutput(output)
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create an error response
 */
function errorResponse(message, code) {
    const output = JSON.stringify({
        success: false,
        status: 'error',
        error: message,
        code: code || 400,
        timestamp: now()
    });
    return ContentService
        .createTextOutput(output)
        .setMimeType(ContentService.MimeType.JSON);
}

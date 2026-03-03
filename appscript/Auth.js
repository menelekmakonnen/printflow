/**
 * PrintFlow — Authentication Module
 * Handles login, logout, session validation.
 * Supports multi-role users (comma-separated roles).
 */

var SESSION_HEADERS = ['token', 'username', 'roles', 'display_name', 'user_id', 'created_at', 'expires_at'];
var SESSION_DURATION_HOURS = 24;

/**
 * Login: validate credentials, create session token
 */
function handleLogin(payload) {
    var username = payload.username;
    var password = payload.password;
    if (!username || !password) {
        return errorResponse('Username and password are required', 401);
    }

    var user = findRow(SHEET_USERS, 'username', username);
    if (!user) {
        return errorResponse('Invalid credentials', 401);
    }

    // Check if user is disabled
    if (user.status === 'disabled') {
        return errorResponse('Your account has been disabled. Contact your administrator.', 403);
    }

    if (!verifyPassword(password, user.password_hash)) {
        return errorResponse('Invalid credentials', 401);
    }

    // Support both old 'role' field and new 'roles' field
    var userRoles = user.roles || user.role || '';

    // Create session
    var token = generateToken();
    var expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

    var session = {
        token: token,
        username: user.username,
        roles: userRoles,
        display_name: user.display_name,
        user_id: user.user_id || user.username,
        created_at: now(),
        expires_at: expiresAt.toISOString()
    };

    appendRow(SHEET_SESSIONS, session, SESSION_HEADERS);

    // Log activity
    logActivity(user.username, 'login', 'User logged in');

    return jsonResponse({
        token: token,
        user: {
            username: user.username,
            display_name: user.display_name,
            roles: userRoles,
            avatar_base64: user.avatar_base64 || ''
        }
    });
}

/**
 * Logout: invalidate session token
 */
function handleLogout(payload) {
    var token = payload.token;
    if (!token) return errorResponse('No token provided', 400);

    var session = findRow(SHEET_SESSIONS, 'token', token);
    if (session) {
        updateCell(SHEET_SESSIONS, session._rowIndex, 'expires_at', '1970-01-01T00:00:00Z');
    }

    return jsonResponse({ message: 'Logged out' });
}

/**
 * Validate a session token. Returns user info or null.
 */
function validateSession(token) {
    if (!token) return null;

    var session = findRow(SHEET_SESSIONS, 'token', token);
    if (!session) return null;

    var expires = new Date(session.expires_at);
    if (expires < new Date()) return null;

    return {
        username: session.username,
        roles: session.roles || session.role || '',
        display_name: session.display_name,
        user_id: session.user_id
    };
}

/**
 * Middleware: validate token and check role.
 * Uses multi-role: passes if user has ANY of the allowedRoles.
 */
function requireAuth(token, allowedRoles) {
    var user = validateSession(token);
    if (!user) {
        return { error: errorResponse('Unauthorized — please log in', 401) };
    }

    if (allowedRoles) {
        var userRoles = (user.roles || '').split(',').map(function (r) { return r.trim(); });
        var hasPermission = false;
        for (var i = 0; i < allowedRoles.length; i++) {
            if (userRoles.indexOf(allowedRoles[i]) >= 0) {
                hasPermission = true;
                break;
            }
        }
        if (!hasPermission) {
            return { error: errorResponse('Forbidden — insufficient permissions', 403) };
        }
    }

    return { user: user };
}

/**
 * Get current user from token
 */
function handleGetMe(payload) {
    var auth = requireAuth(payload.token);
    if (auth.error) return auth.error;

    // Fetch fresh user data to get the latest avatar
    var user = findRow(SHEET_USERS, 'username', auth.user.username);
    if (user) {
        auth.user.avatar_base64 = user.avatar_base64 || '';
    }

    return jsonResponse(auth.user);
}

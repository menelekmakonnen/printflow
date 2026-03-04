/**
 * PrintFlow — Users Module
 * User management with multi-role support and disable/enable (no delete).
 * Roles stored as comma-separated string: "receptionist,designer"
 */

const USER_HEADERS = ['user_id', 'username', 'password_hash', 'display_name', 'roles', 'status', 'created_at', 'avatar_base64'];

const VALID_ROLES = ['receptionist', 'designer', 'finisher', 'admin', 'super_admin'];

/**
 * Parse roles string into array
 */
function parseRoles(rolesStr) {
    if (!rolesStr) return [];
    return String(rolesStr).split(',').map(r => {
        var normalized = r.trim().toLowerCase().replace(/\s+/g, '_');
        if (normalized === 'site_admin') return 'admin';
        return normalized;
    }).filter(r => VALID_ROLES.includes(r));
}

/**
 * Check if a user has any of the specified roles
 */
function userHasAnyRole(user, roleList) {
    // Support both old 'role' field and new 'roles' field
    var rolesStr = user.roles || user.role || '';
    var userRoles = parseRoles(rolesStr);
    for (var i = 0; i < roleList.length; i++) {
        if (userRoles.indexOf(roleList[i]) >= 0) return true;
    }
    return false;
}

/**
 * Get all users (admin/super_admin only)
 */
function handleGetUsers(payload) {
    var auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    var users = getSheetData(SHEET_USERS).map(function (u) {
        return {
            user_id: u.user_id,
            username: u.username,
            display_name: u.display_name,
            roles: u.roles || u.role || '',
            status: u.status || 'active',
            created_at: u.created_at
        };
    });

    return jsonResponse(users);
}

/**
 * Create a new user
 */
function handleCreateUser(payload) {
    var auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    var username = payload.username;
    var password = payload.password;
    var display_name = payload.display_name;
    var roles = payload.roles; // comma-separated string or array

    if (!username || !password || !display_name || !roles) {
        return errorResponse('All fields are required: username, password, display_name, roles', 400);
    }

    // Normalize roles
    var rolesArray = Array.isArray(roles) ? roles : String(roles).split(',').map(function (r) { return r.trim(); });
    for (var i = 0; i < rolesArray.length; i++) {
        if (VALID_ROLES.indexOf(rolesArray[i]) < 0) {
            return errorResponse('Invalid role: "' + rolesArray[i] + '". Must be one of: ' + VALID_ROLES.join(', '), 400);
        }
    }

    // Only super_admin can assign admin or super_admin roles
    var callerRoles = parseRoles(auth.user.roles || auth.user.role);
    if ((rolesArray.indexOf('admin') >= 0 || rolesArray.indexOf('super_admin') >= 0) && callerRoles.indexOf('super_admin') < 0) {
        return errorResponse('Only Super Admin can assign admin roles', 403);
    }

    // Check if username already exists
    var existing = findRow(SHEET_USERS, 'username', username);
    if (existing) {
        return errorResponse('Username already taken', 400);
    }

    var userId = Utilities.getUuid();
    var hashedPassword = hashPassword(password);
    var rolesString = rolesArray.join(',');

    var user = {
        user_id: userId,
        username: username,
        password_hash: hashedPassword,
        display_name: display_name,
        roles: rolesString,
        status: 'active',
        created_at: now()
    };

    appendRow(SHEET_USERS, user, USER_HEADERS);

    // Create staff folder in Drive
    try {
        createStaffFolder(display_name);
    } catch (e) {
        Logger.log('Staff folder creation failed: ' + e.message);
    }

    logActivity(auth.user.username, 'create_user', 'Created user "' + username + '" with roles "' + rolesString + '"');

    return jsonResponse({
        user_id: userId,
        username: username,
        display_name: display_name,
        roles: rolesString,
        status: 'active'
    });
}

/**
 * Update an existing user
 */
function handleUpdateUser(payload) {
    var auth = requireAuth(payload.token, ['admin', 'super_admin']);
    if (auth.error) return auth.error;

    var user = findRow(SHEET_USERS, 'username', payload.target_username);
    if (!user) return errorResponse('User not found', 404);

    var updates = {};

    if (payload.display_name) updates.display_name = payload.display_name;

    if (payload.roles) {
        var rolesArray = Array.isArray(payload.roles) ? payload.roles : String(payload.roles).split(',').map(function (r) { return r.trim(); });
        for (var i = 0; i < rolesArray.length; i++) {
            if (VALID_ROLES.indexOf(rolesArray[i]) < 0) {
                return errorResponse('Invalid role: "' + rolesArray[i] + '"', 400);
            }
        }
        // Only super_admin can assign admin or super_admin
        var callerRoles = parseRoles(auth.user.roles || auth.user.role);
        if ((rolesArray.indexOf('admin') >= 0 || rolesArray.indexOf('super_admin') >= 0) && callerRoles.indexOf('super_admin') < 0) {
            return errorResponse('Only Super Admin can assign admin roles', 403);
        }
        updates.roles = rolesArray.join(',');
    }

    if (payload.new_password) {
        updates.password_hash = hashPassword(payload.new_password);
    }

    if (Object.keys(updates).length > 0) {
        updateRow(SHEET_USERS, user._rowIndex, updates);
    }

    logActivity(auth.user.username, 'update_user', 'Updated user "' + payload.target_username + '"');

    return jsonResponse({ message: 'User "' + payload.target_username + '" updated' });
}

/**
 * Disable a user (super_admin only) — blocks login but preserves data
 */
function handleDisableUser(payload) {
    var auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    var user = findRow(SHEET_USERS, 'username', payload.target_username);
    if (!user) return errorResponse('User not found', 404);

    if (user.username === auth.user.username) {
        return errorResponse('Cannot disable your own account', 400);
    }

    updateRow(SHEET_USERS, user._rowIndex, { status: 'disabled' });

    logActivity(auth.user.username, 'disable_user', 'Disabled user "' + payload.target_username + '"');

    return jsonResponse({ message: 'User "' + payload.target_username + '" disabled' });
}

/**
 * Enable a previously disabled user (super_admin only)
 */
function handleEnableUser(payload) {
    var auth = requireAuth(payload.token, ['super_admin']);
    if (auth.error) return auth.error;

    var user = findRow(SHEET_USERS, 'username', payload.target_username);
    if (!user) return errorResponse('User not found', 404);

    updateRow(SHEET_USERS, user._rowIndex, { status: 'active' });

    logActivity(auth.user.username, 'enable_user', 'Enabled user "' + payload.target_username + '"');

    return jsonResponse({ message: 'User "' + payload.target_username + '" enabled' });
}

/**
 * Allow any authenticated user to update their own profile (avatar)
 */
function handleUpdateProfile(payload) {
    var auth = requireAuth(payload.token); // any logged in user
    if (auth.error) return auth.error;

    var user = findRow(SHEET_USERS, 'username', auth.user.username);
    if (!user) return errorResponse('User not found', 404);

    var updates = {};

    if (payload.avatar_base64 !== undefined) {
        updates.avatar_base64 = payload.avatar_base64;
    }

    if (Object.keys(updates).length > 0) {
        updateRow(SHEET_USERS, user._rowIndex, updates);
    }

    logActivity(auth.user.username, 'update_profile', 'Updated their profile image');

    return jsonResponse({ message: 'Profile updated' });
}

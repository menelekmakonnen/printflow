/**
 * PrintFlow API Proxy
 * Routes all frontend requests through Next.js server to avoid CORS with Apps Script.
 */

export async function POST(request) {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

    if (!APPS_SCRIPT_URL) {
        return Response.json(
            { success: false, error: 'Apps Script URL not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            redirect: 'follow',
        });

        // Apps Script returns ContentService responses — parse as text first
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { success: false, error: 'Invalid response from backend', raw: text.substring(0, 500) };
        }

        return Response.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return Response.json(
            { success: false, error: 'Failed to reach backend: ' + error.message },
            { status: 502 }
        );
    }
}

export async function GET(request) {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
        return Response.json({ success: false, error: 'Not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams(searchParams);

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
            redirect: 'follow',
        });
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { success: false, error: 'Invalid response', raw: text.substring(0, 500) };
        }
        return Response.json(data);
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 502 });
    }
}

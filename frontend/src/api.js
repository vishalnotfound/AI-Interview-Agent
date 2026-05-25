// In production (Docker), nginx proxies API calls — use relative URLs.
// In local dev (Vite on :5173), point to the backend directly.
const API_BASE = window.location.port === '5173'
    ? 'http://localhost:8000'
    : 'https://ai-interview-agent-bot.onrender.com';

/**
 * Ping the backend /health endpoint to wake up the Render free-tier server.
 * Called on app load so the server is already warm by the time the user uploads a resume.
 */
export function wakeUpBackend() {
    fetch(`${API_BASE}/health`).catch(() => {});
}

export async function uploadResume(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload-resume`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload resume');
    }

    return res.json();
}

export async function submitAnswer(payload) {
    const res = await fetch(`${API_BASE}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit answer');
    }

    return res.json();
}


// ─── Auth API ───

export async function apiSignup(name, email, password) {
    const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Signup failed');
    }

    return res.json();
}

export async function apiLogin(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Login failed');
    }

    return res.json();
}

export async function apiGetMe(token) {
    const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        throw new Error('Not authenticated');
    }

    return res.json();
}


// ─── History API ───

export async function apiSaveReport(token, report) {
    const res = await fetch(`${API_BASE}/history/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(report),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save report');
    }

    return res.json();
}

export async function apiGetHistory(token) {
    const res = await fetch(`${API_BASE}/history/`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to fetch history');
    }

    return res.json();
}

export async function apiDeleteReport(token, recordId) {
    const res = await fetch(`${API_BASE}/history/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete record');
    }

    return res.json();
}

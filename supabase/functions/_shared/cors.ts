const ALLOWED_ORIGINS = [
    'https://bolo-indie-ai.vercel.app',
    'http://localhost:5173',
    'http://localhost:1420',
    'tauri://localhost',
];

export function getCorsHeaders(request: Request) {
    const origin = request.headers.get('Origin');
    const headers = {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        return {
            ...headers,
            'Access-Control-Allow-Origin': origin,
        };
    }

    // Default to the first allowed origin or something restrictive if no origin is provided
    // Note: For some environments (like Tauri on some platforms), the Origin might be missing or different.
    // However, the security requirement is to restrict it.
    return {
        ...headers,
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    };
}

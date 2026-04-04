import { jest } from '@jest/globals';

export const supabase = {
    auth: {
        refreshSession: jest.fn(),
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    }
};

export const getAccessToken = jest.fn(() => Promise.resolve(null));

export default supabase;

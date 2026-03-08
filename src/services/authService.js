// ========================================
// Auth Service — Supabase Authentication
// ========================================

import { supabase } from './supabaseClient';

/**
 * Sign up with email and password
 */
export async function signUp(email, password, displayName = '') {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName },
        },
    });

    if (error) throw error;

    // Profile will be created by ensureProfile() when App.jsx detects the session
    return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        },
    });

    if (error) throw error;
    return data;
}

/**
 * Sign out
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Get current session
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
            callback(event, session);
        }
    );
    return subscription;
}

/**
 * Ensure a profile row exists for the user.
 * Called after login/signup — replaces the database trigger approach.
 */
export async function ensureProfile(user) {
    if (!user) return null;

    // Check if profile already exists
    const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (existing) return existing;

    // Create new profile
    const displayName = user.user_metadata?.display_name
        || user.user_metadata?.full_name
        || user.email?.split('@')[0]
        || 'User';

    const { data, error } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            display_name: displayName,
            preferred_language: 'unknown',
            stt_mode: 'translate',
            plan: 'free',
            daily_credits: 0,
            topup_credits: 10,
        })
        .select()
        .single();

    if (error) {
        console.error('[Auth] Failed to create profile:', error);
        // Might fail due to RLS — try upsert
        const { data: upserted } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                display_name: displayName,
                plan: 'free',
                daily_credits: 0,
                topup_credits: 10,
            })
            .select()
            .single();
        return upserted;
    }

    return data;
}

/**
 * Get user profile from DB
 */
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('[Auth] Profile fetch error:', error);
        return null;
    }
    return data;
}

/**
 * Update user profile
 */
export async function updateProfile(userId, updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get user's remaining credits
 */
export async function getCredits(userId) {
    const profile = await getUserProfile(userId);
    return (profile?.daily_credits ?? 0) + (profile?.topup_credits ?? 0);
}

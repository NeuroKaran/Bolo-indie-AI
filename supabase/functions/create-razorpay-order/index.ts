import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const token = authHeader.replace(/^Bearer\s+/i, '');
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_ANON_KEY') || '',
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Parse package info
        const { packageId, amount_inr } = await req.json();

        if (!amount_inr || amount_inr <= 0) {
            return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const keyId = Deno.env.get('VITE_RAZORPAY_KEY_ID');
        const keySecret = Deno.env.get('VITE_RAZORPAY_KEY_SECRET');

        if (!keyId || !keySecret) {
            throw new Error('Razorpay credentials not configured');
        }

        // Call Razorpay
        const authString = btoa(`${keyId}:${keySecret}`);
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authString}`
            },
            body: JSON.stringify({
                amount: amount_inr * 100, // Convert to paisa
                currency: 'INR',
                receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
                notes: {
                    user_id: user.id,
                    package_id: packageId || 'unknown'
                }
            })
        });

        const orderData = await response.json();
        if (!response.ok) {
            throw new Error(orderData.error?.description || 'Failed to create order');
        }

        return new Response(JSON.stringify(orderData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('Error in create-razorpay-order:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

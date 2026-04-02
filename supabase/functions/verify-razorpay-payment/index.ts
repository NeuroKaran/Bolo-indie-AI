import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${orderId}|${paymentId}`);
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, data);

    const hexMac = Array.from(new Uint8Array(mac))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return hexMac === signature;
}

Deno.serve(async (req) => {
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

        const body = await req.json();
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

        const keyId = Deno.env.get('VITE_RAZORPAY_KEY_ID');
        const keySecret = Deno.env.get('VITE_RAZORPAY_KEY_SECRET');
        if (!keyId || !keySecret) throw new Error('Razorpay credentials not configured');

        const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret);
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid payment signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Fetch order details from Razorpay to verify package and user
        const authString = btoa(`${keyId}:${keySecret}`);
        const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
            headers: {
                'Authorization': `Basic ${authString}`
            }
        });

        if (!orderRes.ok) {
            throw new Error('Failed to fetch order details from Razorpay');
        }

        const orderData = await orderRes.json();
        const verifiedPackageId = orderData.notes?.package_id;
        const verifiedUserId = orderData.notes?.user_id;

        if (verifiedUserId !== user.id) {
            throw new Error('Payment user mismatch');
        }

        if (!verifiedPackageId) {
            throw new Error('Package ID missing from order notes');
        }

        // Apply package benefits
        const { data: profile } = await supabase.from('profiles').select('plan, topup_credits, daily_credits').eq('id', user.id).single();
        if (!profile) throw new Error('Profile not found');

        let updateData: any = {};

        // Define our packages based on the pricing strategy
        if (verifiedPackageId === 'pro_monthly') {
            updateData.plan = 'pro';
            updateData.daily_credits = 10;
        } else if (verifiedPackageId === 'power_monthly') {
            updateData.plan = 'power';
            updateData.daily_credits = 30;
        } else if (verifiedPackageId === 'topup_mini') {
            updateData.topup_credits = profile.topup_credits + 50;
        } else if (verifiedPackageId === 'topup_value') {
            updateData.topup_credits = profile.topup_credits + 200;
        } else if (verifiedPackageId === 'topup_mega') {
            updateData.topup_credits = profile.topup_credits + 500;
        } else {
            throw new Error('Unknown package ID');
        }

        const { error: updateError } = await supabase.from('profiles').update(updateData).eq('id', user.id);
        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, message: 'Payment verified and profile updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('Error in verify-razorpay-payment:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

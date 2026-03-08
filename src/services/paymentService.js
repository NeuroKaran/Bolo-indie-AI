// ========================================
// Payment Service — Razorpay Integration
// ========================================

import { supabase } from './supabaseClient';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Load Razorpay script dynamically
 */
function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

/**
 * Initiate a payment flow
 */
export async function initiatePayment(packageId, amountInr) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // 1. Create order on the server
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ packageId, amount_inr: amountInr })
        });

        const orderData = await response.json();
        if (!response.ok) throw new Error(orderData.error || 'Got error creating order');

        // 2. Load script
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error('Razorpay SDK failed to load');

        // 3. Open Razorpay Checkouot
        return new Promise((resolve, reject) => {
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Use the public key ID here
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Bolo AI',
                description: `Upgrade: ${packageId}`,
                order_id: orderData.id,
                theme: { color: '#FF9933' }, // Saffron
                handler: async function (paymentResponse) {
                    try {
                        // 4. Verify payment on server
                        const verifyRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-razorpay-payment`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                packageId
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');

                        resolve(true);
                    } catch (err) {
                        reject(err);
                    }
                },
                modal: {
                    ondismiss: function () {
                        reject(new Error('Payment cancelled'));
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                reject(new Error(response.error.description));
            });
            rzp.open();
        });

    } catch (err) {
        console.error('Payment Error:', err);
        throw err;
    }
}

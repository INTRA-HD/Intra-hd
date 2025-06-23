const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Initialize Paystack API client
const paystackAPI = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Initialize a payment transaction
exports.initializeTransaction = async (data) => {
  try {
    const { amount, email, reference, metadata } = data;
    
    // Use amount as totalAmount (orderAmount + charges)
    const response = await paystackAPI.post('/transaction/initialize', {
      amount, // amount should already be totalAmount * 100 (pesewas)
      email,
      reference,
      metadata
    });
    
    return {
      success: true,
      data: response.data.data,
      message: 'Transaction initialized'
    };
  } catch (error) {
    console.error('Error initializing Paystack transaction:', error.response?.data || error.message);
    
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to initialize transaction'
    };
  }
};

// Verify a payment transaction
exports.verifyTransaction = async (reference) => {
  try {
    const response = await paystackAPI.get(`/transaction/verify/${reference}`);
    
    return {
      success: true,
      data: response.data.data,
      message: 'Transaction verified'
    };
  } catch (error) {
    console.error('Error verifying Paystack transaction:', error.response?.data || error.message);
    
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to verify transaction'
    };
  }
};

// Parse and validate Paystack webhook event
exports.parseWebhookEvent = (requestBody, signature) => {
  try {
    // In production, validate the signature
    if (process.env.NODE_ENV === 'production' && signature) {
      const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                      .update(JSON.stringify(requestBody))
                      .digest('hex');
      
      if (hash !== signature) {
        throw new Error('Invalid signature');
      }
    }
    
    return {
      success: true,
      data: requestBody,
      eventType: requestBody.event
    };
  } catch (error) {
    console.error('Error parsing Paystack webhook:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to parse webhook event'
    };
  }
};

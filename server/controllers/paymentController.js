const { Order } = require('../models');
const paystack = require('../utils/paystack');
const Joi = require('joi');

// Validation schema for initializing payment
const paymentSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  email: Joi.string().email().required()
});

// Initialize payment for an order
exports.initializePayment = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = paymentSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        errors: error.details.map(d => d.message)
      });
    }

    const { orderId, email } = value;

    // Find the order
    const order = await Order.findByPk(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Generate reference
    const reference = `INTRA-HD-${Date.now()}-${orderId.substring(0, 8)}`;

    // Initialize transaction
    const paymentData = {
      amount: parseFloat(order.totalAmount) * 100, // Use totalAmount for payment
      email,
      reference,
      metadata: {
        order_id: order.id,
        customer_name: order.name,
        customer_phone: order.phoneNumber
      }
    };

    const paystackResponse = await paystack.initializeTransaction(paymentData);
    
    if (!paystackResponse.success) {
      return res.status(500).json({
        success: false,
        message: paystackResponse.message
      });
    }

    // Update order with payment reference
    order.paymentReference = reference;
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Payment initialized',
      data: {
        reference: paystackResponse.data.reference,
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code
      }
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',
      error: error.message
    });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    // Verify transaction with Paystack
    const verificationResponse = await paystack.verifyTransaction(reference);

    if (!verificationResponse.success) {
      return res.status(400).json({
        success: false,
        message: verificationResponse.message
      });
    }

    const transaction = verificationResponse.data;

    // Find the order with this reference
    const order = await Order.findOne({ where: { paymentReference: reference } });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found for the provided reference'
      });
    }

    // Update order payment status based on Paystack response
    if (transaction.status === 'success') {
      order.paymentStatus = 'completed';
      order.paymentDate = new Date();
      await order.save();

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          orderId: order.id,
          status: 'completed',
          amount: transaction.amount / 100, // Convert from pesewas to GHS
          reference: transaction.reference,
          paidAt: transaction.paid_at
        }
      });
    } else {
      order.paymentStatus = 'failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: {
          orderId: order.id,
          status: 'failed',
          reference: transaction.reference
        }
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

// Handle webhook events from Paystack
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    
    // Parse and validate the webhook event
    const event = paystack.parseWebhookEvent(req.body, signature);

    if (!event.success) {
      return res.status(400).json({
        success: false,
        message: event.message
      });
    }

    // Handle different event types
    const eventData = event.data;
    
    if (eventData.event === 'charge.success') {
      const reference = eventData.data.reference;
      
      // Find the order with this reference
      const order = await Order.findOne({ where: { paymentReference: reference } });
      
      if (order) {
        order.paymentStatus = 'completed';
        order.paymentDate = new Date();
        await order.save();
      }
    }

    // Return 200 to acknowledge receipt of the webhook
    return res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message
    });
  }
};

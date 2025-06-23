const { Order } = require('../models');
const Joi = require('joi');
const { sendOrderNotification } = require('../utils/emailService');

// Validation schema for creating a new order
const orderSchema = Joi.object({
  name: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  residenceType: Joi.string().valid('legon-hall', 'traditional-halls', 'hostels').required(),
  orderDescription: Joi.string().required(),
  orderAmount: Joi.number().positive().required(),
  // Optional fields based on residence type
  block: Joi.string().when('residenceType', {
    is: Joi.string().valid('legon-hall', 'hostels'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  room: Joi.string().when('residenceType', {
    is: 'legon-hall',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  hall: Joi.string().when('residenceType', {
    is: 'traditional-halls',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  hostel: Joi.string().when('residenceType', {
    is: 'hostels',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  userId: Joi.string().optional(),
});

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = orderSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        errors: error.details.map(d => d.message)
      });
    }

    // Calculate charges and totalAmount
    const orderAmount = parseFloat(value.orderAmount);
    const charges = +(orderAmount * 0.2).toFixed(2);
    const totalAmount = +(orderAmount + charges).toFixed(2);

    const orderData = {
      ...value,
      charges,
      totalAmount
    };

    // Create order in database
    const order = await Order.create(orderData);
    
    // Send email notification (don't block the response if email fails)
    sendOrderNotification(order.toJSON()).catch(error => {
      console.error('Failed to send email notification:', error);
    });
    
    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get a specific order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// Get orders by user ID
exports.getOrdersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user orders',
      error: error.message
    });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['received', 'processing', 'in-delivery', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update the order
    order.status = status;
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await order.destroy();

    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
};

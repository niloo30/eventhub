import mongoose from 'mongoose';

const bookedSeatSchema = new mongoose.Schema(
  {
    seatId: { type: String, required: true },
    row: { type: String, required: true },
    number: { type: Number, required: true },
    section: { type: String, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const ticketBookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    seats: { type: [bookedSeatSchema], default: [] },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['held', 'pending_payment', 'paid', 'cancelled', 'expired'],
      default: 'held',
    },
    holdExpiresAt: { type: Date },
    bookingReference: { type: String, required: true, unique: true },
    paymentProvider: { type: String, default: 'razorpay' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    refundStatus: { type: String, default: 'none' },
    refundReference: { type: String },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

ticketBookingSchema.index({ show: 1, status: 1 });
ticketBookingSchema.index({ user: 1, show: 1, status: 1 });
ticketBookingSchema.index({ holdExpiresAt: 1 });
ticketBookingSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
ticketBookingSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

export const TicketBooking = mongoose.model('TicketBooking', ticketBookingSchema);
export default TicketBooking;

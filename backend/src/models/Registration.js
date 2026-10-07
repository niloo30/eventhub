import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    bookingType: { type: String, enum: ['free', 'permanent'], default: 'free' },
    ticketOptionKey: { type: String, default: 'free' },
    ticketOptionLabel: { type: String },
    bookingReference: { type: String },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending_payment', 'registered', 'attended', 'cancelled'], default: 'registered' },
    paymentProvider: { type: String, default: 'razorpay' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: { type: Date },
    qrCodeDataUrl: { type: String },
    checkedInAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    refundStatus: { type: String, default: 'none' },
    refundReference: { type: String },
    refundedAt: { type: Date },
    reminderSentAt: { type: Date },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

export const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;

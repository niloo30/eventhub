import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['customer', 'organizer', 'admin'], default: 'customer' },
    isBlocked: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    interests: [{ type: String }],
    avatarUrl: { type: String },
    authOtpCodeHash: { type: String, select: false },
    authOtpExpiresAt: { type: Date, select: false },
    authOtpPurpose: { type: String, enum: ['signup', 'login'], select: false },
    authOtpAttempts: { type: Number, default: 0, select: false },
    lastOtpSentAt: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
export default User;

import mongoose from 'mongoose';

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // 1 hour in seconds (TTL index)
  }
});

export const PasswordResetTokenModel = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
export default PasswordResetTokenModel;

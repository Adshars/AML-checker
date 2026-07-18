import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface PasswordResetTokenDocument extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  createdAt: Date;
}

const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>({
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

export const PasswordResetTokenModel: Model<PasswordResetTokenDocument> = mongoose.model<PasswordResetTokenDocument>('PasswordResetToken', passwordResetTokenSchema);
export default PasswordResetTokenModel;

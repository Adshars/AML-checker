import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface RefreshTokenDocument extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>({
  token: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800 // 7 days in seconds (TTL index)
  }
});

export const RefreshTokenModel: Model<RefreshTokenDocument> = mongoose.model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema);
export default RefreshTokenModel;

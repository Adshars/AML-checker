import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  organizationId: mongoose.Types.ObjectId;
  role: 'superadmin' | 'admin' | 'user';
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'user'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const UserModel: Model<UserDocument> = mongoose.model<UserDocument>('User', userSchema);
export default UserModel;

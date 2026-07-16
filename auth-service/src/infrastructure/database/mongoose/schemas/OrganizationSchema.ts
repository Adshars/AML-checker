import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface OrganizationDocument extends Document {
  name: string;
  country: string;
  city: string;
  address: string;
  apiKey?: string;
  apiSecretHash?: string;
  createdAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  apiSecretHash: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const OrganizationModel: Model<OrganizationDocument> = mongoose.model<OrganizationDocument>('Organization', organizationSchema);
export default OrganizationModel;

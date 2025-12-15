import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  // Organisation name
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Location data
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
    required: true, // Street, number, etc.
    trim: true
  },
  // API Keys for machine access (B2B)
  apiKey: {
    type: String,
    unique: true,
    sparse: true // Allows for missing key before generation
  },
  // API Secret Hash
  apiSecretHash: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Organization', organizationSchema);
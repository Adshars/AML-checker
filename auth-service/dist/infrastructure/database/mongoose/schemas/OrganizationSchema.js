import mongoose, { Schema } from 'mongoose';
const organizationSchema = new Schema({
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
export const OrganizationModel = mongoose.model('Organization', organizationSchema);
export default OrganizationModel;

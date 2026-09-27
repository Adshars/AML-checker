import Joi from 'joi';
import { IDENTITY_MODES, hasAnyService, normalizeOrganizationServices } from '../../domain/entities/OrganizationServices.js';
// Rules
const emailRule = Joi.string().email().required().messages({
    'string.email': 'Invalid email (must contain @ and a domain with a dot)',
    'string.empty': 'Email is required',
    'any.required': 'Email is required'
});
const passwordRule = Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.empty': 'Password is required',
    'any.required': 'Password is required'
});
const textRule = Joi.string().required().messages({
    'string.empty': 'This field cannot be empty',
    'any.required': 'This field is required'
});
// Organization services rules
const sanctionsRule = Joi.boolean().messages({
    'boolean.base': 'sanctions must be a boolean',
    'any.required': 'sanctions is required'
});
const identityModeMessage = `identityMode must be one of: ${IDENTITY_MODES.join(', ')}`;
const identityModeRule = Joi.string().valid(...IDENTITY_MODES).messages({
    'any.only': identityModeMessage,
    'string.base': identityModeMessage,
    'any.required': 'identityMode is required'
});
const servicesMessages = {
    'object.base': 'Services must be an object',
    'services.none': 'At least one service must be enabled'
};
// Omitted fields fall back to defaults before the check
const atLeastOneService = (value, helpers) => hasAnyService(normalizeOrganizationServices(value)) ? value : helpers.error('services.none');
// Organization Registration Schema
export const registerOrgSchema = Joi.object({
    orgName: textRule,
    country: textRule,
    city: textRule,
    address: textRule,
    firstName: textRule,
    lastName: textRule,
    email: emailRule,
    password: passwordRule,
    services: Joi.object({
        sanctions: sanctionsRule,
        identityMode: identityModeRule
    }).custom(atLeastOneService).messages(servicesMessages).optional()
});
// Organization Services Update Schema (full object required)
export const updateOrganizationServicesSchema = Joi.object({
    sanctions: sanctionsRule.required(),
    identityMode: identityModeRule.required()
}).custom(atLeastOneService).messages(servicesMessages);
// User Registration Schema
export const registerUserSchema = Joi.object({
    firstName: textRule,
    lastName: textRule,
    organizationId: Joi.string().optional(),
    email: emailRule,
    password: passwordRule,
    role: Joi.string().valid('user', 'admin', 'superadmin').optional().messages({
        'any.only': 'Role must be one of: user, admin, superadmin'
    })
});
// Login Schema
export const loginSchema = Joi.object({
    email: emailRule,
    password: Joi.string().required().messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is required'
    })
});
// Reset Password Schema
export const resetPasswordSchema = Joi.object({
    userId: Joi.string().required(),
    token: Joi.string().required(),
    newPassword: passwordRule
});
// Change Password Schema
export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'string.empty': 'Current password is required',
        'any.required': 'Current password is required'
    }),
    newPassword: passwordRule
});
/**
 * Validation middleware factory
 */
export const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }
        next();
    };
};

import Joi from 'joi';

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

// Organization Registration Schema
export const registerOrgSchema = Joi.object({
  orgName: textRule,
  country: textRule,
  city: textRule,
  address: textRule,
  firstName: textRule,
  lastName: textRule,
  email: emailRule,
  password: passwordRule
});

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
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

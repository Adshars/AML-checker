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

// Organization and User Validation Schemas

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
  organizationId: Joi.string().optional(), // Optional - will be enforced from admin context
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
    'string.empty': 'Hasło jest wymagane',
    'any.required': 'Hasło jest wymagane'
  })
});

// Reset Password Schema
export const resetPasswordSchema = Joi.object({
  userId: Joi.string().required(),
  token: Joi.string().required(),
  newPassword: passwordRule
});
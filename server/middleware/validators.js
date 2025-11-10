import Joi from "joi";

export const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(32).required()
      .messages({
        "string.min": "Username must be at least 3 characters",
        "string.max": "Username must be at most 32 characters",
        "any.required": "Username is required",
      }),
    email: Joi.string().email().required()
      .messages({
        "string.email": "Please enter a valid email address",
        "any.required": "Email is required",
      }),
    password: Joi.string().min(8).max(128).required()
      .messages({
        "string.min": "Password must be at least 8 characters",
        "string.max": "Password must be at most 128 characters",
        "any.required": "Password is required",
      }),
  });
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(", ");
    return res.status(400).json({ error: errorMessages, details: error.details });
  }
  next();
};

export const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
  });
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return res.status(400).json({ error: "Invalid input", details: error.details });
  next();
};

export const validateEncryptedMessage = (req, res, next) => {
  const schema = Joi.object({
    recipientId: Joi.string().required(),
    ciphertext: Joi.string().required(),
    nonce: Joi.string().required(),
    dhPublicKey: Joi.string().allow(null, "").optional(),
    messageNumber: Joi.number().integer().min(0).required(),
    previousChainLength: Joi.number().integer().min(0).required(),
    senderDeviceId: Joi.string().required(),
    recipientDeviceIds: Joi.array().items(Joi.string()).optional(),
    type: Joi.string().valid("text", "attachment", "system").optional(),
    attachments: Joi.array()
      .items(
        Joi.object({
          encryptedBlob: Joi.string(),
          contentType: Joi.string(),
          contentHash: Joi.string(),
          size: Joi.number().integer().min(0),
        })
      )
      .optional(),
  });
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return res.status(400).json({ error: "Invalid message", details: error.details });
  next();
};



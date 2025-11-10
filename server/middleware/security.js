import helmet from "helmet";
import cors from "cors";
// Note: `express-mongo-sanitize` and `xss-clean` are not compatible with Express 5
// because they try to modify req.query which is read-only in Express 5.
// We rely on Joi validation for input sanitization and MongoDB's built-in protection.
// import mongoSanitize from "express-mongo-sanitize";
// import xss from "xss-clean";
import hpp from "hpp";
import morgan from "morgan";

// During development allow all origins (makes local testing easier). In
// production, restrict to known origins.
const isDev = process.env.NODE_ENV !== "production";
const allowedOrigins = isDev
  ? []
  : [
      "http://E2EE-chat:3000",
      "http://localhost:3000",
    ];

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", ...allowedOrigins],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
    dnsPrefetchControl: { allow: false },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }),

  cors({
    origin: (origin, cb) => {
      if (isDev) return cb(null, true);
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Timestamp"],
    credentials: false,
    maxAge: 600,
  }),

  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"),
  // mongoSanitize() - removed due to Express 5 incompatibility
  // MongoDB injection protection is handled by Joi validation and Mongoose
  hpp(),
];



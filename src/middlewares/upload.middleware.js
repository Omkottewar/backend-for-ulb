import multer from "multer";

// ─────────────────────────────────────────────────────────────────────────────
// Upload middleware — Multer configuration for query/reply attachments
//
// Uses memory storage (buffers) since files are forwarded directly to
// Supabase Storage. For the current file size limits (50 MB × 5 files max),
// memory usage peaks at ~250 MB worst-case — acceptable for a typical
// Node.js server. If file sizes grow significantly, switch to diskStorage
// with a temp directory and streaming upload.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allowed MIME types matching the UI constraint:
 *   PDF, MS Word (.doc/.docx), MS Excel (.xls/.xlsx), JPEG, PNG, plain text
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",                                                         // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",    // .docx
  "application/vnd.ms-excel",                                                   // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",          // .xlsx
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/csv", // Allow CSV as well since it's a common text-based spreadsheet format
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file
const MAX_FILE_COUNT = 5;               // per request

const storage = multer.memoryStorage();

/**
 * File filter — rejects files whose MIME type is not in the whitelist.
 * Multer invokes this per file before buffering.
 */
const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }

  const err = new Error(
    `File type not allowed: ${file.mimetype}. ` +
    "Accepted: PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG, TXT."
  );
  err.statusCode = 400;
  return cb(err, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILE_COUNT,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Wrapped middleware
//
// Multer errors (file too large, too many files, wrong type) are caught here
// and converted to a consistent JSON error response. This keeps the
// controller free of multer-specific error handling.
//
// The form field name is "documents" — the frontend must use this key:
//   formData.append("documents", file1);
//   formData.append("documents", file2);
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware that parses multipart/form-data and populates
 * `req.files` with an array of uploaded file buffers.
 *
 * Handles all multer errors with proper JSON responses.
 */
export const handleDocumentUpload = (req, res, next) => {
  const uploader = upload.array("documents", MAX_FILE_COUNT);

  uploader(req, res, (err) => {
    if (!err) return next();

    // Multer-specific errors
    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE:  `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`,
        LIMIT_FILE_COUNT: `Maximum ${MAX_FILE_COUNT} files allowed per request`,
        LIMIT_UNEXPECTED_FILE: 'Unexpected field name. Use "documents" as the form field key',
      };

      return res.status(400).json({
        success: false,
        message: messages[err.code] || err.message,
      });
    }

    // Custom errors from fileFilter or other sources
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  });
};
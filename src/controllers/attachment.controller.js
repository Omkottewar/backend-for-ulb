import { getAttachmentsByFileId } from "../services/attachment.service.js";

/**
 * GET /api/files/:fileId/attachments
 * Returns all attachments for a file, grouped phase-wise.
 */
export const getFileAttachments = async (req, res) => {
  try {
    const { fileId } = req.params;

    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!UUID_REGEX.test(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fileId format",
      });
    }

    const data = await getAttachmentsByFileId(fileId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Internal server error" : error.message;

    if (status === 500) {
      console.error("[getFileAttachments] Unexpected error:", error);
    }

    return res.status(status).json({ success: false, message });
  }
};

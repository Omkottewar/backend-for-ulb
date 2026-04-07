import { getFileVersionHistory } from "../services/file-version.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/files/:fileId/versions
 * Returns the full version history of a file with
 * field-level changes nested inside each version.
 */
export const getFileVersions = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!UUID_REGEX.test(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fileId format",
      });
    }

    const data = await getFileVersionHistory(fileId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Internal server error" : error.message;

    if (status === 500) {
      console.error("[getFileVersions] Unexpected error:", error);
    }

    return res.status(status).json({ success: false, message });
  }
};
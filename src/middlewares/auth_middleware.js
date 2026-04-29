import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Pin algorithm — prevents alg-confusion attacks as defense-in-depth
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!decoded?.id || !decoded?.roleId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // Attach a consistent shape downstream routes can rely on
    req.user = {
      id: decoded.id,
      roleId: decoded.roleId,
    };

    return next();
  } catch (error) {
    console.error("protect middleware error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
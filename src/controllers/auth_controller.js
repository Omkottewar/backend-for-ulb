import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { eq } from "drizzle-orm";
import { roles } from "../db/schema/roles.js";
export const signup = async (req, res) => {
  try {
    const { name, email, password, phone, roleId } = req.body;

    if (!name || !email || !password || !roleId) {
      return res.status(400).json({ message: "All fields required" });
    }

    const emailNormalized = email.toLowerCase();

    // Check existing user
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailNormalized));

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Validate role
    const roleResult = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (roleResult.length === 0) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const role = roleResult[0];

    // Prevent admin signup
    if (role.code === "ADMIN") {
      return res.status(403).json({
        message: "Admin role cannot be assigned during signup"
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const inserted = await db
      .insert(users)
      .values({
        name,
        email: emailNormalized,
        passwordHash,
        phone: phone || null,
        roleId: role.id,
        approve: false
      })
      .returning();

    const user = inserted[0];

    const token = jwt.sign(
      { sub: user.id, role: role.code },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role.name
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (result.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result[0];

    // check flags
    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({ message: "Account disabled" });
    }

    if (!user.approve) {
      return res.status(403).json({ message: "Account not approved yet" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = jwt.sign(
      { id: user.id, roleId: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSignupRoles = async (req, res) => {
  const rolesList = await db
    .select({
      id: roles.id,
      name: roles.name,
      code: roles.code
    })
    .from(roles)
    .where(eq(roles.isActive, true));

  const filtered = rolesList.filter(r => r.code !== "ADMIN");

  res.json(filtered);
};
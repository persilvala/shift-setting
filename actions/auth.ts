"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIRE_UPPERCASE = /[A-Z]/;

export async function checkMustChangePassword(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  return admin?.mustChangePassword ?? false;
}

export async function checkPasswordStatus(): Promise<{ mustChange: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { mustChange: false };
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  return { mustChange: admin?.mustChangePassword ?? false };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized - please log in again" };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New passwords do not match" };
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return { success: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
    }

    if (!PASSWORD_REQUIRE_UPPERCASE.test(newPassword)) {
      return { success: false, error: "Password must contain at least 1 uppercase letter" };
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    });

    if (!admin) {
      return { success: false, error: "Admin not found" };
    }

    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.admin.update({
      where: { id: session.user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (e) {
    console.error("changePassword error:", e);
    return { success: false, error: "An error occurred while changing password" };
  }
}

export async function createAdmin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (username.length < 3) {
    return { success: false, error: "Username must be at least 3 characters" };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { success: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }

  if (!PASSWORD_REQUIRE_UPPERCASE.test(password)) {
    return { success: false, error: "Password must contain at least 1 uppercase letter" };
  }

  const existing = await prisma.admin.findUnique({
    where: { username },
  });

  if (existing) {
    return { success: false, error: "Username already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.create({
    data: {
      username,
      passwordHash,
      mustChangePassword: true,
    },
  });

  revalidatePath("/admin/admins");
  return { success: true };
}

export async function deleteAdmin(
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (adminId === session.user.id) {
    return { success: false, error: "You cannot delete yourself" };
  }

  const adminCount = await prisma.admin.count();
  if (adminCount <= 1) {
    return { success: false, error: "Cannot delete the last admin" };
  }

  await prisma.admin.delete({
    where: { id: adminId },
  });

  revalidatePath("/admin/admins");
  return { success: true };
}

export async function getAllAdmins() {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return prisma.admin.findMany({
    select: {
      id: true,
      username: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function getCurrentAdminId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

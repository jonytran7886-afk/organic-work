import { test, expect, type Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { db, client } from "../src/lib/db";
import { hashPassword, verifyPassword, tokenHash } from "../src/lib/password";
import { changeOwnPassword } from "../src/lib/profile";
const password = process.env.DEMO_PASSWORD!;
const fixtures: ObjectId[] = [];
async function account(role = "employee") {
  const d = await db(),
    department = await d
      .collection("departments")
      .findOne({ code: "operations" });
  const fallback = department || (await d.collection("departments").findOne());
  const user = {
    _id: new ObjectId(),
    name: "Người dùng hồ sơ",
    email: `profile-${randomUUID()}@organic.vn`,
    role,
    departmentId: fallback!._id,
    active: true,
    passwordHash: hashPassword(password),
  };
  await d.collection("users").insertOne(user);
  fixtures.push(user._id);
  return user;
}
async function login(page: Page, email: string, value = password) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
async function write(page: Page, path: string, data: any, method = "PATCH") {
  return page.request.fetch("/api/" + path, {
    method,
    headers: { Origin: new URL(page.url()).origin },
    data,
  });
}
test.afterEach(async () => {
  const d = await db();
  for (const userId of fixtures.splice(0)) {
    await d.collection("sessions").deleteMany({ userId });
    await d.collection("users").deleteOne({ _id: userId });
    await d
      .collection("login_attempts")
      .deleteOne({ _id: tokenHash("change-password:" + userId) } as any);
  }
});
test.afterAll(async () => {
  await client().close();
});

test("Nhân viên cập nhật hồ sơ, lỗi giữ nội dung, xóa số điện thoại và không lộ dữ liệu cá nhân", async ({
  page,
}) => {
  const user = await account();
  await login(page, user.email);
  await page
    .locator(".desktop-sidebar")
    .getByRole("link", { name: "Hồ sơ của tôi", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Hồ sơ của tôi", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveValue("");
  for (const field of ["Email đăng nhập", "Phòng ban", "Vai trò"])
    await expect(page.getByLabel(field, { exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
  await page
    .getByLabel("Họ và tên", { exact: true })
    .fill("  Nguyễn Ánh Minh  ");
  await page.getByLabel("Số điện thoại liên hệ").fill("not-a-number");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Họ và tên")).toHaveValue("  Nguyễn Ánh Minh  ");
  await page.getByLabel("Số điện thoại liên hệ").fill("+84 901 234 567");
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Lỗi lưu có kiểm soát" }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(
    page.locator(".profile-personal").getByRole("alert"),
  ).toContainText("Lỗi lưu có kiểm soát");
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveValue(
    "+84 901 234 567",
  );
  await page.unroute("**/api/profile");
  let writes = 0;
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      writes++;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    await route.continue();
  });
  await page
    .getByRole("form", { name: "Thông tin cá nhân" })
    .evaluate((element) => {
      (element as HTMLFormElement).requestSubmit();
      (element as HTMLFormElement).requestSubmit();
    });
  await expect(page.getByRole("status")).toHaveText("Đã cập nhật hồ sơ");
  expect(writes).toBe(1);
  await expect(
    page.locator(".desktop-sidebar .profile-link strong"),
  ).toHaveText("Nguyễn Ánh Minh");
  await expect(page.locator(".topbar .avatar")).toHaveText("N");
  await page.reload();
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Nguyễn Ánh Minh");
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveValue(
    "+84901234567",
  );
  const own = await (await page.request.get("/api/profile")).json();
  expect(Object.keys(own).sort()).toEqual(
    [
      "_id",
      "active",
      "departmentId",
      "departmentName",
      "email",
      "name",
      "phone",
      "role",
    ].sort(),
  );
  const directory = await (await page.request.get("/api/data")).json();
  expect(directory.user.phone).toBeUndefined();
  expect(
    directory.users.some(
      (row: any) =>
        "phone" in row || "passwordHash" in row || "sessionRevision" in row,
    ),
  ).toBe(false);
  expect(
    (await (await page.request.get("/api/session")).json()).user.phone,
  ).toBeUndefined();
  await page.screenshot({ path: "docs/profile-desktop.png", fullPage: true });
  await page.getByLabel("Số điện thoại liên hệ").fill("");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Đã cập nhật hồ sơ");
  await page.reload();
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveValue("");
});

test("Ba vai trò chỉ sửa hồ sơ của mình; từ chối trường tổ chức, chưa đăng nhập và bị vô hiệu hóa", async ({
  browser,
}) => {
  const other = await account();
  const d = await db();
  const anonymous = await browser.newContext();
  expect(
    (await anonymous.request.get("http://localhost:3101/api/profile")).status(),
  ).toBe(401);
  expect(
    (
      await anonymous.request.patch("http://localhost:3101/api/profile", {
        headers: { Origin: "http://localhost:3101" },
        data: { name: "No" },
      })
    ).status(),
  ).toBe(401);
  await anonymous.close();
  for (const role of ["admin", "manager", "employee"]) {
    const user = await account(role),
      page = await browser.newPage();
    try {
      await login(page, user.email);
      await page.goto("/profile");
      await expect(page.getByLabel("Email đăng nhập")).toHaveValue(user.email);
      const own = await (await page.request.get("/api/profile")).json();
      expect(own._id).toBe(String(user._id));
      for (const patch of [
        { role: "admin" },
        { departmentId: String(other.departmentId) },
        { email: other.email },
        { _id: String(other._id) },
        { passwordHash: "no" },
        { active: false },
      ]) {
        const response = await write(page, "profile", {
          name: "Không được lưu",
          ...patch,
        });
        expect(response.status()).toBe(400);
      }
      expect((await write(page, "profile", { name: "  " })).status()).toBe(400);
      expect((await write(page, "profile", { name: 123 })).status()).toBe(400);
      expect(
        (await write(page, "profile", { name: "A", phone: 123 })).status(),
      ).toBe(400);
      expect(
        (await write(page, "profile", { name: "A", phone: "---" })).status(),
      ).toBe(400);
      expect(
        (await page.request.get("/api/profile/" + other._id)).status(),
      ).toBe(404);
      expect(
        (await write(page, "profile/" + other._id, { name: "No" })).status(),
      ).toBe(404);
      expect(
        (await d.collection("users").findOne({ _id: user._id }))!.name,
      ).toBe(user.name);
      const data = await (await page.request.get("/api/data")).json();
      expect(
        data.users.some(
          (row: any) =>
            "phone" in row || "passwordHash" in row || "sessionRevision" in row,
        ),
      ).toBe(false);
      if (role === "admin")
        expect(
          (await (await page.request.get("/api/admin")).json()).users.some(
            (row: any) => "phone" in row || "passwordHash" in row,
          ),
        ).toBe(false);
      await d
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { active: false } });
      expect((await page.request.get("/api/profile")).status()).toBe(401);
      expect((await write(page, "profile", { name: "No" })).status()).toBe(401);
      expect(
        (
          await write(
            page,
            "profile/password",
            {
              currentPassword: password,
              newPassword: "654321",
              confirmPassword: "654321",
            },
            "POST",
          )
        ).status(),
      ).toBe(401);
    } finally {
      await page.close();
    }
  }
  expect((await d.collection("users").findOne({ _id: other._id }))!.name).toBe(
    other.name,
  );
});

test("Dialog đổi mật khẩu, bàn phím, lỗi xác thực và thu hồi mọi phiên", async ({
  page,
  browser,
}) => {
  const user = await account();
  await login(page, user.email);
  const second = await browser.newPage();
  try {
    await login(second, user.email);
    await page.goto("/profile");
    await page
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Đổi mật khẩu",
      exact: true,
    });
    const current = dialog.getByLabel("Mật khẩu hiện tại", { exact: true }),
      fresh = dialog.getByLabel("Mật khẩu mới", { exact: true }),
      confirm = dialog.getByLabel("Nhập lại mật khẩu mới", { exact: true });
    await expect(current).toBeFocused();
    await expect(current).toHaveAttribute("autocomplete", "current-password");
    await expect(fresh).toHaveAttribute("autocomplete", "new-password");
    await current.fill("wrong-password");
    await fresh.fill("654321");
    await confirm.fill("654321");
    await dialog
      .getByRole("button", { name: "Hiện mật khẩu hiện tại", exact: true })
      .click();
    await expect(current).toHaveAttribute("type", "text");
    await dialog
      .getByRole("button", { name: "Ẩn mật khẩu hiện tại", exact: true })
      .click();
    await expect(current).toHaveAttribute("type", "password");
    await dialog
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    await expect(current).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("alert")).toContainText(
      "hiện tại không đúng",
    );
    await current.fill(password);
    await confirm.fill("123456");
    await dialog
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    await expect(confirm).toHaveAttribute("aria-invalid", "true");
    await fresh.fill(password);
    await confirm.fill(password);
    await dialog
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    await expect(fresh).toHaveAttribute("aria-invalid", "true");
    const short = await write(
      page,
      "profile/password",
      {
        currentPassword: password,
        newPassword: "12345",
        confirmPassword: "12345",
      },
      "POST",
    );
    expect(short.status()).toBe(400);
    expect((await short.json()).fields.newPassword).toContain("6");
    expect((await page.request.get("/api/session")).status()).toBe(200);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Đổi mật khẩu", exact: true }),
    ).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    await expect(current).toHaveValue("");
    await expect(fresh).toHaveValue("");
    await expect(confirm).toHaveValue("");
    await current.fill(password);
    await fresh.fill("654321");
    await confirm.fill("654321");
    await page.screenshot({
      path: "docs/profile-password-mobile.png",
      fullPage: false,
    });
    let submissions = 0;
    await page.route("**/api/profile/password", async (route) => {
      submissions++;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.continue();
    });
    await dialog.locator("form").evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
      (form as HTMLFormElement).requestSubmit();
    });
    await expect(page).toHaveURL(/\/login\?passwordChanged=success$/);
    expect(submissions).toBe(1);
    await expect(page.getByRole("status")).toHaveText(
      "Đã đổi mật khẩu. Vui lòng đăng nhập lại.",
    );
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "organic_session",
      ),
    ).toBe(false);
    expect((await second.request.get("/api/profile")).status()).toBe(401);
    const d = await db();
    expect(
      await d.collection("sessions").countDocuments({ userId: user._id }),
    ).toBe(0);
    const wrongLogin = await write(
      page,
      "login",
      { email: user.email, password },
      "POST",
    );
    expect(wrongLogin.ok()).toBe(false);
    await login(page, user.email, "654321");
    await page
      .getByRole("button", { name: "Mở điều hướng", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Điều hướng", exact: true })
      .getByRole("link", { name: "Hồ sơ của tôi", exact: true })
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByLabel("Email đăng nhập")).toHaveValue(user.email);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "docs/profile-mobile.png", fullPage: true });
  } finally {
    await second.close();
  }
});

test("Giới hạn thử đổi mật khẩu, rollback giữ nguyên mật khẩu/phiên và đăng nhập đồng thời", async ({
  page,
  browser,
}) => {
  const user = await account(),
    d = await db();
  await login(page, user.email);
  const record = await d.collection("users").findOne({ _id: user._id });
  await expect(
    changeOwnPassword(
      record,
      {
        currentPassword: password,
        newPassword: "654321",
        confirmPassword: "654321",
      },
      true,
    ),
  ).rejects.toThrow("TEST_PASSWORD_WRITE_FAILURE");
  expect(
    (await d.collection("users").findOne({ _id: user._id }))!.passwordHash,
  ).toBe(record!.passwordHash);
  expect(
    await d.collection("sessions").countDocuments({ userId: user._id }),
  ).toBe(1);
  // The failed transaction counted as an attempt; clear only this fixture's limiter for the boundary check.
  const key = tokenHash("change-password:" + user._id);
  await d.collection("login_attempts").deleteOne({ _id: key } as any);
  for (let n = 0; n < 5; n++)
    expect(
      (
        await write(
          page,
          "profile/password",
          {
            currentPassword: "wrong-password",
            newPassword: "654321",
            confirmPassword: "654321",
          },
          "POST",
        )
      ).status(),
    ).toBe(400);
  const denied = await write(
    page,
    "profile/password",
    {
      currentPassword: password,
      newPassword: "654321",
      confirmPassword: "654321",
    },
    "POST",
  );
  expect(denied.status()).toBe(429);
  expect(
    verifyPassword(
      password,
      (await d.collection("users").findOne({ _id: user._id }))!.passwordHash,
    ),
  ).toBe(true);
  expect((await page.request.get("/api/profile")).status()).toBe(200);
  await d
    .collection("login_attempts")
    .updateOne({ _id: key } as any, { $set: { expiresAt: new Date(0) } });
  const otherContext = await browser.newContext();
  try {
    const [change, concurrent] = await Promise.all([
      write(
        page,
        "profile/password",
        {
          currentPassword: password,
          newPassword: "654321",
          confirmPassword: "654321",
        },
        "POST",
      ),
      otherContext.request.post("http://localhost:3101/api/login", {
        headers: { Origin: "http://localhost:3101" },
        data: { email: user.email, password },
      }),
    ]);
    expect(change.status()).toBe(200);
    expect([200, 400]).toContain(concurrent.status());
    expect(
      (
        await otherContext.request.get("http://localhost:3101/api/profile")
      ).status(),
    ).toBe(401);
    expect(
      await d.collection("sessions").countDocuments({ userId: user._id }),
    ).toBe(0);
  } finally {
    await otherContext.close();
  }
});

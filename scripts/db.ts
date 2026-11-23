import { db, client } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { today } from "../src/lib/model";
export async function setup() {
  const d = await db();
  for (let n = 0; n < 90; n++) {
    const hello = await d.admin().command({ hello: 1 });
    if (hello.isWritablePrimary && hello.setName) break;
    if (n === 89) throw new Error("MongoDB replica set chưa có primary");
    await new Promise((r) => setTimeout(r, 1000));
  }
  for (const name of [
    "departments",
    "users",
    "tasks",
    "task_comments",
    "task_activities",
    "sessions",
    "login_attempts",
    "system_locks",
    "system_counters",
    "attachments",
    "notifications",
    "task_operations",
    "fs.files",
    "fs.chunks",
  ])
    if (!(await d.listCollections({ name }).hasNext()))
      await d.createCollection(name);
  await d.collection("departments").createIndex({ code: 1 }, { unique: true });
  await d.collection("users").createIndex({ email: 1 }, { unique: true });
  await d.collection("users").createIndex({ departmentId: 1, active: 1 });
  await d
    .collection("tasks")
    .createIndex({ participantIds: 1, archivedAt: 1, dueDate: 1 });
  await d
    .collection("tasks")
    .createIndex({ parentTaskId: 1, archivedAt: 1, createdAt: 1 });
  await d
    .collection("attachments")
    .createIndex({ uploadedById: 1, uploadKey: 1 }, { unique: true });
  await d.collection("attachments").createIndex({ taskId: 1, state: 1 });
  await d.collection("attachments").createIndex({ state: 1, expiresAt: 1 });
  await d
    .collection("notifications")
    .createIndex({ eventId: 1, recipientId: 1 }, { unique: true });
  await d
    .collection("notifications")
    .createIndex({ recipientId: 1, createdAt: -1 });
  await d
    .collection("task_operations")
    .createIndex({ actorId: 1, requestId: 1 }, { unique: true });
  await d.collection("fs.files").createIndex({ filename: 1, uploadDate: 1 });
  await d
    .collection("fs.chunks")
    .createIndex({ files_id: 1, n: 1 }, { unique: true });
  await d.collection("tasks").createIndex(
    { createdById: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  for (const key of [
    "owningDepartmentId",
    "requestingDepartmentId",
    "assigneeId",
    "status",
    "dueDate",
  ])
    await d
      .collection("tasks")
      .createIndex({ [key]: 1, archivedAt: 1, dueDate: 1 });
  await d
    .collection("tasks")
    .createIndex({ seedKey: 1 }, { unique: true, sparse: true });
  for (const name of ["task_comments", "task_activities"])
    await d.collection(name).createIndex({ taskId: 1, createdAt: 1 });
  await d
    .collection("sessions")
    .createIndex({ tokenHash: 1 }, { unique: true });
  await d
    .collection("sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d
    .collection("login_attempts")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
export async function bootstrap() {
  const d = await db();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error("Cần email và BOOTSTRAP_ADMIN_PASSWORD ít nhất 12 ký tự");
  if (await d.collection("users").countDocuments()) {
    console.log("Database đã có tài khoản; không thay đổi bootstrap.");
    return;
  }
  await d.collection("departments").updateOne(
    { code: "management" },
    {
      $setOnInsert: {
        name: "Ban quản trị",
        code: "management",
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  const department = await d
    .collection("departments")
    .findOne({ code: "management" });
  await d.collection("users").updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        name: "Quản trị Organic",
        passwordHash: hashPassword(password),
        role: "admin",
        departmentId: department!._id,
        active: true,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log("Đã bootstrap Admin.");
}
export async function seed() {
  if (
    process.env.ALLOW_DEMO_SEED !== "true" ||
    !/demo|test/.test(process.env.MONGODB_DB || "")
  )
    throw new Error(
      "Seed chỉ cho database có demo/test trong tên và ALLOW_DEMO_SEED=true",
    );
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Cần DEMO_PASSWORD ít nhất 12 ký tự");
  const d = await db();
  const defs = [
    ["sales", "Kinh doanh"],
    ["operations", "Vận hành"],
    ["quality", "Chất lượng"],
    ["logistics", "Kho vận"],
  ];
  for (const [code, name] of defs)
    await d
      .collection("departments")
      .updateOne(
        { code },
        { $setOnInsert: { code, name, createdAt: new Date() } },
        { upsert: true },
      );
  const departments = await d.collection("departments").find().toArray();
  const dep = (code: string) => departments.find((d) => d.code === code)!._id;
  for (const [email, name, role, code] of [
    ["admin@organic.vn", "Nguyễn Minh An", "admin", "sales"],
    ["kinhdoanh@organic.vn", "Trần Minh Anh", "manager", "sales"],
    ["vanhanh@organic.vn", "Lê Hoàng Nam", "manager", "operations"],
    ["nv.vanhanh@organic.vn", "Phạm Thanh Hà", "employee", "operations"],
    ["nv.kinhdoanh@organic.vn", "Nguyễn Tuấn Kiệt", "employee", "sales"],
    ["nv.chatluong@organic.vn", "Đỗ Ngọc Linh", "employee", "quality"],
    ["nv.vanhanh2@organic.vn", "Vũ Hải Đăng", "employee", "operations"],
  ])
    await d.collection("users").updateOne(
      { email },
      {
        $setOnInsert: {
          email,
          name,
          role,
          departmentId: dep(code),
          passwordHash: hashPassword(password),
          active: true,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  await d.collection("users").updateOne(
    { email: "nv.nghi@organic.vn" },
    {
      $setOnInsert: {
        email: "nv.nghi@organic.vn",
        name: "Tài khoản đã tắt",
        role: "employee",
        departmentId: dep("operations"),
        passwordHash: hashPassword(password),
        active: false,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  const us = await d.collection("users").find().toArray();
  const uid = (email: string) =>
    us.find((u) => u.email === email + "@organic.vn")!._id;
  const date = (days: number) => {
    const day = new Date(today() + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() + days);
    return day.toISOString().slice(0, 10);
  };
  const samples = [
    [
      "Xác nhận lịch đóng gói lô gà Kỳ Anh",
      "operations",
      "sales",
      "todo",
      1,
      "urgent",
      null,
    ],
    [
      "Rà soát kế hoạch vận chuyển tuần tới",
      "logistics",
      "sales",
      "doing",
      3,
      "normal",
      null,
    ],
    [
      "Chuẩn bị hồ sơ khách hàng đối tác miền Bắc",
      "sales",
      "sales",
      "doing",
      2,
      "high",
      "nv.kinhdoanh",
    ],
    [
      "Đối soát đơn hàng tháng này",
      "sales",
      "sales",
      "waiting",
      -2,
      "high",
      "nv.kinhdoanh",
    ],
    [
      "Kiểm tra chất lượng lô hàng mới",
      "quality",
      "sales",
      "todo",
      -1,
      "urgent",
      "nv.chatluong",
    ],
    [
      "Hoàn thiện quy trình đóng gói sản phẩm",
      "operations",
      "operations",
      "done",
      -3,
      "normal",
      "nv.vanhanh",
    ],
    [
      "Cập nhật lịch giao hàng cho đối tác",
      "operations",
      "sales",
      "waiting",
      2,
      "low",
      "nv.vanhanh",
    ],
    [
      "Lập kế hoạch chăm sóc khách hàng",
      "sales",
      "sales",
      "todo",
      5,
      "normal",
      "nv.kinhdoanh",
    ],
    [
      "Chuẩn bị vật tư cho ca sản xuất",
      "operations",
      "operations",
      "doing",
      0,
      "high",
      "nv.vanhanh",
    ],
    [
      "Tổng hợp báo cáo chất lượng tuần",
      "quality",
      "quality",
      "done",
      -1,
      "normal",
      "nv.chatluong",
    ],
  ];
  for (const [i, s] of samples.entries()) {
    const [title, owner, requester, status, days, priority, assignee] = s;
    const session = client().startSession();
    try {
      await session.withTransaction(async () => {
        const result = await d.collection("tasks").updateOne(
          { seedKey: "sample-" + i },
          {
            $setOnInsert: {
              seedKey: "sample-" + i,
              title,
              description:
                "Phối hợp các bộ phận liên quan, cập nhật tiến độ và xác nhận kết quả tại công việc này.",
              owningDepartmentId: dep(String(owner)),
              requestingDepartmentId: dep(String(requester)),
              createdById: uid(
                requester === "operations" ? "vanhanh" : "kinhdoanh",
              ),
              assigneeId: assignee ? uid(String(assignee)) : null,
              status,
              priority,
              dueDate: date(Number(days)),
              archivedAt: null,
              completedAt: status === "done" ? new Date() : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true, session },
        );
        if (result.upsertedId)
          await d.collection("task_activities").insertOne(
            {
              taskId: result.upsertedId,
              actorId: uid("admin"),
              type: "created",
              createdAt: new Date(),
            },
            { session },
          );
      });
    } finally {
      await session.endSession();
    }
  }
  const extra = [
    {
      key: "yesterday",
      title: "Kiểm tra vật tư ca sáng",
      days: -1,
      status: "todo",
      priority: "urgent",
    },
    {
      key: "today",
      title: "Xác nhận kế hoạch sản xuất hôm nay",
      days: 0,
      status: "doing",
      priority: "high",
    },
    {
      key: "tomorrow",
      title: "Chuẩn bị lịch đóng gói ngày mai",
      days: 1,
      status: "todo",
      priority: "normal",
    },
    {
      key: "seventh",
      title: "Rà soát vật tư cuối chu kỳ 7 ngày",
      days: 7,
      status: "todo",
      priority: "high",
    },
    {
      key: "eighth",
      title: "Lập kế hoạch vận hành sau 8 ngày",
      days: 8,
      status: "todo",
      priority: "normal",
    },
    {
      key: "undated",
      title: "Đối chiếu hồ sơ cũ chưa có hạn",
      days: null,
      status: "todo",
      priority: "low",
    },
    {
      key: "waiting",
      title: "Chờ xác nhận quy cách bao bì",
      days: 2,
      status: "waiting",
      priority: "high",
      waitingReason: "Chờ phòng Chất lượng duyệt quy cách bao bì.",
    },
    {
      key: "legacy-waiting",
      title: "Rà soát việc đang chờ từ dữ liệu cũ",
      days: 3,
      status: "waiting",
      priority: "normal",
    },
    {
      key: "manager",
      title: "Duyệt phân công tổ sản xuất",
      days: 0,
      status: "todo",
      priority: "high",
      manager: true,
    },
  ];
  for (const fixture of extra) {
    const session = client().startSession();
    try {
      await session.withTransaction(async () => {
        const value: any = {
          seedKey: "layout-" + fixture.key,
          title: fixture.title,
          description: "Tình huống demo theo dõi công việc cá nhân và tiến độ.",
          owningDepartmentId: dep("operations"),
          requestingDepartmentId: dep("operations"),
          createdById: uid("vanhanh"),
          assigneeId: uid(fixture.manager ? "vanhanh" : "nv.vanhanh"),
          status: fixture.status,
          priority: fixture.priority,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(fixture.days === null ? {} : { dueDate: date(fixture.days) }),
          ...(fixture.waitingReason
            ? { waitingReason: fixture.waitingReason }
            : {}),
        };
        const result = await d
          .collection("tasks")
          .updateOne(
            { seedKey: value.seedKey },
            { $setOnInsert: value },
            { upsert: true, session },
          );
        if (result.upsertedId)
          await d.collection("task_activities").insertOne(
            {
              taskId: result.upsertedId,
              actorId: uid("vanhanh"),
              type: "created",
              createdAt: new Date(),
            },
            { session },
          );
      });
    } finally {
      await session.endSession();
    }
  }
  console.log("Seed hoàn tất; không ghi đè dữ liệu đã có.");
}
if (process.argv[1] && /[/\\]db\.ts$/.test(process.argv[1])) {
  try {
    const command = process.argv[2];
    if (command === "setup") await setup();
    else if (command === "bootstrap") await bootstrap();
    else if (command === "seed") await seed();
    else throw new Error("Lệnh không hợp lệ");
  } finally {
    await client().close();
  }
}

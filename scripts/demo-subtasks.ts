import { db, client } from "../src/lib/db";
import { createTask } from "../src/lib/service";
import { today } from "../src/lib/model";
import { addDays } from "../src/lib/work-model";
try {
  const d = await db();
  const manager = await d
    .collection("users")
    .findOne({ role: "manager", active: true });
  if (!manager)
    throw new Error(
      "Cần một trưởng bộ phận đang hoạt động để tạo mẫu công việc con",
    );
  let parent = await d.collection("tasks").findOne({ demoKey: "subtasks-v1" });
  if (!parent) {
    parent = await createTask(manager, {
      title: "Truyền thông đợt 1",
      description:
        "Công việc mẫu để kiểm tra cha–con. Mỗi việc con có người đảm nhận, hạn và kết quả riêng.",
      owningDepartmentId: String(manager.departmentId),
      assigneeId: String(manager._id),
      startDate: today(),
      dueDate: addDays(today(), 7),
      requestId: "90000000-0000-4000-8000-000000000001",
    });
    if (!parent) throw new Error("Không tạo được công việc cha mẫu");
    await d
      .collection("tasks")
      .updateOne({ _id: parent._id }, { $set: { demoKey: "subtasks-v1" } });
  }
  const people = await d
    .collection("users")
    .find({
      departmentId: parent.owningDepartmentId,
      active: true,
      role: "employee",
    })
    .sort({ name: 1 })
    .limit(2)
    .toArray();
  for (const [index, title] of [
    "Chuẩn hóa nhận diện",
    "Thiết kế mẫu nội dung",
  ].entries()) {
    if (
      await d.collection("tasks").findOne({ parentTaskId: parent._id, title })
    )
      continue;
    await createTask(manager, {
      title,
      description:
        index === 0
          ? "Rà soát logo, màu sắc và quy tắc sử dụng nhận diện. Bàn giao tài liệu thống nhất."
          : "Thiết kế mẫu nội dung cho đợt truyền thông. Bàn giao mẫu và ghi chú sử dụng.",
      owningDepartmentId: String(parent.owningDepartmentId),
      parentTaskId: String(parent._id),
      assigneeId: people[index]?._id ? String(people[index]._id) : null,
      startDate: today(),
      dueDate: addDays(today(), 5 + index),
      requestId: `90000000-0000-4000-8000-00000000000${index + 2}`,
    });
  }
  console.log(`SUBTASK_DEMO_PATH=/tasks/${parent._id}`);
  console.log(`DEPARTMENT_ID=${parent.owningDepartmentId}`);
} finally {
  await client().close();
}

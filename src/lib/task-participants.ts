import { type ClientSession, ObjectId } from "mongodb";
import { z } from "zod";
import { db, id } from "./db";
import { canManage, canView } from "./model";

export async function validateParticipants(
  actor: any,
  task: any,
  input: unknown,
  assigneeId: ObjectId | null,
  session: ClientSession,
) {
  const values = z
    .array(z.string())
    .max(50, "Tối đa 50 người tham gia")
    .parse(input ?? []);
  const unique = new Map(
    values.map((value) => {
      const personId = id(value);
      return [personId.toHexString(), personId] as const;
    }),
  );
  const ids = [...unique.values()].filter(
    (personId) => !personId.equals(assigneeId),
  );
  if (ids.length && !canManage(actor, task))
    throw new Error(
      "Chỉ trưởng phòng phụ trách hoặc Admin được quản lý người tham gia",
    );
  const d = await db();
  for (const userId of ids) {
    const person = await d
      .collection("users")
      .findOne(
        { _id: userId, active: true, departmentId: task.owningDepartmentId },
        { session },
      );
    if (!person || !canView(person, task))
      throw new Error(
        "Người tham gia phải đang hoạt động, thuộc phòng phụ trách và còn quyền xem công việc",
      );
  }
  return ids;
}

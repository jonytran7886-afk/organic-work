import { ObjectId, type ClientSession } from "mongodb";
import { db, id } from "./db";
import { canView } from "./model";
import { notifyTask } from "./notifications";

export async function lockTask(taskId: ObjectId, session: ClientSession) {
  return (await db())
    .collection("tasks")
    .findOneAndUpdate(
      { _id: taskId },
      { $inc: { hierarchyVersion: 1 } },
      { session, returnDocument: "after" },
    );
}
export async function activeChildren(
  parentId: ObjectId,
  session?: ClientSession,
) {
  return (await db())
    .collection("tasks")
    .find({ parentTaskId: parentId, archivedAt: null }, { session })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
}

export async function childrenPage(
  user: any,
  parent: any,
  after?: string | null,
) {
  const d = await db();
  const visibility =
    user.role === "admin"
      ? {}
      : {
          $or: [
            { owningDepartmentId: user.departmentId },
            ...(user.role === "manager"
              ? [{ requestingDepartmentId: user.departmentId }]
              : []),
          ],
        };
  const cursor = after ? id(after) : null;
  const rows = await d
    .collection("tasks")
    .find({
      parentTaskId: parent._id,
      archivedAt: null,
      ...visibility,
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    })
    .project({ description: 0, handovers: 0, result: 0, resultLinks: 0 })
    .sort({ _id: 1 })
    .limit(26)
    .toArray();
  return {
    items: rows.slice(0, 25),
    nextCursor: rows.length > 25 ? String(rows[24]._id) : null,
  };
}
export async function recomputeParent(
  actor: any,
  parentId: ObjectId,
  session: ClientSession,
) {
  const d = await db(),
    parent = await d
      .collection("tasks")
      .findOne({ _id: parentId }, { session });
  if (!parent) throw new Error("Công việc cha không tồn tại");
  const children = await activeChildren(parentId, session),
    total = children.length,
    done = children.filter((c) => c.status === "done").length;
  const changes: any = {
    activeChildCount: total,
    completedChildCount: done,
    updatedAt: new Date(),
  };
  if (total) {
    changes.status =
      done === total
        ? !parent.reviewerId || parent.status === "done"
          ? "done"
          : "doing"
        : children.every((c) => c.status === "todo")
          ? "todo"
          : "doing";
    if (changes.status !== "done") {
      changes.completedAt = null;
      changes.completedById = null;
      changes.reviewAcceptedAt = null;
      changes.reviewAcceptedById = null;
    }
    if (changes.status === "done" && parent.status !== "done") {
      changes.completedAt = new Date();
      changes.completedById = actor._id;
      const result = (
        `Hoàn thành ${done}/${total} công việc con.\n` +
        children
          .map((c) => `${c.title}: ${c.result || "Đã hoàn thành"}`)
          .join("\n")
      ).slice(0, 5000);
      changes.result = result;
      changes.handovers = [
        ...(parent.handovers || []),
        {
          eventId: new ObjectId(),
          result,
          links: [],
          attachmentIds: [],
          completedById: actor._id,
          completedAt: changes.completedAt,
          automatic: true,
        },
      ];
    }
    if (changes.status !== "waiting") changes.waitingReason = null;
  }
  await d
    .collection("tasks")
    .updateOne({ _id: parentId }, { $set: changes }, { session });
  if (changes.status && changes.status !== parent.status) {
    const eventId = new ObjectId();
    await d.collection("task_activities").insertOne(
      {
        taskId: parentId,
        actorId: actor._id,
        type: "status",
        before: parent.status,
        after: changes.status,
        source: "subtasks",
        createdAt: new Date(),
      },
      { session },
    );
    await notifyTask(
      actor,
      parent,
      { ...parent, ...changes },
      eventId,
      session,
    );
  }
}
export async function hierarchyDetails(user: any, task: any) {
  const d = await db();
  const children = await d
    .collection("tasks")
    .find({ parentTaskId: task._id })
    .sort({ createdAt: 1 })
    .toArray();
  const parent = task.parentTaskId
    ? await d.collection("tasks").findOne({ _id: task.parentTaskId })
    : null;
  const siblings = parent ? await activeChildren(parent._id) : [];
  const remaining = siblings.filter((c) => !c._id.equals(task._id));
  return {
    children: children
      .filter((c) => canView(user, c))
      .map((child) => ({
        ...child,
        participantIds: child.participantIds || [],
      })),
    parent:
      parent && canView(user, parent)
        ? {
            _id: parent._id,
            title: parent.title,
            status: parent.status,
            archivedAt: parent.archivedAt,
          }
        : null,
    archiveImpact:
      !!parent &&
      !task.archivedAt &&
      task.status !== "done" &&
      remaining.length > 0 &&
      remaining.every((c) => c.status === "done"),
  };
}

import { ObjectId, type ClientSession } from "mongodb";
import { db } from "./db";
import { canView } from "./model";

export async function notifyTask(
  actor: any,
  before: any,
  after: any,
  eventId: ObjectId,
  session: ClientSession,
) {
  const d = await db();
  const recipients = new Map<string, { user: any; types: Set<string> }>();
  async function add(userId: any, type: string) {
    if (!userId || String(userId) === String(actor._id)) return;
    const user = await d
      .collection("users")
      .findOne({ _id: userId, active: true }, { session });
    if (!user || !canView(user, after)) return;
    const key = String(userId),
      row = recipients.get(key) || { user, types: new Set<string>() };
    row.types.add(type);
    recipients.set(key, row);
  }
  const cross =
    String(after.owningDepartmentId) !== String(after.requestingDepartmentId);
  const oldParticipants = new Set((before?.participantIds || []).map(String));
  for (const participantId of after.participantIds || [])
    if (!oldParticipants.has(String(participantId)))
      await add(participantId, "participating");
  if (
    after.assigneeId &&
    String(before?.assigneeId) !== String(after.assigneeId)
  )
    await add(after.assigneeId, "assigned");
  if (!before && cross && !after.parentTaskId) {
    for (const manager of await d
      .collection("users")
      .find(
        {
          role: "manager",
          active: true,
          departmentId: after.owningDepartmentId,
        },
        { session },
      )
      .toArray())
      await add(manager._id, "request");
  }
  if (before && before.dueDate !== after.dueDate) {
    for (const participantId of after.participantIds || [])
      await add(participantId, "due");
    await add(after.assigneeId, "due");
    if (cross) await add(after.createdById, "due");
  }
  if (before && before.status !== "done" && after.status === "done") {
    for (const participantId of after.participantIds || [])
      await add(participantId, "completed");
    if (cross) await add(after.createdById, "completed");
  }
  for (const { user, types } of recipients.values())
    await d.collection("notifications").updateOne(
      { eventId, recipientId: user._id },
      {
        $setOnInsert: {
          taskId: after._id,
          types: [...types],
          createdAt: new Date(),
          readAt: null,
        },
      },
      { upsert: true, session },
    );
}
export async function notificationsFor(user: any) {
  const d = await db();
  const records = await d
    .collection("notifications")
    .aggregate([
      { $match: { recipientId: user._id } },
      {
        $lookup: {
          from: "tasks",
          localField: "taskId",
          foreignField: "_id",
          as: "task",
        },
      },
      { $unwind: "$task" },
      ...(user.role === "admin"
        ? []
        : [
            {
              $match: {
                $or: [
                  { "task.owningDepartmentId": user.departmentId },
                  ...(user.role === "manager"
                    ? [{ "task.requestingDepartmentId": user.departmentId }]
                    : []),
                ],
              },
            },
          ]),
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $limit: 40 },
            {
              $project: {
                taskId: 1,
                types: 1,
                createdAt: 1,
                readAt: 1,
                title: "$task.title",
              },
            },
          ],
          unread: [{ $match: { readAt: null } }, { $count: "count" }],
        },
      },
    ])
    .next();
  return {
    items: records?.items || [],
    unread: records?.unread[0]?.count || 0,
  };
}
export async function markNotifications(user: any, notificationId?: ObjectId) {
  const d = await db();
  // Resolve permission again for mutations, including older entries outside the latest 40.
  const records = await d
    .collection("notifications")
    .find({
      recipientId: user._id,
      readAt: null,
      ...(notificationId ? { _id: notificationId } : {}),
    })
    .toArray();
  for (const record of records) {
    const task = await d.collection("tasks").findOne({ _id: record.taskId });
    if (task && canView(user, task))
      await d
        .collection("notifications")
        .updateOne(
          { _id: record._id, recipientId: user._id },
          { $set: { readAt: new Date() } },
        );
  }
}

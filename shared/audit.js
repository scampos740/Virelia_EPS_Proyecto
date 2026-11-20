import { randomUUID } from "node:crypto";
import { rows } from "./db.js";
export async function audit(conn, actor, action, resource) {
  await rows(
    conn,
    "INSERT INTO audit_events(id,actor_id,action,resource_id) VALUES(?,?,?,?)",
    [randomUUID(), actor, action, resource],
  );
}

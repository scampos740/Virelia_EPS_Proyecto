import { rows, transaction } from "./db.js";
import { tokenHash } from "./security.js";
import { HttpError } from "./validation.js";
export async function limit(pool, key, max = 5, seconds = 900) {
  const denied = await transaction(pool, async (c) => {
    const hash = tokenHash(key);
    await rows(
      c,
      "INSERT IGNORE INTO request_limits(key_hash,count,window_start) VALUES(?,0,UTC_TIMESTAMP())",
      [hash],
    );
    const [r] = await rows(
      c,
      "SELECT *,TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP()) AS age FROM request_limits WHERE key_hash=? FOR UPDATE",
      [hash],
    );
    if (r.age >= seconds) {
      await rows(
        c,
        "UPDATE request_limits SET count=1,window_start=UTC_TIMESTAMP() WHERE key_hash=?",
        [hash],
      );
      return false;
    }
    if (r.count >= max) return true;
    await rows(c, "UPDATE request_limits SET count=count+1 WHERE key_hash=?", [
      hash,
    ]);
    return false;
  });
  if (denied)
    throw new HttpError(
      429,
      "Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.",
    );
}

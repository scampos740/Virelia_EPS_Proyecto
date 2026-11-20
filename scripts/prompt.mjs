import readline from "node:readline";
import { Writable } from "node:stream";
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = readline.createInterface({
  input: process.stdin,
  output,
  terminal: process.stdin.isTTY,
});
export function ask(label, secret = false) {
  process.stdout.write(label);
  hidden = secret;
  return new Promise((resolve) =>
    rl.question("", (answer) => {
      hidden = false;
      if (secret) process.stdout.write("\n");
      resolve(answer);
    }),
  );
}
export function finish() {
  rl.close();
}

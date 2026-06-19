import { workerData, parentPort } from "worker_threads";
import { statSync, cpSync, copyFileSync, unlinkSync, rmSync, mkdirSync } from "fs";

const { task, src, dest, trashDest } = workerData as {
  task: "clone" | "delete";
  src: string;
  dest?: string;
  trashDest?: string;
};

try {
  if (task === "clone" && dest) {
    const stat = statSync(src);
    if (stat.isDirectory()) {
      cpSync(src, dest, { recursive: true });
    } else {
      copyFileSync(src, dest);
    }
    parentPort?.postMessage({ type: "done" });

  } else if (task === "delete" && trashDest) {
    const stat = statSync(src);
    if (stat.isDirectory()) {
      mkdirSync(trashDest, { recursive: true });
      cpSync(src, trashDest, { recursive: true });
      rmSync(src, { recursive: true });
    } else {
      copyFileSync(src, trashDest);
      unlinkSync(src);
    }
    parentPort?.postMessage({ type: "done" });

  } else {
    parentPort?.postMessage({ type: "error", error: "Invalid task configuration" });
  }
} catch (err) {
  parentPort?.postMessage({
    type: "error",
    error: err instanceof Error ? err.message : String(err),
  });
}

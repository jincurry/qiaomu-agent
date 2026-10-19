import type { ChatCallbacks, PermissionMode } from "../types";
import { toVaultPath } from "./change-tracker";
import { externalFiles, type LocalHost } from "./local-host";
import { secretPath, startupPath } from "./local-guard";

export const VAULT_ONLY = "只能访问当前库内的文件";
export const OUTSIDE_WRITE = "可写当前库模式不能写入库外文件";

export type AgentFileHost = NonNullable<ChatCallbacks["host"]> & {
  /** Why a request that would write these files is refused before asking, or null. */
  refusal(paths: string[]): string | null;
};

/**
 * Files an agent reaches through the client (ACP fs). The vault always; outside it, reads unless the
 * turn is read-only, and writes only with full access. The agent's own shell is not confined either
 * way, so refusing outside reads would only leave it less informed.
 */
export function agentFileHost(options: {
  root: string | null;
  mode: PermissionMode;
  local: LocalHost | null;
  /** This agent can be given full access, so a refusal may point there. */
  fullAccess?: boolean;
  vault: { read(relative: string): Promise<string>; write(relative: string, content: string): Promise<void> };
  /** An outside file is about to be written; `before` is undefined when it cannot be tracked. */
  onOutsideWrite?: (path: string, before: string | null | undefined) => void;
}): AgentFileHost {
  const { root, mode, local, vault } = options;
  const files = externalFiles(local);
  const outsideWrite = options.fullAccess ? `${OUTSIDE_WRITE}，需要时请切换到完全访问` : OUTSIDE_WRITE;
  const reachable = (path: string, write: boolean): boolean => !!local && local.path.isAbsolute(path) && (write ? mode === "full" : mode !== "plan");
  const real = async (path: string): Promise<string> => {
    try { return await local!.fs.realpath(path); }
    catch {
      const parent = local!.path.dirname(path);
      return parent === path ? path : local!.path.join(await real(parent), local!.path.basename(path));
    }
  };
  return {
    async readText(path) {
      const relative = toVaultPath(path, root);
      if (relative !== null) return vault.read(relative);
      if (!reachable(path, false)) throw new Error(VAULT_ONLY);
      return local!.fs.readFile(path, "utf8");
    },
    async writeText(path, content) {
      const relative = toVaultPath(path, root);
      if (relative !== null) return vault.write(relative, content);
      if (!reachable(path, true) || !files) throw new Error(mode === "edit" ? outsideWrite : VAULT_ONLY);
      options.onOutsideWrite?.(path, await files.read(path).catch(() => undefined));
      await files.write(path, content);
    },
    // The same floor as the local tools: secrets leave for the model provider, startup files persist.
    async caution(path, write) {
      if (toVaultPath(path, root) !== null || !reachable(path, write)) return null;
      const target = await real(path);
      const reason = secretPath(target, local!.home) ?? (write ? startupPath(target, local!.home) : null);
      if (!reason) return null;
      return { title: `${write ? "写入" : "读取"}${reason}`, detail: write ? path : `${path}\n内容会发送给当前模型服务商。` };
    },
    refusal: (paths) => mode === "edit" && paths.some((path) => toVaultPath(path, root) === null) ? outsideWrite : null,
  };
}

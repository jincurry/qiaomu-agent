import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("obsidian", () => ({ normalizePath: (p: string) => p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "") }));

import { agentFileHost, OUTSIDE_WRITE, VAULT_ONLY } from "../src/services/agent-files";
import type { LocalHost } from "../src/services/local-host";
import type { PermissionMode } from "../src/types";

let root: string;
let home: string;
let vaultRoot: string;

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "qa-agent-files-")));
  home = path.join(root, "home");
  vaultRoot = path.join(home, "Vault");
  await fs.mkdir(vaultRoot, { recursive: true });
  await fs.mkdir(path.join(home, ".grok"), { recursive: true });
  await fs.writeFile(path.join(home, ".grok", "notes.md"), "grok memory");
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

function setup(mode: PermissionMode, fullAccess = false) {
  const local: LocalHost = { fs, path, home, platform: process.platform, isRoot: false, exec: async () => ({ code: 0, stdout: "", stderr: "", timedOut: false }), trash: async () => undefined };
  const vault = { read: vi.fn(async (relative: string) => `vault:${relative}`), write: vi.fn(async () => undefined) };
  const outsideWrites: Array<[string, string | null | undefined]> = [];
  const host = agentFileHost({ root: vaultRoot, mode, local, fullAccess, vault, onOutsideWrite: (file, before) => outsideWrites.push([file, before]) });
  return { host, vault, outsideWrites };
}

it("keeps vault files on the vault and reads outside files unless the turn is read-only", async () => {
  const edit = setup("edit");
  expect(await edit.host.readText(path.join(vaultRoot, "a.md"))).toBe("vault:a.md");
  await edit.host.writeText(path.join(vaultRoot, "a.md"), "new");
  expect(edit.vault.write).toHaveBeenCalledWith("a.md", "new");
  expect(await edit.host.readText(path.join(home, ".grok", "notes.md"))).toBe("grok memory");
  await expect(edit.host.readText("../outside.md")).rejects.toThrow(VAULT_ONLY);
  await expect(setup("plan").host.readText(path.join(home, ".grok", "notes.md"))).rejects.toThrow(VAULT_ONLY);
});

it("writes outside the vault only with full access, tracked for undo", async () => {
  const target = path.join(root, "tmp", "test.txt");
  const edit = setup("edit");
  await expect(edit.host.writeText(target, "x")).rejects.toThrow(OUTSIDE_WRITE);
  expect(edit.host.refusal([path.join(vaultRoot, "a.md"), target])).toBe(OUTSIDE_WRITE);
  expect(edit.host.refusal([path.join(vaultRoot, "a.md")])).toBeNull();
  expect(setup("edit", true).host.refusal([target])).toBe(`${OUTSIDE_WRITE}，需要时请切换到完全访问`);
  const full = setup("full");
  expect(full.host.refusal([target])).toBeNull();
  await full.host.writeText(target, "x");
  expect(await fs.readFile(target, "utf8")).toBe("x");
  expect(full.outsideWrites).toEqual([[target, null]]);
});

it("asks before outside secrets are read or startup files are written, and only where access is allowed", async () => {
  const key = path.join(home, ".ssh", "id_ed25519");
  const rc = path.join(home, ".zshrc");
  const full = setup("full");
  expect(await full.host.caution!(key, false)).toEqual({ title: "读取凭据或私人数据目录", detail: `${key}\n内容会发送给当前模型服务商。` });
  expect(await full.host.caution!(rc, true)).toEqual({ title: "写入登录或 Shell 启动配置", detail: rc });
  expect(await full.host.caution!(path.join(home, ".grok", "notes.md"), false)).toBeNull();
  expect(await full.host.caution!(path.join(vaultRoot, ".env"), false)).toBeNull();
  expect(await setup("edit").host.caution!(rc, true)).toBeNull();
});

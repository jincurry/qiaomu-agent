// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReplyTimeline } from "../src/ui/reply-timeline";
import type { AgentMessage } from "../src/services/chat-transport";
afterEach(cleanup);
const text = (value: string) => <span>{value}</span>;
const approval = () => <button>允许一次</button>;
const initial: AgentMessage = { id: "a", role: "assistant", parts: [] };
const props = { renderText: text, renderApproval: approval, renderQuestion: () => <button>回答问题</button>, active: true, statusText: "正在连接…" };
it("replaces the initial indicator with one collapsed live row and preserves manual expansion on updates", () => {
  const { container, rerender } = render(<ReplyTimeline {...props} message={initial} />);
  expect(screen.getByRole("status").textContent).toBe("正在思考…");
  const message: AgentMessage = { ...initial, parts: [{ type: "data-activity", data: { id: "1", kind: "command", label: "obsidian search query=AI", status: "running" } }] };
  rerender(<ReplyTimeline {...props} message={message} />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe("正在搜索资料…");
  const details = container.querySelector(".qa-live-work") as HTMLDetailsElement;
  expect(details.open).toBe(false);
  fireEvent.click(details.querySelector("summary")!);
  expect(details.open).toBe(true);
  message.parts.push({ type: "data-activity", data: { id: "2", kind: "command", label: 'obsidian read path="a.md"', status: "running" } });
  rerender(<ReplyTimeline {...props} message={{ ...message }} />);
  expect(screen.getByRole("status").textContent).toBe("正在阅读内容…");
  expect(details.open).toBe(true);
});
it("keeps pending approvals visible and summarizes failures without a final reply after stopping", () => {
  const message: AgentMessage = { ...initial, parts: [
    { type: "data-activity", data: { id: "1", label: "读取失败", status: "failed" } },
    { type: "data-approval", data: { id: "p", title: "允许写入？", status: "pending", options: [] } },
  ] };
  const { rerender, container } = render(<ReplyTimeline {...props} message={message} />);
  expect(screen.getByRole("button", { name: "允许一次" }).closest("details")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("等待你的确认，1 步出错");
  expect(container.querySelector(".qa-working-glyph")).toBeNull();
  rerender(<ReplyTimeline {...props} message={message} active={false} />);
  expect(screen.getByRole("button", { name: "允许一次" }).closest("details")).toBeNull();
  expect(screen.getByRole("alert").closest("details")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe("有 1 项操作未完成，请展开处理记录查看详情。");
});
it("counts live failures in the status row and explains each one in its own step", () => {
  const message: AgentMessage = { ...initial, parts: [
    { type: "data-activity", data: { id: "1", label: "Read `C:\\Users\\me\\.grok\\notes.md`", status: "failed", detail: "running\nFailed to read file: IO Error: 只能访问当前库内的文件\n" } },
    { type: "data-activity", data: { id: "2", kind: "command", label: "Get-Location; Get-Command obsidian", status: "failed", exitCode: 1, detail: "$ Get-Location; Get-Command obsidian\nPath\n----\nC:\\vault" } },
  ] };
  const { container } = render(<ReplyTimeline {...props} message={message} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("正在思考…，2 步出错");
  expect(container.querySelector(".qa-live-issues")!.textContent).toBe("2 步出错");
  const [read, command] = [...container.querySelectorAll(".qa-step.is-failed")];
  expect(read!.querySelector(".qa-step-failed-reason")!.textContent).toBe("Failed to read file: IO Error: 只能访问当前库内的文件");
  expect(command!.querySelector(".qa-step-exit")!.textContent).toBe("退出码 1");
  // What a command printed is not why it failed.
  expect(command!.querySelector(".qa-step-failed-reason")).toBeNull();
});
it("folds failed attempts into the completed record after recovery and keeps their error details", () => {
  const message: AgentMessage = { ...initial, parts: [
    { type: "data-activity", data: { id: "1", kind: "command", label: "download first-source", status: "failed", detail: "Source unavailable" } },
    { type: "data-activity", data: { id: "2", kind: "command", label: "download fallback", status: "running" } },
  ] };
  const { rerender, container } = render(<ReplyTimeline {...props} message={message} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(container.querySelector(".qa-live-issues")!.textContent).toBe("1 步出错");
  const live = container.querySelector(".qa-live-work") as HTMLDetailsElement;
  fireEvent.click(live.querySelector("summary")!);
  expect(live.open).toBe(true);
  const completed: AgentMessage = { ...message, parts: [message.parts[0]!,
    { type: "data-activity", data: { id: "2", kind: "command", label: "download fallback", status: "completed" } },
    { type: "text", text: "已下载：song.mp3" },
  ] };
  rerender(<ReplyTimeline {...props} message={completed} active={false} />);
  const record = container.querySelector(".qa-worked") as HTMLDetailsElement;
  expect(record.open).toBe(false);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("已下载：song.mp3").closest("details")).toBeNull();
  expect(screen.getByText("download first-source").closest(".qa-worked")).toBe(record);
  fireEvent.click(record.querySelector("summary")!);
  const failed = container.querySelector(".qa-step.is-failed") as HTMLDetailsElement;
  fireEvent.click(failed.querySelector("summary")!);
  expect(record.open).toBe(true);
  expect(failed.open).toBe(true);
  expect(screen.getByText("Source unavailable").closest(".qa-worked")).toBe(record);
});
it("keeps the final failure explanation visible without duplicating the failed command", () => {
  const message: AgentMessage = { ...initial, parts: [
    { type: "data-activity", data: { id: "1", label: "download first-source", status: "failed" } },
    { type: "text", text: "下载未完成，请提供可访问的链接后重试。" },
  ] };
  render(<ReplyTimeline {...props} message={message} active={false} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("下载未完成，请提供可访问的链接后重试。").closest("details")).toBeNull();
  expect(screen.getAllByText("download first-source")).toHaveLength(1);
});
it("keeps unanswered questions visible while working and after stopping", () => {
  const message = { ...initial, parts: [
    { type: "data-activity", data: { id: "1", label: "搜索", status: "completed" } },
    { type: "data-question", data: { id: "q", status: "pending", questions: [] } },
  ] } as AgentMessage;
  const { rerender } = render(<ReplyTimeline {...props} message={message} />);
  expect(screen.getByRole("button", { name: "回答问题" }).closest("details")).toBeNull();
  rerender(<ReplyTimeline {...props} message={message} active={false} />);
  expect(screen.getByRole("button", { name: "回答问题" }).closest("details")).toBeNull();
});

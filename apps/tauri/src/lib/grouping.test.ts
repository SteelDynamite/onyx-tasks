import { describe, it, expect } from "vitest";
import { groupTasksByDate } from "./grouping";
import type { Task } from "./types";

// 2026-04-17 12:00 local time — "today" in the fixtures below.
const NOW = new Date(2026, 3, 17, 12, 0, 0);

// The app stores task dates as local moments serialized with toISOString()
// (see DateTimePicker / TasksScreen handleDrop), and groupTasksByDate buckets
// by *local* calendar day. Build fixtures the same way so they're
// timezone-independent — hardcoded "...T00:00:00Z" strings only land on the
// intended calendar day for machines at UTC or east of it.
function iso(day: number, hour = 0, minute = 0): string {
  return new Date(2026, 3, day, hour, minute, 0).toISOString();
}

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    description: "",
    status: "backlog",
    date: partial.date ?? null,
    has_time: partial.has_time ?? false,
    version: 1,
    parent_id: null,
    ...partial,
  };
}

describe("groupTasksByDate", () => {
  it("returns an empty array when there are no pending tasks", () => {
    expect(groupTasksByDate([], NOW)).toEqual([]);
  });

  it("puts 'No Date' last — regression: was first, burying urgent tasks", () => {
    const tasks = [
      task({ id: "overdue", date: iso(15) }),
      task({ id: "no-date" }),
      task({ id: "today", date: iso(17, 9) }),
    ];
    const labels = groupTasksByDate(tasks, NOW).map((g) => g.label);
    expect(labels).toEqual(["Overdue", "Today", "No Date"]);
  });

  it("orders dated buckets: Overdue, Today, Tomorrow, future…, then No Date", () => {
    const tasks = [
      task({ id: "nd1" }),
      task({ id: "future", date: iso(20) }),
      task({ id: "tomorrow", date: iso(18) }),
      task({ id: "today", date: iso(17, 9) }),
      task({ id: "overdue", date: iso(10) }),
    ];
    const labels = groupTasksByDate(tasks, NOW).map((g) => g.label);
    expect(labels[0]).toBe("Overdue");
    expect(labels[1]).toBe("Today");
    expect(labels[2]).toBe("Tomorrow");
    // One future day label between tomorrow and No Date
    expect(labels[labels.length - 1]).toBe("No Date");
    expect(labels).toHaveLength(5);
  });

  it("drops empty buckets", () => {
    const tasks = [task({ id: "t1", date: iso(17, 8) })];
    expect(groupTasksByDate(tasks, NOW).map((g) => g.label)).toEqual(["Today"]);
  });

  it("sorts tasks within a bucket by due time ascending, stable on ties", () => {
    const tasks = [
      task({ id: "b", date: iso(17, 15), has_time: true }),
      task({ id: "a", date: iso(17, 9), has_time: true }),
      task({ id: "c", date: iso(17, 15), has_time: true }),
    ];
    const today = groupTasksByDate(tasks, NOW).find((g) => g.label === "Today")!;
    expect(today.tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("places a task with today's date but time before 'now' in the Today bucket (not Overdue)", () => {
    const tasks = [task({ id: "earlier-today", date: iso(17, 8) })];
    const groups = groupTasksByDate(tasks, NOW);
    expect(groups.map((g) => g.label)).toEqual(["Today"]);
  });

  it("preserves No Date order as given by the caller", () => {
    const tasks = [
      task({ id: "z" }),
      task({ id: "a" }),
      task({ id: "m" }),
    ];
    const nd = groupTasksByDate(tasks, NOW).find((g) => g.label === "No Date")!;
    expect(nd.tasks.map((t) => t.id)).toEqual(["z", "a", "m"]);
  });

  it("groups multiple tasks on the same future day under one label", () => {
    const tasks = [
      task({ id: "f1", date: iso(25, 9), has_time: true }),
      task({ id: "f2", date: iso(25, 14), has_time: true }),
    ];
    const groups = groupTasksByDate(tasks, NOW);
    const future = groups.find((g) => g.date?.getDate() === 25);
    expect(future).toBeDefined();
    expect(future!.tasks.map((t) => t.id)).toEqual(["f1", "f2"]);
    // And it comes before No Date (which is absent here).
    expect(groups).toHaveLength(1);
  });
});

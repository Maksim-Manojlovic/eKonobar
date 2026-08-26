import { describe, it, expect, vi } from "vitest";
import { excludeDeleted, SOFT_DELETE_READ_OPS, SOFT_DELETE_MODELS } from "../db";

/**
 * CQ-Z guard. The Prisma extension itself needs a live database to exercise, so
 * these tests cover the two things that actually broke: the where-injection
 * logic, and the list of operations it is wired to.
 *
 * The original filter covered findMany/findFirst/findUnique only, so `count`,
 * `aggregate`, `groupBy` and the `*OrThrow` variants returned soft-deleted rows
 * with no type error and no exception. The op-coverage test below is what makes
 * that class of miss loud.
 */
type Args = { where?: Record<string, unknown> };

describe("soft-delete filter", () => {
  const run = (args: Args) => {
    const query = vi.fn((a: Args) => a);
    const out: Args = excludeDeleted<Args, Args>({ args, query });
    return { out, query };
  };

  it("injects deletedAt: null when the caller passes no where", () => {
    const { out } = run({});
    expect(out.where).toEqual({ deletedAt: null });
  });

  it("preserves the caller's where clause", () => {
    const { out } = run({ where: { role: "WAITER" } });
    expect(out.where).toEqual({ deletedAt: null, role: "WAITER" });
  });

  it("survives a call with no args at all — count() and aggregate() allow it", () => {
    const query = vi.fn((a: Args) => a);
    const out: Args = excludeDeleted<Args, Args>({
      args: undefined as unknown as Args,
      query,
    });
    expect(out.where).toEqual({ deletedAt: null });
  });

  it("passes the mutated args through to the underlying query", () => {
    const { query } = run({ where: { id: "v-1" } });
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, id: "v-1" } }),
    );
  });

  it("lets an explicit deletedAt filter win — admin restore flows need deleted rows", () => {
    const { out } = run({ where: { deletedAt: { not: null } } });
    expect(out.where).toEqual({ deletedAt: { not: null } });
  });

  it("covers every Prisma read operation — a missing one is a silent bypass", () => {
    // If Prisma gains a read op, add it here and to SOFT_DELETE_READ_OPS together.
    expect([...SOFT_DELETE_READ_OPS].sort()).toEqual(
      [
        "aggregate",
        "count",
        "findFirst",
        "findFirstOrThrow",
        "findMany",
        "findUnique",
        "findUniqueOrThrow",
        "groupBy",
      ].sort(),
    );
  });

  it("does not filter writes — restoring a soft-deleted row must reach it", () => {
    for (const op of SOFT_DELETE_READ_OPS) {
      expect(["create", "update", "delete", "upsert", "updateMany", "deleteMany"]).not.toContain(op);
    }
  });

  it("guards exactly the models that carry deletedAt", () => {
    expect([...SOFT_DELETE_MODELS]).toEqual(["user", "venue", "jobPost"]);
  });
});

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation",  () => ({ useRouter: vi.fn() }));

import { useSession } from "next-auth/react";
import { useRouter }  from "next/navigation";
import { RoleGuard }  from "../RoleGuard";

const mockReplace = vi.fn();

function mockRouter() {
  vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never);
}

describe("RoleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter();
  });

  it("shows spinner while loading", () => {
    vi.mocked(useSession).mockReturnValue({ status: "loading", data: null } as never);
    const { container } = render(
      <RoleGuard><span>Content</span></RoleGuard>,
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated with allowed role", () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      data: { user: { role: "VENUE_OWNER" } },
    } as never);
    render(
      <RoleGuard allowedRoles={["VENUE_OWNER"]}>
        <span>Dashboard</span>
      </RoleGuard>,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders children for any role when allowedRoles not provided", () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      data: { user: { role: "WAITER" } },
    } as never);
    render(
      <RoleGuard>
        <span>Content</span>
      </RoleGuard>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("returns null when unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({ status: "unauthenticated", data: null } as never);
    const { container } = render(
      <RoleGuard><span>Secret</span></RoleGuard>,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({ status: "unauthenticated", data: null } as never);
    render(<RoleGuard><span>X</span></RoleGuard>);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when role not in allowedRoles", () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      data: { user: { role: "WAITER" } },
    } as never);
    render(
      <RoleGuard allowedRoles={["VENUE_OWNER", "ADMIN"]}>
        <span>Admin area</span>
      </RoleGuard>,
    );
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

/**
 * Unit tests for `GlobalAuthErrorListener`.
 *
 * The component is a side-effect-only React node that wires window-level
 * `unhandledrejection` + `error` listeners and delegates the decision to
 * `handleAuthError` from `@/lib/server-fn-auth`. The tests verify:
 *   - listeners are registered on mount and removed on unmount (no leaks),
 *   - auth-shaped events trigger `handleAuthError` (which we mock),
 *   - non-auth events still fire `handleAuthError` but DO NOT trigger
 *     `preventDefault` (mock returns false), matching real behavior.
 *
 * No `@testing-library/react` in this repo — we mount via `createRoot`
 * inside `act()` to satisfy React 19's strict effect flushing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

vi.mock("@/lib/server-fn-auth", () => ({
  handleAuthError: vi.fn(),
}));

import { handleAuthError } from "@/lib/server-fn-auth";
import { GlobalAuthErrorListener } from "../GlobalAuthErrorListener";

const handleAuthErrorMock = vi.mocked(handleAuthError);

function mount(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(<GlobalAuthErrorListener />);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLDivElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("GlobalAuthErrorListener", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handleAuthErrorMock.mockReset();
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("registers unhandledrejection + error listeners on mount", () => {
    const { container, root } = mount();

    const events = addSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain("unhandledrejection");
    expect(events).toContain("error");

    unmount(root, container);
  });

  it("removes both listeners on unmount (no leaks)", () => {
    const { container, root } = mount();

    // Capture the exact handler refs registered so we can match them on removal.
    const rejectionCall = addSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "unhandledrejection",
    );
    const errorCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "error");
    expect(rejectionCall).toBeDefined();
    expect(errorCall).toBeDefined();

    unmount(root, container);

    const removed = removeSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(removed).toContain("unhandledrejection");
    expect(removed).toContain("error");

    // Same handler reference must come off — otherwise the listener leaks.
    const removedRejection = removeSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "unhandledrejection",
    );
    const removedError = removeSpy.mock.calls.find((c: unknown[]) => c[0] === "error");
    expect(removedRejection?.[1]).toBe(rejectionCall?.[1]);
    expect(removedError?.[1]).toBe(errorCall?.[1]);
  });

  it("invokes handleAuthError when an auth-shaped unhandledrejection fires", () => {
    handleAuthErrorMock.mockReturnValue(true);
    const { container, root } = mount();

    const reason = { status: 401, message: "Unauthorized" };
    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.reject(reason).catch(() => {}),
      reason,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(handleAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(handleAuthErrorMock).toHaveBeenCalledWith(reason);

    unmount(root, container);
  });

  it("still forwards non-auth unhandledrejection but does not preventDefault", () => {
    // Real `handleAuthError` returns false for non-auth errors; that branch
    // means the listener leaves the event alone (no preventDefault call).
    handleAuthErrorMock.mockReturnValue(false);
    const { container, root } = mount();

    const reason = new Error("totally unrelated bug");
    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.reject(reason).catch(() => {}),
      reason,
      cancelable: true,
    });
    const preventSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(handleAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(handleAuthErrorMock).toHaveBeenCalledWith(reason);
    expect(preventSpy).not.toHaveBeenCalled();

    unmount(root, container);
  });

  it("invokes handleAuthError when an auth-shaped error event fires", () => {
    handleAuthErrorMock.mockReturnValue(true);
    const { container, root } = mount();

    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    const event = new ErrorEvent("error", {
      error,
      message: error.message,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(handleAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(handleAuthErrorMock).toHaveBeenCalledWith(error);

    unmount(root, container);
  });

  it("forwards non-auth error events without preventing default", () => {
    handleAuthErrorMock.mockReturnValue(false);
    const { container, root } = mount();

    const error = new TypeError("plain runtime crash");
    const event = new ErrorEvent("error", {
      error,
      message: error.message,
      cancelable: true,
    });
    const preventSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(handleAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(handleAuthErrorMock).toHaveBeenCalledWith(error);
    expect(preventSpy).not.toHaveBeenCalled();

    unmount(root, container);
  });
});

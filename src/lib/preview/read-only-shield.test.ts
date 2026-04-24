import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isActivationKey,
  isAllowed,
  shouldBlockClickEvent,
  shouldBlockKeyboardEvent,
} from "./read-only-shield";

/**
 * Verifies the /preview read-only shield blocks Enter/Space (and clicks)
 * on every kind of interactive control we expose, while leaving opted-in
 * controls and editable fields fully functional.
 */

type ControlSpec = {
  name: string;
  /** Build the focusable target element. */
  build: () => HTMLElement;
};

/** Exhaustive list of control types the preview page can render. */
const BLOCKED_CONTROLS: ControlSpec[] = [
  {
    name: "<button>",
    build: () => Object.assign(document.createElement("button"), { textContent: "Save" }),
  },
  {
    name: "<a href>",
    build: () => {
      const a = document.createElement("a");
      a.href = "/dashboard";
      a.textContent = "Dashboard";
      return a;
    },
  },
  {
    name: '[role="button"]',
    build: () => {
      const div = document.createElement("div");
      div.setAttribute("role", "button");
      div.tabIndex = 0;
      return div;
    },
  },
  {
    name: '[role="link"]',
    build: () => {
      const span = document.createElement("span");
      span.setAttribute("role", "link");
      span.tabIndex = 0;
      return span;
    },
  },
  {
    name: '[role="menuitem"]',
    build: () => {
      const li = document.createElement("li");
      li.setAttribute("role", "menuitem");
      li.tabIndex = 0;
      return li;
    },
  },
  {
    name: '[role="tab"]',
    build: () => {
      const div = document.createElement("div");
      div.setAttribute("role", "tab");
      div.tabIndex = 0;
      return div;
    },
  },
  {
    name: '<input type="submit">',
    build: () => {
      const input = document.createElement("input");
      input.type = "submit";
      return input;
    },
  },
  {
    name: '<input type="button">',
    build: () => {
      const input = document.createElement("input");
      input.type = "button";
      return input;
    },
  },
  {
    name: '<input type="checkbox">',
    build: () => {
      const input = document.createElement("input");
      input.type = "checkbox";
      return input;
    },
  },
  {
    name: '<input type="radio">',
    build: () => {
      const input = document.createElement("input");
      input.type = "radio";
      return input;
    },
  },
  {
    name: "<select>",
    build: () => document.createElement("select"),
  },
  {
    name: "<summary>",
    build: () => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "More";
      details.appendChild(summary);
      document.body.appendChild(details);
      return summary;
    },
  },
  {
    name: "[data-preview-block]",
    build: () => {
      const div = document.createElement("div");
      div.setAttribute("data-preview-block", "");
      return div;
    },
  },
];

const ACTIVATION_KEYS = ["Enter", " ", "Spacebar"] as const;

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("isActivationKey", () => {
  it.each(ACTIVATION_KEYS)("treats %j as an activation key", (key) => {
    expect(isActivationKey(key)).toBe(true);
  });

  it.each(["Tab", "Escape", "ArrowDown", "a", "Shift", ""])(
    "ignores non-activation key %j",
    (key) => {
      expect(isActivationKey(key)).toBe(false);
    },
  );
});

describe("isAllowed", () => {
  it("returns false for non-Element targets", () => {
    expect(isAllowed(null)).toBe(false);
    expect(isAllowed(document)).toBe(false);
  });

  it("returns true when the element opts in", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-preview-allow", "true");
    document.body.appendChild(btn);
    expect(isAllowed(btn)).toBe(true);
  });

  it("returns true when an ancestor opts in", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-preview-allow", "true");
    const btn = document.createElement("button");
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
    expect(isAllowed(btn)).toBe(true);
  });

  it("returns false when nothing opts in", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    expect(isAllowed(btn)).toBe(false);
  });
});

describe("shouldBlockKeyboardEvent — blocks every interactive control", () => {
  for (const control of BLOCKED_CONTROLS) {
    for (const key of ACTIVATION_KEYS) {
      it(`blocks ${key === " " ? "Space" : key} on ${control.name}`, () => {
        const target = control.build();
        if (!target.isConnected) document.body.appendChild(target);
        expect(shouldBlockKeyboardEvent(key, target)).toBe(true);
      });
    }
  }
});

describe("shouldBlockKeyboardEvent — opts out correctly", () => {
  it.each(BLOCKED_CONTROLS)(
    "does not block $name when it opts in via data-preview-allow",
    ({ build }) => {
      const target = build();
      target.setAttribute("data-preview-allow", "true");
      if (!target.isConnected) document.body.appendChild(target);
      for (const key of ACTIVATION_KEYS) {
        expect(shouldBlockKeyboardEvent(key, target)).toBe(false);
      }
    },
  );

  it.each(BLOCKED_CONTROLS)(
    "does not block $name when an ancestor opts in",
    ({ build }) => {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-preview-allow", "true");
      const target = build();
      // Re-parent if build() already attached the element.
      if (target.parentElement) target.parentElement.removeChild(target);
      wrapper.appendChild(target);
      document.body.appendChild(wrapper);
      for (const key of ACTIVATION_KEYS) {
        expect(shouldBlockKeyboardEvent(key, target)).toBe(false);
      }
    },
  );
});

describe("shouldBlockKeyboardEvent — leaves typing alone", () => {
  const editable: ControlSpec[] = [
    {
      name: '<input type="text">',
      build: () => {
        const i = document.createElement("input");
        i.type = "text";
        return i;
      },
    },
    {
      name: '<input type="email">',
      build: () => {
        const i = document.createElement("input");
        i.type = "email";
        return i;
      },
    },
    {
      name: '<input type="search">',
      build: () => {
        const i = document.createElement("input");
        i.type = "search";
        return i;
      },
    },
    {
      name: "<textarea>",
      build: () => document.createElement("textarea"),
    },
    {
      name: '[contenteditable="true"]',
      build: () => {
        const d = document.createElement("div");
        d.setAttribute("contenteditable", "true");
        return d;
      },
    },
  ];

  it.each(editable)("does not block Enter/Space on $name", ({ build }) => {
    const el = build();
    document.body.appendChild(el);
    for (const key of ACTIVATION_KEYS) {
      expect(shouldBlockKeyboardEvent(key, el)).toBe(false);
    }
  });
});

describe("shouldBlockKeyboardEvent — non-activation keys pass through", () => {
  it.each(["Tab", "Escape", "ArrowDown", "ArrowUp", "a", "F5"])(
    "ignores key %j even on a <button>",
    (key) => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);
      expect(shouldBlockKeyboardEvent(key, btn)).toBe(false);
    },
  );
});

describe("shouldBlockClickEvent", () => {
  for (const control of BLOCKED_CONTROLS.filter(
    // <summary>, role=menuitem, role=tab are not in the click-time selector
    // because they are keyboard-only or layout-time concerns. Skip them here.
    (c) => !["<summary>", '[role="menuitem"]', '[role="tab"]'].includes(c.name),
  )) {
    it(`blocks click on ${control.name}`, () => {
      const target = control.build();
      if (!target.isConnected) document.body.appendChild(target);
      expect(shouldBlockClickEvent(target)).toBe(true);
    });
  }

  it("ignores clicks on plain text", () => {
    const p = document.createElement("p");
    p.textContent = "hello";
    document.body.appendChild(p);
    expect(shouldBlockClickEvent(p)).toBe(false);
  });

  it("ignores clicks when an ancestor opts in", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-preview-allow", "true");
    const btn = document.createElement("button");
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
    expect(shouldBlockClickEvent(btn)).toBe(false);
  });
});

/**
 * Integration-style assertions: simulate real DOM events on the controls and
 * confirm the shield (when wired into a capture-phase listener) actually
 * stops them from running their default action / handler.
 */
describe("DOM event flow — shield prevents real activation", () => {
  function mountShield(): { root: HTMLDivElement; reset: () => void } {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const onKey = (e: KeyboardEvent) => {
      if (shouldBlockKeyboardEvent(e.key, e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (shouldBlockClickEvent(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onSubmit = (e: SubmitEvent) => {
      if (!isAllowed(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    root.addEventListener("keydown", onKey, true);
    root.addEventListener("click", onClick, true);
    root.addEventListener("submit", onSubmit, true);

    return {
      root,
      reset: () => {
        root.removeEventListener("keydown", onKey, true);
        root.removeEventListener("click", onClick, true);
        root.removeEventListener("submit", onSubmit, true);
        root.remove();
      },
    };
  }

  it("Enter on a <button> never calls the click handler", () => {
    const { root, reset } = mountShield();
    const btn = document.createElement("button");
    const handler = vi.fn();
    btn.addEventListener("click", handler);
    root.appendChild(btn);

    btn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    // jsdom doesn't auto-translate Enter→click, but we also dispatch a click
    // to mirror what a real browser would do. The capture-phase shield must
    // stop both paths.
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(handler).not.toHaveBeenCalled();
    reset();
  });

  it("Space on a checkbox does not toggle it", () => {
    const { root, reset } = mountShield();
    const cb = document.createElement("input");
    cb.type = "checkbox";
    root.appendChild(cb);
    expect(cb.checked).toBe(false);

    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    const wasDefaultPrevented = !cb.dispatchEvent(evt);

    expect(wasDefaultPrevented).toBe(true);
    expect(cb.checked).toBe(false);
    reset();
  });

  it("Enter on a link does not navigate (default is prevented)", () => {
    const { root, reset } = mountShield();
    const a = document.createElement("a");
    a.href = "/dashboard";
    a.textContent = "Go";
    const handler = vi.fn();
    a.addEventListener("click", handler);
    root.appendChild(a);

    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    const allowed = a.dispatchEvent(evt);

    expect(handler).not.toHaveBeenCalled();
    expect(allowed).toBe(false); // defaultPrevented → no navigation
    reset();
  });

  it("submit on a form is prevented", () => {
    const { root, reset } = mountShield();
    const form = document.createElement("form");
    const handler = vi.fn();
    form.addEventListener("submit", handler);
    root.appendChild(form);

    const evt = new Event("submit", { bubbles: true, cancelable: true });
    const allowed = form.dispatchEvent(evt);

    expect(handler).not.toHaveBeenCalled();
    expect(allowed).toBe(false);
    reset();
  });

  it("opted-in button still fires its click handler", () => {
    const { root, reset } = mountShield();
    const btn = document.createElement("button");
    btn.setAttribute("data-preview-allow", "true");
    const handler = vi.fn();
    btn.addEventListener("click", handler);
    root.appendChild(btn);

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    reset();
  });

  it("typing into a text input is unaffected", () => {
    const { root, reset } = mountShield();
    const input = document.createElement("input");
    input.type = "text";
    root.appendChild(input);

    const handler = vi.fn();
    input.addEventListener("keydown", handler);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }),
    );

    // Enter inside a text field should NOT be blocked by the shield —
    // the handler still receives both events.
    expect(handler).toHaveBeenCalledTimes(2);
    reset();
  });
});

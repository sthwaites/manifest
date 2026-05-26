import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureRequest, getWebSocketUrl } from "./FeatureRequest";
import type { AgentEvent } from "./AgentStream";

class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  readonly url: string;
  readyState = MockWebSocket.OPEN;
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close"));
  });
  send = vi.fn();

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  static instances: MockWebSocket[] = [];
}

function renderFeatureRequest(
  props: Partial<ComponentProps<typeof FeatureRequest>> = {},
) {
  return render(
    <FeatureRequest
      onEvent={vi.fn()}
      onConnectionChange={vi.fn()}
      threadId={null}
      events={[]}
      {...props}
    />,
  );
}

describe("FeatureRequest", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects directly to the local bridge on localhost", () => {
    renderFeatureRequest();

    expect(MockWebSocket.instances[0]?.url).toBe("ws://localhost:3002/api/ws");
  });

  it("keeps the same WebSocket when parent callbacks change after events", () => {
    const initialOnEvent = vi.fn();
    const nextOnEvent = vi.fn();
    const initialOnConnectionChange = vi.fn();
    const nextOnConnectionChange = vi.fn();
    const { rerender } = renderFeatureRequest({
      onEvent: initialOnEvent,
      onConnectionChange: initialOnConnectionChange,
    });

    rerender(
      <FeatureRequest
        onEvent={nextOnEvent}
        onConnectionChange={nextOnConnectionChange}
        threadId={null}
        events={[{ type: "fileChange", path: "src/app/page.tsx" }]}
      />,
    );

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(new Event("open"));
    });
    expect(initialOnConnectionChange).not.toHaveBeenCalled();
    expect(nextOnConnectionChange).toHaveBeenCalledWith(true);

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "fileChange", path: "src/app/page.tsx" }),
        }),
      );
    });
    expect(initialOnEvent).not.toHaveBeenCalled();
    expect(nextOnEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "fileChange" }),
    );
  });

  it("uses the current origin when localhost is serving through a proxy", () => {
    expect(
      getWebSocketUrl({
        protocol: "http:",
        hostname: "localhost",
        host: "localhost:18080",
        port: "18080",
      }),
    ).toBe("ws://localhost:18080/api/ws");
  });

  it("renders a larger composer and staged progress from WebSocket events", async () => {
    const onEvent = vi.fn();
    renderFeatureRequest({ onEvent });

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "featureRequest", text: "Add filters" }),
    );
    expect(screen.getByText("Sending")).toHaveAttribute("aria-current", "step");

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            method: "thread/started",
            params: { thread: { id: "thread_1" } },
          }),
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByText("Starting agent")).toHaveAttribute(
        "aria-current",
        "step",
      ),
    );

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "turn-started",
            message: "Agent accepted the request.",
          }),
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByText("Agent working")).toHaveAttribute(
        "aria-current",
        "step",
      ),
    );

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "fileChange",
            path: "src/app/page.tsx",
          }),
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByText("Applying changes")).toHaveAttribute(
        "aria-current",
        "step",
      ),
    );

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ method: "turn/completed" }),
        }),
      );
    });
    await waitFor(() =>
      expect(screen.getByText("Applied")).toHaveAttribute(
        "aria-current",
        "step",
      ),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ method: "turn/completed" }),
    );
  });

  it("re-enables submit and shows feedback when a feature request fails", async () => {
    renderFeatureRequest();

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ error: "The request failed." }),
        }),
      );
    });

    expect(await screen.findByText("The request failed.")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit feature request" }),
    ).not.toBeDisabled();
  });

  it("preserves the prompt when the bridge reports another sandbox operation is running", async () => {
    renderFeatureRequest();

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "bridge-busy",
            error:
              "Another sandbox operation is still running. Wait for it to finish, then send again.",
          }),
        }),
      );
    });

    expect(
      await screen.findByText(
        "Another sandbox operation is still running. Wait for it to finish, then send again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sandbox operation in progress."),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
  });

  it("restores the prompt when the WebSocket closes during submit", async () => {
    renderFeatureRequest();

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(new CloseEvent("close"));
    });

    expect(
      await screen.findByText(
        "Connection lost before the request finished. Reconnect and send again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
    expect(
      screen.getByRole("button", { name: "Submit feature request" }),
    ).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  it("shows bridge-disconnected feedback when submitting without an open socket", async () => {
    renderFeatureRequest();
    MockWebSocket.instances[0].readyState = MockWebSocket.CLOSED;

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    expect(
      await screen.findByText("Bridge disconnected. Reconnect and send again."),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
  });

  it("times out while waiting for a new thread to start", async () => {
    vi.useFakeTimers();
    renderFeatureRequest();

    fireEvent.change(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      { target: { value: "Add filters" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(
      screen.getByText(
        "The request timed out before the agent started. Reconnect and send again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  it("times out after agent activity starts", async () => {
    vi.useFakeTimers();
    renderFeatureRequest();

    fireEvent.change(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      { target: { value: "Add filters" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            method: "thread/started",
            params: { thread: { id: "thread_1" } },
          }),
        }),
      );
      vi.advanceTimersByTime(150_000);
    });

    expect(
      screen.getByText(
        "The agent stopped responding before the request finished. Reconnect and send again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
  });

  it("retries the preserved prompt once connected", async () => {
    renderFeatureRequest();

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(new CloseEvent("close"));
      MockWebSocket.instances[0].readyState = MockWebSocket.OPEN;
      MockWebSocket.instances[0].dispatchEvent(new Event("open"));
    });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledTimes(2);
    expect(MockWebSocket.instances[0].send).toHaveBeenLastCalledWith(
      JSON.stringify({ type: "featureRequest", text: "Add filters" }),
    );
  });

  it("clears retry state after turn completion", async () => {
    renderFeatureRequest();

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ method: "turn/completed" }),
        }),
      );
    });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Applied")).toHaveAttribute("aria-current", "step");
  });

  it("clears a stale timeout error if completion arrives afterwards", async () => {
    vi.useFakeTimers();
    renderFeatureRequest();

    fireEvent.change(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      { target: { value: "Add filters" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            method: "thread/started",
            params: { thread: { id: "thread_1" } },
          }),
        }),
      );
      vi.advanceTimersByTime(150_000);
    });

    expect(
      screen.getByText(
        "The agent stopped responding before the request finished. Reconnect and send again.",
      ),
    ).toBeInTheDocument();

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ method: "turn/completed" }),
        }),
      );
    });

    expect(
      screen.queryByText(
        "The agent stopped responding before the request finished. Reconnect and send again.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Applied")).toHaveAttribute("aria-current", "step");
  });

  it("allows another request after a completed turn", async () => {
    renderFeatureRequest({ threadId: "thread_1" });

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ method: "turn/completed" }),
        }),
      );
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Submit feature request" }),
      ).not.toBeDisabled(),
    );
    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Make cards denser",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledTimes(2);
    expect(MockWebSocket.instances[0].send).toHaveBeenLastCalledWith(
      JSON.stringify({ type: "featureRequest", text: "Make cards denser" }),
    );
    expect(screen.getByText("Sending")).toHaveAttribute("aria-current", "step");
  });

  it("preserves the prompt when the app-server reports a failed completed turn", async () => {
    renderFeatureRequest();
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(new Event("open"));
    });

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            method: "turn/completed",
            params: {
              turn: {
                status: "failed",
                error: { message: "unexpected status 401 Unauthorized" },
              },
            },
          }),
        }),
      );
    });

    expect(
      await screen.findByText("unexpected status 401 Unauthorized"),
    ).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Applied")).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
    expect(screen.getByRole("button", { name: "Retry" })).not.toBeDisabled();
  });

  it("ignores retryable app-server errors but fails on the final non-retryable error", async () => {
    renderFeatureRequest();

    await userEvent.type(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
      "Add filters",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit feature request" }),
    );
    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            method: "error",
            params: {
              error: { message: "Reconnecting... 1/5" },
              willRetry: true,
            },
          }),
        }),
      );
    });

    expect(screen.queryByText("Reconnecting... 1/5")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();

    act(() => {
      MockWebSocket.instances[0].dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            method: "error",
            params: {
              error: { message: "authentication failed" },
              willRetry: false,
            },
          }),
        }),
      );
    });

    expect(
      await screen.findByText("authentication failed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Describe the catalogue change you want Codex to make...",
      ),
    ).toHaveValue("Add filters");
  });

  it("keeps rollback and reset recovery controls in the composer", async () => {
    const onRollbackComplete = vi.fn();
    const onResetComplete = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: "Sandbox reset to baseline" }),
        ),
    );
    const events: AgentEvent[] = [{ method: "turn/completed" }];
    renderFeatureRequest({
      threadId: "thread_1",
      events,
      onRollbackComplete,
      onResetComplete,
    });

    expect(
      screen.getByRole("button", { name: "Undo last change" }),
    ).not.toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Reset baseline" }),
    );
    expect(
      screen.getByText(
        "This will discard all Codex changes and return the catalogue to its original state.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm reset" }),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/reset",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      await screen.findByText("Sandbox reset to baseline"),
    ).toBeInTheDocument();
    expect(onResetComplete).toHaveBeenCalled();
  });

  it("toggles feature request recording on click and transcribes the result", async () => {
    const stopTrack = vi.fn();
    const mediaRecorderInstances: Array<{
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    class MockMediaRecorder extends EventTarget {
      start = vi.fn();
      stop = vi.fn(() => {
        this.dispatchEvent(
          Object.assign(new Event("dataavailable"), {
            data: new Blob(["audio"], { type: "audio/webm" }),
          }),
        );
        this.dispatchEvent(new Event("stop"));
      });

      constructor() {
        super();
        mediaRecorderInstances.push(this);
      }
    }
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Add filters" }) }),
    );

    renderFeatureRequest();

    const micButton = await screen.findByRole("button", {
      name: "Record feature request",
    });
    await userEvent.click(micButton);
    await screen.findByPlaceholderText("Listening...");
    await userEvent.click(
      screen.getByRole("button", { name: "Stop recording feature request" }),
    );

    expect(mediaRecorderInstances[0].start).toHaveBeenCalled();
    expect(mediaRecorderInstances[0].stop).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
    expect(await screen.findByDisplayValue("Add filters")).toBeInTheDocument();
  });

  it("enables rollback from a recovered persisted thread after refresh", async () => {
    const onRollbackComplete = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Rolled back to previous state" })),
    );

    renderFeatureRequest({
      rollbackThreadId: "thread_recovered",
      events: [],
      onRollbackComplete,
    });

    expect(
      screen.getByRole("button", { name: "Undo last change" }),
    ).not.toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Undo last change" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/rollback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ threadId: "thread_recovered" }),
      }),
    );
    expect(onRollbackComplete).toHaveBeenCalled();
  });

  it("keeps rollback disabled when there is no completed or recovered change", () => {
    renderFeatureRequest({ events: [], threadId: null, rollbackThreadId: null });

    expect(
      screen.getByRole("button", { name: "Undo last change" }),
    ).toBeDisabled();
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  };
}

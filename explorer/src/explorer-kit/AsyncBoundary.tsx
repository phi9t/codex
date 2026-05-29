import { type ReactNode } from "react";

import { errorMessage } from "../lib/fetch";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };

type AsyncBoundaryProps<T> = {
  state: AsyncState<T>;
  loadingText?: string;
  children: (data: T) => ReactNode;
  noDataFallback?: ReactNode;
  errorRenderer?: (message: string) => ReactNode;
};

const defaultErrorRenderer = (message: string): ReactNode => (
  <div className="status status-error" role="status" aria-live="polite">
    {message}
  </div>
);

export function AsyncBoundary<T>({
  state,
  children,
  loadingText = "Loading explorer data…",
  noDataFallback,
  errorRenderer = defaultErrorRenderer,
}: AsyncBoundaryProps<T>): ReactNode {
  if (state.status === "loading") {
    return <p className="status status-loading">{loadingText}</p>;
  }

  if (state.status === "error") {
    return errorRenderer(errorMessage(state.error));
  }

  if (state.status === "ready") {
    const data = state.data;

    if (!data) {
      return noDataFallback ?? <p className="status status-empty">No data available.</p>;
    }

    return children(data);
  }

  return null;
}

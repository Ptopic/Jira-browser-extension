export type QuoteJobStatus = "idle" | "pending" | "success" | "error";

export interface QuoteJobState {
  status: QuoteJobStatus;
  sourceUrl: string | null;
  articleId: number | null;
  articleSlug: string | null;
  articleTitle: string | null;
  error: string | null;
  updatedAt: number;
}

const JOB_STATE_KEY = "quoted_article_job_state";
const chromeApi = (globalThis as { chrome?: any }).chrome;

export const defaultQuoteJobState: QuoteJobState = {
  status: "idle",
  sourceUrl: null,
  articleId: null,
  articleSlug: null,
  articleTitle: null,
  error: null,
  updatedAt: 0,
};

function parseJobState(value: unknown): QuoteJobState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  const status = candidate.status;
  const validStatus =
    status === "idle" ||
    status === "pending" ||
    status === "success" ||
    status === "error";

  if (!validStatus) {
    return null;
  }

  return {
    status,
    sourceUrl:
      typeof candidate.sourceUrl === "string" ? candidate.sourceUrl : null,
    articleId: typeof candidate.articleId === "number" ? candidate.articleId : null,
    articleSlug:
      typeof candidate.articleSlug === "string" ? candidate.articleSlug : null,
    articleTitle:
      typeof candidate.articleTitle === "string" ? candidate.articleTitle : null,
    error: typeof candidate.error === "string" ? candidate.error : null,
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : 0,
  };
}

export async function getQuoteJobState(): Promise<QuoteJobState> {
  if (!chromeApi?.storage?.local?.get) {
    return defaultQuoteJobState;
  }

  return new Promise((resolve) => {
    chromeApi.storage.local.get(JOB_STATE_KEY, (items: Record<string, unknown>) => {
      resolve(parseJobState(items[JOB_STATE_KEY]) ?? defaultQuoteJobState);
    });
  });
}

export async function setQuoteJobState(
  state: Omit<QuoteJobState, "updatedAt">,
): Promise<void> {
  if (!chromeApi?.storage?.local?.set) {
    return;
  }

  const nextState: QuoteJobState = {
    ...state,
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve) => {
    chromeApi.storage.local.set({ [JOB_STATE_KEY]: nextState }, () => resolve());
  });
}

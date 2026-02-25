import { setQuoteJobState } from "./lib/quoteJobState";

const APP_URL = process.env.PLASMO_PUBLIC_APP_URL || "http://localhost:3000";

type CreateQuotedArticleMessage = {
  type: "create-quoted-article";
  token: string;
  sourceUrl: string;
};

const chromeApi = (globalThis as { chrome?: any }).chrome;
let isRunning = false;

async function notifyQuoteCompleted(articleTitle: string) {
  if (!chromeApi?.notifications?.create) {
    return false;
  }

  const icons = chromeApi?.runtime?.getManifest?.()?.icons || {};
  const iconPath = icons["128"] || icons["64"] || icons["48"] || icons["32"];

  if (!iconPath) {
    return false;
  }

  const iconUrl = chromeApi.runtime.getURL(iconPath);

  return await new Promise<boolean>((resolve) => {
    chromeApi.notifications.create(
      `quote-complete-${Date.now()}`,
      {
        type: "basic",
        iconUrl,
        title: "JB Quoting Complete",
        message: `Quoted article created: ${articleTitle}`,
        priority: 2,
      },
      () => {
        if (chromeApi.runtime.lastError) {
          resolve(false);
          return;
        }

        resolve(true);
      },
    );
  });
}

function isCreateQuotedArticleMessage(
  message: unknown,
): message is CreateQuotedArticleMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const payload = message as Record<string, unknown>;
  return (
    payload.type === "create-quoted-article" &&
    typeof payload.token === "string" &&
    typeof payload.sourceUrl === "string"
  );
}

async function runCreateQuotedArticleJob(token: string, sourceUrl: string) {
  await setQuoteJobState({
    status: "pending",
    sourceUrl,
    articleId: null,
    articleSlug: null,
    articleTitle: null,
    error: null,
  });

  try {
    const response = await fetch(`${APP_URL}/api/quoted-article/browser-extension`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sourceUrl }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      await setQuoteJobState({
        status: "error",
        sourceUrl,
        articleId: null,
        articleSlug: null,
        articleTitle: null,
        error: result.error || "Failed to create quoted article.",
      });
      return;
    }

    await setQuoteJobState({
      status: "success",
      sourceUrl,
      articleId: result.data.articleId,
      articleSlug: result.data.articleSlug,
      articleTitle: result.data.articleTitle,
      error: null,
    });

    await notifyQuoteCompleted(result.data.articleTitle);
  } catch (error) {
    await setQuoteJobState({
      status: "error",
      sourceUrl,
      articleId: null,
      articleSlug: null,
      articleTitle: null,
      error: error instanceof Error ? error.message : "Unexpected error occurred.",
    });
  }
}

chromeApi?.runtime?.onMessage?.addListener(
  (
    message: unknown,
    _sender: unknown,
    sendResponse: (response: { success: boolean; error?: string }) => void,
  ) => {
    if (!isCreateQuotedArticleMessage(message)) {
      return false;
    }

    if (isRunning) {
      void setQuoteJobState({
        status: "error",
        sourceUrl: message.sourceUrl,
        articleId: null,
        articleSlug: null,
        articleTitle: null,
        error: "A quote job is already running. Please wait.",
      });

      sendResponse({ success: false, error: "Quote job already running" });
      return false;
    }

    isRunning = true;

    void runCreateQuotedArticleJob(message.token, message.sourceUrl)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown background error",
        });
      })
      .finally(() => {
        isRunning = false;
      });

    return true;
  },
);

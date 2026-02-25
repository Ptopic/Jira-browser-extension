import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://ptopic.atlassian.net/*"]
}

const TOOLBAR_SELECTOR = "[data-testid='ak-editor-main-toolbar']"
const CURRENT_ISSUE_KEY_SELECTOR =
  "[data-testid='issue.views.issue-base.foundation.breadcrumbs.current-issue.item'] span"
const PARENT_ISSUE_KEY_SELECTOR =
  "[data-testid='issue.views.issue-base.foundation.breadcrumbs.parent-issue.item'] span"
const FALLBACK_ISSUE_KEY_SELECTOR = "#jira ._6v24wadc span"
const DIALOG_DESCRIPTION_SELECTOR = "[role='dialog'] p"
const BUTTON_ID = "jira-adf-rewrite-button"
const BUTTON_IDLE_TEXT = "Rewrite with AI"
const TOAST_CONTAINER_ID = "jira-ai-toast-container"
const OPENAI_API_KEY = process.env.PLASMO_PUBLIC_OPENAI_API_KEY ?? ""
const OPENAI_MODEL = process.env.PLASMO_PUBLIC_OPENAI_MODEL ?? "gpt-4o-mini"

type ButtonState = "idle" | "loading" | "error" | "success"
type ToastType = "success" | "error"

function ensureToastContainer(): HTMLDivElement {
  const existing = document.getElementById(TOAST_CONTAINER_ID)
  if (existing instanceof HTMLDivElement) {
    return existing
  }

  const container = document.createElement("div")
  container.id = TOAST_CONTAINER_ID
  container.style.position = "fixed"
  container.style.top = "16px"
  container.style.right = "16px"
  container.style.zIndex = "2147483647"
  container.style.display = "flex"
  container.style.flexDirection = "column"
  container.style.gap = "8px"
  container.style.maxWidth = "380px"
  document.body.appendChild(container)
  return container
}

function showToast(message: string, type: ToastType) {
  const container = ensureToastContainer()
  const toast = document.createElement("div")
  toast.setAttribute("role", "status")
  toast.textContent = message
  toast.style.padding = "10px 12px"
  toast.style.borderRadius = "8px"
  toast.style.color = "#ffffff"
  toast.style.fontSize = "13px"
  toast.style.fontWeight = "600"
  toast.style.lineHeight = "1.3"
  toast.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.18)"
  toast.style.background = type === "success" ? "#1f8f4d" : "#c4362f"
  toast.style.opacity = "0"
  toast.style.transform = "translateY(-6px)"
  toast.style.transition = "opacity 160ms ease, transform 160ms ease"
  container.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = "1"
    toast.style.transform = "translateY(0)"
  })

  window.setTimeout(() => {
    toast.style.opacity = "0"
    toast.style.transform = "translateY(-6px)"

    window.setTimeout(() => {
      toast.remove()
      if (container.childElementCount === 0) {
        container.remove()
      }
    }, 180)
  }, type === "success" ? 1800 : 3500)
}

function extractProjectTag(args: { issue: string | null }): string | null {
  const { issue } = args
  if (typeof issue !== "string") return null

  const match = issue.match(/^([A-Z][A-Z0-9_]*)-\d+$/)

  return match ? match[1] : null
}

function setButtonState(button: HTMLButtonElement, state: ButtonState, detail?: string) {
  if (state === "loading") {
    button.disabled = true
    button.textContent = "Processing..."
    button.title = "Generating Jira description"
    return
  }

  button.disabled = false

  if (state === "idle") {
    button.textContent = BUTTON_IDLE_TEXT
    button.title = "Rewrite Jira description with AI"
    return
  }

  if (state === "success") {
    button.textContent = "Updated"
    button.title = "Description updated successfully"
    return
  }

  button.textContent = "Retry"
  button.title = detail ?? "Failed to update Jira description"
}

function getIssueKey(): string | null {
  const locationMatch = window.location.pathname.match(/\/browse\/([A-Z][A-Z0-9_]*-\d+)/)
  if (locationMatch?.[1]) {
    return locationMatch[1]
  }

  const selectedIssue = new URLSearchParams(window.location.search).get("selectedIssue")
  if (selectedIssue && /^[A-Z][A-Z0-9_]*-\d+$/.test(selectedIssue)) {
    return selectedIssue
  }

  const selectors = [
    CURRENT_ISSUE_KEY_SELECTOR,
    PARENT_ISSUE_KEY_SELECTOR,
    FALLBACK_ISSUE_KEY_SELECTOR
  ]

  for (const selector of selectors) {
    const node = document.querySelector(selector)
    const text = node?.textContent?.trim() ?? ""

    if (/^[A-Z][A-Z0-9_]*-\d+$/.test(text)) {
      return text
    }
  }

  return null
}

function getDialogDescription(): string | null {
  const paragraphs = Array.from(document.querySelectorAll(DIALOG_DESCRIPTION_SELECTOR))
  const firstWithText = paragraphs.find((paragraph) => {
    const text = paragraph.textContent?.trim() ?? ""
    return text.length > 0
  })

  if (!firstWithText) {
    return null
  }

  const text = firstWithText.textContent?.replace(/\s+/g, " ").trim()
  return text && text.length > 0 ? text : null
}

function buildPrompt(description: string): string {
  return `You must output ONLY valid JSON representing a Jira ADF document (Atlassian Document Format).

The output must strictly follow this structure:

- Root object must contain:
  - "type": "doc"
  - "version": 1
  - "content" array

Inside "content" include exactly these nodes in this exact order:

1. A heading level 2 with text "Summary"
2. A paragraph with 1–2 clear sentences describing the feature/change
3. A heading level 2 with text "Context"
4. A paragraph describing the current state and why change is needed
5. A heading level 2 with text "Acceptance criteria"
6. A bullet list ("bulletList") containing list items ("listItem") with testable requirements

STRICT RULES:
- Output valid JSON only.
- Do NOT output Markdown.
- Do NOT use code blocks.
- Do NOT include explanations.
- Do NOT include text before or after the JSON.
- Do NOT include trailing commas.
- Headings must use:
  "type": "heading",
  "attrs": { "level": 2 }
- Acceptance criteria must be a "bulletList" containing "listItem" nodes.
- Each "listItem" must contain a "paragraph" with a "text" node.
- Preserve the original meaning but rewrite clearly and professionally.
- Do not invent new features.
- Do not include empty nodes.
- Ensure the JSON is syntactically valid and directly usable as Jira description.

Jira task:
${description}`
}

function stripCodeFence(value: string): string {
  if (!value.startsWith("```")) {
    return value
  }

  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
}

function parseAdfResponse(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("OpenAI returned invalid JSON structure")
  }

  const documentValue = raw as {
    type?: string
    version?: number
    content?: unknown
  }

  if (documentValue.type === "doc" && documentValue.version === 1 && Array.isArray(documentValue.content)) {
    return documentValue.content
  }

  if (Array.isArray(raw)) {
    return raw
  }

  throw new Error("OpenAI response must be Jira ADF doc JSON")
}

async function createAdfContentFromDescription(description: string): Promise<unknown[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing PLASMO_PUBLIC_OPENAI_API_KEY")
  }

  const prompt = buildPrompt(description)
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${bodyText}`)
  }

  let payload: {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  try {
    payload = JSON.parse(bodyText)
  } catch {
    throw new Error("OpenAI returned non-JSON response")
  }

  const output = payload.choices?.[0]?.message?.content?.trim()
  if (!output) {
    throw new Error("OpenAI response had empty content")
  }

  let parsedOutput: unknown
  try {
    parsedOutput = JSON.parse(stripCodeFence(output))
  } catch {
    throw new Error("OpenAI output was not valid JSON")
  }

  return parseAdfResponse(parsedOutput)
}

async function updateJiraDescription(issueKey: string, parsedContent: unknown[]) {
  const response = await fetch(
    `https://ptopic.atlassian.net/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          description: {
            type: "doc",
            version: 1,
            content: parsedContent
          }
        }
      })
    }
  )

  if (response.ok) {
    return
  }

  const errorText = await response.text()
  throw new Error(`Jira update failed (${response.status}): ${errorText}`)
}

function getRedirectUrl(project: string, issueKey: string): string {
  return `https://ptopic.atlassian.net/jira/software/projects/${encodeURIComponent(project)}/boards/2?selectedIssue=${encodeURIComponent(issueKey)}`
}

function clearJiraCachedIssueStorage(issueKey: string) {
  const normalizedKey = issueKey.toLowerCase()

  const clearFromStorage = (storage: Storage) => {
    const keysToRemove: string[] = []

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key) {
        continue
      }

      const normalizedStorageKey = key.toLowerCase()
      const shouldRemove =
        normalizedStorageKey.includes(normalizedKey) ||
        (normalizedStorageKey.includes("jira") &&
          (normalizedStorageKey.includes("editor") ||
            normalizedStorageKey.includes("issue") ||
            normalizedStorageKey.includes("draft")))

      if (shouldRemove) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key)
    }
  }

  try {
    clearFromStorage(window.localStorage)
    clearFromStorage(window.sessionStorage)
  } catch (error) {
    console.warn("Could not clear Jira cached issue storage", error)
  }
}

async function handleRewrite(button: HTMLButtonElement) {
  setButtonState(button, "loading")

  try {
    const issueKey = getIssueKey()
    if (!issueKey) {
      throw new Error("Could not extract issue key")
    }

    const issueDescription = getDialogDescription()
    if (!issueDescription) {
      throw new Error("Could not extract issue description from dialog")
    }

    const parsedContent = await createAdfContentFromDescription(issueDescription)
    await updateJiraDescription(issueKey, parsedContent)

    const projectTag = extractProjectTag({ issue: issueKey })
    if (!projectTag) {
      throw new Error("Could not extract project tag from issue key")
    }

    clearJiraCachedIssueStorage(issueKey)
    setButtonState(button, "success")
    showToast(`Issue ${issueKey} updated successfully`, "success")
    window.setTimeout(() => {
      window.location.href = getRedirectUrl(projectTag, issueKey)
    }, 900)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow error"
    setButtonState(button, "error", message)
    showToast(message, "error")
    console.error("Jira rewrite extension error", error)
  }
}

function createButton(): HTMLButtonElement {
  const button = document.createElement("button")
  button.id = BUTTON_ID
  button.type = "button"
  button.textContent = BUTTON_IDLE_TEXT
  button.title = "Rewrite Jira description with AI"
  button.style.height = "32px"
  button.style.padding = "0 12px"
  button.style.borderRadius = "6px"
  button.style.border = "1px solid #1f6feb"
  button.style.background = "#1f6feb"
  button.style.color = "#ffffff"
  button.style.fontSize = "13px"
  button.style.fontWeight = "600"
  button.style.whiteSpace = "nowrap"
  button.style.cursor = "pointer"
  button.style.marginLeft = "8px"

  button.addEventListener("click", () => {
    void handleRewrite(button)
  })

  return button
}

function ensureButtonMounted() {
  const toolbar = document.querySelector(TOOLBAR_SELECTOR)
  if (!toolbar) {
    return
  }

  const existingButton = document.getElementById(BUTTON_ID)
  if (existingButton) {
    return
  }

  toolbar.appendChild(createButton())
}

function startToolbarWatcher() {
  ensureButtonMounted()

  const observer = new MutationObserver(() => {
    ensureButtonMounted()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startToolbarWatcher, { once: true })
} else {
  startToolbarWatcher()
}

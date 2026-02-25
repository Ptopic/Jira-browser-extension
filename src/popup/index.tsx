import "../globals.css"

function IndexPopup() {
  return (
    <div className="w-[320px] p-4 bg-white text-gray-900">
      <h1 className="text-base font-semibold">Jira ADF Rewriter</h1>
      <p className="mt-2 text-sm leading-5 text-gray-700">
        Open a Jira issue page in ptopic.atlassian.net, then use the <strong>Rewrite with AI</strong> button in the issue toolbar.
      </p>
    </div>
  )
}

export default IndexPopup

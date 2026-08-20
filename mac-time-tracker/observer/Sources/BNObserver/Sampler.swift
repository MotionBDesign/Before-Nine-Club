import AppKit
import ApplicationServices
import Foundation

/// Builds one `Snapshot` from whatever the frontmost app is willing to tell us.
struct Sampler {
    /// Bundle identifiers whose `AXDocument` is a web address rather than a file.
    private static let browsers: Set<String> = [
        "com.apple.Safari",
        "com.apple.SafariTechnologyPreview",
        "com.google.Chrome",
        "com.google.Chrome.canary",
        "com.microsoft.edgemac",
        "company.thebrowser.Browser",
        "org.mozilla.firefox",
        "com.brave.Browser",
        "com.vivaldi.Vivaldi",
        "com.operasoftware.Opera",
    ]

    func sample() -> Snapshot? {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let idle = SystemState.idleSeconds()
        let locked = SystemState.screenIsLocked()

        guard let frontmost = NSWorkspace.shared.frontmostApplication else { return nil }
        let bundleId = frontmost.bundleIdentifier ?? "unknown"
        let appName = frontmost.localizedName ?? bundleId

        // When the screen is locked there is nothing worth inspecting, and the
        // AX calls would just time out against the login window.
        if locked {
            return Snapshot(ts: now, app: appName, bundleId: bundleId, title: nil,
                            documentPath: nil, url: nil, idleSeconds: idle, locked: true)
        }

        let appElement = AXUIElementCreateApplication(frontmost.processIdentifier)
        _ = AXUIElementSetMessagingTimeout(appElement, AX.messagingTimeout)

        var title: String?
        var documentPath: String?
        var url: String?

        if let window = AX.element(appElement, kAXFocusedWindowAttribute as String) {
            title = AX.string(window, kAXTitleAttribute as String)

            if let document = AX.string(window, kAXDocumentAttribute as String) {
                if let parsed = URL(string: document), parsed.isFileURL {
                    documentPath = parsed.path
                } else if document.hasPrefix("http://") || document.hasPrefix("https://") {
                    url = document
                } else if document.hasPrefix("/") {
                    // A few apps hand back a bare POSIX path.
                    documentPath = document
                }
            }

            if url == nil, Self.browsers.contains(bundleId) {
                url = AX.webAreaURL(window)
            }
        }

        return Snapshot(ts: now, app: appName, bundleId: bundleId, title: title,
                        documentPath: documentPath, url: url,
                        idleSeconds: idle, locked: false)
    }
}

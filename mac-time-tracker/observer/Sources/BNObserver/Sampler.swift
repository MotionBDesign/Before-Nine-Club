import AppKit
import ApplicationServices
import Foundation

/// Builds one `Snapshot` from whatever the frontmost app is willing to tell us.
struct Sampler {
    let browserMode: BrowserQueryMode

    init(browserMode: BrowserQueryMode) {
        self.browserMode = browserMode
    }

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

        let window = AX.element(appElement, kAXFocusedWindowAttribute as String)
        if let window {
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
        }

        if BrowserURL.isBrowser(bundleId) {
            let reading = BrowserURL.read(bundleId: bundleId, window: window, mode: browserMode)
            if reading.isPrivate {
                // Private browsing is never recorded — not the address, not the
                // page title, which usually names the page just as clearly.
                return Snapshot(ts: now, app: appName, bundleId: bundleId, title: nil,
                                documentPath: nil, url: nil, idleSeconds: idle, locked: false)
            }
            if let found = reading.url { url = found }
        }

        return Snapshot(ts: now, app: appName, bundleId: bundleId, title: title,
                        documentPath: documentPath, url: url,
                        idleSeconds: idle, locked: false)
    }
}

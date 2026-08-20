import AppKit
import Foundation

/// Reading the address out of a browser.
///
/// Two strategies, because they trade off differently:
///
/// - `.accessibility` walks the AX tree for the web area's `AXURL`. It needs no
///   permission beyond the Accessibility grant we already hold and prompts for
///   nothing, but Chromium exposes it inconsistently and it cannot tell a
///   private window from a normal one.
/// - `.appleScript` asks the browser directly. It is what ActivityWatch and
///   sindresorhus/get-windows both do, it is far more reliable, and it is the
///   only way to detect an incognito window — but the first query to each
///   browser raises a macOS Automation permission prompt.
///
/// Bundle identifier coverage below follows sindresorhus/get-windows (MIT);
/// the incognito check follows ActivityWatch's macOS watcher (MPL-2.0).
enum BrowserQueryMode: String {
    case accessibility
    case appleScript
    case off
}

struct BrowserReading {
    let url: String?
    /// True when the front window is incognito/private. Nothing is recorded then.
    let isPrivate: Bool
}

enum BrowserURL {
    /// Chromium and its many rebadges — all share the same AppleScript dictionary.
    static let chromium: Set<String> = [
        "com.google.Chrome", "com.google.Chrome.beta", "com.google.Chrome.dev", "com.google.Chrome.canary",
        "org.chromium.Chromium",
        "com.brave.Browser", "com.brave.Browser.beta", "com.brave.Browser.nightly",
        "com.microsoft.edgemac", "com.microsoft.edgemac.Beta", "com.microsoft.edgemac.Dev", "com.microsoft.edgemac.Canary",
        "com.vivaldi.Vivaldi",
        "com.operasoftware.Opera", "com.operasoftware.OperaNext", "com.operasoftware.OperaDeveloper", "com.operasoftware.OperaGX",
        "company.thebrowser.Browser",
        "com.bookry.wavebox", "com.pushplaylabs.sidekick", "com.ghostbrowser.gb1", "com.mighty.app",
    ]

    static let safari: Set<String> = ["com.apple.Safari", "com.apple.SafariTechnologyPreview"]

    /// Firefox has never exposed its URL to AppleScript or the AX tree.
    static let unsupported: Set<String> = ["org.mozilla.firefox", "org.mozilla.firefoxdeveloperedition"]

    static func isBrowser(_ bundleId: String) -> Bool {
        chromium.contains(bundleId) || safari.contains(bundleId) || unsupported.contains(bundleId)
    }

    static func read(bundleId: String, window: AXUIElement?, mode: BrowserQueryMode) -> BrowserReading {
        guard mode != .off, isBrowser(bundleId), !unsupported.contains(bundleId) else {
            return BrowserReading(url: nil, isPrivate: false)
        }
        switch mode {
        case .appleScript:
            return viaAppleScript(bundleId: bundleId)
        case .accessibility:
            guard let window else { return BrowserReading(url: nil, isPrivate: false) }
            return BrowserReading(url: AX.webAreaURL(window), isPrivate: false)
        case .off:
            return BrowserReading(url: nil, isPrivate: false)
        }
    }

    // MARK: - AppleScript

    private static func viaAppleScript(bundleId: String) -> BrowserReading {
        let source: String
        if chromium.contains(bundleId) {
            // `mode` is a Chrome dictionary property that some forks omit, so the
            // lookup is wrapped rather than assumed.
            source = """
            tell application id "\(bundleId)"
                if (count of windows) is 0 then return ""
                set theURL to URL of active tab of front window
                set theMode to "normal"
                try
                    set theMode to (mode of front window) as text
                end try
                return theURL & "\\n" & theMode
            end tell
            """
        } else {
            // Safari gives no way to inspect a private window, so we can only
            // report the URL and note the gap in the docs.
            source = """
            tell application id "\(bundleId)"
                if (count of documents) is 0 then return ""
                return (URL of front document) & "\\n" & "normal"
            end tell
            """
        }

        guard let raw = run(source), !raw.isEmpty else {
            return BrowserReading(url: nil, isPrivate: false)
        }
        let parts = raw.components(separatedBy: "\n")
        let url = parts.first.flatMap { $0.isEmpty ? nil : $0 }
        let isPrivate = parts.count > 1 && parts[1].lowercased().contains("incognito")
        return BrowserReading(url: isPrivate ? nil : url, isPrivate: isPrivate)
    }

    /// NSAppleScript must run on the main thread; the sampling timer already does.
    private static func run(_ source: String) -> String? {
        guard let script = NSAppleScript(source: source) else { return nil }
        var error: NSDictionary?
        let result = script.executeAndReturnError(&error)
        if error != nil {
            // Most often this is the user declining the Automation prompt.
            // Nothing to do but carry on without a URL.
            return nil
        }
        return result.stringValue
    }
}

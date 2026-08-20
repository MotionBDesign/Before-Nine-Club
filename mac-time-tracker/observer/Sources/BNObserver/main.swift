import AppKit
import Foundation

/// BNObserver — the only part of the tracker that needs macOS APIs.
///
/// It samples the frontmost app, its focused window title, and the open
/// document path or browser URL, then prints one JSON object per line on
/// stdout. It makes no network calls and writes nothing to disk; deciding what
/// any of it means is the daemon's job.
///
/// Usage: BNObserver [--interval SECONDS] [--out PATH] [--browser-urls MODE]
///                   [--menubar] [--review-url URL]
///
/// --browser-urls is one of `accessibility` (default, no extra prompts),
/// `appleScript` (more reliable, detects incognito, prompts for Automation)
/// or `off`.
///
/// With `--out` it appends to a spool file, which is how the installed agent
/// runs: launchd starts it directly so macOS attributes the Accessibility
/// permission to this binary rather than to whatever spawned it.

struct Options {
    var interval: TimeInterval = 5
    var menuBar = false
    var reviewURL = "http://127.0.0.1:7878/"
    var outputPath: String?
    /// How to read browser addresses. AppleScript is more reliable and is the
    /// only mode that can spot an incognito window, but it prompts for
    /// Automation permission the first time it queries each browser.
    var browserMode: BrowserQueryMode = .accessibility

    static func parse(_ arguments: [String]) -> Options {
        var options = Options()
        var index = 0
        while index < arguments.count {
            switch arguments[index] {
            case "--interval":
                index += 1
                if index < arguments.count, let value = Double(arguments[index]), value >= 1 {
                    options.interval = value
                }
            case "--menubar":
                options.menuBar = true
            case "--review-url":
                index += 1
                if index < arguments.count { options.reviewURL = arguments[index] }
            case "--out":
                index += 1
                if index < arguments.count { options.outputPath = arguments[index] }
            case "--browser-urls":
                index += 1
                if index < arguments.count, let mode = BrowserQueryMode(rawValue: arguments[index]) {
                    options.browserMode = mode
                }
            default:
                break
            }
            index += 1
        }
        return options
    }
}

final class Observer: NSObject {
    private let options: Options
    private let sampler: Sampler
    private var timer: Timer?
    private var statusItem: NSStatusItem?
    private var pausedUntil: Date?
    private var warnedAboutTrust = false

    init(options: Options) {
        self.options = options
        self.sampler = Sampler(browserMode: options.browserMode)
    }

    func start() {
        if let path = options.outputPath {
            do {
                try Emit.useSpool(at: path)
            } catch {
                FileHandle.standardError.write(Data("Cannot open spool at \(path): \(error)\n".utf8))
                exit(1)
            }
        }
        if options.menuBar { installStatusItem() }

        // Prompting here is what surfaces the System Settings pane the first
        // time the tracker runs; without the permission we can still report the
        // frontmost app, just not titles or documents.
        if !AX.isTrusted(prompt: true) {
            Emit.problem("Accessibility permission not granted. Grant it in System Settings > Privacy & Security > Accessibility, then restart the tracker.")
        }

        let timer = Timer(timeInterval: options.interval, repeats: true) { [weak self] _ in
            self?.tick()
        }
        // .common keeps sampling alive while a menu is open.
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
        tick()
    }

    private func tick() {
        if let until = pausedUntil {
            if Date() < until { return }
            pausedUntil = nil
            refreshStatusTitle()
        }
        if !AX.isTrusted(prompt: false), !warnedAboutTrust {
            warnedAboutTrust = true
            Emit.problem("Accessibility permission is still missing; titles and file paths will be blank.")
        }
        guard let snapshot = sampler.sample() else { return }
        Emit.line(snapshot)
    }

    // MARK: - Optional menu bar presence

    private func installStatusItem() {
        NSApplication.shared.setActivationPolicy(.accessory)
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "◷"
        let menu = NSMenu()
        menu.addItem(withTitle: "Open timesheet review", action: #selector(openReview), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Pause for 1 hour", action: #selector(pauseOneHour), keyEquivalent: "")
        menu.addItem(withTitle: "Resume now", action: #selector(resume), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit tracker", action: #selector(quit), keyEquivalent: "q")
        for menuItem in menu.items { menuItem.target = self }
        item.menu = menu
        statusItem = item
    }

    private func refreshStatusTitle() {
        statusItem?.button?.title = pausedUntil == nil ? "◷" : "◷ paused"
    }

    @objc private func openReview() {
        guard let url = URL(string: options.reviewURL) else { return }
        NSWorkspace.shared.open(url)
    }

    @objc private func pauseOneHour() {
        pausedUntil = Date().addingTimeInterval(3600)
        refreshStatusTitle()
    }

    @objc private func resume() {
        pausedUntil = nil
        refreshStatusTitle()
    }

    @objc private func quit() {
        exit(0)
    }
}

let options = Options.parse(Array(CommandLine.arguments.dropFirst()))
let observer = Observer(options: options)

// Stop cleanly when the daemon goes away rather than leaving an orphan.
_ = signal(SIGTERM) { _ in exit(0) }
_ = signal(SIGINT) { _ in exit(0) }
_ = signal(SIGPIPE) { _ in exit(0) }

observer.start()

if options.menuBar {
    NSApplication.shared.run()
} else {
    RunLoop.main.run()
}

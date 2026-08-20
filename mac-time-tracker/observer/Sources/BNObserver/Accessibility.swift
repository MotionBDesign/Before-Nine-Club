import ApplicationServices
import Foundation

/// Thin, defensive wrappers over the Accessibility (AX) API.
///
/// Every call here can fail for perfectly ordinary reasons — the app is busy,
/// the window went away, the app simply doesn't publish the attribute — so
/// nothing throws and everything returns an optional.
enum AX {
    /// Apps that hang will otherwise block our sampling thread indefinitely.
    static let messagingTimeout: Float = 1.0

    static func isTrusted(prompt: Bool) -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    static func copyValue(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
            return nil
        }
        return value
    }

    static func string(_ element: AXUIElement, _ attribute: String) -> String? {
        guard let value = copyValue(element, attribute) else { return nil }
        if let text = value as? String { return text }
        if CFGetTypeID(value) == CFURLGetTypeID() {
            return ((value as! CFURL) as URL).absoluteString
        }
        return nil
    }

    static func element(_ element: AXUIElement, _ attribute: String) -> AXUIElement? {
        guard let value = copyValue(element, attribute) else { return nil }
        guard CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return (value as! AXUIElement)
    }

    static func children(_ element: AXUIElement) -> [AXUIElement] {
        guard let value = copyValue(element, kAXChildrenAttribute as String),
              let list = value as? [AXUIElement] else { return [] }
        return list
    }

    /// Chromium-based browsers publish the address on the web area rather than
    /// on the window, so we have to walk down to find it. Safari answers via
    /// `AXDocument` and never gets this far.
    static func webAreaURL(_ element: AXUIElement, depth: Int = 0) -> String? {
        if depth > 5 { return nil }
        if let role = string(element, kAXRoleAttribute as String), role == "AXWebArea" {
            if let url = string(element, "AXURL") { return url }
        }
        for child in children(element).prefix(24) {
            if let found = webAreaURL(child, depth: depth + 1) { return found }
        }
        return nil
    }
}

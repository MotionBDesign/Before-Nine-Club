import CoreGraphics
import Foundation
import IOKit

enum SystemState {
    /// Seconds since the last HID event. Read straight from the IOHIDSystem
    /// registry entry, which needs no special permission and is unaffected by
    /// the app being in the background.
    static func idleSeconds() -> Double {
        var iterator: io_iterator_t = 0
        guard IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching("IOHIDSystem"), &iterator) == KERN_SUCCESS else {
            return 0
        }
        defer { IOObjectRelease(iterator) }

        let entry = IOIteratorNext(iterator)
        guard entry != 0 else { return 0 }
        defer { IOObjectRelease(entry) }

        var unmanaged: Unmanaged<CFMutableDictionary>?
        guard IORegistryEntryCreateCFProperties(entry, &unmanaged, kCFAllocatorDefault, 0) == KERN_SUCCESS,
              let properties = unmanaged?.takeRetainedValue() as NSDictionary? else {
            return 0
        }
        // HIDIdleTime comes back as an NSNumber; go through it rather than
        // relying on a direct bridge to a fixed-width integer.
        guard let nanoseconds = properties["HIDIdleTime"] as? NSNumber else { return 0 }
        return nanoseconds.doubleValue / 1_000_000_000
    }

    /// True while the screen is locked or the screensaver is up — time that
    /// should never land on a timesheet.
    static func screenIsLocked() -> Bool {
        guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else { return false }
        if let locked = session["CGSSessionScreenIsLocked"] as? Int { return locked == 1 }
        if let locked = session["CGSSessionScreenIsLocked"] as? Bool { return locked }
        return false
    }
}

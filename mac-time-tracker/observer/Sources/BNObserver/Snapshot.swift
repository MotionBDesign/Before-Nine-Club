import Foundation

/// One observation, serialised as a single line of JSON on stdout.
/// The shape here must stay in step with `daemon/src/types.ts`.
struct Snapshot: Encodable {
    let ts: Int64
    let app: String
    let bundleId: String
    let title: String?
    let documentPath: String?
    let url: String?
    let idleSeconds: Double
    let locked: Bool

    // Synthesised encoding would drop nil fields entirely; emitting explicit
    // nulls keeps the wire format matching the TypeScript type exactly.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(ts, forKey: .ts)
        try container.encode(app, forKey: .app)
        try container.encode(bundleId, forKey: .bundleId)
        try container.encode(title, forKey: .title)
        try container.encode(documentPath, forKey: .documentPath)
        try container.encode(url, forKey: .url)
        try container.encode(idleSeconds, forKey: .idleSeconds)
        try container.encode(locked, forKey: .locked)
    }

    enum CodingKeys: String, CodingKey {
        case ts, app, bundleId, title, documentPath, url, idleSeconds, locked
    }
}

/// Out-of-band messages (permission problems, warnings) share the same stream.
struct ObserverError: Encodable {
    let error: String
}

enum Emit {
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        return encoder
    }()

    /// When set, snapshots are appended here instead of going to stdout.
    /// The handle is opened once and kept; O_APPEND means the daemon can
    /// safely truncate the spool underneath us without losing writes.
    private static var spool: FileHandle?

    static func useSpool(at path: String) throws {
        let manager = FileManager.default
        let directory = (path as NSString).deletingLastPathComponent
        try manager.createDirectory(atPath: directory, withIntermediateDirectories: true,
                                    attributes: [.posixPermissions: 0o700])
        if !manager.fileExists(atPath: path) {
            manager.createFile(atPath: path, contents: nil, attributes: [.posixPermissions: 0o600])
        }
        let handle = try FileHandle(forWritingTo: URL(fileURLWithPath: path))
        handle.seekToEndOfFile()
        spool = handle
    }

    static func line<T: Encodable>(_ value: T) {
        guard let data = try? encoder.encode(value),
              let text = String(data: data, encoding: .utf8) else { return }
        guard let spool else {
            print(text)
            // The daemon reads us line by line; never sit in a pipe buffer.
            fflush(stdout)
            return
        }
        if let payload = (text + "\n").data(using: .utf8) {
            try? spool.write(contentsOf: payload)
        }
    }

    /// Problems always go to stderr so they are visible whichever mode we run in.
    static func problem(_ message: String) {
        line(ObserverError(error: message))
        FileHandle.standardError.write(Data((message + "\n").utf8))
    }
}

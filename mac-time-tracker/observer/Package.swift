// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "BNObserver",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "BNObserver",
            path: "Sources/BNObserver"
        )
    ]
)

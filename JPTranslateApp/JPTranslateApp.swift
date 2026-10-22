import SafariServices
import SwiftUI

private let extensionBundleIdentifier = "com.alimohammed.JPTranslate.Extension"

@main
struct JPTranslateApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowResizability(.contentSize)
    }
}

private final class ExtensionStatusModel: ObservableObject {
    @Published var status = "Checking Safari extension status…"
    @Published var isEnabled = false

    func refresh() {
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] state, error in
            DispatchQueue.main.async {
                guard let self else { return }

                if let error {
                    self.status = "Safari could not read the extension state: \(error.localizedDescription)"
                    self.isEnabled = false
                    return
                }

                self.isEnabled = state?.isEnabled ?? false
                self.status = self.isEnabled
                    ? "JPTranslate is enabled in Safari."
                    : "JPTranslate is installed but is not enabled in Safari."
            }
        }
    }

    func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] error in
            guard let error else { return }
            DispatchQueue.main.async {
                self?.status = "Safari settings could not be opened: \(error.localizedDescription)"
            }
        }
    }
}

private struct ContentView: View {
    @StateObject private var model = ExtensionStatusModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 12) {
                Image(systemName: "character.book.closed.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(.red)

                VStack(alignment: .leading, spacing: 3) {
                    Text("JPTranslate")
                        .font(.title2.weight(.semibold))
                    Text("Fast Jisho lookups without leaving the page")
                        .foregroundStyle(.secondary)
                }
            }

            Label(model.status, systemImage: model.isEnabled ? "checkmark.circle.fill" : "info.circle.fill")
                .foregroundStyle(model.isEnabled ? .green : .secondary)

            VStack(alignment: .leading, spacing: 8) {
                Text("Local installation")
                    .font(.headline)
                Text("In Safari Settings, enable Allow unsigned extensions under Developer, then enable JPTranslate under Extensions. Safari resets the unsigned-extension setting whenever it quits.")
                    .fixedSize(horizontal: false, vertical: true)
                    .foregroundStyle(.secondary)
            }

            HStack {
                Button("Open Safari Extension Settings") {
                    model.openSafariSettings()
                }
                .keyboardShortcut(.defaultAction)

                Button("Refresh Status") {
                    model.refresh()
                }
            }

            Divider()

            Text("To search, select text on a webpage, right-click it, and choose Jisho Search.")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(width: 540)
        .onAppear {
            model.refresh()
        }
    }
}


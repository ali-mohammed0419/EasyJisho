import Foundation
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private enum Constants {
        static let operation = "jishoSearch"
        static let maximumQueryLength = 200
        static let requestTimeout: TimeInterval = 10
    }

    func beginRequest(with context: NSExtensionContext) {
        guard
            let item = context.inputItems.first as? NSExtensionItem,
            let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
            message["type"] as? String == Constants.operation,
            let rawQuery = message["query"] as? String
        else {
            complete(
                context,
                with: failure(code: "invalidRequest", message: "JPTranslate received an invalid lookup request.")
            )
            return
        }

        let query = rawQuery
            .split(whereSeparator: \Character.isWhitespace)
            .joined(separator: " ")

        guard !query.isEmpty, query.count <= Constants.maximumQueryLength else {
            complete(
                context,
                with: failure(code: "invalidQuery", message: "Select a passage of 200 characters or fewer.")
            )
            return
        }

        guard var components = URLComponents(string: "https://jisho.org/api/v1/search/words") else {
            complete(
                context,
                with: failure(code: "invalidURL", message: "JPTranslate could not construct the Jisho request.")
            )
            return
        }

        components.queryItems = [URLQueryItem(name: "keyword", value: query)]

        guard let url = components.url else {
            complete(
                context,
                with: failure(code: "invalidURL", message: "JPTranslate could not construct the Jisho request.")
            )
            return
        }

        var request = URLRequest(
            url: url,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: Constants.requestTimeout
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }

            if let urlError = error as? URLError {
                let message = urlError.code == .timedOut
                    ? "Jisho took too long to respond. Try again."
                    : "Jisho could not be reached. Check your connection and try again."
                self.complete(context, with: self.failure(code: "network", message: message))
                return
            }

            if error != nil {
                self.complete(
                    context,
                    with: self.failure(code: "network", message: "Jisho could not be reached. Check your connection and try again.")
                )
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                self.complete(
                    context,
                    with: self.failure(code: "invalidResponse", message: "Jisho returned an invalid response.")
                )
                return
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                self.complete(
                    context,
                    with: self.failure(code: "http", message: "Jisho returned HTTP \(httpResponse.statusCode).")
                )
                return
            }

            guard
                let data,
                let payload = try? JSONSerialization.jsonObject(with: data),
                payload is [String: Any]
            else {
                self.complete(
                    context,
                    with: self.failure(code: "invalidResponse", message: "Jisho returned an unexpected response.")
                )
                return
            }

            self.complete(context, with: ["ok": true, "payload": payload])
        }.resume()
    }

    private func failure(code: String, message: String) -> [String: Any] {
        ["ok": false, "code": code, "message": message]
    }

    private func complete(_ context: NSExtensionContext, with message: [String: Any]) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: message]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}


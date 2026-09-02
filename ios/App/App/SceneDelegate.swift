import UIKit
import Capacitor
import WebKit

/// The web UI is served from the live site, so with no connection the web view
/// has nothing to render. A separate native window is shown on top instead of a
/// blank page, and the web view reloads once the network returns.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    /// Must match `server.url` in capacitor.config.ts. A load that failed while
    /// offline leaves the web view with no URL, so `reload()` does nothing and
    /// the user is stuck on white — we re-load this address instead.
    private static let serverURL = "https://skanaround.bytenetdigital.com"

    private var splashWindow: UIWindow?
    private var splashTimer: Timer?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        guard let windowScene = scene as? UIWindowScene else { return }
        window = windowScene.windows.first

        showSplash(in: windowScene)

        // Do not put a separate native reachability gate in front of WKWebView.
        // URLSession and network-path probes can disagree with WebKit on real
        // devices (especially while cellular service is settling), leaving an
        // online phone trapped behind a false offline screen. Capacitor loads
        // the live URL directly; the web app owns connection-state messaging.
    }

    deinit {
        splashTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Web view helpers

    private var bridgeWebView: WKWebView? {
        (window?.rootViewController as? CAPBridgeViewController)?.webView
    }

    /// Reload if there is a live document, otherwise start a fresh load — a web
    /// view whose first load failed has nothing to reload.
    private func reloadWeb() {
        guard let webView = bridgeWebView else { return }
        let current = webView.url?.absoluteString ?? ""
        if current.isEmpty || current == "about:blank" {
            if let url = URL(string: Self.serverURL) {
                webView.load(URLRequest(url: url))
            }
        } else {
            webView.reload()
        }

        // If the recovery load never produces content, force the address again.
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self, let webView = self.bridgeWebView else { return }
            if webView.estimatedProgress < 0.1, let url = URL(string: Self.serverURL) {
                webView.load(URLRequest(url: url))
            }
        }
    }

    // MARK: - Splash

    private func showSplash(in windowScene: UIWindowScene) {
        guard splashWindow == nil else { return }

        let host = UIWindow(windowScene: windowScene)
        host.windowLevel = .normal + 1
        let vc = UIViewController()
        let root = vc.view!
        root.backgroundColor = UIColor(red: 0.055, green: 0.047, blue: 0.043, alpha: 1)

        let rings = UIView()
        rings.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(rings)

        for (index, size) in [200.0, 140.0, 84.0].enumerated() {
            let ring = UIView()
            ring.translatesAutoresizingMaskIntoConstraints = false
            ring.layer.cornerRadius = size / 2
            ring.layer.borderWidth = 1
            ring.layer.borderColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 0.12 + 0.09 * Double(index)).cgColor
            rings.addSubview(ring)
            NSLayoutConstraint.activate([
                ring.centerXAnchor.constraint(equalTo: rings.centerXAnchor),
                ring.centerYAnchor.constraint(equalTo: rings.centerYAnchor),
                ring.widthAnchor.constraint(equalToConstant: size),
                ring.heightAnchor.constraint(equalToConstant: size),
            ])
        }

        let dot = UIView()
        dot.translatesAutoresizingMaskIntoConstraints = false
        dot.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1)
        dot.layer.cornerRadius = 8
        dot.layer.shadowColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1).cgColor
        dot.layer.shadowOpacity = 0.8
        dot.layer.shadowRadius = 18
        dot.layer.shadowOffset = .zero
        rings.addSubview(dot)

        let wordmark = UILabel()
        wordmark.attributedText = NSAttributedString(string: "SKANAROUND", attributes: [.kern: 4.0])
        wordmark.font = .systemFont(ofSize: 15, weight: .heavy)
        wordmark.textColor = .white
        wordmark.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(wordmark)

        NSLayoutConstraint.activate([
            rings.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            rings.centerYAnchor.constraint(equalTo: root.centerYAnchor, constant: -20),
            rings.widthAnchor.constraint(equalToConstant: 200),
            rings.heightAnchor.constraint(equalToConstant: 200),

            dot.centerXAnchor.constraint(equalTo: rings.centerXAnchor),
            dot.centerYAnchor.constraint(equalTo: rings.centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 16),
            dot.heightAnchor.constraint(equalToConstant: 16),

            wordmark.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            wordmark.topAnchor.constraint(equalTo: rings.bottomAnchor, constant: 28),
        ])

        UIView.animate(withDuration: 1.2, delay: 0, options: [.repeat, .autoreverse, .curveEaseInOut]) {
            dot.transform = CGAffineTransform(scaleX: 1.6, y: 1.6)
            dot.alpha = 0.55
        }

        host.rootViewController = vc
        host.isHidden = false
        splashWindow = host

        // Dismiss as soon as the web app has painted, with a hard cap so a slow
        // network can never trap the user behind the splash.
        var elapsed = 0.0
        splashTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            elapsed += 0.25
            let ready = (self.bridgeWebView?.estimatedProgress ?? 0) >= 0.9
            if ready || elapsed >= 8 {
                timer.invalidate()
                self.hideSplash()
            }
        }
    }

    private func hideSplash() {
        splashTimer?.invalidate()
        splashTimer = nil
        guard let host = splashWindow else { return }
        UIView.animate(withDuration: 0.35, animations: {
            host.alpha = 0
        }, completion: { _ in
            host.isHidden = true
        })
        splashWindow = nil
    }


    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

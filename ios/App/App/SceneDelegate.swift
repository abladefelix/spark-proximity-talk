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
    private var offlineWindow: UIWindow?
    private var offlineTimer: Timer?


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
            let progress = self.bridgeWebView?.estimatedProgress ?? 0
            if progress >= 0.9 {
                timer.invalidate()
                self.hideSplash()
            } else if elapsed >= 8 {
                timer.invalidate()
                self.hideSplash()
                // The first load produced nothing — rather than leaving a blank
                // web view, show the branded offline screen and keep retrying.
                if progress < 0.1 { self.showOffline() }
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

    // MARK: - Offline screen

    /// Branded "no connection" screen shown only after a load has actually
    /// failed, with a manual retry and an automatic retry loop.
    private func showOffline() {
        guard offlineWindow == nil, let windowScene = window?.windowScene else { return }

        let host = UIWindow(windowScene: windowScene)
        host.windowLevel = .normal + 2
        let vc = UIViewController()
        let root = vc.view!
        root.backgroundColor = UIColor(red: 0.055, green: 0.047, blue: 0.043, alpha: 1)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(stack)

        let mark = UIView()
        mark.translatesAutoresizingMaskIntoConstraints = false
        mark.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1)
        mark.layer.cornerRadius = 8
        mark.widthAnchor.constraint(equalToConstant: 16).isActive = true
        mark.heightAnchor.constraint(equalToConstant: 16).isActive = true

        let ring = UIView()
        ring.translatesAutoresizingMaskIntoConstraints = false
        ring.layer.cornerRadius = 42
        ring.layer.borderWidth = 1
        ring.layer.borderColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 0.25).cgColor
        ring.widthAnchor.constraint(equalToConstant: 84).isActive = true
        ring.heightAnchor.constraint(equalToConstant: 84).isActive = true
        ring.addSubview(mark)
        NSLayoutConstraint.activate([
            mark.centerXAnchor.constraint(equalTo: ring.centerXAnchor),
            mark.centerYAnchor.constraint(equalTo: ring.centerYAnchor),
        ])

        let wordmark = UILabel()
        wordmark.attributedText = NSAttributedString(string: "SKANAROUND", attributes: [.kern: 4.0])
        wordmark.font = .systemFont(ofSize: 13, weight: .heavy)
        wordmark.textColor = .white

        let title = UILabel()
        title.text = "You're offline"
        title.font = .systemFont(ofSize: 19, weight: .semibold)
        title.textColor = .white

        let body = UILabel()
        body.text = "Turn off aeroplane mode or reconnect to the internet — we'll pick things up automatically."
        body.font = .systemFont(ofSize: 14)
        body.textColor = UIColor(white: 1, alpha: 0.65)
        body.numberOfLines = 0
        body.textAlignment = .center

        let retry = UIButton(type: .system)
        retry.setTitle("Try again", for: .normal)
        retry.setTitleColor(UIColor(red: 0.055, green: 0.047, blue: 0.043, alpha: 1), for: .normal)
        retry.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        retry.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1)
        retry.layer.cornerRadius = 10
        retry.contentEdgeInsets = UIEdgeInsets(top: 12, left: 26, bottom: 12, right: 26)
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        stack.addArrangedSubview(ring)
        stack.setCustomSpacing(24, after: ring)
        stack.addArrangedSubview(wordmark)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.setCustomSpacing(24, after: body)
        stack.addArrangedSubview(retry)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: root.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: root.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -32),
        ])

        host.rootViewController = vc
        host.isHidden = false
        offlineWindow = host

        // Keep trying by itself so the user never has to tap anything.
        offlineTimer?.invalidate()
        offlineTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.attemptRecovery()
        }
    }

    @objc private func retryTapped() {
        attemptRecovery()
    }

    /// Reload, then drop the offline screen only once the web view really has
    /// content — a failed retry leaves the screen in place.
    private func attemptRecovery() {
        guard offlineWindow != nil else { return }
        reloadWeb()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self else { return }
            if (self.bridgeWebView?.estimatedProgress ?? 0) >= 0.5 {
                self.hideOffline()
            }
        }
    }

    private func hideOffline() {
        offlineTimer?.invalidate()
        offlineTimer = nil
        guard let host = offlineWindow else { return }
        offlineWindow = nil
        UIView.animate(withDuration: 0.3, animations: {
            host.alpha = 0
        }, completion: { _ in
            host.isHidden = true
        })
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        if offlineWindow != nil { attemptRecovery() }
    }




    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

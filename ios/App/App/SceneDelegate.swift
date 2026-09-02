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

    /// Separate window kept above the Capacitor window so the offline screen is
    /// never replaced by the bridge's own view controller setup.
    private var offlineWindow: UIWindow?
    private var splashWindow: UIWindow?
    private var splashTimer: Timer?
    private var wasOffline = false
    private weak var statusLabel: UILabel?
    private weak var retryButton: UIButton?
    private weak var pulseView: UIView?

    /// A satisfied network path only means an interface is up — a Wi-Fi router
    /// with no upstream still reports `.satisfied`. Everything below decides
    /// offline state from an actual request to the site instead.
    private var probing = false
    private var consecutiveProbeFailures = 0
    private lazy var probeSession: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 6
        config.timeoutIntervalForResource = 6
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()

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

    // MARK: - Reachability

    /// Cheap request against the site itself; any response at all means the
    /// device can reach the internet.
    private func probeReachability(_ completion: @escaping (Bool) -> Void) {
        guard var components = URLComponents(string: Self.serverURL + "/favicon.png") else {
            return completion(false)
        }
        components.queryItems = [URLQueryItem(name: "native_ping", value: UUID().uuidString)]
        guard let url = components.url else { return completion(false) }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 6
        probeSession.dataTask(with: request) { _, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            // Any HTTP response proves that DNS, TLS and the internet path work.
            let ok = error == nil && status > 0
            DispatchQueue.main.async { completion(ok) }
        }.resume()
    }

    @objc private func evaluateConnectivity() {
        guard !probing else { return }
        probing = true
        probeReachability { [weak self] ok in
            guard let self else { return }
            self.probing = false
            if ok {
                self.consecutiveProbeFailures = 0
                self.applyConnectivity(online: true)
                return
            }

            self.consecutiveProbeFailures += 1
            // Avoid covering a usable web view because of one transient timeout.
            // Retry immediately when the native offline screen is already open.
            if self.offlineWindow != nil || self.consecutiveProbeFailures >= 2 {
                self.applyConnectivity(online: false)
            }
        }
    }

    private func applyConnectivity(online: Bool) {
        guard let windowScene = window?.windowScene ?? (UIApplication.shared.connectedScenes.first as? UIWindowScene) else { return }
        if online {
            hideOffline(reload: wasOffline)
            wasOffline = false
        } else {
            wasOffline = true
            hideSplash()
            showOffline(in: windowScene)
        }
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


    private func showOffline(in windowScene: UIWindowScene) {
        guard offlineWindow == nil else { return }

        let host = UIWindow(windowScene: windowScene)
        host.windowLevel = .alert + 1
        let vc = UIViewController()
        let root = vc.view!
        root.backgroundColor = UIColor(red: 0.055, green: 0.047, blue: 0.043, alpha: 1)

        // Warm ambient glow behind the radar mark.
        let glow = UIView()
        glow.translatesAutoresizingMaskIntoConstraints = false
        glow.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 0.10)
        glow.layer.cornerRadius = 150
        root.addSubview(glow)

        // Radar rings — concentric, fading outward.
        let rings = UIView()
        rings.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(rings)

        for (index, size) in [220.0, 160.0, 100.0].enumerated() {
            let ring = UIView()
            ring.translatesAutoresizingMaskIntoConstraints = false
            ring.layer.cornerRadius = size / 2
            ring.layer.borderWidth = 1
            ring.layer.borderColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 0.10 + 0.08 * Double(index)).cgColor
            rings.addSubview(ring)
            NSLayoutConstraint.activate([
                ring.centerXAnchor.constraint(equalTo: rings.centerXAnchor),
                ring.centerYAnchor.constraint(equalTo: rings.centerYAnchor),
                ring.widthAnchor.constraint(equalToConstant: size),
                ring.heightAnchor.constraint(equalToConstant: size),
            ])
        }

        // Centre dot with a slow breathing pulse.
        let dot = UIView()
        dot.translatesAutoresizingMaskIntoConstraints = false
        dot.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1)
        dot.layer.cornerRadius = 9
        dot.layer.shadowColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1).cgColor
        dot.layer.shadowOpacity = 0.7
        dot.layer.shadowRadius = 16
        dot.layer.shadowOffset = .zero
        rings.addSubview(dot)
        pulseView = dot

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false

        let kicker = UILabel()
        kicker.attributedText = NSAttributedString(string: "NO SIGNAL", attributes: [.kern: 3.0])
        kicker.font = .systemFont(ofSize: 11, weight: .heavy)
        kicker.textColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 0.85)

        let title = UILabel()
        title.text = "You're off the radar"
        title.font = .systemFont(ofSize: 26, weight: .bold)
        title.textColor = .white
        title.textAlignment = .center

        let body = UILabel()
        body.text = "SKANAROUND can't reach the internet.\nCheck your Wi-Fi or mobile data and try again."
        body.numberOfLines = 0
        body.textAlignment = .center
        body.font = .systemFont(ofSize: 15)
        body.textColor = UIColor(white: 1, alpha: 0.52)

        let status = UILabel()
        status.text = " "
        status.font = .systemFont(ofSize: 13, weight: .medium)
        status.textColor = UIColor(red: 1.0, green: 0.55, blue: 0.45, alpha: 1)
        status.textAlignment = .center
        status.alpha = 0
        statusLabel = status

        let retry = UIButton(type: .system)
        retry.setTitle("Try again", for: .normal)
        retry.setTitleColor(UIColor(red: 0.09, green: 0.08, blue: 0.07, alpha: 1), for: .normal)
        retry.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        retry.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1)
        retry.layer.cornerRadius = 26
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        retry.translatesAutoresizingMaskIntoConstraints = false
        retry.heightAnchor.constraint(equalToConstant: 52).isActive = true
        retry.widthAnchor.constraint(equalToConstant: 200).isActive = true
        retryButton = retry

        stack.addArrangedSubview(kicker)
        stack.setCustomSpacing(14, after: kicker)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.setCustomSpacing(18, after: body)
        stack.addArrangedSubview(status)
        stack.setCustomSpacing(14, after: status)
        stack.addArrangedSubview(retry)

        root.addSubview(stack)
        NSLayoutConstraint.activate([
            glow.centerXAnchor.constraint(equalTo: rings.centerXAnchor),
            glow.centerYAnchor.constraint(equalTo: rings.centerYAnchor),
            glow.widthAnchor.constraint(equalToConstant: 300),
            glow.heightAnchor.constraint(equalToConstant: 300),

            rings.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            rings.bottomAnchor.constraint(equalTo: stack.topAnchor, constant: -44),
            rings.widthAnchor.constraint(equalToConstant: 220),
            rings.heightAnchor.constraint(equalToConstant: 220),

            dot.centerXAnchor.constraint(equalTo: rings.centerXAnchor),
            dot.centerYAnchor.constraint(equalTo: rings.centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 18),
            dot.heightAnchor.constraint(equalToConstant: 18),

            stack.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: root.centerYAnchor, constant: 80),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: root.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -32),
        ])

        UIView.animate(withDuration: 1.4, delay: 0, options: [.repeat, .autoreverse, .curveEaseInOut]) {
            dot.transform = CGAffineTransform(scaleX: 1.5, y: 1.5)
            dot.alpha = 0.6
        }

        host.rootViewController = vc
        host.isHidden = false
        offlineWindow = host
    }

    private func hideOffline(reload: Bool) {
        if let host = offlineWindow {
            host.isHidden = true
            offlineWindow = nil
            statusLabel = nil
            retryButton = nil
            pulseView = nil
        }
        if reload {
            if let windowScene = window?.windowScene {
                showSplash(in: windowScene)
            }
            reloadWeb()
        }
    }


    /// Only dismiss the offline screen when the network is actually back —
    /// otherwise reloading leaves a blank web view behind the dismissed overlay.
    @objc private func retryTapped() {
        guard !probing else { return }
        statusLabel?.text = "Checking connection…"
        statusLabel?.textColor = UIColor(white: 1, alpha: 0.6)
        UIView.animate(withDuration: 0.2) { self.statusLabel?.alpha = 1 }

        probing = true
        retryButton?.isEnabled = false
        probeReachability { [weak self] ok in
            guard let self else { return }
            self.probing = false
            self.retryButton?.isEnabled = true
            if ok {
                self.consecutiveProbeFailures = 0
                self.hideOffline(reload: true)
                self.wasOffline = false
            } else {
                self.failRetry()
            }
        }
    }

    private func failRetry() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        statusLabel?.text = "Still no connection"
        statusLabel?.textColor = UIColor(red: 1.0, green: 0.55, blue: 0.45, alpha: 1)
        UIView.animate(withDuration: 0.2) { self.statusLabel?.alpha = 1 }

        guard let button = retryButton else { return }
        let shake = CAKeyframeAnimation(keyPath: "transform.translation.x")
        shake.values = [0, -8, 8, -6, 6, 0]
        shake.duration = 0.35
        button.layer.add(shake, forKey: "shake")

    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

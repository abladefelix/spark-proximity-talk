import UIKit
import Capacitor
import Network
import WebKit

/// The web UI is served from the live site, so with no connection the web view
/// has nothing to render. A separate native window is shown on top instead of a
/// blank page, and the web view reloads once the network returns.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    /// Separate window kept above the Capacitor window so the offline screen is
    /// never replaced by the bridge's own view controller setup.
    private var offlineWindow: UIWindow?
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "app.skanaround.network")
    private var wasOffline = false
    private weak var statusLabel: UILabel?
    private weak var retryButton: UIButton?
    private weak var pulseView: UIView?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        guard let windowScene = scene as? UIWindowScene else { return }
        window = windowScene.windows.first

        monitor.pathUpdateHandler = { [weak self, weak windowScene] path in
            DispatchQueue.main.async {
                guard let self, let windowScene else { return }
                if path.status == .satisfied {
                    self.hideOffline(reload: self.wasOffline)
                    self.wasOffline = false
                } else {
                    self.wasOffline = true
                    self.showOffline(in: windowScene)
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    deinit { monitor.cancel() }

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
        body.text = "SkanAround can't reach the network.\nTurn off airplane mode or reconnect to Wi-Fi."
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
        if reload, let bridgeVC = window?.rootViewController as? CAPBridgeViewController {
            bridgeVC.webView?.reload()
        }
    }

    /// Only dismiss the offline screen when the network is actually back —
    /// otherwise reloading leaves a blank web view behind the dismissed overlay.
    @objc private func retryTapped() {
        if monitor.currentPath.status == .satisfied {
            hideOffline(reload: true)
            wasOffline = false
            return
        }

        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        statusLabel?.text = "Still no connection"
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

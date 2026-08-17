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
        vc.view.backgroundColor = UIColor(red: 0.078, green: 0.071, blue: 0.063, alpha: 1)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        let title = UILabel()
        title.text = "You're offline"
        title.font = .systemFont(ofSize: 22, weight: .semibold)
        title.textColor = .white

        let body = UILabel()
        body.text = "SkanAround needs an internet connection.\nTurn off airplane mode or reconnect to Wi-Fi."
        body.numberOfLines = 0
        body.textAlignment = .center
        body.font = .systemFont(ofSize: 15)
        body.textColor = UIColor(white: 1, alpha: 0.6)

        let retry = UIButton(type: .system)
        retry.setTitle("Try again", for: .normal)
        retry.setTitleColor(UIColor(red: 0.09, green: 0.08, blue: 0.07, alpha: 1), for: .normal)
        retry.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        retry.backgroundColor = UIColor(red: 0.98, green: 0.76, blue: 0.35, alpha: 1)
        retry.layer.cornerRadius = 22
        retry.contentEdgeInsets = UIEdgeInsets(top: 12, left: 28, bottom: 12, right: 28)
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.setCustomSpacing(24, after: body)
        stack.addArrangedSubview(retry)

        vc.view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: vc.view.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: vc.view.trailingAnchor, constant: -32),
        ])

        host.rootViewController = vc
        host.isHidden = false
        offlineWindow = host
    }

    private func hideOffline(reload: Bool) {
        if let host = offlineWindow {
            host.isHidden = true
            offlineWindow = nil
        }
        if reload, let bridgeVC = window?.rootViewController as? CAPBridgeViewController {
            bridgeVC.webView?.reload()
        }
    }

    @objc private func retryTapped() {
        hideOffline(reload: true)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

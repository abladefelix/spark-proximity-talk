import UIKit
import Capacitor
import Network
import WebKit

/// The web UI is served from the live site, so with no connection the web view
/// has nothing to render. This controller puts a native "no internet" screen on
/// top instead of a blank page, and reloads the app once the network returns.
class OfflineBridgeViewController: CAPBridgeViewController {

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "app.skanaround.network")
    private var overlay: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                if path.status == .satisfied {
                    self?.hideOffline(reload: true)
                } else {
                    self?.showOffline()
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    deinit { monitor.cancel() }

    private func showOffline() {
        guard overlay == nil else { return }

        let container = UIView(frame: view.bounds)
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.backgroundColor = UIColor(red: 0.078, green: 0.071, blue: 0.063, alpha: 1)

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

        container.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -32),
        ])

        view.addSubview(container)
        overlay = container
    }

    private func hideOffline(reload: Bool) {
        guard let container = overlay else { return }
        container.removeFromSuperview()
        overlay = nil
        if reload { webView?.reload() }
    }

    @objc private func retryTapped() {
        hideOffline(reload: true)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = OfflineBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

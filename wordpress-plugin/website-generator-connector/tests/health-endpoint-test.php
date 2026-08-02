<?php

define('ABSPATH', __DIR__.'/wordpress/');
define('WEBSITE_GENERATOR_CONNECTOR_VERSION', '1.0.0');
define('ELEMENTOR_VERSION', '3.30.0');

class WP_REST_Controller {}
class WP_REST_Server { public const READABLE = 'GET'; public const CREATABLE = 'POST'; }
class WP_Error { public function __construct(public string $code, public string $message, public array $data) {} }
class WP_REST_Response { public function __construct(public array $data, public int $status) {} }
class WP_REST_Request {
    public function __construct(private array $headers = []) {}
    public function get_header(string $name): string { return $this->headers[$name] ?? ''; }
}

$GLOBALS['routes'] = [];
$GLOBALS['token_hash'] = '';
$GLOBALS['elementor_active'] = true;
function register_rest_route($namespace, $route, $definition): void { $GLOBALS['routes'][$namespace.$route] = $definition; }
function get_option(): string { return $GLOBALS['token_hash']; }
function wp_check_password($token, $hash): bool { return hash_equals($hash, hash('sha256', $token)); }
function did_action(): int { return $GLOBALS['elementor_active'] ? 1 : 0; }
function get_plugins(): array { return ['elementor/elementor.php' => ['Version' => '3.30.0']]; }
function is_plugin_active(): bool { return $GLOBALS['elementor_active']; }
function get_bloginfo(): string { return '6.8'; }
function site_url(): string { return 'https://example.test'; }
function __($message): string { return $message; }
function is_user_logged_in(): bool { return false; }

require dirname(__DIR__).'/includes/class-sitefoundry-connector-token.php';
require dirname(__DIR__).'/includes/class-website-generator-rest-controller.php';

$controller = new Website_Generator_REST_Controller();
$controller->register_routes();
assert(isset($GLOBALS['routes']['website-generator/v1/health']));
assert($controller->connector_permissions_check(new WP_REST_Request()) instanceof WP_Error);
assert($controller->connector_permissions_check(new WP_REST_Request(['authorization' => 'Bearer invalid'])) instanceof WP_Error);
$GLOBALS['token_hash'] = hash('sha256', 'valid');
assert(true === $controller->connector_permissions_check(new WP_REST_Request(['authorization' => 'Bearer valid'])));
$response = $controller->health();
assert(200 === $response->status && true === $response->data['connected']);
assert(true === $response->data['elementor']['active']);
assert(false === str_contains(json_encode($response->data), 'valid'));
$GLOBALS['elementor_active'] = false;
$inactive = $controller->health();
assert(false === $inactive->data['connected']);
assert('elementor_inactive' === $inactive->data['error']['code']);

echo "Health endpoint tests passed.\n";

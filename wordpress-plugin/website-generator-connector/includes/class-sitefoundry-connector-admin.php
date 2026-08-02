<?php
/**
 * SiteFoundry administration screen.
 */

defined('ABSPATH') || exit;

final class SiteFoundry_Connector_Admin
{
    private const PAGE = 'sitefoundry-connector';
    private const TOKEN_ACTION = 'sitefoundry_connector_token';
    private const HEALTH_ACTION = 'sitefoundry_connector_health';
    private const TOKEN_NOTICE = 'sitefoundry_connector_token_notice_';
    private static string $plugin_file;

    public static function init(string $plugin_file): void
    {
        self::$plugin_file = $plugin_file;
        add_action('admin_menu', [self::class, 'register_menu']);
        add_action('admin_post_sitefoundry_connector_token', [self::class, 'handle_token_action']);
        add_action('admin_post_sitefoundry_connector_health', [self::class, 'handle_health_test']);
        add_filter('plugin_action_links_' . plugin_basename($plugin_file), [self::class, 'settings_link']);
    }

    public static function register_menu(): void
    {
        add_menu_page(
            __('SiteFoundry', 'website-generator-connector'),
            __('SiteFoundry', 'website-generator-connector'),
            'manage_options',
            self::PAGE,
            [self::class, 'render_page'],
            'dashicons-admin-links',
            80
        );
    }

    public static function settings_link(array $links): array
    {
        $url = admin_url('admin.php?page=' . self::PAGE);
        array_unshift($links, '<a href="' . esc_url($url) . '">' . esc_html__('Settings', 'website-generator-connector') . '</a>');
        return $links;
    }

    public static function handle_token_action(): void
    {
        self::authorize(self::TOKEN_ACTION);
        $operation = isset($_POST['operation']) ? sanitize_key(wp_unslash($_POST['operation'])) : '';
        if ('revoke' === $operation) {
            SiteFoundry_Connector_Token::revoke();
        } elseif (in_array($operation, ['generate', 'regenerate'], true)) {
            $token = SiteFoundry_Connector_Token::generate();
            set_transient(self::TOKEN_NOTICE . get_current_user_id(), $token, 5 * MINUTE_IN_SECONDS);
        }
        self::redirect();
    }

    public static function handle_health_test(): void
    {
        self::authorize(self::HEALTH_ACTION);
        $server = rest_get_server();
        $routes = $server->get_routes();
        $results = [
            'rest' => isset($routes['/']),
            'routes' => isset($routes['/website-generator/v1/status']),
            'elementor_installed' => self::elementor_installed(),
            'elementor_active' => self::elementor_active(),
            'capabilities' => current_user_can('manage_options'),
        ];
        update_option('sitefoundry_connector_last_test', ['time' => time(), 'results' => $results], false);
        self::redirect();
    }

    private static function authorize(string $action): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You are not allowed to manage SiteFoundry settings.', 'website-generator-connector'), '', ['response' => 403]);
        }
        check_admin_referer($action);
    }

    private static function redirect(): void
    {
        wp_safe_redirect(admin_url('admin.php?page=' . self::PAGE));
        exit;
    }

    private static function elementor_installed(): bool
    {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        return isset(get_plugins()['elementor/elementor.php']);
    }

    private static function elementor_active(): bool
    {
        return did_action('elementor/loaded') > 0 || defined('ELEMENTOR_VERSION');
    }

    private static function yes_no(bool $value): string
    {
        return $value ? __('Yes', 'website-generator-connector') : __('No', 'website-generator-connector');
    }

    private static function date_value($timestamp): string
    {
        return $timestamp ? wp_date(get_option('date_format') . ' ' . get_option('time_format'), (int) $timestamp) : __('Never', 'website-generator-connector');
    }

    public static function render_page(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You are not allowed to manage SiteFoundry settings.', 'website-generator-connector'), '', ['response' => 403]);
        }
        $last_test = get_option('sitefoundry_connector_last_test', []);
        $results = is_array($last_test) && isset($last_test['results']) && is_array($last_test['results']) ? $last_test['results'] : [];
        $token = get_transient(self::TOKEN_NOTICE . get_current_user_id());
        if (is_string($token) && '' !== $token) {
            delete_transient(self::TOKEN_NOTICE . get_current_user_id());
        } else {
            $token = '';
        }
        $token_exists = SiteFoundry_Connector_Token::exists();
        $endpoint = rest_url('website-generator/v1/status');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('SiteFoundry Connector', 'website-generator-connector'); ?></h1>
            <?php if ($token) : ?>
                <div class="notice notice-success"><p><strong><?php echo esc_html__('Copy this token now. It will not be shown again.', 'website-generator-connector'); ?></strong></p>
                    <p><input id="sitefoundry-token" class="regular-text code" type="text" readonly value="<?php echo esc_attr($token); ?>"> <button type="button" class="button" onclick="navigator.clipboard.writeText(document.getElementById('sitefoundry-token').value)"><?php echo esc_html__('Copy token', 'website-generator-connector'); ?></button></p>
                </div>
            <?php endif; ?>

            <h2><?php echo esc_html__('Status', 'website-generator-connector'); ?></h2>
            <table class="widefat striped"><tbody>
                <?php
                $status = [
                    __('Plugin version', 'website-generator-connector') => WEBSITE_GENERATOR_CONNECTOR_VERSION,
                    __('Connection status', 'website-generator-connector') => $token_exists ? __('Ready', 'website-generator-connector') : __('Token required', 'website-generator-connector'),
                    __('WordPress REST API status', 'website-generator-connector') => isset($results['rest']) ? self::yes_no((bool) $results['rest']) : __('Not tested', 'website-generator-connector'),
                    __('Elementor installed', 'website-generator-connector') => self::yes_no(self::elementor_installed()),
                    __('Elementor active', 'website-generator-connector') => self::yes_no(self::elementor_active()),
                    __('Elementor version', 'website-generator-connector') => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : __('Unavailable', 'website-generator-connector'),
                    __('Site URL', 'website-generator-connector') => site_url(),
                    __('WordPress version', 'website-generator-connector') => get_bloginfo('version'),
                    __('PHP version', 'website-generator-connector') => PHP_VERSION,
                    __('Last connection test', 'website-generator-connector') => self::date_value($last_test['time'] ?? 0),
                    __('Last deployment', 'website-generator-connector') => self::date_value(get_option('sitefoundry_connector_last_deployment', 0)),
                    __('Connector token status', 'website-generator-connector') => $token_exists ? __('Active', 'website-generator-connector') : __('Not generated', 'website-generator-connector'),
                ];
                foreach ($status as $label => $value) : ?>
                    <tr><th scope="row"><?php echo esc_html($label); ?></th><td><?php echo esc_html((string) $value); ?></td></tr>
                <?php endforeach; ?>
            </tbody></table>

            <h2><?php echo esc_html__('Connector Token', 'website-generator-connector'); ?></h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="sitefoundry_connector_token">
                <?php wp_nonce_field(self::TOKEN_ACTION); ?>
                <?php if ($token_exists) : ?>
                    <button class="button button-primary" name="operation" value="regenerate"><?php echo esc_html__('Regenerate token', 'website-generator-connector'); ?></button>
                    <button class="button" name="operation" value="revoke"><?php echo esc_html__('Revoke token', 'website-generator-connector'); ?></button>
                <?php else : ?>
                    <button class="button button-primary" name="operation" value="generate"><?php echo esc_html__('Generate token', 'website-generator-connector'); ?></button>
                <?php endif; ?>
            </form>

            <h2><?php echo esc_html__('Connection Health', 'website-generator-connector'); ?></h2>
            <?php if ($results) : ?><ul>
                <?php foreach ([
                    'rest' => __('REST API reachable', 'website-generator-connector'), 'routes' => __('Plugin routes registered', 'website-generator-connector'),
                    'elementor_installed' => __('Elementor installed', 'website-generator-connector'), 'elementor_active' => __('Elementor active', 'website-generator-connector'),
                    'capabilities' => __('Required WordPress capabilities available', 'website-generator-connector'),
                ] as $key => $label) : ?>
                    <li><strong><?php echo !empty($results[$key]) ? '✓' : '✕'; ?></strong> <?php echo esc_html($label); ?> — <?php echo esc_html(!empty($results[$key]) ? __('Success', 'website-generator-connector') : __('Error', 'website-generator-connector')); ?></li>
                <?php endforeach; ?>
            </ul><?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="sitefoundry_connector_health"><?php wp_nonce_field(self::HEALTH_ACTION); ?>
                <button class="button button-primary"><?php echo esc_html__('Run connection health test', 'website-generator-connector'); ?></button>
            </form>

            <h2><?php echo esc_html__('Connection Details', 'website-generator-connector'); ?></h2>
            <table class="widefat striped"><tbody>
                <tr><th><?php echo esc_html__('WordPress site URL', 'website-generator-connector'); ?></th><td><code><?php echo esc_html(site_url()); ?></code></td></tr>
                <tr><th><?php echo esc_html__('Connector endpoint URL', 'website-generator-connector'); ?></th><td><code><?php echo esc_html($endpoint); ?></code></td></tr>
                <tr><th><?php echo esc_html__('Plugin version', 'website-generator-connector'); ?></th><td><?php echo esc_html(WEBSITE_GENERATOR_CONNECTOR_VERSION); ?></td></tr>
                <tr><th><?php echo esc_html__('Token status', 'website-generator-connector'); ?></th><td><?php echo esc_html($token_exists ? __('Active', 'website-generator-connector') : __('Not generated', 'website-generator-connector')); ?></td></tr>
            </tbody></table>
            <p><?php echo esc_html__('Generate a connector token, copy it when it appears, and paste it into your site connection in SiteFoundry. The token cannot be viewed again.', 'website-generator-connector'); ?></p>
        </div>
        <?php
    }
}

<?php
/**
 * Plugin Name: SiteFoundry Connector
 * Description: Authenticated SiteFoundry deployment endpoints for WordPress and Elementor.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Requires Plugins: elementor
 * Author: SiteFoundry
 * License: GPL-2.0-or-later
 */

defined('ABSPATH') || exit;
define('WEBSITE_GENERATOR_CONNECTOR_VERSION', '1.0.0');
register_activation_hook(__FILE__, static function (): void {
    if (version_compare(PHP_VERSION, '8.1', '<') || version_compare(get_bloginfo('version'), '6.5', '<')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(esc_html__('SiteFoundry Connector requires WordPress 6.5+ and PHP 8.1+.', 'website-generator-connector'));
    }
    update_option('sitefoundry_connector_schema_version', '1');
});
require_once __DIR__ . '/includes/class-website-generator-rest-controller.php';
add_action('rest_api_init', static function (): void {
    (new Website_Generator_REST_Controller())->register_routes();
});

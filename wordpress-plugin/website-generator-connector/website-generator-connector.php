<?php
/**
 * Plugin Name: Website Generator Connector
 * Description: Authenticated deployment endpoints for Website Generator and Elementor.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: Website Generator
 * License: GPL-2.0-or-later
 */

defined('ABSPATH') || exit;
define('WEBSITE_GENERATOR_CONNECTOR_VERSION', '0.1.0');
require_once __DIR__ . '/includes/class-website-generator-rest-controller.php';
add_action('rest_api_init', static function (): void {
    (new Website_Generator_REST_Controller())->register_routes();
});

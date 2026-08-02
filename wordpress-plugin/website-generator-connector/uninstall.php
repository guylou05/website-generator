<?php
defined('WP_UNINSTALL_PLUGIN') || exit;
// Customer pages, media, menus, and settings are preserved by default.
if (defined('SITEFOUNDRY_CONNECTOR_REMOVE_SETTINGS') && SITEFOUNDRY_CONNECTOR_REMOVE_SETTINGS === true) {
    delete_option('sitefoundry_connector_schema_version');
    delete_option('sitefoundry_connector_token_hash');
    delete_option('sitefoundry_connector_last_test');
    delete_option('sitefoundry_connector_last_deployment');
}

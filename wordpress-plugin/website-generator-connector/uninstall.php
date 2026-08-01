<?php
defined('WP_UNINSTALL_PLUGIN') || exit;
// Customer pages, media, menus, and settings are preserved by default.
if (defined('SITEFOUNDRY_CONNECTOR_REMOVE_SETTINGS') && SITEFOUNDRY_CONNECTOR_REMOVE_SETTINGS === true) {
    delete_option('sitefoundry_connector_schema_version');
}

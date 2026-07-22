<?php

defined('ABSPATH') || exit;

final class Website_Generator_REST_Controller extends WP_REST_Controller
{
    protected $namespace = 'website-generator/v1';

    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/status', [
            'methods' => WP_REST_Server::READABLE, 'callback' => [$this, 'status'], 'permission_callback' => [$this, 'permissions_check'],
        ]);
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/elementor', [
            'methods' => WP_REST_Server::CREATABLE, 'callback' => [$this, 'save_elementor'],
            'permission_callback' => [$this, 'permissions_check'], 'args' => ['id' => $this->id_arg(), 'data' => ['required' => true, 'validate_callback' => [$this, 'is_array']], 'settings' => ['default' => [], 'validate_callback' => [$this, 'is_array']], 'version' => ['default' => '0.4', 'sanitize_callback' => 'sanitize_text_field']],
        ]);
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/css', [
            'methods' => WP_REST_Server::CREATABLE, 'callback' => [$this, 'update_css_metadata'], 'permission_callback' => [$this, 'permissions_check'], 'args' => ['id' => $this->id_arg()],
        ]);
        register_rest_route($this->namespace, '/elementor/regenerate-css', [
            'methods' => WP_REST_Server::CREATABLE, 'callback' => [$this, 'regenerate_css'], 'permission_callback' => [$this, 'permissions_check'],
        ]);
        register_rest_route($this->namespace, '/pages/(?P<id>\d+)/template', [
            'methods' => WP_REST_Server::CREATABLE, 'callback' => [$this, 'set_template'], 'permission_callback' => [$this, 'permissions_check'],
            'args' => ['id' => $this->id_arg(), 'template' => ['required' => true, 'sanitize_callback' => 'sanitize_key', 'validate_callback' => [$this, 'valid_template']]],
        ]);
        register_rest_route($this->namespace, '/menus', [
            'methods' => WP_REST_Server::CREATABLE, 'callback' => [$this, 'upsert_menu'], 'permission_callback' => [$this, 'permissions_check'],
            'args' => ['name' => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'], 'items' => ['required' => true, 'validate_callback' => [$this, 'is_array']]],
        ]);
        register_rest_route($this->namespace, '/settings/homepage', [
            'methods' => WP_REST_Server::CREATABLE, 'callback' => [$this, 'set_homepage'], 'permission_callback' => [$this, 'permissions_check'],
            'args' => ['page_id' => ['required' => true, 'sanitize_callback' => 'absint', 'validate_callback' => [$this, 'valid_page']]],
        ]);
    }

    public function status(): WP_REST_Response
    {
        return new WP_REST_Response([
            'wordpress' => ['available' => true, 'version' => get_bloginfo('version')],
            'connector' => ['available' => true, 'version' => defined('WEBSITE_GENERATOR_CONNECTOR_VERSION') ? WEBSITE_GENERATOR_CONNECTOR_VERSION : 'unknown'],
            'elementor' => ['available' => did_action('elementor/loaded') > 0, 'version' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : null],
        ], 200);
    }

    public function permissions_check(): bool|WP_Error
    {
        if (!is_user_logged_in()) return new WP_Error('rest_not_authenticated', __('Authentication is required.', 'website-generator-connector'), ['status' => 401]);
        if (!current_user_can('manage_options')) return new WP_Error('rest_forbidden', __('Administrator capabilities are required.', 'website-generator-connector'), ['status' => 403]);
        return true;
    }

    public function save_elementor(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $post = $this->page_or_error((int) $request['id']);
        if (is_wp_error($post)) return $post;
        $data = $this->sanitize_recursive($request->get_param('data'));
        $settings = $this->sanitize_recursive($request->get_param('settings'));
        $encoded = wp_json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (false === $encoded) return new WP_Error('invalid_elementor_data', __('Elementor data could not be encoded.', 'website-generator-connector'), ['status' => 400]);
        update_post_meta($post->ID, '_elementor_data', wp_slash($encoded));
        update_post_meta($post->ID, '_elementor_page_settings', $settings);
        update_post_meta($post->ID, '_elementor_edit_mode', 'builder');
        update_post_meta($post->ID, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : sanitize_text_field((string) $request->get_param('version')));
        clean_post_cache($post->ID);
        return new WP_REST_Response(['success' => true, 'pageId' => $post->ID], 200);
    }

    public function update_css_metadata(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $post = $this->page_or_error((int) $request['id']);
        if (is_wp_error($post)) return $post;
        delete_post_meta($post->ID, '_elementor_css');
        update_post_meta($post->ID, '_elementor_css_time', time());
        return new WP_REST_Response(['success' => true, 'pageId' => $post->ID], 200);
    }

    public function regenerate_css(): WP_REST_Response|WP_Error
    {
        if (!did_action('elementor/loaded') || !class_exists('Elementor\\Plugin')) return new WP_Error('elementor_unavailable', __('Elementor must be active to regenerate CSS.', 'website-generator-connector'), ['status' => 409]);
        Elementor\Plugin::$instance->files_manager->clear_cache();
        return new WP_REST_Response(['success' => true], 200);
    }

    public function set_template(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $post = $this->page_or_error((int) $request['id']);
        if (is_wp_error($post)) return $post;
        update_post_meta($post->ID, '_wp_page_template', sanitize_key((string) $request['template']));
        return new WP_REST_Response(['success' => true, 'pageId' => $post->ID], 200);
    }

    public function upsert_menu(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $name = sanitize_text_field((string) $request['name']);
        if ('' === $name) return new WP_Error('invalid_menu_name', __('A menu name is required.', 'website-generator-connector'), ['status' => 400]);
        $menu = wp_get_nav_menu_object($name);
        $action = $menu ? 'updated' : 'created';
        $menu_id = $menu ? (int) $menu->term_id : wp_create_nav_menu($name);
        if (is_wp_error($menu_id)) return $menu_id;
        $existing = [];
        foreach ((array) wp_get_nav_menu_items($menu_id, ['post_status' => 'any']) as $item) {
            $key = (string) get_post_meta($item->ID, '_website_generator_key', true);
            if ($key) $existing[$key] = (int) $item->ID;
        }
        $resolved = [];
        $seen = [];
        foreach ((array) $request->get_param('items') as $raw) {
            if (!is_array($raw)) continue;
            $key = sanitize_key((string) ($raw['key'] ?? ''));
            $title = sanitize_text_field((string) ($raw['title'] ?? ''));
            if (!$key || !$title || isset($seen[$key])) continue;
            $seen[$key] = true;
            $page_id = absint($raw['pageId'] ?? 0);
            $parent_key = sanitize_key((string) ($raw['parentKey'] ?? ''));
            $args = ['menu-item-title' => $title, 'menu-item-status' => 'publish', 'menu-item-parent-id' => $resolved[$parent_key] ?? 0];
            if ($page_id && 'page' === get_post_type($page_id)) $args += ['menu-item-object-id' => $page_id, 'menu-item-object' => 'page', 'menu-item-type' => 'post_type'];
            else {
                $url = esc_url_raw((string) ($raw['url'] ?? ''));
                if (str_starts_with((string) ($raw['url'] ?? ''), '/')) $url = esc_url_raw(home_url((string) $raw['url']));
                if (!$url) continue;
                $args += ['menu-item-url' => $url, 'menu-item-type' => 'custom'];
            }
            $item_id = wp_update_nav_menu_item($menu_id, $existing[$key] ?? 0, $args);
            if (is_wp_error($item_id)) return $item_id;
            update_post_meta($item_id, '_website_generator_key', $key);
            $resolved[$key] = (int) $item_id;
        }
        foreach ($existing as $key => $item_id) if (!isset($seen[$key])) wp_delete_post($item_id, true);
        return new WP_REST_Response(['id' => (int) $menu_id, 'name' => $name, 'slug' => sanitize_title($name), 'action' => $action], 200);
    }

    public function set_homepage(WP_REST_Request $request): WP_REST_Response
    {
        $page_id = absint($request['page_id']);
        update_option('show_on_front', 'page');
        update_option('page_on_front', $page_id);
        return new WP_REST_Response(['success' => true, 'pageId' => $page_id], 200);
    }

    public function is_array(mixed $value): bool { return is_array($value); }
    public function valid_template(string $value): bool { return in_array($value, ['default', 'elementor_canvas', 'elementor_header_footer'], true); }
    public function valid_page(mixed $value): bool { return 'page' === get_post_type(absint($value)); }
    private function id_arg(): array { return ['required' => true, 'sanitize_callback' => 'absint', 'validate_callback' => [$this, 'valid_page']]; }
    private function page_or_error(int $id): WP_Post|WP_Error { $post = get_post($id); return $post && 'page' === $post->post_type ? $post : new WP_Error('page_not_found', __('Page not found.', 'website-generator-connector'), ['status' => 404]); }
    private function sanitize_recursive(mixed $value): mixed
    {
        if (is_array($value)) { $clean = []; foreach ($value as $key => $item) $clean[is_int($key) ? $key : sanitize_key((string) $key)] = $this->sanitize_recursive($item); return $clean; }
        if (is_string($value)) return sanitize_textarea_field($value);
        if (is_bool($value) || is_int($value) || is_float($value) || null === $value) return $value;
        return null;
    }
}

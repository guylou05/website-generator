<?php
/**
 * Connector token storage and verification.
 */

defined('ABSPATH') || exit;

final class SiteFoundry_Connector_Token
{
    private const OPTION = 'sitefoundry_connector_token_hash';

    public static function generate(): string
    {
        $token = 'sf_' . bin2hex(random_bytes(32));
        update_option(self::OPTION, wp_hash_password($token), false);

        return $token;
    }

    public static function revoke(): void
    {
        delete_option(self::OPTION);
    }

    public static function exists(): bool
    {
        return '' !== (string) get_option(self::OPTION, '');
    }

    public static function verify(string $token): bool
    {
        $hash = (string) get_option(self::OPTION, '');

        return '' !== $hash && '' !== $token && wp_check_password($token, $hash);
    }
}

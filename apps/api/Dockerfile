FROM php:8.3-cli-alpine

RUN apk add --no-cache postgresql-dev \
    && docker-php-ext-install pdo_pgsql \
    && apk add --no-cache --virtual .build-deps linux-headers $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-progress

COPY apps/api/ ./
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data
EXPOSE 8080
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-8080}"]

FROM php:8.3-fpm-alpine
RUN apk add --no-cache postgresql-dev linux-headers $PHPIZE_DEPS && docker-php-ext-install pdo_pgsql && pecl install redis && docker-php-ext-enable redis && apk del $PHPIZE_DEPS linux-headers
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY composer.json ./
RUN composer install --no-interaction --prefer-dist --no-scripts
COPY . .
RUN composer dump-autoload --optimize && chown -R www-data:www-data storage bootstrap/cache
CMD ["php-fpm"]

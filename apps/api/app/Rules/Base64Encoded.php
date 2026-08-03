<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class Base64Encoded implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || base64_decode($value, true) === false) {
            $fail("The {$attribute} field must be valid Base64.");
        }
    }
}

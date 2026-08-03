<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidUtf8 implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || preg_match('//u', $value) !== 1) {
            $fail("The {$attribute} field must contain valid UTF-8 text.");
        }
    }
}

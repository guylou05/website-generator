<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGenerationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['input' => ['required', 'array'], 'input.businessName' => ['required', 'string'], 'provider' => ['sometimes', 'in:mock,openai']];
    }
}

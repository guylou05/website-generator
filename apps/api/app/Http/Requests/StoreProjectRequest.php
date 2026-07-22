<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:255'], 'slug' => ['nullable', 'string', 'max:255', 'unique:projects,slug'], 'status' => ['sometimes', 'in:draft,generating,ready,failed,cancelled'], 'business_profile' => ['required', 'array'], 'brand_settings' => ['nullable', 'array']];
    }
}

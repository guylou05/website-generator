<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['name' => ['sometimes', 'required', 'string', 'max:255'], 'slug' => ['sometimes', 'string', 'max:255', Rule::unique('projects')->ignore($this->route('project'))], 'status' => ['sometimes', 'in:draft,generating,ready,failed,cancelled'], 'business_profile' => ['sometimes', 'required', 'array'], 'brand_settings' => ['nullable', 'array']];
    }
}

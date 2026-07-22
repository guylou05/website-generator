<?php

namespace App\Http\Controllers;

use App\Services\StripeWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StripeWebhookController extends Controller
{
    public function __invoke(Request $request, StripeWebhookService $service): JsonResponse
    {
        $processed = $service->handle($request->getContent(), (string) $request->header('Stripe-Signature'));

        return response()->json(['received' => true, 'processed' => $processed]);
    }
}
